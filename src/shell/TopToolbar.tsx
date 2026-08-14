import { useState } from "react";
import Button from "../ui/Button";
import { useSkillsStore } from "../store/skills";
import NewSkillModal from "../modals/NewSkillModal";

export default function TopToolbar() {
  const refresh = useSkillsStore((s) => s.refresh);
  const loading = useSkillsStore((s) => s.loading);
  const [newOpen, setNewOpen] = useState(false);

  return (
    <div className="glass flex h-[46px] shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-3">
      <div className="flex-1" />
      {/* 新建技能:工具栏唯一主操作,用 accent 强调 */}
      <Button variant="primary" onClick={() => setNewOpen(true)}>
        新建技能
      </Button>
      <Button onClick={() => refresh()} disabled={loading} className="flex items-center gap-1.5">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
        </svg>
        {loading ? "扫描中…" : "重新扫描"}
      </Button>
      {newOpen && <NewSkillModal onClose={() => setNewOpen(false)} />}
    </div>
  );
}
