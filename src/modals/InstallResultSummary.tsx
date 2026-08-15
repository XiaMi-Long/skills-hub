import Button from "../ui/Button";
import { AGENT_META } from "../lib/agents";
import type { AgentId, SkillInstance } from "../types/api";

/** 命令添加(远程安装)的逐 agent 结果汇总,样式与同步结果一致。 */
export default function InstallResultSummary({
  skillName,
  results,
  onClose,
}: {
  skillName: string;
  results: [AgentId, { Ok: SkillInstance } | { Err: string }][];
  onClose: () => void;
}) {
  const okCount = results.filter(([, r]) => "Ok" in r).length;
  return (
    <div>
      <div className="mb-3 text-[12px] text-[var(--text-secondary)]">
        <span className="font-semibold text-[var(--text-primary)]">{skillName}</span>{" "}
        <span className="text-[var(--text-muted)]">添加完成</span>
        <span className="ml-2 rounded-md bg-[var(--bg-elevated)] px-1.5 py-px text-[11px]">
          ✓ {okCount} / 共 {results.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {results.map(([agent, r]) => {
          const meta = AGENT_META[agent];
          const ok = "Ok" in r;
          return (
            <div
              key={agent}
              className="flex items-start gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2"
            >
              <span
                className={`mt-0.5 text-[13px] ${ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
              >
                {ok ? "✓" : "✗"}
              </span>
              <span className="h-[6px] w-[6px] rounded-full shrink-0 mt-1.5" style={{ background: meta.color }} />
              <div className="min-w-0">
                <div className="text-[13px] text-[var(--text-primary)]">{meta.display}</div>
                {!ok && (
                  <div className="text-[11px] text-[var(--danger)]">{"Err" in r ? r.Err : ""}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" onClick={onClose}>
          完成
        </Button>
      </div>
    </div>
  );
}
