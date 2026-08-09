import { useEffect, useState } from "react";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import { writeSkillMd } from "../api/commands";
import { toast } from "../store/toast";
import { useSkillsStore } from "../store/skills";
import type { CommandError, SkillInstance } from "../types/api";

/**
 * CodeMirror 懒加载(避免影响首屏)。编辑态才挂载。
 */
function CodeMirrorEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [view, setView] = useState<import("@codemirror/view").EditorView | null>(null);

  useEffect(() => {
    let cancelled = false;
    let v: import("@codemirror/view").EditorView | null = null;
    (async () => {
      const { EditorView } = await import("@codemirror/view");
      const { createEditorExtensions } = await import("../editor/cm-setup");
      if (cancelled) return;
      v = new EditorView({
        doc: value,
        parent: document.getElementById("cm-host")!,
        extensions: [
          ...createEditorExtensions(),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChange(u.state.doc.toString());
          }),
        ],
      });
      setView(v);
    })();
    return () => {
      cancelled = true;
      v?.destroy();
      setView(null);
    };
  }, []);

  useEffect(() => {
    // 外部 value 变化(如 force 重载后)同步进编辑器
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value, view]);

  return <div id="cm-host" className="h-full" />;
}

export default function EditPane({
  groupName,
  agentId,
  initialRaw,
  loadedMtime,
  onSaved,
  onCancel,
}: {
  groupName: string;
  agentId: string;
  initialRaw: string;
  loadedMtime: number;
  onSaved: (inst: SkillInstance, savedRaw: string) => void;
  onCancel: () => void;
}) {
  const [raw, setRaw] = useState(initialRaw);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [conflictOpen, setConflictOpen] = useState(false);
  const refresh = useSkillsStore((s) => s.refresh);

  const doSave = (force: boolean) => {
    setSaving(true);
    writeSkillMd(agentId as never, groupName, raw, loadedMtime, force)
      .then((inst) => {
        setSaving(false);
        setDirty(false);
        toast.success("已保存");
        onSaved(inst, raw);
        refresh();
      })
      .catch((e: CommandError) => {
        setSaving(false);
        if (e?.code === "file_changed_on_disk") {
          setConflictOpen(true);
          return;
        }
        toast.error(`保存失败: ${e?.message ?? e}`);
      });
  };

  // Ctrl+S 保存
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        doSave(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [raw, loadedMtime]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-2">
        <span className="text-[12px] text-[var(--text-muted)]">编辑 {groupName}</span>
        {dirty && (
          <span className="rounded-md bg-[var(--bg-elevated)] px-1.5 py-px text-[11px] text-[#f59e0b]">
            未保存
          </span>
        )}
        <div className="flex-1" />
        <Button onClick={onCancel} disabled={saving}>
          取消
        </Button>
        <Button variant="primary" onClick={() => doSave(false)} disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <CodeMirrorEditor
          value={raw}
          onChange={(v) => {
            setRaw(v);
            setDirty(true);
          }}
        />
      </div>

      {conflictOpen && (
        <ConfirmDialog
          title="文件已在磁盘上被修改"
          message="该 SKILL.md 在磁盘上已被外部修改。仍要覆盖吗?"
          confirmText="仍要覆盖"
          danger
          onConfirm={() => {
            setConflictOpen(false);
            doSave(true);
          }}
          onCancel={() => setConflictOpen(false)}
        />
      )}
    </div>
  );
}
