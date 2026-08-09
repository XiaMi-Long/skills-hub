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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeepseekSettings {
    pub api_key: String,
    pub model: String,
    pub base_url: String,
}

impl Default for DeepseekSettings {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            model: "deepseek-chat".into(),
            base_url: "https://api.deepseek.com/v1".into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: Theme,
    pub agent_overrides: HashMap<AgentId, PathBuf>,
    pub deepseek: DeepseekSettings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: Theme::Dark,
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
