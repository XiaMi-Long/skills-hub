import { useMemo } from "react";
import { AGENT_META, AGENT_ORDER } from "../lib/agents";
import { useSkillsStore } from "../store/skills";
import type { AgentId } from "../types/api";

export default function AgentSidebar() {
  const scan = useSkillsStore((s) => s.scan);
  const agentFilter = useSkillsStore((s) => s.agentFilter);
  const setAgentFilter = useSkillsStore((s) => s.setAgentFilter);

  const counts = useMemo(() => {
    const c = new Map<AgentId, number>();
    for (const g of scan?.groups ?? []) {
      for (const inst of g.instances) {
        c.set(inst.agent_id, (c.get(inst.agent_id) ?? 0) + 1);
      }
    }
    return c;
  }, [scan]);

  const allCount = scan?.groups.length ?? 0;

  return (
    <div className="pane flex h-full flex-col bg-[var(--bg-pane)]">
      <div className="px-3 pt-3 pb-1 text-[11px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
        Agents
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        <button
          onClick={() => setAgentFilter(null)}
          className={`relative flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${
            agentFilter === null
              ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/60"
          }`}
        >
          {agentFilter === null && (
            <span className="accent-gradient absolute top-1/2 left-0.5 h-3.5 w-[2.5px] -translate-y-1/2 rounded-full" />
          )}
          <span className="font-medium">全部技能</span>
          <span className="mono text-[11px] text-[var(--text-muted)]">{allCount}</span>
        </button>

        {AGENT_ORDER.map((id) => {
          const meta = AGENT_META[id];
          const count = counts.get(id) ?? 0;
          const active = agentFilter === id;
          return (
            <button
              key={id}
              onClick={() => setAgentFilter(id)}
              className={`relative flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                active
                  ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/60"
              }`}
            >
              {active && (
                <span className="accent-gradient absolute top-1/2 left-0.5 h-3.5 w-[2.5px] -translate-y-1/2 rounded-full" />
              )}
              <span
                className="h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ background: meta.color }}
              />
              <span className="flex-1 truncate">{meta.display}</span>
              <span className="mono text-[11px] text-[var(--text-muted)]">{count}</span>
              {count === 0 && (
                <span className="text-[11px] text-[var(--text-muted)]">未检测到</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
