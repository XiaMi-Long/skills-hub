use std::fs;
use std::process::Command;
use std::time::UNIX_EPOCH;

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::agents::AgentId;
use crate::error::{AppError, AppResult};
use crate::llm;
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

    let dirname = instance
        .abs_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| skill_name.clone());
    Ok(build_instance(agent_id, instance.abs_path, dirname))
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

#[tauri::command]
pub fn reveal_in_explorer(app: AppHandle, agent_id: AgentId, skill_name: String) -> AppResult<()> {
    let settings = store(&app).load();
    let instance = find_agent_instance(&settings, agent_id, &skill_name)
        .ok_or_else(|| AppError::NotFound(format!("{} / {}", agent_id.display(), skill_name)))?;
    let target = if instance.abs_path.join("SKILL.md").exists() {
        instance.abs_path.join("SKILL.md")
    } else {
        instance.abs_path.clone()
    };
    Command::new("explorer.exe")
        .arg(format!("/select,{}", target.display()))
        .spawn()
        .map_err(|e| AppError::Internal(format!("explorer 启动失败: {e}")))?;
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

// ---- 翻译 ----

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
    let mtime = fs::metadata(&skill_md)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    let key = llm::translate_cache_key(&skill_md, mtime, &ds.model, &ds.base_url);

    if let Some(text) = llm::read_cache(&app, &key) {
        return Ok(TranslateResult {
            cached: true,
            text: Some(text),
            request_id: String::new(),
        });
    }

    let request_id = uuid::Uuid::new_v4().to_string();
    let app2 = app.clone();
    let abs_path = instance.abs_path.join("SKILL.md");
    let rid = request_id.clone();
    tauri::async_runtime::spawn(async move {
        llm::stream_translation_task(app2, rid, abs_path, mtime, ds).await;
    });

    Ok(TranslateResult {
        cached: false,
        text: None,
        request_id,
    })
}

#[tauri::command]
pub async fn test_deepseek(app: AppHandle) -> AppResult<TestDeepseekResult> {
    let settings = store(&app).load();
    let (ok, message) = llm::test_deepseek(&settings.deepseek).await;
    Ok(TestDeepseekResult { ok, message })
}


