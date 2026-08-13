import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Checkbox from "../ui/Checkbox";
import { AGENT_META, AGENT_ORDER } from "../lib/agents";
import { syncSkill } from "../api/commands";
import { useSkillsStore } from "../store/skills";
import type { AgentId, OnConflict, SkillGroup } from "../types/api";
import { useState } from "react";
import SyncResultSummary from "./SyncResultSummary";
import ConflictResolver from "./ConflictResolver";

type Step = "targets" | "conflict" | "result";

export type SyncTargetRow = {
  agent: AgentId;
  exists: boolean;
  conflict: OnConflict;
};

export default function SyncModal({
  group,
  sourceAgent,
  onClose,
}: {
  group: SkillGroup;
  sourceAgent: AgentId;
  onClose: () => void;
}) {
  const refresh = useSkillsStore((s) => s.refresh);

  const [step, setStep] = useState<Step>("targets");
  const [targets, setTargets] = useState<Set<AgentId>>(
    () =>
      new Set(
        AGENT_ORDER.filter(
          (a) => a !== sourceAgent && !group.instances.some((i) => i.agent_id === a),
        ),
      ),
  );
  const [rows, setRows] = useState<SyncTargetRow[]>(
    () =>
      AGENT_ORDER.filter((a) => a !== sourceAgent).map((a) => ({
        agent: a,
        exists: group.instances.some((i) => i.agent_id === a),
        conflict: "overwrite" as OnConflict,
      })),
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<[AgentId, { Ok: null } | { Err: string }][] | null>(null);

  const existsTargets = rows.filter((r) => r.exists && targets.has(r.agent));
  const anyTarget = targets.size > 0;

  const toggle = (a: AgentId) => {
    setTargets((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  };

  const applyAll = (c: OnConflict) => {
    setRows((rs) => rs.map((r) => (r.exists ? { ...r, conflict: c } : r)));
  };

  const setRowConflict = (a: AgentId, c: OnConflict) => {
    setRows((rs) => rs.map((r) => (r.agent === a ? { ...r, conflict: c } : r)));
  };

  const execute = (choiceRows: SyncTargetRow[]) => {
    setRunning(true);
    const directives = choiceRows
      .filter((r) => targets.has(r.agent))
      .map((r) => ({ target: r.agent, on_conflict: r.exists ? r.conflict : ("overwrite" as OnConflict) }));
    syncSkill(sourceAgent, group.name, directives)
      .then((r) => {
        setResult(r.results);
        setStep("result");
        setRunning(false);
        refresh();
      })
      .catch((e) => {
        setRunning(false);
        setStep("result");
        setResult([[sourceAgent, { Err: `同步请求失败: ${e?.message ?? e}` }]]);
      });
  };

  return (
    <Modal
      title="同步到…"
      onClose={onClose}
      width={560}
    >
      {step === "targets" && (
        <div>
          <div className="mb-3 flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
            源:
            <span className="flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] px-2 py-0.5">
              <span
                className="h-[6px] w-[6px] rounded-full"
                style={{ background: AGENT_META[sourceAgent].color }}
              />
              {AGENT_META[sourceAgent].display}
            </span>
            <span className="mono text-[11px] text-[var(--text-muted)]">{group.name}</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {rows.map((r) => {
              const meta = AGENT_META[r.agent];
              const checked = targets.has(r.agent);
              return (
                <Checkbox
                  key={r.agent}
                  checked={checked}
                  onChange={() => toggle(r.agent)}
                  className={`items-center rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors ${
                    checked
                      ? "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                      : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
                  }`}
                >
                  <span className="h-[6px] w-[6px] rounded-full" style={{ background: meta.color }} />
                  <span className="flex-1">{meta.display}</span>
                  {r.exists && (
                    <span className="rounded-md bg-[var(--warning)]/15 px-1.5 py-px text-[10px] text-[var(--warning)]">
                      已存在
                    </span>
                  )}
                </Checkbox>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-muted)]">
              已选 {targets.size} 个 target
              {existsTargets.length > 0 && ` · ${existsTargets.length} 个存在冲突`}
            </span>
            <div className="flex gap-2">
              <Button onClick={onClose}>取消</Button>
              <Button
                variant="primary"
                disabled={!anyTarget || running}
                onClick={() => {
                  if (existsTargets.length > 0) setStep("conflict");
                  else execute(rows);
                }}
              >
                下一步
              </Button>
            </div>
          </div>
        </div>
      )}

      {step === "conflict" && (
        <ConflictResolver
          rows={rows.filter((r) => r.exists && targets.has(r.agent))}
          onSet={(a, c) => setRowConflict(a, c)}
          onApplyAll={applyAll}
          onBack={() => setStep("targets")}
          onConfirm={() => execute(rows)}
        />
      )}

      {step === "result" && result && (
        <SyncResultSummary
          sourceAgent={sourceAgent}
          groupName={group.name}
          results={result}
          onClose={() => {
            onClose();
          }}
        />
      )}
    </Modal>
  );
}
