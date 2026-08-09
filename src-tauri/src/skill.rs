use serde::{Deserialize, Serialize};
use std::path::PathBuf;

use crate::agents::AgentId;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillInstance {
    pub agent_id: AgentId,
    pub abs_path: PathBuf,
    pub name: String,
    pub description: String,
    pub supporting_files: u32,
    pub has_skill_md: bool,
    pub mtime: i64,
    pub content_hash: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillGroup {
    pub name: String,
    pub instances: Vec<SkillInstance>,
    pub drift: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResult {
    pub groups: Vec<SkillGroup>,
    pub scanned_at: i64,
    pub errors: Vec<ScanError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanError {
    pub agent_id: AgentId,
    pub path: PathBuf,
    pub message: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum DeleteScope {
    ThisCopy,
    AllCopies,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum OnConflict {
    Overwrite,
    Skip,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncDirective {
    pub target: AgentId,
    pub on_conflict: OnConflict,
}

/// group_key:"My Skill"=="my-skill"=="MY SKILL"(spec §3)。
/// lowercase + trim 后空白(含连续空白)换 `-`。
pub fn group_key(name: &str) -> String {
    let t = name.trim().to_ascii_lowercase();
    let mut out = String::with_capacity(t.len());
    let mut prev_space = false;
    for c in t.chars() {
        if c.is_whitespace() {
            if !prev_space && !out.is_empty() {
                out.push('-');
            }
            prev_space = true;
        } else {
            out.push(c);
            prev_space = false;
        }
    }
    out
}
