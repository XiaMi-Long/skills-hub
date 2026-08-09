import type { AgentId } from "../types/api";

export const AGENT_ORDER: AgentId[] = [
  "claude_code",
  "codex",
  "grok",
  "pi",
  "cursor",
  "trae",
  "qoder",
  "universal",
];

export const AGENT_META: Record<AgentId, { id: AgentId; display: string; defaultSubpath: string; color: string }> = {
  claude_code: { id: "claude_code", display: "Claude Code", defaultSubpath: ".claude/skills", color: "#E8865A" },
  codex: { id: "codex", display: "Codex", defaultSubpath: ".codex/skills", color: "#10A37F" },
  grok: { id: "grok", display: "Grok", defaultSubpath: ".grok/skills", color: "#3B82F6" },
  pi: { id: "pi", display: "Pi", defaultSubpath: ".pi/agent/skills", color: "#8B5CF6" },
  cursor: { id: "cursor", display: "Cursor", defaultSubpath: ".cursor/skills", color: "#06B6D4" },
  trae: { id: "trae", display: "Trae", defaultSubpath: ".trae/skills", color: "#22C55E" },
  qoder: { id: "qoder", display: "Qoder", defaultSubpath: ".qoder/skills", color: "#F59E0B" },
  universal: { id: "universal", display: "Universal", defaultSubpath: ".agents/skills", color: "#EF6C4D" },
};

export function agentMeta(id: AgentId) {
  return AGENT_META[id];
}
