use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use crate::agents::AgentId;
use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Dark,
    Light,
    System,
}

impl Default for Theme {
    fn default() -> Self {
        Theme::Dark
    }
}

/// 系统色调(前端映射到 --accent-from/--accent-to 渐变)。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Accent {
    Blue,
    Orange,
    Green,
    Purple,
    Pink,
}

impl Default for Accent {
    fn default() -> Self {
        Accent::Blue
    }
}

/// 翻译目标语言。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TranslateTo {
    Zh,
    En,
}

impl Default for TranslateTo {
    fn default() -> Self {
        TranslateTo::Zh
    }
}

/// 打开技能时的默认视图。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SkillOpenView {
    Original,
    Translated,
}

impl Default for SkillOpenView {
    fn default() -> Self {
        SkillOpenView::Original
    }
}

/// 技能预览的 Markdown 排版主题。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MarkdownTheme {
    Default,
    Docs,
    Paper,
    Compact,
}

impl Default for MarkdownTheme {
    fn default() -> Self {
        MarkdownTheme::Default
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeepseekSettings {
    pub api_key: String,
    pub model: String,
    pub base_url: String,
    /// 旧配置无此字段 → 默认中文
    #[serde(default)]
    pub translate_to: TranslateTo,
}

impl Default for DeepseekSettings {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            model: "deepseek-chat".into(),
            base_url: "https://api.deepseek.com/v1".into(),
            translate_to: TranslateTo::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: Theme,
    /// 旧 settings.json 无此字段 → 默认蓝色,保证兼容加载
    #[serde(default)]
    pub accent: Accent,
    /// 打开技能默认视图,旧配置默认原文
    #[serde(default)]
    pub default_view: SkillOpenView,
    /// 技能预览 Markdown 排版主题,旧配置默认 default
    #[serde(default)]
    pub markdown_theme: MarkdownTheme,
    pub agent_overrides: HashMap<AgentId, PathBuf>,
    pub deepseek: DeepseekSettings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: Theme::Dark,
            accent: Accent::default(),
            default_view: SkillOpenView::default(),
            markdown_theme: MarkdownTheme::default(),
            agent_overrides: HashMap::new(),
            deepseek: DeepseekSettings::default(),
        }
    }
}

/// settings.json 原子读写(.tmp + rename)。
pub struct SettingsStore {
    path: PathBuf,
}

impl SettingsStore {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self {
            path: app_data_dir.join("settings.json"),
        }
    }

    pub fn load(&self) -> Settings {
        match fs::read_to_string(&self.path) {
            Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
            Err(_) => Settings::default(),
        }
    }

    pub fn save(&self, settings: &Settings) -> AppResult<()> {
        let parent = self
            .path
            .parent()
            .ok_or_else(|| AppError::Settings("app 数据目录不可用".into()))?;
        fs::create_dir_all(parent)?;
        let tmp = parent.join("settings.json.tmp");
        fs::write(&tmp, serde_json::to_string_pretty(settings)?)?;
        fs::rename(&tmp, &self.path)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn atomic_write_roundtrip() {
        let dir = tempdir().unwrap();
        let store = SettingsStore::new(dir.path().to_path_buf());
        let mut s = Settings::default();
        s.agent_overrides.insert(AgentId::Codex, std::path::PathBuf::from("C:/tmp/codex"));
        store.save(&s).unwrap();

        let loaded = store.load();
        assert_eq!(loaded.theme, Theme::Dark);
        assert_eq!(loaded.accent, Accent::Blue);
        assert_eq!(loaded.default_view, SkillOpenView::Original);
        assert_eq!(loaded.markdown_theme, MarkdownTheme::Default);
        assert_eq!(loaded.deepseek.translate_to, TranslateTo::Zh);
        assert_eq!(
            loaded.agent_overrides.get(&AgentId::Codex).unwrap().to_string_lossy(),
            "C:/tmp/codex"
        );
        assert_eq!(loaded.deepseek.model, "deepseek-chat");
        assert_eq!(loaded.deepseek.base_url, "https://api.deepseek.com/v1");
        // 无 .tmp 残留
        let entries: Vec<_> = std::fs::read_dir(dir.path()).unwrap().collect();
        assert_eq!(entries.len(), 1);
    }

    #[test]
    fn missing_file_loads_default() {
        let dir = tempdir().unwrap();
        let store = SettingsStore::new(dir.path().join("nope").to_path_buf());
        let s = store.load();
        assert_eq!(s.theme, Theme::Dark);
        assert_eq!(s.accent, Accent::Blue);
        assert!(s.agent_overrides.is_empty());
    }

    #[test]
    fn legacy_json_without_accent_defaults_blue() {
        let dir = tempdir().unwrap();
        let store = SettingsStore::new(dir.path().to_path_buf());
        std::fs::write(
            &store.path,
            r#"{"theme":"light","agent_overrides":{},"deepseek":{"api_key":"","model":"deepseek-chat","base_url":"https://api.deepseek.com/v1"}}"#,
        )
        .unwrap();
        let s = store.load();
        assert_eq!(s.theme, Theme::Light);
        assert_eq!(s.accent, Accent::Blue);
        assert_eq!(s.default_view, SkillOpenView::Original);
        assert_eq!(s.markdown_theme, MarkdownTheme::Default);
        assert_eq!(s.deepseek.translate_to, TranslateTo::Zh);
    }

    #[test]
    fn accent_roundtrip() {
        let dir = tempdir().unwrap();
        let store = SettingsStore::new(dir.path().to_path_buf());
        let mut s = Settings::default();
        s.accent = Accent::Purple;
        store.save(&s).unwrap();
        assert_eq!(store.load().accent, Accent::Purple);
    }
}
