import Button from "../ui/Button";
import Radio from "../ui/Radio";
import { AGENT_META } from "../lib/agents";
import type { AgentId, OnConflict } from "../types/api";
import type { SyncTargetRow } from "./SyncModal";

export default function ConflictResolver({
  rows,
  onSet,
  onApplyAll,
  onBack,
  onConfirm,
}: {
  rows: SyncTargetRow[];
  onSet: (a: AgentId, c: OnConflict) => void;
  onApplyAll: (c: OnConflict) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div>
      <p className="mb-3 text-[12px] text-[var(--text-secondary)]">
        以下 agent 已存在同名技能,选择处理方式:
      </p>

      {/* 应用到全部 */}
      <div className="mb-3 flex items-center gap-2 text-[12px]">
        <span className="text-[var(--text-muted)]">应用到全部:</span>
        <button
          onClick={() => onApplyAll("overwrite")}
          className="rounded-md border border-[var(--border-subtle)] px-2 py-0.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
        >
          覆盖
        </button>
        <button
          onClick={() => onApplyAll("skip")}
          className="rounded-md border border-[var(--border-subtle)] px-2 py-0.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
        >
          跳过
        </button>
      </div>

      <div className="space-y-1.5">
        {rows.map((r) => {
          const meta = AGENT_META[r.agent];
          return (
            <div
              key={r.agent}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2"
            >
              <span className="h-[6px] w-[6px] rounded-full" style={{ background: meta.color }} />
              <span className="flex-1 text-[13px] text-[var(--text-primary)]">{meta.display}</span>
              <Radio
                checked={r.conflict === "overwrite"}
                onChange={() => onSet(r.agent, "overwrite")}
                className="text-[12px] text-[var(--text-secondary)]"
              >
                覆盖
              </Radio>
              <Radio
                checked={r.conflict === "skip"}
                onChange={() => onSet(r.agent, "skip")}
                className="text-[12px] text-[var(--text-secondary)]"
              >
                跳过
              </Radio>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onBack}>返回</Button>
        <Button variant="primary" onClick={onConfirm}>
          开始同步
        </Button>
      </div>
    </div>
  );
}
