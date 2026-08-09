use std::fs;
use std::hash::{DefaultHasher, Hasher};
use std::path::{Path, PathBuf};

use async_openai::config::OpenAIConfig;
use async_openai::types::{
    ChatCompletionRequestMessage, ChatCompletionRequestSystemMessage,
    ChatCompletionRequestSystemMessageContent, ChatCompletionRequestUserMessage,
    ChatCompletionRequestUserMessageContent, CreateChatCompletionRequestArgs,
};
use async_openai::Client;
use futures::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::error::{AppError, AppResult};
use crate::settings::DeepseekSettings;

pub const PROMPT_VERSION: u32 = 1;
pub const SYSTEM_PROMPT: &str = "你是技术文档翻译器。把 SKILL.md 翻译成简体中文。规则:代码块、行内代码、文件路径、命令、frontmatter 的 key 保持原样;frontmatter 的 description 值要翻译,name 值保持原样;markdown 结构(标题/列表/表格/链接)保持;只输出翻译后的全文,无解释。";

// TODO(v2): write_back_translation —— 让 LLM 把译文/修改同步回 SKILL.md(留空钩子)。

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

/// 缓存 key:abs_path + mtime + model + base_url + PROMPT_VERSION。
pub fn translate_cache_key(abs_path: &Path, mtime: i64, model: &str, base_url: &str) -> String {
    let mut h = DefaultHasher::new();
    h.write(abs_path.to_string_lossy().as_bytes());
    h.write(&mtime.to_le_bytes());
    h.write(model.as_bytes());
    h.write(base_url.as_bytes());
    h.write(&PROMPT_VERSION.to_le_bytes());
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

/// 流式翻译任务:逐 chunk emit `translate-chunk`,结束 emit `translate-done` 并写缓存;
/// 错误 emit `translate-error`。绝不写 skill 文件(纯视图层)。
pub async fn stream_translation_task(
    app: AppHandle,
    request_id: String,
    abs_path: PathBuf,
    mtime: i64,
    ds: DeepseekSettings,
) {
    let raw = match fs::read_to_string(&abs_path) {
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
        .messages(build_messages(SYSTEM_PROMPT, &raw))
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
                                request_id,
                                message: format!("流式响应错误: {e}"),
                            },
                        );
                        return;
                    }
                }
            }
            let key = translate_cache_key(&abs_path, mtime, &ds.model, &ds.base_url);
            write_cache(&app, &key, &text);
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
