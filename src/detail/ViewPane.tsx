import Markdown from "../md/Markdown";
import { displayPath } from "../lib/paths";
import type { SkillInstance } from "../types/api";
import { AGENT_META } from "../lib/agents";

export default function ViewPane({
  instance,
  raw,
  loading,
  onReveal,
  onDelete,
}: {
  instance: SkillInstance;
  raw: string | null;
  loading: boolean;
  onReveal: () => void;
  onDelete: () => void;
}) {
  const meta = AGENT_META[instance.agent_id];
  const hasMd = instance.has_skill_md;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 工具条 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-2">
        <button
          title="M5 实现:DeepSeek 翻译"
          disabled
          className="cursor-not-allowed rounded-lg px-2.5 py-1 text-[12px] text-[var(--text-muted)] opacity-60"
        >
          翻译
        </button>
        <button
          title="M3 实现:同步到其他 agent"
          disabled
          className="cursor-not-allowed rounded-lg px-2.5 py-1 text-[12px] text-[var(--text-muted)] opacity-60"
        >
          同步到…
        </button>
        <div className="flex-1" />
        <button
          onClick={onReveal}
          className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
        >
          打开目录
        </button>
        <button
          onClick={onDelete}
          className="rounded-lg px-2.5 py-1 text-[12px] text-[var(--text-muted)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
        >
          删除
        </button>
      </div>

      {/* Meta chips */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--border-subtle)] px-4 py-2">
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
          <span className="h-[6px] w-[6px] rounded-full" style={{ background: meta.color }} />
          {meta.display}
        </span>
        <span className="rounded-md bg-[var(--bg-elevated)] px-1.5 py-px text-[11px] text-[var(--text-secondary)]">
          scope=global
        </span>
        <span className="rounded-md bg-[var(--bg-elevated)] px-1.5 py-px text-[11px] text-[var(--text-secondary)]">
          辅助文件 {instance.supporting_files}
        </span>
        <span className="mono truncate text-[11px] text-[var(--text-muted)]" title={instance.abs_path}>
          {displayPath(instance.abs_path)}
        </span>
      </div>

      {/* 内容 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {loading ? (
          <div className="text-[12px] text-[var(--text-muted)]">加载中…</div>
        ) : !hasMd ? (
          <div className="text-[12px] text-[var(--text-muted)]">
            该副本没有 SKILL.md(仅有辅助文件),无法预览。
          </div>
        ) : raw === null ? (
          <div className="text-[12px] text-[var(--text-muted)]">读取失败。</div>
        ) : (
          <Markdown text={raw} />
        )}
      </div>
    </div>
  );
}
