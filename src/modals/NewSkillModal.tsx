import { useMemo, useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Checkbox from "../ui/Checkbox";
import { AGENT_META, AGENT_ORDER } from "../lib/agents";
import { createSkill } from "../api/commands";
import { toast } from "../store/toast";
import { useSkillsStore } from "../store/skills";
import type { AgentId } from "../types/api";

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TEMPLATE = (name: string) => `# ${name}

## 描述

这个技能用于…

## 使用方式

- 步骤 1
- 步骤 2
`;

export default function NewSkillModal({ onClose }: { onClose: () => void }) {
  const scan = useSkillsStore((s) => s.scan);
  const refresh = useSkillsStore((s) => s.refresh);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [targets, setTargets] = useState<Set<AgentId>>(new Set());
  const [overwrite, setOverwrite] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const nameValid = name.length > 0 && NAME_RE.test(name);
  const nameError = name.length > 0 && !NAME_RE.test(name) ? "仅允许小写字母、数字、连字符(如 my-skill)" : null;

  // 冲突:勾选 target 中存在同名技能
  const conflicts = useMemo(() => {
    if (!scan || !nameValid) return [];
    const key = name.toLowerCase();
    return AGENT_ORDER.filter((a) => {
      if (!targets.has(a)) return false;
      const g = scan.groups.find((gg) => gg.name === key);
      return !!g && g.instances.some((i) => i.agent_id === a);
    });
  }, [scan, name, nameValid, targets]);

  const canSubmit = nameValid && targets.size > 0 && (conflicts.length === 0 || overwrite);

  const toggleTarget = (a: AgentId) => {
    setTargets((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  };

  const submit = () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    createSkill(name, description, body || TEMPLATE(name), AGENT_ORDER.filter((a) => targets.has(a)), overwrite)
      .then((r) => {
        let okCount = 0;
        for (const [, res] of r.results) {
          if ("Ok" in res) {
            okCount++;
          } else {
            toast.error(`创建到某 agent 失败: ${res.Err}`);
          }
        }
        if (okCount > 0) {
          toast.success(`已创建 ${name} 到 ${okCount} 个 agent`);
        }
        refresh();
        onClose();
      })
      .catch((e) => {
        toast.error(`创建失败: ${e?.message ?? e}`);
        setSubmitting(false);
      });
  };

  return (
    <Modal title="新建技能" onClose={onClose} width={560}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">名字</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value.trim())}
            placeholder="my-skill"
            autoFocus
          />
          {nameError && <p className="mt-1 text-[11px] text-[var(--danger)]">{nameError}</p>}
        </div>

        <div>
          <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">描述</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="一句话说明这个技能"
          />
        </div>

        <div>
          <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">正文 Markdown</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={TEMPLATE(name || "my-skill")}
            className="h-40 w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-[border-color,box-shadow] duration-150 hover:border-[var(--border-strong)] focus:border-[var(--accent-from)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-from)_18%,transparent)] focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">
            目标 agent(已选 {targets.size})
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {AGENT_ORDER.map((a) => {
              const meta = AGENT_META[a];
              const checked = targets.has(a);
              const conflicted = conflicts.includes(a);
              return (
                <Checkbox
                  key={a}
                  checked={checked}
                  onChange={() => toggleTarget(a)}
                  className={`items-center rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors ${
                    checked
                      ? "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                      : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
                  }`}
                >
                  <span className="h-[6px] w-[6px] rounded-full" style={{ background: meta.color }} />
                  <span className="flex-1">{meta.display}</span>
                  {conflicted && (
                    <span className="text-[10px] text-[var(--warning)]">已存在</span>
                  )}
                </Checkbox>
              );
            })}
          </div>
        </div>

        {conflicts.length > 0 && (
          <div className="rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2">
            <p className="text-[12px] text-[var(--warning)]">
              以下 agent 已有同名技能:{" "}
              {conflicts.map((a) => AGENT_META[a].display).join("、")}
            </p>
            <Checkbox
              checked={overwrite}
              onChange={setOverwrite}
              className="mt-1.5 text-[12px] text-[var(--text-secondary)]"
            >
              覆盖已有副本
            </Checkbox>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" disabled={!canSubmit || submitting} onClick={submit}>
            {submitting ? "创建中…" : "创建"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
