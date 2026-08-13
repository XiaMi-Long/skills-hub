import { useMemo } from "react";
import { useSkillsStore } from "../store/skills";
import { AGENT_META, AGENT_ORDER } from "../lib/agents";
import type { AgentId, SkillGroup, SkillInstance } from "../types/api";

/** 详情列头部:agent 副本 badges,点击切换查看哪个副本。
 *  默认选 AGENTS 顺序第一个 has_skill_md 实例。 */
export default function InstanceSelector({
  group,
  active,
  onSelect,
}: {
  group: SkillGroup;
  active: SkillInstance;
  onSelect: (agentId: AgentId) => void;
}) {
  const viewAgent = useSkillsStore((s) => s.viewAgent);

  const ordered = useMemo(() => {
    const byOrder = new Map<AgentId, SkillInstance>(
      group.instances.map((i) => [i.agent_id, i]),
    );
    return AGENT_ORDER.filter((a) => byOrder.has(a)).map((a) => byOrder.get(a)!);
  }, [group]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ordered.map((inst) => {
        const meta = AGENT_META[inst.agent_id];
        const isActive = inst.agent_id === active.agent_id;
        const isSelected = viewAgent === inst.agent_id;
        return (
          <button
            key={inst.agent_id}
            onClick={() => onSelect(inst.agent_id)}
            title={inst.abs_path}
            className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] transition-colors ${
              isActive
                ? "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                : "border-transparent text-[var(--text-muted)] hover:border-[var(--border-subtle)] hover:text-[var(--text-secondary)]"
            }`}
          >
            <span
              className={`h-[6px] w-[6px] rounded-full ${inst.has_skill_md ? "" : "opacity-40"}`}
              style={{ background: meta.color }}
            />
            {meta.display}
            {!inst.has_skill_md && <span className="text-[10px] opacity-70">无 SKILL.md</span>}
            {isSelected && (
              <span className="accent-gradient h-[5px] w-[5px] rounded-full" title="当前查看" />
            )}
          </button>
        );
      })}
    </div>
  );
}
