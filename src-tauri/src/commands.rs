use std::collections::HashMap;
use std::fs;
use std::sync::atomic::Ordering;
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;

use crate::agents::AgentId;
use crate::error::{AppError, AppResult};
use crate::llm;
use crate::remote;
use crate::scanner::{agent_base_dir, build_instance, find_agent_instance};
use crate::settings::{DeepseekSettings, Settings, SettingsStore};
use crate::skill::{group_key, DeleteScope, SkillInstance, SyncDirective};
use crate::sync::sync_one;

fn store(app: &AppHandle) -> SettingsStore {
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    SettingsStore::new(dir)
}

/// 读取磁盘后重建 instance(写回类命令用)。
fn rebuild_instance(agent_id: AgentId, abs_path: std::path::PathBuf, fallback: &str) -> SkillInstance {
    let dirname = abs_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| fallback.to_string());
    build_instance(agent_id, abs_path, dirname)
}

/// 用 serde_yaml 输出安全的 YAML 标量(引号/转义)。
fn yaml_scalar(s: &str) -> String {
    serde_yaml::to_string(s)
        .map(|mut v| {
            if v.ends_with('\n') {
                v.pop();
            }
            v
        })
        .unwrap_or_else(|_| format!("\"{}\"", s.replace('"', "\\\"")))
}

#[derive(Serialize)]
pub struct ReadSkillResult {
    pub instance: SkillInstance,
    pub raw: String,
}

#[derive(Serialize)]
pub struct CreateSkillResult {
    pub results: Vec<(AgentId, Result<SkillInstance, String>)>,
}

#[derive(Serialize)]
pub struct SyncSkillResult {
    pub results: Vec<(AgentId, Result<(), String>)>,
}

#[derive(Serialize)]
pub struct TestDeepseekResult {
    pub ok: bool,
    pub message: String,
}

#[derive(Serialize)]
pub struct TranslateResult {
    pub cached: bool,
    pub text: Option<String>,
    pub request_id: String,
}

#[derive(Serialize)]
pub struct CheckTranslationResult {
    pub status: String,
    pub text: Option<String>,
}

#[derive(Serialize)]
pub struct TranslateAllStart {
    pub total: u32,
}

#[derive(Serialize)]
pub struct CountReplaceableResult {
    pub total: u32,
    pub replaceable: u32,
}

#[derive(Serialize)]
pub struct ReplaceAllResult {
    pub replaced: u32,
    pub skipped: u32,
    pub failed: u32,
    pub errors: Vec<llm::BatchErrorItem>,
}

// ---- 扫描 ----

#[tauri::command]
pub fn scan_all(app: AppHandle) -> AppResult<crate::skill::ScanResult> {
    let settings = store(&app).load();
    Ok(crate::scanner::scan_all(&settings))
}

// ---- 读取 ----

#[tauri::command]
pub fn read_skill_md(
    app: AppHandle,
    agent_id: AgentId,
    skill_name: String,
) -> AppResult<ReadSkillResult> {
    let settings = store(&app).load();
    let instance = find_agent_instance(&settings, agent_id, &skill_name)
        .ok_or_else(|| AppError::NotFound(format!("{} / {}", agent_id.display(), skill_name)))?;
    let skill_md = instance.abs_path.join("SKILL.md");
    if !skill_md.exists() {
        return Err(AppError::NotFound(format!(
            "{} / {} 没有 SKILL.md",
            agent_id.display(),
            skill_name
        )));
    }
    let (raw, ok) = crate::frontmatter::read_skill_md_lossy(&skill_md);
    if !ok {
        return Err(AppError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            "SKILL.md 读取失败",
        )));
    }
    Ok(ReadSkillResult { instance, raw })
}

// ---- 写入 ----

#[tauri::command]
pub fn write_skill_md(
    app: AppHandle,
    agent_id: AgentId,
    skill_name: String,
    raw: String,
    loaded_mtime: i64,
    force: bool,
) -> AppResult<SkillInstance> {
    let settings = store(&app).load();
    let instance = find_agent_instance(&settings, agent_id, &skill_name)
        .ok_or_else(|| AppError::NotFound(format!("{} / {}", agent_id.display(), skill_name)))?;
    let skill_md = instance.abs_path.join("SKILL.md");

    // 陈旧检测:磁盘 mtime ≠ loaded_mtime → FileChangedOnDisk(force 跳过)
    if !force {
        let disk_mtime = fs::metadata(&skill_md)
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        if disk_mtime != loaded_mtime {
            return Err(AppError::FileChangedOnDisk);
        }
    }

    fs::write(&skill_md, raw.as_bytes()).map_err(|e| AppError::Io(e))?;

    Ok(rebuild_instance(agent_id, instance.abs_path, &skill_name))
}

// ---- 新建 ----

#[tauri::command]
pub fn create_skill(
    app: AppHandle,
    name: String,
    description: String,
    body_md: String,
    targets: Vec<AgentId>,
    overwrite: bool,
) -> AppResult<CreateSkillResult> {
    let settings = store(&app).load();
    let mut results: Vec<(AgentId, Result<SkillInstance, String>)> = Vec::new();

    for target in targets {
        let base = agent_base_dir(&settings, target);
        let dir = base.join(&name);
        let out = (|| -> Result<SkillInstance, String> {
            if dir.exists() && !overwrite {
                return Err(format!("{} 已存在同名技能", target.display()));
            }
            fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
            let fm = format!(
                "---\nname: {}\ndescription: {}\n---\n\n",
                yaml_scalar(&name),
                yaml_scalar(&description)
            );
            fs::write(dir.join("SKILL.md"), format!("{fm}{body_md}")).map_err(|e| e.to_string())?;
            Ok(build_instance(target, dir, name.clone()))
        })();
        results.push((target, out));
    }

    Ok(CreateSkillResult { results })
}

// ---- 删除 ----

#[tauri::command]
pub fn delete_skill(
    app: AppHandle,
    agent_id: AgentId,
    skill_name: String,
    scope: DeleteScope,
) -> AppResult<()> {
    let settings = store(&app).load();
    let key = group_key(&skill_name);

    let agents: Vec<AgentId> = match scope {
        DeleteScope::ThisCopy => vec![agent_id],
        DeleteScope::AllCopies => crate::agents::AGENTS.iter().map(|m| m.id).collect(),
    };

    let mut removed_any = false;
    for agent in agents {
        if let Some(instance) = find_agent_instance(&settings, agent, &key) {
            if group_key(&instance.name) == key {
                fs::remove_dir_all(&instance.abs_path).map_err(|e| AppError::Io(e))?;
                removed_any = true;
            }
        }
    }
    if !removed_any {
        return Err(AppError::NotFound(format!(
            "{} / {} 不存在",
            agent_id.display(),
            skill_name
        )));
    }
    Ok(())
}

// ---- 同步 ----

#[tauri::command]
pub fn sync_skill(
    app: AppHandle,
    source_agent: AgentId,
    skill_name: String,
    directives: Vec<SyncDirective>,
) -> AppResult<SyncSkillResult> {
    let settings = store(&app).load();
    let source = find_agent_instance(&settings, source_agent, &skill_name);

    let mut results: Vec<(AgentId, Result<(), String>)> = Vec::new();
    for d in directives {
        let out = (|| -> Result<(), String> {
            let src = match &source {
                Some(s) => s.abs_path.clone(),
                None => {
                    return Err(format!(
                        "源副本不存在: {} / {}",
                        source_agent.display(),
                        skill_name
                    ))
                }
            };
            let target_base = agent_base_dir(&settings, d.target);
            if !target_base.exists() {
                return Err(format!(
                    "目标目录不存在: {}",
                    crate::error::display_path(&target_base)
                ));
            }
            sync_one(&src, &target_base, d.on_conflict).map(|_| ())
        })();
        results.push((d.target, out));
    }

    Ok(SyncSkillResult { results })
}

// ---- 资源管理器 ----

/// 打开资源管理器定位到技能目录:SKILL.md 存在则打开目录并选中该文件,否则直接打开目录。
/// 用 opener 插件(内部走 Win32 SHOpenFolderAndSelectItems),避免手工调 explorer.exe
/// /select 参数在路径含空格/特殊字符时的解析问题。
#[tauri::command]
pub fn reveal_in_explorer(app: AppHandle, agent_id: AgentId, skill_name: String) -> AppResult<()> {
    let settings = store(&app).load();
    let instance = find_agent_instance(&settings, agent_id, &skill_name)
        .ok_or_else(|| AppError::NotFound(format!("{} / {}", agent_id.display(), skill_name)))?;
    let skill_md = instance.abs_path.join("SKILL.md");
    if skill_md.exists() {
        app.opener()
            .reveal_item_in_dir(skill_md)
            .map_err(|e| AppError::Internal(format!("打开资源管理器失败: {e}")))?;
    } else {
        app.opener()
            .open_path(instance.abs_path.to_string_lossy().into_owned(), None::<&str>)
            .map_err(|e| AppError::Internal(format!("打开资源管理器失败: {e}")))?;
    }
    Ok(())
}

// ---- 设置 ----

#[tauri::command]
pub fn get_settings(app: AppHandle) -> AppResult<Settings> {
    Ok(store(&app).load())
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Settings) -> AppResult<()> {
    store(&app).save(&settings)
}

/// 返回某 agent 的 skills 基目录(覆盖优先,否则 home/默认子路径),供浏览对话框定位初始目录。
#[tauri::command]
pub fn get_agent_dir(app: AppHandle, agent_id: AgentId) -> AppResult<String> {
    let settings = store(&app).load();
    Ok(agent_base_dir(&settings, agent_id)
        .to_string_lossy()
        .into_owned())
}

// ---- 翻译 ----

/// 纯查缓存:hit=当前内容有译文;stale=文件已变,返回旧译文;none=从未翻译。
#[tauri::command]
pub fn check_translation(
    app: AppHandle,
    agent_id: AgentId,
    skill_name: String,
) -> AppResult<CheckTranslationResult> {
    let settings = store(&app).load();
    let instance = find_agent_instance(&settings, agent_id, &skill_name)
        .ok_or_else(|| AppError::NotFound(format!("{} / {}", agent_id.display(), skill_name)))?;
    let skill_md = instance.abs_path.join("SKILL.md");
    if !skill_md.exists() {
        return Err(AppError::NotFound(format!(
            "{} / {} 没有 SKILL.md",
            agent_id.display(),
            skill_name
        )));
    }
    let (status, text) = llm::check_translation(&app, &settings.deepseek, &skill_md)?;
    Ok(CheckTranslationResult {
        status: status.as_str().into(),
        text,
    })
}

#[tauri::command]
pub async fn translate_skill(
    app: AppHandle,
    agent_id: AgentId,
    skill_name: String,
) -> AppResult<TranslateResult> {
    let settings = store(&app).load();
    let ds: DeepseekSettings = settings.deepseek.clone();
    if ds.api_key.trim().is_empty() {
        return Err(AppError::Llm("未配置 DeepSeek API Key,请在设置中配置".into()));
    }
    let instance = find_agent_instance(&settings, agent_id, &skill_name)
        .ok_or_else(|| AppError::NotFound(format!("{} / {}", agent_id.display(), skill_name)))?;
    let skill_md = instance.abs_path.join("SKILL.md");
    if !skill_md.exists() {
        return Err(AppError::NotFound(format!(
            "{} / {} 没有 SKILL.md",
            agent_id.display(),
            skill_name
        )));
    }

    // 命中缓存直接返回;过期/无缓存 → 流式重译
    if let (llm::TranslationStatus::Hit, Some(text)) =
        llm::check_translation(&app, &ds, &skill_md)?
    {
        return Ok(TranslateResult {
            cached: true,
            text: Some(text),
            request_id: String::new(),
        });
    }

    let request_id = uuid::Uuid::new_v4().to_string();
    let app2 = app.clone();
    let rid = request_id.clone();
    tauri::async_runtime::spawn(async move {
        llm::stream_translation_task(app2, rid, skill_md, ds).await;
    });

    Ok(TranslateResult {
        cached: false,
        text: None,
        request_id,
    })
}

/// 用译文替换原文:写回 SKILL.md(带陈旧检测),并把译文登记为当前内容的缓存。
#[tauri::command]
pub fn replace_with_translation(
    app: AppHandle,
    agent_id: AgentId,
    skill_name: String,
    translated_raw: String,
    loaded_mtime: i64,
    force: bool,
) -> AppResult<SkillInstance> {
    let settings = store(&app).load();
    let instance = find_agent_instance(&settings, agent_id, &skill_name)
        .ok_or_else(|| AppError::NotFound(format!("{} / {}", agent_id.display(), skill_name)))?;
    let skill_md = instance.abs_path.join("SKILL.md");

    if !force {
        let disk_mtime = fs::metadata(&skill_md)
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        if disk_mtime != loaded_mtime {
            return Err(AppError::FileChangedOnDisk);
        }
    }

    // 防御:写回前剥离译文首尾可能的 ``` 围栏(老缓存/旧文件可能已带围栏)
    let cleaned = llm::strip_fences(&translated_raw);
    fs::write(&skill_md, cleaned.as_bytes()).map_err(|e| AppError::Io(e))?;
    // 新内容 = 译文本身,登记后下次打开直接命中缓存
    llm::register_translation(
        &app,
        &settings.deepseek,
        &skill_md,
        cleaned.as_bytes(),
        &cleaned,
    );

    Ok(rebuild_instance(agent_id, instance.abs_path, &skill_name))
}

/// 一键翻译全部(去重后顺序执行,事件上报进度,可取消)。
#[tauri::command]
pub async fn translate_all(app: AppHandle) -> AppResult<TranslateAllStart> {
    let state = app.state::<llm::TranslateState>();
    if state.batch_running.swap(true, Ordering::SeqCst) {
        return Err(AppError::Llm("批量翻译已在运行".into()));
    }
    state.batch_cancel.store(false, Ordering::SeqCst);

    let settings = store(&app).load();
    let ds: DeepseekSettings = settings.deepseek.clone();
    if ds.api_key.trim().is_empty() {
        state.batch_running.store(false, Ordering::SeqCst);
        return Err(AppError::Llm("未配置 DeepSeek API Key,请在设置中配置".into()));
    }

    // 扫描全部实例,按内容去重(相同内容只翻译一次,副本共享缓存)
    let scan = crate::scanner::scan_all(&settings);
    let mut map: HashMap<String, llm::BatchItem> = HashMap::new();
    for g in &scan.groups {
        for inst in &g.instances {
            if !inst.has_skill_md {
                continue;
            }
            let path = inst.abs_path.join("SKILL.md");
            let Ok(bytes) = fs::read(&path) else { continue };
            let h = llm::content_hash(&bytes);
            let entry = map.entry(h).or_insert_with(|| llm::BatchItem {
                name: g.name.clone(),
                paths: Vec::new(),
                raw: bytes.clone(),
            });
            entry.paths.push(path);
        }
    }
    let items: Vec<llm::BatchItem> = map.into_values().collect();
    let total = items.len() as u32;
    if total == 0 {
        state.batch_running.store(false, Ordering::SeqCst);
        return Err(AppError::NotFound("没有找到可翻译的 SKILL.md".into()));
    }

    tauri::async_runtime::spawn(async move {
        llm::translate_all_task(app.clone(), ds, items).await;
    });
    Ok(TranslateAllStart { total })
}

#[tauri::command]
pub fn cancel_translate_all(app: AppHandle) -> AppResult<()> {
    app.state::<llm::TranslateState>()
        .batch_cancel
        .store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn test_deepseek(app: AppHandle) -> AppResult<TestDeepseekResult> {
    let settings = store(&app).load();
    let (ok, message) = llm::test_deepseek(&settings.deepseek).await;
    Ok(TestDeepseekResult { ok, message })
}

// ---- 批量替换原文 ----

/// 可替换候选:SKILL.md 路径 + 展示名 + 命中的译文。
struct ReplaceCandidate {
    path: std::path::PathBuf,
    label: String,
    text: String,
}

/// 扫描全部实例,收集当前内容命中翻译缓存(Hit)的副本。
/// 只认 Hit:与单副本替换一致,stale/未翻译的绝不静默写回。
fn collect_replace_candidates(
    app: &AppHandle,
    settings: &Settings,
) -> (u32, Vec<ReplaceCandidate>) {
    let scan = crate::scanner::scan_all(settings);
    // 有 SKILL.md 的副本总数(不含无 SKILL.md 的目录)
    let mut total = 0u32;
    let mut candidates = Vec::new();

    for g in &scan.groups {
        for inst in &g.instances {
            if !inst.has_skill_md {
                continue;
            }
            total += 1;
            let path = inst.abs_path.join("SKILL.md");
            // 纯查缓存:Hit = 译文与当前内容匹配,可直接写回
            if let Ok((llm::TranslationStatus::Hit, Some(text))) =
                llm::check_translation(app, &settings.deepseek, &path)
            {
                candidates.push(ReplaceCandidate {
                    path,
                    label: format!("{} / {}", inst.agent_id.display(), inst.name),
                    text,
                });
            }
        }
    }

    (total, candidates)
}

/// 查询可用译文替换的副本数(二次确认弹窗展示用,纯本地不写盘)。
#[tauri::command]
pub fn count_replaceable_translations(app: AppHandle) -> AppResult<CountReplaceableResult> {
    let settings = store(&app).load();
    let (total, candidates) = collect_replace_candidates(&app, &settings);
    Ok(CountReplaceableResult {
        total,
        replaceable: candidates.len() as u32,
    })
}

/// 一键用译文替换原文:命中缓存的副本逐个写回 SKILL.md,
/// 并把译文登记为新内容的缓存(与单副本 replace_with_translation 一致)。
#[tauri::command]
pub fn replace_all_with_translations(app: AppHandle) -> AppResult<ReplaceAllResult> {
    // 批量翻译进行中禁止替换,避免与翻译任务互相干扰
    if app
        .state::<llm::TranslateState>()
        .batch_running
        .load(Ordering::SeqCst)
    {
        return Err(AppError::Llm("批量翻译运行中,请等待完成后再替换".into()));
    }

    let settings = store(&app).load();
    let (total, candidates) = collect_replace_candidates(&app, &settings);
    // 未翻译/译文过期的副本数(candidates 必为 total 子集,不会下溢)
    let skipped = total - candidates.len() as u32;

    let mut replaced = 0u32;
    let mut failed = 0u32;
    let mut errors: Vec<llm::BatchErrorItem> = Vec::new();

    for c in &candidates {
        // 单个失败不中断,逐条收集结果;写回前剥离可能的 ``` 围栏
        let cleaned = llm::strip_fences(&c.text);
        match fs::write(&c.path, cleaned.as_bytes()) {
            Ok(()) => {
                // 新内容 = 译文本身,登记后下次打开直接命中缓存
                llm::register_translation(
                    &app,
                    &settings.deepseek,
                    &c.path,
                    cleaned.as_bytes(),
                    &cleaned,
                );
                replaced += 1;
            }
            Err(e) => {
                failed += 1;
                errors.push(llm::BatchErrorItem {
                    name: c.label.clone(),
                    message: format!("写入失败: {e}"),
                });
            }
        }
    }

    Ok(ReplaceAllResult {
        replaced,
        skipped,
        failed,
        errors,
    })
}

// ---- 窗口质感(亚克力透明) ----

/// 构造亚克力窗口效果配置(Windows 10/11)。
pub fn fancy_effects() -> tauri::window::EffectsBuilder {
    tauri::window::EffectsBuilder::new().effect(tauri::window::Effect::Acrylic)
}

/// 开/关窗口亚克力透明(质感背景设置项的窗口层部分)。
/// 需要窗口配置 transparent:true;背景半透明由前端 CSS(html.fancy-bg)承担。
#[tauri::command]
pub fn set_window_fancy(app: AppHandle, enabled: bool) -> AppResult<()> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| AppError::Internal("主窗口不存在".into()))?;
    let result = if enabled {
        window.set_effects(fancy_effects().build())
    } else {
        window.set_effects(None)
    };
    result.map_err(|e| AppError::Internal(format!("窗口透明效果设置失败: {e}")))
}

// ---- 远程技能(命令添加) ----

/// AI 解读技能内容的提示词:要求严格输出 JSON(title/description/summary)。
const AI_READ_SYSTEM: &str = "你是 AI 技能解析器。用户会给你一份 SKILL.md 技能文档(可能含 YAML frontmatter)。阅读后只输出一个 JSON 对象,字段如下:title——技能标题(简短短语);description——一句话中文描述(50-100字,说明这个技能做什么、什么时候用);summary——中文摘要(不超过 150 字,概括正文要点)。不要输出 JSON 以外的任何文本,不要用代码围栏包裹。";

#[derive(Serialize)]
pub struct AiSkillRead {
    pub title: String,
    pub description: String,
    pub summary: String,
}

/// 解析安装命令/链接,列出 GitHub 仓库内的全部技能。
#[tauri::command]
pub async fn list_remote_skills(source: String) -> AppResult<remote::RemoteRepoInfo> {
    remote::list_remote_skills(&source).await
}

/// 下载仓库中某个技能的全部文件(缓存到内存),返回预览所需元信息。
#[tauri::command]
pub async fn fetch_remote_skill(
    app: AppHandle,
    owner: String,
    repo: String,
    git_ref: String,
    dir: String,
) -> AppResult<remote::FetchedSkillMeta> {
    let state = app.state::<remote::RemoteState>();
    remote::fetch_remote_skill(&state, &owner, &repo, &git_ref, &dir).await
}

/// AI 读取 SKILL.md 内容,返回标题/描述/摘要(供预填表单)。
#[tauri::command]
pub async fn ai_read_skill(app: AppHandle, raw: String) -> AppResult<AiSkillRead> {
    let settings = store(&app).load();
    let ds = settings.deepseek;
    if ds.api_key.trim().is_empty() {
        return Err(AppError::Llm("未配置 DeepSeek API Key,请在设置中配置".into()));
    }
    // 限制长度,控制 token 消耗
    let truncated: String = raw.chars().take(20_000).collect();
    let user = format!("以下是 SKILL.md 内容:\n\n{truncated}");
    let text = llm::complete_text(&ds, AI_READ_SYSTEM, &user)
        .await
        .map_err(AppError::Llm)?;

    // 容错:剥离可能的围栏,截取首个 { 到末个 } 之间的 JSON
    let cleaned = llm::strip_fences(&text);
    let start = cleaned
        .find('{')
        .ok_or_else(|| AppError::Llm("AI 返回内容无法解析为 JSON".into()))?;
    let end = cleaned
        .rfind('}')
        .ok_or_else(|| AppError::Llm("AI 返回内容无法解析为 JSON".into()))?;
    if end <= start {
        return Err(AppError::Llm("AI 返回内容无法解析为 JSON".into()));
    }
    let v: serde_json::Value = serde_json::from_str(&cleaned[start..=end])
        .map_err(|e| AppError::Llm(format!("AI 返回 JSON 解析失败: {e}")))?;

    Ok(AiSkillRead {
        title: v["title"].as_str().unwrap_or_default().trim().to_string(),
        description: v["description"].as_str().unwrap_or_default().trim().to_string(),
        summary: v["summary"].as_str().unwrap_or_default().trim().to_string(),
    })
}

/// 单个 target 安装:staging 目录内写 SKILL.md + 辅助文件,再 rename 替换目标,
/// 中途失败不会留下半成品(与同步引擎同策略)。
fn install_one(
    agent: AgentId,
    base: &std::path::Path,
    name: &str,
    description: &str,
    body_md: &str,
    files: &[(String, Vec<u8>)],
    overwrite: bool,
) -> Result<SkillInstance, String> {
    if name.is_empty() || name.contains('/') || name.contains('\\') || name == "." || name == ".." {
        return Err("非法技能名".into());
    }
    let target = base.join(name);
    if target.exists() && !overwrite {
        return Err(format!("{} 已存在同名技能", agent.display()));
    }

    let staging = base.join(format!(".skills-hub-staging-{}", uuid::Uuid::new_v4()));
    let build = (|| -> Result<(), String> {
        fs::create_dir_all(&staging).map_err(|e| e.to_string())?;
        let fm = format!(
            "---\nname: {}\ndescription: {}\n---\n\n",
            yaml_scalar(name),
            yaml_scalar(description)
        );
        fs::write(staging.join("SKILL.md"), format!("{fm}{body_md}")).map_err(|e| e.to_string())?;
        for (rel, bytes) in files {
            let path = remote::safe_join(&staging, rel)?;
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::write(&path, bytes).map_err(|e| e.to_string())?;
        }
        Ok(())
    })();
    if let Err(e) = build {
        let _ = fs::remove_dir_all(&staging);
        return Err(e);
    }

    let replace = (|| -> Result<(), String> {
        if target.exists() {
            fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
        }
        fs::rename(&staging, &target).map_err(|e| e.to_string())
    })();
    if let Err(e) = replace {
        let _ = fs::remove_dir_all(&staging);
        return Err(format!("替换目标目录失败: {e}"));
    }

    Ok(build_instance(agent, target, name.to_string()))
}

/// 把已获取(fetch_id)的远程技能安装到所选 agent:SKILL.md 按表单内容重建,
/// 辅助文件原样落盘;逐 target 收集结果,部分失败不中断。
#[tauri::command]
pub fn install_remote_skill(
    app: AppHandle,
    fetch_id: String,
    name: String,
    description: String,
    body_md: String,
    targets: Vec<AgentId>,
    overwrite: bool,
) -> AppResult<CreateSkillResult> {
    let settings = store(&app).load();
    let files = app
        .state::<remote::RemoteState>()
        .take(&fetch_id)
        .ok_or_else(|| AppError::NotFound("获取结果不存在或已过期,请重新获取".into()))?;

    let mut results: Vec<(AgentId, Result<SkillInstance, String>)> = Vec::new();
    for target in targets {
        let base = agent_base_dir(&settings, target);
        let out = install_one(target, &base, &name, &description, &body_md, &files, overwrite);
        results.push((target, out));
    }

    Ok(CreateSkillResult { results })
}


