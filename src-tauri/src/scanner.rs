use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::hash::{DefaultHasher, Hasher};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::agents::{AgentId, AGENTS};
use crate::error::display_path;
use crate::frontmatter::{parse_skill_md, read_skill_md_lossy};
use crate::settings::Settings;
use crate::skill::{group_key, ScanError, ScanResult, SkillGroup, SkillInstance};

pub fn home_dir() -> PathBuf {
    dirs::home_dir().unwrap_or_else(|| PathBuf::from("."))
}

/// agent 目录:设置覆盖优先,否则 home/default_subpath。不存在 = 0 skills 不报错。
pub fn agent_base_dir(settings: &Settings, agent: AgentId) -> PathBuf {
    if let Some(p) = settings.agent_overrides.get(&agent) {
        return p.clone();
    }
    home_dir().join(agent.meta().default_subpath)
}

pub fn hash_bytes(b: &[u8]) -> u64 {
    let mut h = DefaultHasher::new();
    h.write(b);
    h.finish()
}

fn file_mtime_secs(path: &Path) -> i64 {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn count_supporting_files(dir: &Path) -> u32 {
    walkdir::WalkDir::new(dir)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter(|e| e.path().file_name().map(|n| n != "SKILL.md").unwrap_or(false))
        .count() as u32
}

/// 构建单个 skill 目录的实例。SKILL.md 缺失 → has_skill_md=false,name=dirname。
pub fn build_instance(agent: AgentId, dir: PathBuf, dirname: String) -> SkillInstance {
    let skill_md = dir.join("SKILL.md");
    let mut name = dirname.clone();
    let mut description = String::new();
    let mut has_skill_md = false;
    let mut mtime = 0i64;
    let mut content_hash = 0u64;

    if skill_md.exists() {
        let bytes = fs::read(&skill_md).unwrap_or_default();
        content_hash = hash_bytes(&bytes);
        mtime = file_mtime_secs(&skill_md);
        let text = String::from_utf8_lossy(&bytes);
        let fm = parse_skill_md(&text);
        if let Some(n) = fm.name {
            name = n;
        }
        description = fm.description.unwrap_or_default();
        has_skill_md = true;
    }

    let supporting_files = count_supporting_files(&dir);

    SkillInstance {
        agent_id: agent,
        abs_path: dir,
        name,
        description,
        supporting_files,
        has_skill_md,
        mtime,
        content_hash,
    }
}

/// 扫单个 agent 一层子目录(忽略 `.` 开头目录)。
pub fn scan_agent(settings: &Settings, agent: AgentId) -> (Vec<SkillInstance>, Vec<ScanError>) {
    let base = agent_base_dir(settings, agent);
    let mut instances = Vec::new();
    let mut errors = Vec::new();

    let entries = match fs::read_dir(&base) {
        Ok(e) => e,
        Err(_) => return (instances, errors), // 目录不存在 = 0 skills,不报错
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let dirname = entry.file_name().to_string_lossy().to_string();
        if dirname.starts_with('.') {
            continue;
        }
        // 读取 SKILL.md 有问题的记录 ScanError(读失败按 lossy 空处理)
        let skill_md = path.join("SKILL.md");
        if skill_md.exists() {
            let (_, ok) = read_skill_md_lossy(&skill_md);
            if !ok {
                errors.push(ScanError {
                    agent_id: agent,
                    path: path.clone(),
                    message: "SKILL.md 读取失败".into(),
                });
            }
        }
        instances.push(build_instance(agent, path, dirname));
    }

    (instances, errors)
}

/// 归组 + drift;groups 按 name 升序,组内按 AGENTS 表顺序。
pub fn build_groups(all: Vec<SkillInstance>) -> Vec<SkillGroup> {
    let mut map: BTreeMap<String, Vec<SkillInstance>> = BTreeMap::new();
    for inst in all {
        map.entry(group_key(&inst.name)).or_default().push(inst);
    }

    let mut groups = Vec::with_capacity(map.len());
    for (name, mut instances) in map {
        instances.sort_by_key(|i| i.agent_id.order());
        let mut hashes = HashSet::new();
        for i in &instances {
            if i.has_skill_md {
                hashes.insert(i.content_hash);
            }
        }
        let drift = hashes.len() >= 2;
        groups.push(SkillGroup {
            name,
            instances,
            drift,
        });
    }
    groups
}

/// 8 目录并发扫(scope threads)并归组。
pub fn scan_all(settings: &Settings) -> ScanResult {
    let mut all_instances: Vec<SkillInstance> = Vec::new();
    let mut all_errors: Vec<ScanError> = Vec::new();

    std::thread::scope(|s| {
        let handles: Vec<_> = AGENTS
            .iter()
            .map(|meta| {
                let settings = settings;
                s.spawn(move || scan_agent(settings, meta.id))
            })
            .collect();
        for h in handles {
            let (instances, errors) = h.join().unwrap_or_default();
            all_instances.extend(instances);
            all_errors.extend(errors);
        }
    });

    let groups = build_groups(all_instances);
    let scanned_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    ScanResult {
        groups,
        scanned_at,
        errors: all_errors,
    }
}

/// 找某 agent 下 group_key 匹配的实例(供 read/write/delete/sync/translate 共用)。
pub fn find_agent_instance(
    settings: &Settings,
    agent: AgentId,
    skill_name: &str,
) -> Option<SkillInstance> {
    let (instances, _) = scan_agent(settings, agent);
    let key = group_key(skill_name);
    instances
        .into_iter()
        .find(|i| group_key(&i.name) == key)
}

pub fn instance_abs_path_display(i: &SkillInstance) -> String {
    display_path(&i.abs_path)
}
