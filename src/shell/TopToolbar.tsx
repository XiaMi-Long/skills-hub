import { useSkillsStore } from "../store/skills";
import { useState } from "react";
import NewSkillModal from "../modals/NewSkillModal";

export default function TopToolbar() {
  const refresh = useSkillsStore((s) => s.refresh);
  const loading = useSkillsStore((s) => s.loading);
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="glass flex h-[46px] shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-3">
      <div className="text-[14px] font-semibold tracking-tight">skills-hub</div>
      <div className="ml-2 rounded-md bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] text-[var(--text-muted)] mono">
        v0.1 · M2
      </div>
      <div className="flex-1" />
      {/* 新建技能 */}
      <button
        onClick={() => setNewOpen(true)}
        className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
      >
        新建技能
      </button>
      <button
        onClick={() => refresh()}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
        </svg>
        {loading ? "扫描中…" : "重新扫描"}
      </button>
      {newOpen && <NewSkillModal onClose={() => setNewOpen(false)} />}
    </div>
  );
}
