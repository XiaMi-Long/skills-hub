//! 远程技能获取:解析 `npx skills add ...` 命令或 GitHub 仓库链接,
//! 通过 GitHub API 列出仓库内技能、下载技能文件到内存缓存,供安装到目标 agent。
//!
//! 流程:list_remote_skills(解析+列技能)→ fetch_remote_skill(下载+缓存)→
//! commands::install_remote_skill(从缓存写入目标目录)。

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use reqwest::Client as HttpClient;
use serde::Serialize;
use serde_json::Value;

use crate::error::{AppError, AppResult};
use crate::frontmatter::parse_skill_md;

/// 单文件下载上限,超过则跳过并记入 skipped。
pub const MAX_FILE_BYTES: usize = 20 * 1024 * 1024;
/// 列表页最多读取 frontmatter 的技能数(防御超大仓库逐个下载)。
const MAX_LIST_SKILLS: usize = 60;
/// 内存缓存最多保留几次 fetch 结果。
const MAX_CACHE_ENTRIES: usize = 8;

const UA: &str = "skills-hub/0.1";

// ---- 命令解析 ----

/// 解析结果:GitHub 仓库定位 + 可选 ref/子路径/--skill 提示。
#[derive(Debug, Clone, PartialEq)]
pub struct ParsedSource {
    pub owner: String,
    pub repo: String,
    /// 分支/tag/commit;URL 带 /tree/<ref> 时有值,否则由 API 取默认分支。
    pub git_ref: Option<String>,
    /// 仓库内子路径(owner/repo/sub 或 /tree/ref/sub)。
    pub subpath: Option<String>,
    /// `--skill <name>` 的值。
    pub skill_hint: Option<String>,
}

/// 解析 `npx skills add <source> [--skill <name>]` 这类命令。
/// 容错:也接受裸链接/owner/repo(无 npx/skills/add 前缀)、`--skill=name` 写法;
/// 其余 flag(-y、--agent 等)忽略。
pub fn parse_add_command(input: &str) -> Result<ParsedSource, String> {
    let tokens: Vec<&str> = input.split_whitespace().collect();
    if tokens.is_empty() {
        return Err("请输入安装命令或 GitHub 仓库地址".into());
    }

    // 定位参数起点:`skills add|install` 之后的部分;首个 token 就是 add/install 也认。
    let mut start = 0;
    let first = tokens[0].to_ascii_lowercase();
    if first == "add" || first == "install" {
        start = 1;
    } else {
        for i in 1..tokens.len() {
            let t = tokens[i].to_ascii_lowercase();
            if (t == "add" || t == "install") && tokens[i - 1].to_ascii_lowercase().contains("skills") {
                start = i + 1;
                break;
            }
        }
    }

    let mut source: Option<String> = None;
    let mut skill_hint: Option<String> = None;
    // 需要跟一个值的已知 flag(值不是 source);未列出的 flag 按布尔跳过。
    const FLAGS_WITH_VALUE: [&str; 7] = ["--agent", "-a", "--dir", "-d", "--branch", "-b", "--source"];

    let mut i = start;
    while i < tokens.len() {
        let t = tokens[i];
        if t == "--skill" {
            skill_hint = tokens.get(i + 1).map(|s| s.to_string()).filter(|s| !s.starts_with('-'));
            i += 2;
            continue;
        }
        if let Some(v) = t.strip_prefix("--skill=") {
            if !v.is_empty() {
                skill_hint = Some(v.to_string());
            }
            i += 1;
            continue;
        }
        if t.starts_with('-') {
            let name_part = t.split('=').next().unwrap_or(t);
            if FLAGS_WITH_VALUE.contains(&name_part) && !t.contains('=') {
                i += 2; // 连同值一起跳过
            } else {
                i += 1;
            }
            continue;
        }
        if source.is_none() {
            source = Some(t.to_string());
        }
        i += 1;
    }

    let source = source
        .ok_or_else(|| "未找到仓库来源,示例:npx skills add owner/repo --skill my-skill".to_string())?;
    parse_source(&source, skill_hint)
}

/// 把来源字符串解析成 owner/repo/ref/subpath。
/// 支持:https://github.com/o/r(.git)?(/tree|blob/ref/sub...)?、git@github.com:o/r.git、o/r(/sub)?。
fn parse_source(source: &str, skill_hint: Option<String>) -> Result<ParsedSource, String> {
    let s = source
        .trim()
        .trim_end_matches('/')
        .trim_end_matches(".git")
        .trim_end_matches('/');
    if s.is_empty() {
        return Err("仓库来源为空".into());
    }

    let path_part: String = if let Some(rest) = s.strip_prefix("git@github.com:") {
        rest.to_string()
    } else if s.contains("://") || s.starts_with("github.com") || s.starts_with("www.github.com") {
        let no_scheme = s.rsplit("://").next().unwrap_or(s);
        let stripped = no_scheme
            .strip_prefix("www.github.com/")
            .or_else(|| no_scheme.strip_prefix("github.com/"));
        match stripped {
            Some(p) => p.to_string(),
            None => return Err("仅支持 github.com 仓库链接".into()),
        }
    } else {
        s.to_string()
    };

    let segs: Vec<&str> = path_part.split('/').filter(|x| !x.is_empty()).collect();
    if segs.len() < 2 {
        return Err("无法识别仓库,需要 owner/repo 或完整 GitHub 链接".into());
    }
    let owner = segs[0].to_string();
    let repo = segs[1].to_string();
    validate_segment(&owner)?;
    validate_segment(&repo)?;

    let mut git_ref = None;
    let mut subpath: Option<String> = None;
    if segs.len() > 2 {
        if segs[2] == "tree" || segs[2] == "blob" {
            if segs.len() < 4 {
                return Err("链接缺少分支名(/tree/<branch>)".into());
            }
            git_ref = Some(segs[3].to_string());
            if segs.len() > 4 {
                let p = segs[4..].join("/");
                if segs[2] == "blob" {
                    if p.ends_with("/SKILL.md") || p == "SKILL.md" {
                        // 指向 SKILL.md 文件本身 → 取其所在目录
                        subpath = Some(p.trim_end_matches("SKILL.md").trim_end_matches('/').to_string());
                    } else {
                        return Err("链接指向单个文件,请指向包含 SKILL.md 的技能目录".into());
                    }
                } else {
                    subpath = Some(p);
                }
            }
        } else {
            subpath = Some(segs[2..].join("/"));
        }
    }

    Ok(ParsedSource {
        owner,
        repo,
        git_ref,
        subpath,
        skill_hint,
    })
}

/// GitHub 路径段只允许字母数字与 -_.(防注入 URL)。
fn validate_segment(s: &str) -> Result<(), String> {
    if s.is_empty()
        || !s
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err(format!("无效的仓库路径段: {s}"));
    }
    Ok(())
}

/// ref 会拼进 URL:允许分支名常见的字符集(含 /,如 feature/x)。
pub fn validate_ref(r: &str) -> Result<(), String> {
    if r.is_empty()
        || r.starts_with('/')
        || r.contains("..")
        || !r.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | '/'))
    {
        return Err(format!("无效的分支/ref: {r}"));
    }
    Ok(())
}

/// 相对路径安全拼接:拒绝绝对路径、`..`、反斜杠、盘符,防目录穿越。
pub fn safe_join(base: &Path, rel: &str) -> Result<PathBuf, String> {
    if rel.is_empty() || rel.starts_with('/') || rel.contains('\\') {
        return Err(format!("非法文件路径: {rel}"));
    }
    let mut out = base.to_path_buf();
    for part in rel.split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." || part.contains(':') {
            return Err(format!("非法文件路径: {rel}"));
        }
        out.push(part);
    }
    if !out.starts_with(base) {
        return Err(format!("非法文件路径: {rel}"));
    }
    Ok(out)
}

// ---- 数据结构 ----

#[derive(Debug, Clone, Serialize)]
pub struct RemoteSkillInfo {
    /// 技能目录相对仓库根的路径;空串 = 仓库根即技能。
    pub dir: String,
    /// frontmatter name,缺则目录名(根技能取仓库名)。
    pub name: String,
    pub description: String,
    /// 除 SKILL.md 外的文件数。
    pub file_count: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct RemoteRepoInfo {
    pub owner: String,
    pub repo: String,
    pub git_ref: String,
    pub skills: Vec<RemoteSkillInfo>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RemoteFileMeta {
    /// 相对技能目录的路径。
    pub path: String,
    pub size: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct FetchedSkillMeta {
    /// 安装时凭此 id 从内存缓存取文件。
    pub fetch_id: String,
    pub owner: String,
    pub repo: String,
    pub git_ref: String,
    pub dir: String,
    pub name: String,
    pub description: String,
    /// SKILL.md 去掉 frontmatter 后的正文。
    pub body: String,
    /// SKILL.md 原文(AI 解读用)。
    pub skill_md_raw: String,
    pub files: Vec<RemoteFileMeta>,
    /// 下载失败/过大被跳过的文件说明。
    pub skipped: Vec<String>,
}

// ---- 内存缓存(fetch 结果,安装时消费) ----

struct CachedSkill {
    files: Vec<(String, Vec<u8>)>,
    fetched_at: i64,
}

#[derive(Default)]
pub struct RemoteState {
    cache: Mutex<HashMap<String, CachedSkill>>,
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

impl RemoteState {
    pub fn insert(&self, id: String, files: Vec<(String, Vec<u8>)>) {
        let mut cache = self.cache.lock().unwrap();
        if cache.len() >= MAX_CACHE_ENTRIES {
            // 淘汰最旧一条
            if let Some(oldest) = cache
                .iter()
                .min_by_key(|(_, v)| v.fetched_at)
                .map(|(k, _)| k.clone())
            {
                cache.remove(&oldest);
            }
        }
        cache.insert(
            id,
            CachedSkill {
                files,
                fetched_at: now_secs(),
            },
        );
    }

    /// 取出并移除缓存(安装是一次性消费)。
    pub fn take(&self, id: &str) -> Option<Vec<(String, Vec<u8>)>> {
        self.cache.lock().unwrap().remove(id).map(|c| c.files)
    }
}

// ---- GitHub HTTP ----

fn gh_client() -> AppResult<HttpClient> {
    HttpClient::builder()
        .user_agent(UA)
        .connect_timeout(Duration::from_secs(20))
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|e| AppError::Remote(format!("HTTP 客户端构造失败: {e}")))
}

async fn gh_api_json(client: &HttpClient, url: &str) -> AppResult<Value> {
    let resp = client
        .get(url)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| AppError::Remote(format!("请求 GitHub 失败: {e}")))?;
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        let msg = serde_json::from_str::<Value>(&body)
            .ok()
            .and_then(|v| v["message"].as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| body.chars().take(200).collect());
        let hint = match status.as_u16() {
            404 => "(仓库不存在或为私有)",
            403 | 429 => "(可能触发 GitHub API 限流,稍后再试)",
            _ => "",
        };
        return Err(AppError::Remote(format!(
            "GitHub 请求失败({status}){hint}: {msg}"
        )));
    }
    resp.json()
        .await
        .map_err(|e| AppError::Remote(format!("GitHub 响应解析失败: {e}")))
}

/// 百分号编码 URL 路径(保留 /),处理中文/空格等非 ASCII 文件名。
fn encode_uri_path(path: &str) -> String {
    let mut out = String::with_capacity(path.len());
    for b in path.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

async fn fetch_raw_bytes(
    client: &HttpClient,
    owner: &str,
    repo: &str,
    git_ref: &str,
    path: &str,
) -> AppResult<Vec<u8>> {
    let url = format!(
        "https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}",
        ref = encode_uri_path(git_ref),
        path = encode_uri_path(path)
    );
    let resp = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::Remote(format!("下载 {path} 失败: {e}")))?;
    let status = resp.status();
    if !status.is_success() {
        return Err(AppError::Remote(format!("下载 {path} 失败({status})")));
    }
    resp.bytes()
        .await
        .map(|b| b.to_vec())
        .map_err(|e| AppError::Remote(format!("读取 {path} 响应失败: {e}")))
}

async fn resolve_ref(client: &HttpClient, src: &ParsedSource) -> AppResult<String> {
    if let Some(r) = &src.git_ref {
        validate_ref(r).map_err(AppError::Remote)?;
        return Ok(r.clone());
    }
    let v = gh_api_json(
        client,
        &format!("https://api.github.com/repos/{}/{}", src.owner, src.repo),
    )
    .await?;
    v["default_branch"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| AppError::Remote("无法读取仓库默认分支".into()))
}

/// 递归拉取文件树,返回 (path, 是否 blob)。
async fn fetch_tree(
    client: &HttpClient,
    owner: &str,
    repo: &str,
    git_ref: &str,
) -> AppResult<Vec<(String, bool)>> {
    let url = format!(
        "https://api.github.com/repos/{owner}/{repo}/git/trees/{ref}?recursive=1",
        ref = encode_uri_path(git_ref)
    );
    let v = gh_api_json(client, &url).await?;
    if v["truncated"].as_bool() == Some(true) {
        return Err(AppError::Remote(
            "仓库文件过多,GitHub 返回被截断,请用更具体的路径".into(),
        ));
    }
    Ok(v["tree"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|e| {
                    let path = e["path"].as_str()?.to_string();
                    let is_blob = e["type"].as_str() == Some("blob");
                    Some((path, is_blob))
                })
                .collect()
        })
        .unwrap_or_default())
}

/// 所有含 SKILL.md 的目录("" = 仓库根)。
fn find_skill_dirs(entries: &[(String, bool)]) -> Vec<String> {
    let mut dirs: Vec<String> = entries
        .iter()
        .filter(|(p, is_blob)| *is_blob && (p == "SKILL.md" || p.ends_with("/SKILL.md")))
        .map(|(p, _)| {
            p.trim_end_matches("SKILL.md")
                .trim_end_matches('/')
                .to_string()
        })
        .collect();
    dirs.sort();
    dirs.dedup();
    dirs
}

/// 技能目录下的可下载文件(相对路径):不含自身 SKILL.md,不含嵌套技能子树。
/// 仓库根技能额外排除常见仓库元文件(.github/LICENSE/README 等)。
fn files_under(entries: &[(String, bool)], dir: &str, skill_dirs: &[String]) -> Vec<String> {
    let prefix = if dir.is_empty() {
        String::new()
    } else {
        format!("{dir}/")
    };
    let mut out = Vec::new();
    for (p, is_blob) in entries {
        if !is_blob || !p.starts_with(&prefix) {
            continue;
        }
        let rel = &p[prefix.len()..];
        if rel == "SKILL.md" || rel.is_empty() {
            continue;
        }
        // 嵌套技能是独立技能,整棵子树排除
        if skill_dirs.iter().any(|d| d != dir && p.starts_with(&format!("{d}/"))) {
            continue;
        }
        if dir.is_empty() {
            let lower = rel.to_ascii_lowercase();
            if lower.starts_with(".git")
                || lower.starts_with(".github/")
                || lower.starts_with("license")
                || lower.starts_with("readme")
                || lower.starts_with("changelog")
                || lower.starts_with("contributing")
            {
                continue;
            }
        }
        out.push(rel.to_string());
    }
    out.sort();
    out
}

// ---- 对外两个核心步骤 ----

/// 解析来源并列出仓库内全部技能(读取每个 SKILL.md 的 frontmatter)。
pub async fn list_remote_skills(source_cmd: &str) -> AppResult<RemoteRepoInfo> {
    let src = parse_add_command(source_cmd).map_err(AppError::Remote)?;
    let client = gh_client()?;
    let git_ref = resolve_ref(&client, &src).await?;
    let entries = fetch_tree(&client, &src.owner, &src.repo, &git_ref).await?;

    let mut skill_dirs = find_skill_dirs(&entries);
    // 来源带子路径:只保留该目录本身或其下的技能
    if let Some(sp) = &src.subpath {
        let sp = sp.trim_matches('/');
        skill_dirs.retain(|d| d == sp || d.starts_with(&format!("{sp}/")));
    }
    if skill_dirs.is_empty() {
        return Err(AppError::Remote(match &src.subpath {
            Some(sp) => format!("未在 {}/{} 的 {} 下找到 SKILL.md", src.owner, src.repo, sp),
            None => format!("仓库 {}/{} 中未找到任何 SKILL.md", src.owner, src.repo),
        }));
    }
    if skill_dirs.len() > MAX_LIST_SKILLS {
        skill_dirs.truncate(MAX_LIST_SKILLS);
    }

    let mut skills = Vec::with_capacity(skill_dirs.len());
    for dir in &skill_dirs {
        let md_path = if dir.is_empty() {
            "SKILL.md".to_string()
        } else {
            format!("{dir}/SKILL.md")
        };
        // 单个 SKILL.md 读失败不中断,降级为空 frontmatter
        let raw = match fetch_raw_bytes(&client, &src.owner, &src.repo, &git_ref, &md_path).await {
            Ok(b) => String::from_utf8_lossy(&b).into_owned(),
            Err(_) => String::new(),
        };
        let fm = parse_skill_md(&raw);
        let fallback_name = if dir.is_empty() {
            src.repo.clone()
        } else {
            dir.rsplit('/').next().unwrap_or(dir).to_string()
        };
        skills.push(RemoteSkillInfo {
            dir: dir.clone(),
            name: fm.name.unwrap_or(fallback_name),
            description: fm.description.unwrap_or_default(),
            file_count: files_under(&entries, dir, &skill_dirs).len() as u32,
        });
    }

    Ok(RemoteRepoInfo {
        owner: src.owner,
        repo: src.repo,
        git_ref,
        skills,
    })
}

/// 下载某个技能的全部文件,字节存入 RemoteState 缓存,返回元信息给前端预览。
pub async fn fetch_remote_skill(
    state: &RemoteState,
    owner: &str,
    repo: &str,
    git_ref: &str,
    dir: &str,
) -> AppResult<FetchedSkillMeta> {
    validate_segment(owner).map_err(AppError::Remote)?;
    validate_segment(repo).map_err(AppError::Remote)?;
    validate_ref(git_ref).map_err(AppError::Remote)?;
    if dir.contains("..") || dir.starts_with('/') || dir.contains('\\') {
        return Err(AppError::Remote(format!("非法技能目录: {dir}")));
    }

    let client = gh_client()?;
    let entries = fetch_tree(&client, owner, repo, git_ref).await?;
    let skill_dirs = find_skill_dirs(&entries);
    if !skill_dirs.iter().any(|d| d == dir) {
        return Err(AppError::Remote("该目录下没有 SKILL.md".into()));
    }

    let md_path = if dir.is_empty() {
        "SKILL.md".to_string()
    } else {
        format!("{dir}/SKILL.md")
    };
    let raw_bytes = fetch_raw_bytes(&client, owner, repo, git_ref, &md_path).await?;
    let skill_md_raw = String::from_utf8_lossy(&raw_bytes).into_owned();
    let fm = parse_skill_md(&skill_md_raw);

    let prefix = if dir.is_empty() {
        String::new()
    } else {
        format!("{dir}/")
    };
    let fallback_name = if dir.is_empty() {
        repo.to_string()
    } else {
        dir.rsplit('/').next().unwrap_or(dir).to_string()
    };

    let mut files: Vec<(String, Vec<u8>)> = Vec::new();
    let mut metas: Vec<RemoteFileMeta> = Vec::new();
    let mut skipped: Vec<String> = Vec::new();
    for rel in files_under(&entries, dir, &skill_dirs) {
        let full = format!("{prefix}{rel}");
        match fetch_raw_bytes(&client, owner, repo, git_ref, &full).await {
            Ok(b) if b.len() > MAX_FILE_BYTES => {
                skipped.push(format!("{rel}(超过大小上限,已跳过)"));
            }
            Ok(b) => {
                metas.push(RemoteFileMeta {
                    path: rel.clone(),
                    size: b.len(),
                });
                files.push((rel, b));
            }
            Err(e) => skipped.push(format!("{e}")),
        }
    }

    let fetch_id = uuid::Uuid::new_v4().to_string();
    state.insert(fetch_id.clone(), files);

    Ok(FetchedSkillMeta {
        fetch_id,
        owner: owner.to_string(),
        repo: repo.to_string(),
        git_ref: git_ref.to_string(),
        dir: dir.to_string(),
        name: fm.name.unwrap_or(fallback_name),
        description: fm.description.unwrap_or_default(),
        body: fm.body.trim_start().to_string(),
        skill_md_raw,
        files: metas,
        skipped,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_full_npx_command() {
        let p =
            parse_add_command("npx skills add https://github.com/humanlayer/skills --skill show-me")
                .unwrap();
        assert_eq!(p.owner, "humanlayer");
        assert_eq!(p.repo, "skills");
        assert_eq!(p.git_ref, None);
        assert_eq!(p.subpath, None);
        assert_eq!(p.skill_hint.as_deref(), Some("show-me"));
    }

    #[test]
    fn parses_owner_repo_with_flags() {
        let p = parse_add_command("npx skills add owner/repo -y --agent claude-code").unwrap();
        assert_eq!(p.owner, "owner");
        assert_eq!(p.repo, "repo");
        assert_eq!(p.skill_hint, None);
    }

    #[test]
    fn parses_skill_equals_form() {
        let p = parse_add_command("skills add a/b --skill=demo").unwrap();
        assert_eq!(p.skill_hint.as_deref(), Some("demo"));
    }

    #[test]
    fn parses_bare_url_without_prefix() {
        let p = parse_add_command("https://github.com/vercel-labs/skills.git").unwrap();
        assert_eq!(p.owner, "vercel-labs");
        assert_eq!(p.repo, "skills");
    }

    #[test]
    fn parses_tree_url_with_ref_and_subpath() {
        let p = parse_add_command("npx skills add https://github.com/o/r/tree/main/some/dir").unwrap();
        assert_eq!(p.git_ref.as_deref(), Some("main"));
        assert_eq!(p.subpath.as_deref(), Some("some/dir"));
    }

    #[test]
    fn parses_blob_url_to_skill_md_dir() {
        let p = parse_add_command("npx skills add https://github.com/o/r/blob/main/x/SKILL.md").unwrap();
        assert_eq!(p.git_ref.as_deref(), Some("main"));
        assert_eq!(p.subpath.as_deref(), Some("x"));
    }

    #[test]
    fn parses_git_ssh_form() {
        let p = parse_add_command("npx skills add git@github.com:o/r.git").unwrap();
        assert_eq!(p.owner, "o");
        assert_eq!(p.repo, "r");
    }

    #[test]
    fn parses_owner_repo_subpath() {
        let p = parse_add_command("npx skills add humanlayer/skills/show-me").unwrap();
        assert_eq!(p.subpath.as_deref(), Some("show-me"));
    }

    #[test]
    fn rejects_non_github_and_empty() {
        assert!(parse_add_command("npx skills add https://gitlab.com/o/r").is_err());
        assert!(parse_add_command("").is_err());
        assert!(parse_add_command("npx skills add").is_err());
        assert!(parse_add_command("npx skills add onlyowner").is_err());
    }

    #[test]
    fn find_skill_dirs_root_and_nested() {
        let entries = vec![
            ("SKILL.md".into(), true),
            ("a/SKILL.md".into(), true),
            ("a/b/SKILL.md".into(), true),
            ("a/other.txt".into(), true),
            ("nope.md".into(), true),
        ];
        assert_eq!(find_skill_dirs(&entries), vec!["", "a", "a/b"]);
    }

    #[test]
    fn files_under_excludes_nested_skill_and_meta() {
        let entries = vec![
            ("SKILL.md".into(), true),
            ("scripts/run.sh".into(), true),
            ("sub/SKILL.md".into(), true),
            ("sub/inner.md".into(), true),
            ("README.md".into(), true),
            (".github/workflows/ci.yml".into(), true),
        ];
        // 根技能:排除自身 SKILL.md、嵌套技能 sub 子树、README、.github
        assert_eq!(files_under(&entries, "", &["".into(), "sub".into()]), vec!["scripts/run.sh"]);
        // 嵌套技能 sub:只有 inner.md
        assert_eq!(files_under(&entries, "sub", &["".into(), "sub".into()]), vec!["inner.md"]);
    }

    #[test]
    fn safe_join_rejects_traversal() {
        let base = Path::new("C:/skills");
        assert!(safe_join(base, "a/b.txt").is_ok());
        assert!(safe_join(base, "../evil").is_err());
        assert!(safe_join(base, "a/../b").is_err());
        assert!(safe_join(base, "/abs").is_err());
        assert!(safe_join(base, "a\\b").is_err());
        assert!(safe_join(base, "c:/drive").is_err());
        assert!(safe_join(base, "").is_err());
    }

    #[test]
    fn cache_take_is_one_shot() {
        let state = RemoteState::default();
        state.insert("id1".into(), vec![("a.txt".into(), vec![1, 2, 3])]);
        assert!(state.take("id1").is_some());
        assert!(state.take("id1").is_none());
    }
}
