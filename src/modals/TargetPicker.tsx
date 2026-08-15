import Checkbox from "../ui/Checkbox";
import { AGENT_META, AGENT_ORDER } from "../lib/agents";
import type { AgentId } from "../types/api";

/**
 * 目标 agent 选择网格(手动创建 / 命令添加共用):
 * 与「同步到…」弹窗同款样式 —— 8 个 agent 复选卡片 + 全选/清空快捷操作 + 「已存在」冲突徽标。
 */
export default function TargetPicker({
  targets,
  onChange,
  conflicts,
}: {
  targets: Set<AgentId>;
  onChange: (next: Set<AgentId>) => void;
  conflicts: AgentId[];
}) {
  const allSelected = targets.size === AGENT_ORDER.length;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="block text-[12px] text-[var(--text-secondary)]">
          目标 agent(已选 {targets.size}{targets.size === AGENT_ORDER.length ? " · 全部" : ""})
        </label>
        <button
          type="button"
          className="text-[11px] text-[var(--accent-from)] transition-opacity hover:opacity-75"
          onClick={() => onChange(allSelected ? new Set() : new Set(AGENT_ORDER))}
        >
          {allSelected ? "清空" : "全选"}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {AGENT_ORDER.map((a) => {
          const meta = AGENT_META[a];
          const checked = targets.has(a);
          const conflicted = conflicts.includes(a);
          return (
            <Checkbox
              key={a}
              checked={checked}
              onChange={() => {
                const next = new Set(targets);
                if (next.has(a)) next.delete(a);
                else next.add(a);
                onChange(next);
              }}
              className={`items-center rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors ${
                checked
                  ? "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                  : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
              }`}
            >
              <span className="h-[6px] w-[6px] rounded-full" style={{ background: meta.color }} />
              <span className="flex-1">{meta.display}</span>
              {conflicted && (
                <span className="rounded-md bg-[var(--warning)]/15 px-1.5 py-px text-[10px] text-[var(--warning)]">
                  已存在
                </span>
              )}
            </Checkbox>
          );
        })}
      </div>
    </div>
  );
}
