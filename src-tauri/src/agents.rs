use serde::{Deserialize, Serialize};

/// 8 个 agent 的目标(spec §2)。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum AgentId {
    ClaudeCode,
    Codex,
    Grok,
    Pi,
    Cursor,
    Trae,
    Qoder,
    Universal,
}

pub struct AgentMeta {
    pub id: AgentId,
    pub display: &'static str,
    pub default_subpath: &'static str,
    pub icon_color: &'static str,
}

pub const AGENTS: [AgentMeta; 8] = [
    AgentMeta { id: AgentId::ClaudeCode, display: "Claude Code", default_subpath: ".claude/skills", icon_color: "#E8865A" },
    AgentMeta { id: AgentId::Codex, display: "Codex", default_subpath: ".codex/skills", icon_color: "#10A37F" },
    AgentMeta { id: AgentId::Grok, display: "Grok", default_subpath: ".grok/skills", icon_color: "#3B82F6" },
    AgentMeta { id: AgentId::Pi, display: "Pi", default_subpath: ".pi/agent/skills", icon_color: "#8B5CF6" },
    AgentMeta { id: AgentId::Cursor, display: "Cursor", default_subpath: ".cursor/skills", icon_color: "#06B6D4" },
    AgentMeta { id: AgentId::Trae, display: "Trae", default_subpath: ".trae/skills", icon_color: "#22C55E" },
    AgentMeta { id: AgentId::Qoder, display: "Qoder", default_subpath: ".qoder/skills", icon_color: "#F59E0B" },
    AgentMeta { id: AgentId::Universal, display: "Universal", default_subpath: ".agents/skills", icon_color: "#EF6C4D" },
];

impl AgentId {
    pub fn order(self) -> usize {
        AGENTS.iter().position(|a| a.id == self).unwrap_or(usize::MAX)
    }
    pub fn meta(self) -> &'static AgentMeta {
        &AGENTS[self.order()]
    }
    pub fn display(self) -> &'static str {
        self.meta().display
    }
}
