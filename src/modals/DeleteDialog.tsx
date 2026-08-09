import { useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { AGENT_META } from "../lib/agents";
import { deleteSkill } from "../api/commands";
import { toast } from "../store/toast";
import { useSkillsStore } from "../store/skills";
import type { AgentId, DeleteScope, SkillGroup } from "../types/api";

export default function DeleteDialog({
  group,
  defaultAgent,
  onClose,
}: {
  group: SkillGroup;
  defaultAgent: AgentId;
  onClose: () => void;
}) {
  const refresh = useSkillsStore((s) => s.refresh);
  const [scope, setScope] = useState<DeleteScope>("thisCopy");
  const [deleting, setDeleting] = useState(false);

  const n = group.instances.length;

  const submit = () => {
    if (deleting) return;
    setDeleting(true);
    deleteSkill(defaultAgent, group.name, scope)
      .then(() => {
        toast.success(
          scope === "thisCopy" ? `已删除 ${AGENT_META[defaultAgent].display} 的副本` : `已删除全部 ${n} 个副本`,
        );
        refresh();
        onClose();
      })
      .catch((e) => {
        toast.error(`删除失败: ${e?.message ?? e}`);
        setDeleting(false);
      });
  };

  return (
    <Modal title="删除技能" onClose={onClose} width={440}>
      <div className="space-y-3">
        <p className="text-[13px] text-[var(--text-secondary)]">
          确定要删除 <span className="font-semibold text-[var(--text-primary)]">{group.name}</span> 吗?
          此操作不可撤销。
        </p>

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[13px] text-[var(--text-secondary)]">
          <input
            type="radio"
            checked={scope === "thisCopy"}
            onChange={() => setScope("thisCopy")}
            className="accent-[#f97316]"
          />
          <span>
            仅此副本
            <span className="ml-1.5 text-[11px] text-[var(--text-muted)]">
              {AGENT_META[defaultAgent].display}
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-[13px] text-[var(--text-secondary)]">
          <input
            type="radio"
            checked={scope === "allCopies"}
            onChange={() => setScope("allCopies")}
            className="accent-[#f97316]"
          />
          <span>
            所有副本
            <span className="ml-1.5 text-[11px] text-[var(--text-muted)]">共 {n} 个</span>
          </span>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onClose}>取消</Button>
          <Button variant="danger" disabled={deleting} onClick={submit}>
            {deleting ? "删除中…" : "删除"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
