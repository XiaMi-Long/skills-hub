export default function TopToolbar() {
  return (
    <div className="glass flex h-[46px] shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-3">
      <div className="text-[14px] font-semibold tracking-tight">skills-hub</div>
      <div className="ml-2 rounded-md bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] text-[var(--text-muted)] mono">
        v0.1 · M0
      </div>
      <div className="flex-1" />
      {/* M0 占位:后续放 新建技能 / 重新扫描 / 设置 */}
      <span className="text-[12px] text-[var(--text-muted)]">脚手架就绪</span>
    </div>
  );
}
