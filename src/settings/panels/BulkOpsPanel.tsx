import { useState, type ReactNode } from "react";
import {
  cancelTranslateAll,
  countReplaceableTranslations,
  replaceAllWithTranslations,
  translateAll,
} from "../../api/commands";
import { useSkillsStore } from "../../store/skills";
import { useTranslateStore } from "../../store/translate";
import { toast } from "../../store/toast";
import Button from "../../ui/Button";
import ConfirmDialog from "../../ui/ConfirmDialog";
import type { CountReplaceableResult } from "../../types/api";

/** 操作卡头部:图标块 + 标题 + 状态 chip + 副标题 */
function CardHead({
  icon,
  title,
  chip,
  chipClass,
  desc,
  danger,
}: {
  icon: ReactNode;
  title: string;
  chip?: string;
  chipClass?: string;
  desc: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${
          danger ? "bg-[var(--danger)]/12 text-[var(--danger)]" : "bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className={`text-[13px] font-semibold ${danger ? "text-[var(--danger)]" : "text-[var(--text-primary)]"}`}>
            {title}
          </h3>
          {chip && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] ${chipClass ?? "bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`}>
              {chip}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{desc}</p>
      </div>
    </div>
  );
}

/**
 * @description 批量操作面板(重设计):两张结构化操作卡。
 * 「一键翻译全部」带完整进度与取消;「用译文替换原文」为独立危险卡(红色警示 + 二次确认 + 数量标红)。
 * @param apiKeyConfigured - 是否已配置 API Key(未配置则翻译按钮禁用)
 */
export default function BulkOpsPanel({ apiKeyConfigured }: { apiKeyConfigured: boolean }) {
  const refresh = useSkillsStore((s) => s.refresh);
  const batch = useTranslateStore((s) => s.batch);

  // 一键替换:二次确认数据(null = 弹窗关闭)
  const [replaceConfirm, setReplaceConfirm] = useState<CountReplaceableResult | null>(null);
  const [counting, setCounting] = useState(false);
  const [replacing, setReplacing] = useState(false);

  const startBatch = async () => {
    try {
      const r = await translateAll();
      useTranslateStore.getState().batchStart(r.total);
      toast.info(`已开始批量翻译 ${r.total} 个技能(内容去重后),可在下方查看进度`);
    } catch (e) {
      toast.error(`启动失败: ${(e as { message?: string })?.message ?? e}`);
    }
  };

  const cancelBatch = () => {
    cancelTranslateAll().catch(() => {});
  };

  /**
   * 点击「用译文替换原文」:先预检可替换数量,再弹二次确认
   * @returns {Promise<void>}
   * @reasoning 替换会永久覆盖原文,先用轻量本地计数给出数量,让用户在确认弹窗里看到影响范围
   * @changeLog
   * - Created
   */
  const askReplaceAll = async () => {
    setCounting(true);
    try {
      const r = await countReplaceableTranslations();

      // 无可用译文:不弹窗,直接提示先翻译
      if (r.replaceable === 0) {
        toast.info("没有可替换的技能:请先「翻译全部」(译文过期的副本不会被替换)");
        return;
      }

      setReplaceConfirm(r);
    } catch (e) {
      toast.error(`查询失败: ${(e as { message?: string })?.message ?? e}`);
    } finally {
      setCounting(false);
    }
  };

  /**
   * 执行批量替换:命中译文缓存的副本逐个用译文覆盖原文,完成后重扫列表
   * @returns {Promise<void>}
   * @changeLog
   * - Created
   */
  const doReplaceAll = async () => {
    setReplacing(true);
    try {
      const r = await replaceAllWithTranslations();

      if (r.failed === 0) {
        toast.success(
          `已用译文替换 ${r.replaced} 个副本${r.skipped ? `,跳过 ${r.skipped} 个无可用译文` : ""}`,
        );
      } else {
        const first = r.errors[0];
        toast.error(
          `替换完成:成功 ${r.replaced} 个,跳过 ${r.skipped} 个,失败 ${r.failed} 个${first ? ` · ${first.name}: ${first.message}` : ""}`,
        );
      }

      setReplaceConfirm(null);
      refresh();
    } catch (e) {
      toast.error(`替换失败: ${(e as { message?: string })?.message ?? e}`);
    } finally {
      setReplacing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 一键翻译全部 */}
      <section className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-pane)]/60 p-5">
        <CardHead
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
            </svg>
          }
          title="一键翻译全部"
          chip={batch.running ? `翻译中 ${batch.done}/${batch.total}` : "空闲"}
          chipClass={batch.running ? "bg-[var(--accent-from)]/12 text-[var(--accent-from)]" : undefined}
          desc="按内容去重后依次翻译全部已安装 skill 并写入本地缓存,之后打开即可直接显示译文"
        />

        <p className="mt-4 text-[12px] text-[var(--warning)]">注意:会消耗 DeepSeek API 额度。</p>

        {/* 运行中:进度 + 当前项 + 取消 */}
        {batch.running && (
          <div className="mt-4 space-y-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
              <div
                className="accent-gradient h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${batch.total ? Math.round((batch.done / batch.total) * 100) : 0}%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[var(--text-secondary)]">
                已处理 {batch.done}/{batch.total}
                {batch.current ? ` · 当前: ${batch.current}` : ""}
              </span>
              <Button onClick={cancelBatch}>取消</Button>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="primary"
            disabled={!apiKeyConfigured || batch.running}
            title={!apiKeyConfigured ? "请先配置 DeepSeek API Key" : undefined}
            onClick={startBatch}
          >
            {batch.running ? "翻译中…" : "开始翻译全部"}
          </Button>
          {!apiKeyConfigured && (
            <span className="text-[11px] text-[var(--text-muted)]">请先在「AI 翻译」中配置 API Key</span>
          )}
        </div>
      </section>

      {/* 用译文替换原文(危险区) */}
      <section className="rounded-[12px] border border-[var(--danger)]/35 bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] p-5">
        <CardHead
          danger
          icon={
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
              <path d="M12 9v4m0 4h.01" />
            </svg>
          }
          title="用译文替换原文"
          chip="危险"
          chipClass="bg-[var(--danger)]/12 text-[var(--danger)]"
          desc="把已有可用译文(命中缓存)的 SKILL.md 用译文覆盖原文,建议先执行「一键翻译全部」"
        />

        <p className="mt-4 text-[12px] text-[var(--text-secondary)]">
          覆盖后原文无法恢复,请确认已有译文内容后再操作。
        </p>

        <div className="mt-4">
          <Button
            variant="danger"
            disabled={batch.running || counting || replacing}
            title={batch.running ? "批量翻译运行中,请等待完成" : undefined}
            onClick={askReplaceAll}
          >
            {counting ? "统计中…" : replacing ? "替换中…" : "用译文替换原文"}
          </Button>
        </div>
      </section>

      {replaceConfirm && (
        <ConfirmDialog
          title="用译文替换原文"
          danger
          confirmText={replacing ? "替换中…" : "确认替换"}
          message={
            <>
              有
              <span className="mx-1 font-semibold text-[var(--danger)]">
                {replaceConfirm.replaceable}
              </span>
              个副本已有可用译文,确认后这些 SKILL.md 将被译文覆盖(原文无法恢复);另有
              <span className="mx-1 font-semibold text-[var(--danger)]">
                {replaceConfirm.total - replaceConfirm.replaceable}
              </span>
              个副本因未翻译或译文过期会被跳过。
            </>
          }
          onConfirm={doReplaceAll}
          onCancel={() => {
            if (!replacing) setReplaceConfirm(null);
          }}
        />
      )}
    </div>
  );
}
