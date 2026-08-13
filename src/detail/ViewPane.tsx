import { useEffect, useState } from "react";
import Button from "../ui/Button";
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
  stale,
  canWriteBack,
  model,
  onTranslate,
  onWriteBack,
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
  stale: boolean;
  canWriteBack: boolean;
  model: string;
  onTranslate: () => void;
  onWriteBack: () => void;
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
          <>
            <Button onClick={onShowOriginal}>查看原文</Button>
            <Button onClick={onTranslate} disabled={translating}>
              {stale ? "重新翻译" : translating ? "翻译中…" : "翻译"}
            </Button>
          </>
        ) : (
          <>
            <Button
              onClick={onTranslate}
              disabled={translateDisabled}
              title={translateDisabled ? "在设置中配置 DeepSeek API Key" : undefined}
            >
              翻译
            </Button>
            {stale && (
              <span
                title="原文已更新,缓存译文可能过期,点击「翻译」重新生成"
                className="flex items-center gap-1 text-[11px] text-[var(--warning)]"
              >
                <span className="h-[5px] w-[5px] rounded-full bg-[var(--warning)]" />
                翻译已过期
              </span>
            )}
          </>
        )}
        <Button onClick={onSync}>同步到…</Button>
        <div className="flex-1" />
        {translateMode && canWriteBack && (
          <Button
            onClick={onWriteBack}
            title="用当前译文覆盖 SKILL.md 原文"
            className="border-transparent text-[var(--text-secondary)] hover:border-[var(--warning)]/40 hover:bg-[var(--warning)]/10 hover:text-[var(--warning)]"
          >
            用译文替换原文
          </Button>
        )}
        <Button onClick={onReveal}>打开目录</Button>
        <Button
          onClick={onDelete}
          className="border-transparent text-[var(--text-muted)] hover:border-[var(--danger)]/40 hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
        >
          删除
        </Button>
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
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[color-mix(in_srgb,var(--accent-from)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent-from)_12%,transparent)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)]">
              <span className="accent-gradient h-[5px] w-[5px] rounded-full" />
              已翻译 · {model}
            </span>
            {translating && (
              <span className="text-[11px] text-[var(--text-muted)]">流式翻译中…</span>
            )}
          </div>
        )}

        {translateMode && stale && !translating && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2">
            <span className="flex-1 text-[12px] text-[var(--warning)]">
              原文已更新,下方译文可能过期。
            </span>
            <Button onClick={onTranslate} className="border-[var(--warning)]/40 text-[var(--warning)] hover:bg-[var(--warning)]/10 hover:text-[var(--warning)]">
              重新翻译
            </Button>
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
            <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed border-[var(--border-strong)] px-4 py-3">
              <span className="text-[12px] text-[var(--text-muted)]">
                该副本还没有缓存翻译。
              </span>
              <Button onClick={onTranslate} disabled={translateDisabled}>
                立即翻译
              </Button>
            </div>
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
