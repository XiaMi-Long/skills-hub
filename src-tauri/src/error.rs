use serde::ser::{Serialize, SerializeMap, Serializer};
use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("文件在磁盘上已被外部修改")]
    FileChangedOnDisk,
    #[error("技能副本不存在: {0}")]
    NotFound(String),
    #[error("IO 错误: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON 序列化错误: {0}")]
    Json(#[from] serde_json::Error),
    #[error("设置错误: {0}")]
    Settings(String),
    #[error("DeepSeek 错误: {0}")]
    Llm(String),
    #[error("内部错误: {0}")]
    Internal(String),
}

impl AppError {
    fn code(&self) -> &'static str {
        match self {
            AppError::FileChangedOnDisk => "file_changed_on_disk",
            AppError::NotFound(_) => "not_found",
            AppError::Io(_) => "io",
            AppError::Json(_) => "json",
            AppError::Settings(_) => "settings",
            AppError::Llm(_) => "llm",
            AppError::Internal(_) => "internal",
        }
    }
}

/// 序列化为 `{ code, message }`,前端 toast 展示。
impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = serializer.serialize_map(Some(2))?;
        map.serialize_entry("code", self.code())?;
        map.serialize_entry("message", &self.to_string())?;
        map.end()
    }
}

pub type AppResult<T> = Result<T, AppError>;

/// 供 UI 展示的路径(\\ → /)。
pub fn display_path(p: &PathBuf) -> String {
    p.to_string_lossy().replace('\\', "/")
}
