import { agentMeta } from "../lib/agents";
import type { AgentId } from "../types/api";

/** agent 缩略 badge:色点 + 短名 */
export default function AgentBadge({ agentId, dim }: { agentId: AgentId; dim?: boolean }) {
  const meta = agentMeta(agentId);
  const short = meta.display.split(" ")[0];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] px-1.5 py-px text-[11px] leading-4 ${
        dim ? "text-[var(--text-muted)]" : "text-[var(--text-secondary)]"
      }`}
    >
      <span className="h-[5px] w-[5px] rounded-full" style={{ background: meta.color }} />
      {short}
    </span>
  );
}
