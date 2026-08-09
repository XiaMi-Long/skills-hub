import { useEffect, useState } from "react";
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
  onSync,
  translateMode,
  translatedText,
  translating,
  translateError,
  translateDisabled,
  model,
  onTranslate,
  onShowOriginal,
}: {
  instance: SkillInstance;
  raw: string | null;
  loading: boolean;
  onReveal: () => void;
  onDelete: () => void;
  onSync: () => void;
  translateMode: boolean;
  translatedText: string | null;
  translating: boolean;
  translateError: string | null;
  translateDisabled: boolean;
  model: string;
  onTranslate: () => void;
  onShowOriginal: () => void;
}) {
  const meta = AGENT_META[instance.agent_id];
  const hasMd = instance.has_skill_md;

  // 流式翻译渲染节流 100ms
  const [rendered, setRendered] = useState<string>("");
  useEffect(() => {
    if (!translateMode) return;
    if (!translating) {
      setRendered(translatedText ?? "");
      return;
    }
    const t = setTimeout(() => setRendered(translatedText ?? ""), 100);
    return () => clearTimeout(t);
  }, [translateMode, translatedText, translating]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 工具条 */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-2">
        {translateMode ? (
          <button
            onClick={onShowOriginal}
            className="rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
          >
            查看原文
          </button>
        ) : (
          <button
            onClick={onTranslate}
            disabled={translateDisabled}
            title={
              translateDisabled
                ? "在设置中配置 DeepSeek API Key"
                : undefined
            }
            className={`rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] disabled:cursor-not-allowed disabled:opacity-50`}
          >
            翻译
          </button>
        )}
        <button
          onClick={onSync}
          className="rounded-lg px-2.5 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
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
        {translateMode && (
          <div className="mb-3 flex items-center gap-2">
            <span className="rounded-md bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
              已翻译 · {model}
            </span>
            {translating && (
              <span className="text-[11px] text-[var(--text-muted)]">流式翻译中…</span>
            )}
          </div>
        )}

        {translateMode ? (
          translateError ? (
            <div className="text-[12px] text-[var(--danger)]">翻译失败: {translateError}</div>
          ) : rendered ? (
            <Markdown text={rendered} />
          ) : translating ? (
            <div className="text-[12px] text-[var(--text-muted)]">等待翻译内容…</div>
          ) : (
            <div className="text-[12px] text-[var(--text-muted)]">暂无译文。</div>
          )
        ) : loading ? (
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
