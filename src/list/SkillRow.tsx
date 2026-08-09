import type { SkillGroup } from "../types/api";
import AgentBadge from "./AgentBadge";

export default function SkillRow({
  group,
  active,
  onClick,
}: {
  group: SkillGroup;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
        active
          ? "bg-[var(--bg-elevated)]"
          : "hover:bg-[var(--bg-elevated)]/60"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">
            {group.name}
          </span>
        </div>
        {group.instances[0]?.description && (
          <div className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
            {group.instances[0].description}
          </div>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          {group.instances.map((i) => (
            <AgentBadge key={i.agent_id} agentId={i.agent_id} dim={!i.has_skill_md} />
          ))}
        </div>
      </div>
      {/* 漂移橙点 */}
      {group.drift && (
        <span
          title="副本内容不一致"
          className="absolute top-1/2 right-1.5 h-[6px] w-[6px] -translate-y-1/2 rounded-full bg-[#f59e0b]"
        />
      )}
    </button>
  );
}
