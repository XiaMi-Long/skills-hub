use std::collections::HashMap;
use std::fs;
use std::hash::{DefaultHasher, Hasher};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use async_openai::config::OpenAIConfig;
use async_openai::types::{
    ChatCompletionRequestMessage, ChatCompletionRequestSystemMessage,
    ChatCompletionRequestSystemMessageContent, ChatCompletionRequestUserMessage,
    ChatCompletionRequestUserMessageContent, CreateChatCompletionRequestArgs,
};
use async_openai::Client;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::error::{AppError, AppResult};
use crate::settings::{DeepseekSettings, TranslateTo};

pub const PROMPT_VERSION: u32 = 2;

pub const SYSTEM_PROMPT_ZH: &str = "你是技术文档翻译器。把 SKILL.md 翻译成简体中文。规则:代码块、行内代码、文件路径、命令、frontmatter 的 key 保持原样;frontmatter 的 description 值要翻译,name 值保持原样;markdown 结构(标题/列表/表格/链接)保持;只输出翻译后的完整全文(含 frontmatter 块),无解释。";
pub const SYSTEM_PROMPT_EN: &str = "You are a technical documentation translator. Translate the SKILL.md into English. Rules: keep code blocks, inline code, file paths, commands, and frontmatter keys unchanged; translate the frontmatter description value but keep the name value unchanged; keep the markdown structure (headings/lists/tables/links) intact; output only the complete translated text (including the frontmatter block), no explanations.";

pub fn system_prompt(to: TranslateTo) -> &'static str {
    match to {
        TranslateTo::Zh => SYSTEM_PROMPT_ZH,
        TranslateTo::En => SYSTEM_PROMPT_EN,
    }
}

// ---- 事件 ----

#[derive(Clone, Serialize)]
pub struct TranslateChunk {
    pub request_id: String,
    pub delta: String,
}

#[derive(Clone, Serialize)]
pub struct TranslateDone {
    pub request_id: String,
    pub text: String,
}

#[derive(Clone, Serialize)]
pub struct TranslateError {
    pub request_id: String,
    pub message: String,
}

#[derive(Clone, Serialize)]
pub struct TranslateAllProgress {
    pub done: u32,
    pub total: u32,
    pub current: String,
}

#[derive(Clone, Serialize)]
pub struct BatchErrorItem {
    pub name: String,
    pub message: String,
}

#[derive(Clone, Serialize)]
pub struct TranslateAllDone {
    pub translated: u32,
    pub skipped: u32,
    pub failed: u32,
    pub cancelled: bool,
    pub errors: Vec<BatchErrorItem>,
}

// ---- 全局状态(清单锁 + 批量运行/取消标志) ----

#[derive(Default)]
pub struct TranslateState {
    pub manifest_lock: Mutex<()>,
    pub batch_running: AtomicBool,
    pub batch_cancel: AtomicBool,
}

// ---- 缓存与清单 ----

/// 内容寻址缓存 key:内容字节 + 目标语言 + 模型 + base_url + PROMPT_VERSION。
/// 相同内容的多个 agent 副本共享同一份翻译。
pub fn content_key(raw: &[u8], to: TranslateTo, model: &str, base_url: &str) -> String {
    let mut h = DefaultHasher::new();
    h.write(raw);
    h.write(match to {
        TranslateTo::Zh => b"zh",
        TranslateTo::En => b"en",
    });
    h.write(model.as_bytes());
    h.write(base_url.as_bytes());
    h.write(&PROMPT_VERSION.to_le_bytes());
    format!("{:016x}", h.finish())
}

/// 仅内容字节哈希(用于清单比对"文件是否已变")。
pub fn content_hash(raw: &[u8]) -> String {
    let mut h = DefaultHasher::new();
    h.write(raw);
    format!("{:016x}", h.finish())
}

pub fn cache_dir(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Internal(e.to_string()))?
        .join("translations");
    fs::create_dir_all(&dir).map_err(|e| AppError::Io(e))?;
    Ok(dir)
}

pub fn read_cache(app: &AppHandle, key: &str) -> Option<String> {
    let path = cache_dir(app).ok()?.join(format!("{key}.md"));
    fs::read_to_string(path).ok()
}

pub fn write_cache(app: &AppHandle, key: &str, text: &str) {
    if let Ok(dir) = cache_dir(app) {
        let _ = fs::write(dir.join(format!("{key}.md")), text);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ManifestEntry {
    pub content_hash: String,
    pub key: String,
    pub translated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TranslationIndex {
    pub files: HashMap<String, ManifestEntry>,
}

fn manifest_path(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(cache_dir(app)?.join("index.json"))
}

pub fn load_manifest(app: &AppHandle) -> TranslationIndex {
    match manifest_path(app).and_then(|p| fs::read_to_string(p).map_err(AppError::Io)) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => TranslationIndex::default(),
    }
}

fn save_manifest(app: &AppHandle, idx: &TranslationIndex) {
    if let Ok(path) = manifest_path(app) {
        let _ = serde_json::to_string_pretty(idx)
            .map(|s| fs::write(&path, s));
    }
}

fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// 登记一次翻译:写缓存文件 + 更新清单(abs_path → 内容哈希/key)。
pub fn register_translation(app: &AppHandle, ds: &DeepseekSettings, abs_path: &Path, raw: &[u8], text: &str) {
    let key = content_key(raw, ds.translate_to, &ds.model, &ds.base_url);
    write_cache(app, &key, text);
    let state = app.state::<TranslateState>();
    let _g = state.manifest_lock.lock().unwrap();
    let mut idx = load_manifest(app);
    idx.files.insert(
        abs_path.to_string_lossy().into_owned(),
        ManifestEntry {
            content_hash: content_hash(raw),
            key,
            translated_at: now_secs(),
        },
    );
    save_manifest(app, &idx);
}

/// 翻译状态:Hit=当前内容有缓存;Stale=文件已变,返回旧译文(可能过期);None=从未翻译。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TranslationStatus {
    Hit,
    Stale,
    None,
}

impl TranslationStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            TranslationStatus::Hit => "hit",
            TranslationStatus::Stale => "stale",
            TranslationStatus::None => "none",
        }
    }
}

/// 纯查缓存,不发请求。
pub fn check_translation(
    app: &AppHandle,
    ds: &DeepseekSettings,
    abs_path: &Path,
) -> AppResult<(TranslationStatus, Option<String>)> {
    let raw = fs::read(abs_path).map_err(|e| AppError::Io(e))?;
    let cur_hash = content_hash(&raw);
    let key = content_key(&raw, ds.translate_to, &ds.model, &ds.base_url);
    if let Some(text) = read_cache(app, &key) {
        return Ok((TranslationStatus::Hit, Some(text)));
    }
    // 清单里只有旧哈希 → 文件已变,给出旧译文供"过期提醒"展示
    let state = app.state::<TranslateState>();
    let _g = state.manifest_lock.lock().unwrap();
    let idx = load_manifest(app);
    if let Some(e) = idx.files.get(abs_path.to_string_lossy().as_ref()) {
        if e.content_hash != cur_hash {
            if let Some(old) = read_cache(app, &e.key) {
                return Ok((TranslationStatus::Stale, Some(old)));
            }
        }
    }
    Ok((TranslationStatus::None, None))
}

// ---- 客户端与请求 ----

fn build_client(ds: &DeepseekSettings) -> AppResult<Client<OpenAIConfig>> {
    if ds.api_key.trim().is_empty() {
        return Err(AppError::Llm(
            "未配置 DeepSeek API Key,请在设置中配置".into(),
        ));
    }
    let config = OpenAIConfig::new()
        .with_api_key(ds.api_key.clone())
        .with_api_base(ds.base_url.clone());
    Ok(Client::with_config(config))
}

fn build_messages(system: &str, user: &str) -> Vec<ChatCompletionRequestMessage> {
    vec![
        ChatCompletionRequestMessage::System(ChatCompletionRequestSystemMessage {
            content: ChatCompletionRequestSystemMessageContent::Text(system.into()),
            name: None,
        }),
        ChatCompletionRequestMessage::User(ChatCompletionRequestUserMessage {
            content: ChatCompletionRequestUserMessageContent::Text(user.into()),
            name: None,
        }),
    ]
}

/// 非流式翻译一段文本(批量翻译用)。返回译文或可读错误。
pub async fn translate_text(ds: &DeepseekSettings, raw: &str) -> Result<String, String> {
    let client = build_client(ds).map_err(|e| e.to_string())?;
    let req = CreateChatCompletionRequestArgs::default()
        .model(ds.model.clone())
        .messages(build_messages(system_prompt(ds.translate_to), raw))
        .build()
        .map_err(|e| format!("请求构造失败: {e}"))?;
    let resp = client
        .chat()
        .create(req)
        .await
        .map_err(|e| format!("DeepSeek 请求失败: {e}"))?;
    Ok(resp
        .choices
        .first()
        .and_then(|c| c.message.content.clone())
        .unwrap_or_default())
}

// ---- 单技能流式翻译 ----

/// 流式翻译任务:逐 chunk emit `translate-chunk`,结束 emit `translate-done` 并写缓存+清单;
/// 错误 emit `translate-error`。
pub async fn stream_translation_task(
    app: AppHandle,
    request_id: String,
    abs_path: PathBuf,
    ds: DeepseekSettings,
) {
    let raw_bytes = match fs::read(&abs_path) {
        Ok(r) => r,
        Err(e) => {
            let _ = app.emit(
                "translate-error",
                TranslateError {
                    request_id,
                    message: format!("读取 SKILL.md 失败: {e}"),
                },
            );
            return;
        }
    };
    let raw = String::from_utf8_lossy(&raw_bytes).into_owned();

    let client = match build_client(&ds) {
        Ok(c) => c,
        Err(e) => {
            let _ = app.emit(
                "translate-error",
                TranslateError {
                    request_id,
                    message: e.to_string(),
                },
            );
            return;
        }
    };

    let req = match CreateChatCompletionRequestArgs::default()
        .model(ds.model.clone())
        .messages(build_messages(system_prompt(ds.translate_to), &raw))
        .build()
    {
        Ok(r) => r,
        Err(e) => {
            let _ = app.emit(
                "translate-error",
                TranslateError {
                    request_id,
                    message: format!("请求构造失败: {e}"),
                },
            );
            return;
        }
    };

    let mut text = String::new();
    match client.chat().create_stream(req).await {
        Ok(mut stream) => {
            while let Some(chunk) = stream.next().await {
                match chunk {
                    Ok(c) => {
                        if let Some(delta) = c.choices.first().and_then(|ch| ch.delta.content.clone())
                        {
                            text.push_str(&delta);
                            let _ = app.emit(
                                "translate-chunk",
                                TranslateChunk {
                                    request_id: request_id.clone(),
                                    delta,
                                },
                            );
                        }
                    }
                    Err(e) => {
                        let _ = app.emit(
                            "translate-error",
                            TranslateError {
                                request_id: request_id.clone(),
                                message: format!("流式响应错误: {e}"),
                            },
                        );
                        return;
                    }
                }
            }
            register_translation(&app, &ds, &abs_path, &raw_bytes, &text);
            let _ = app.emit(
                "translate-done",
                TranslateDone {
                    request_id,
                    text,
                },
            );
        }
        Err(e) => {
            let _ = app.emit(
                "translate-error",
                TranslateError {
                    request_id,
                    message: format!("DeepSeek 请求失败: {e}"),
                },
            );
        }
    }
}

// ---- 批量翻译 ----

pub struct BatchItem {
    pub name: String,
    pub paths: Vec<PathBuf>,
    pub raw: Vec<u8>,
}

/// 批量任务:顺序逐条翻译(去重后),emit progress/done,支持取消。
pub async fn translate_all_task(app: AppHandle, ds: DeepseekSettings, items: Vec<BatchItem>) {
    let total = items.len() as u32;
    let mut translated: u32 = 0;
    let mut skipped: u32 = 0;
    let mut failed: u32 = 0;
    let mut cancelled = false;
    let mut errors: Vec<BatchErrorItem> = Vec::new();

    for (i, item) in items.iter().enumerate() {
        let state = app.state::<TranslateState>();
        if state.batch_cancel.load(Ordering::SeqCst) {
            cancelled = true;
            break;
        }
        let _ = app.emit(
            "translate-all-progress",
            TranslateAllProgress {
                done: i as u32,
                total,
                current: item.name.clone(),
            },
        );

        let key = content_key(&item.raw, ds.translate_to, &ds.model, &ds.base_url);
        if read_cache(&app, &key).is_some() {
            // 已有缓存:登记所有共享该内容的副本路径
            register_paths(&app, &item.paths, &item.raw, &key);
            skipped += 1;
            continue;
        }

        match translate_text(&ds, &String::from_utf8_lossy(&item.raw)).await {
            Ok(text) => {
                write_cache(&app, &key, &text);
                register_paths(&app, &item.paths, &item.raw, &key);
                translated += 1;
            }
            Err(e) => {
                failed += 1;
                errors.push(BatchErrorItem {
                    name: item.name.clone(),
                    message: e,
                });
            }
        }
    }

    let state = app.state::<TranslateState>();
    state.batch_running.store(false, Ordering::SeqCst);
    state.batch_cancel.store(false, Ordering::SeqCst);
    let _ = app.emit(
        "translate-all-done",
        TranslateAllDone {
            translated,
            skipped,
            failed,
            cancelled,
            errors,
        },
    );
}

/// 为共享同一内容的每个副本路径登记清单(指向同一 key)。
fn register_paths(app: &AppHandle, paths: &[PathBuf], raw: &[u8], key: &str) {
    let state = app.state::<TranslateState>();
    let _g = state.manifest_lock.lock().unwrap();
    let mut idx = load_manifest(app);
    for p in paths {
        idx.files.insert(
            p.to_string_lossy().into_owned(),
            ManifestEntry {
                content_hash: content_hash(raw),
                key: key.to_string(),
                translated_at: now_secs(),
            },
        );
    }
    save_manifest(app, &idx);
}

/// 连接测试:非流式 ping。
pub async fn test_deepseek(ds: &DeepseekSettings) -> (bool, String) {
    let client = match build_client(ds) {
        Ok(c) => c,
        Err(e) => return (false, e.to_string()),
    };
    let req = match CreateChatCompletionRequestArgs::default()
        .model(ds.model.clone())
        .messages(build_messages("You are a ping helper. Reply with exactly: pong", "ping"))
        .build()
    {
        Ok(r) => r,
        Err(e) => return (false, format!("请求构造失败: {e}")),
    };
    match client.chat().create(req).await {
        Ok(resp) => {
            let text = resp
                .choices
                .first()
                .and_then(|c| c.message.content.clone())
                .unwrap_or_default();
            (true, format!("连接成功: {text}"))
        }
        Err(e) => (false, format!("DeepSeek 请求失败: {e}")),
    }
}
