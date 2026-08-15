import { useState, type ReactNode } from "react";
import { testDeepseek } from "../../api/commands";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import Segmented from "../../ui/Segmented";
import Select from "../../ui/Select";
import SectionTitle from "../SectionTitle";
import type { Settings, SkillOpenView, TranslateTo } from "../../types/api";

const MODELS = ["deepseek-v4-flash", "deepseek-v4-pro"];

/** 表单行:左侧固定宽度标签 + 右侧控件(设置页经典排版) */
function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <label className="w-[110px] shrink-0 pt-1.5 text-[12px] text-[var(--text-secondary)]">
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * @description AI 翻译面板(重设计):顶部连接状态卡 + 接口配置区 + 翻译偏好区。
 * 配置改动自动保存;连接测试前先立即持久化草稿,保证后端读到最新配置。
 * @param draft - 当前设置草稿
 * @param onChange - 更新草稿回调
 * @param persist - 立即持久化(连接测试前调用)
 */
export default function TranslatePanel({
  draft,
  onChange,
  persist,
}: {
  draft: Settings;
  onChange: (s: Settings) => void;
  persist: (s: Settings) => Promise<void>;
}) {
  const [testing, setTesting] = useState(false);
  const [customModel, setCustomModel] = useState(false);
  // 连接测试结果(行内反馈)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const configured = draft.deepseek.api_key.trim().length > 0;

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      await persist(draft);
      const r = await testDeepseek();
      setTestResult(r);
    } catch (e) {
      setTestResult({
        ok: false,
        message: `连接测试失败: ${(e as { message?: string })?.message ?? e}`,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 连接状态卡 */}
      <section className="flex items-center gap-4 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-pane)]/60 p-4">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${configured ? "bg-[var(--success)]" : "bg-[var(--text-muted)]"}`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-[var(--text-primary)]">DeepSeek 翻译服务</div>
          <div className="truncate text-[11px] text-[var(--text-muted)]">
            {configured
              ? `已配置 API Key(…${draft.deepseek.api_key.slice(-4)}),可直接翻译`
              : "未配置 API Key,请在「接口配置」中填写"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {testResult && (
            <span className={`max-w-[220px] truncate text-[11px] ${testResult.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
              {testResult.ok ? "✓" : "✗"} {testResult.message}
            </span>
          )}
          <Button onClick={test} disabled={testing}>
            {testing ? "测试中…" : "连接测试"}
          </Button>
        </div>
      </section>

      {/* 接口配置 */}
      <section>
        <SectionTitle title="接口配置" desc="DeepSeek API 连接参数" />
        <div className="space-y-4 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-pane)]/60 p-4">
          <FieldRow label="API Key">
            <Input
              type="password"
              value={draft.deepseek.api_key}
              onChange={(e) =>
                onChange({ ...draft, deepseek: { ...draft.deepseek, api_key: e.target.value } })
              }
              placeholder="sk-…"
            />
            <p className="mt-1 text-[11px] text-[var(--warning)]">
              ⚠ key 仅存本机 app 数据目录(明文),不会上传任何其他位置
            </p>
          </FieldRow>

          <FieldRow label="模型">
            <Select
              value={customModel ? "custom" : draft.deepseek.model}
              onChange={(v) => {
                if (v === "custom") setCustomModel(true);
                else {
                  setCustomModel(false);
                  onChange({ ...draft, deepseek: { ...draft.deepseek, model: v } });
                }
              }}
              options={[
                ...MODELS.map((m) => ({ value: m, label: m })),
                { value: "custom", label: "自定义…" },
              ]}
            />
            {customModel && (
              <Input
                className="mt-1.5"
                value={draft.deepseek.model}
                onChange={(e) =>
                  onChange({ ...draft, deepseek: { ...draft.deepseek, model: e.target.value } })
                }
                placeholder="模型名"
              />
            )}
          </FieldRow>

          <FieldRow label="Base URL">
            <Input
              value={draft.deepseek.base_url}
              onChange={(e) =>
                onChange({ ...draft, deepseek: { ...draft.deepseek, base_url: e.target.value } })
              }
              placeholder="https://api.deepseek.com/v1"
            />
          </FieldRow>
        </div>
      </section>

      {/* 翻译偏好 */}
      <section>
        <SectionTitle title="翻译偏好" desc="默认目标语言与打开视图" />
        <div className="space-y-4 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-pane)]/60 p-4">
          <FieldRow label="目标语言">
            <Segmented<TranslateTo>
              value={draft.deepseek.translate_to}
              onChange={(v) =>
                onChange({ ...draft, deepseek: { ...draft.deepseek, translate_to: v } })
              }
              options={[
                { value: "zh", label: "中文" },
                { value: "en", label: "英文" },
              ]}
            />
          </FieldRow>

          <FieldRow label="默认视图">
            <div>
              <Segmented<SkillOpenView>
                value={draft.default_view}
                onChange={(v) => onChange({ ...draft, default_view: v })}
                options={[
                  { value: "original", label: "原文" },
                  { value: "translated", label: "译文" },
                ]}
              />
              <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                选「译文」时,打开技能优先显示缓存翻译;无缓存会提示翻译,原文变更后提示重新翻译。
              </p>
            </div>
          </FieldRow>
        </div>
      </section>
    </div>
  );
}
