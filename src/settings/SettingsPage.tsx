import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { AGENT_META, AGENT_ORDER } from "../lib/agents";
import { ACCENTS } from "../lib/accents";
import { cancelTranslateAll, testDeepseek, translateAll } from "../api/commands";
import { useSettingsStore } from "../store/settings";
import { useSkillsStore } from "../store/skills";
import { useAppStore } from "../store/app";
import { useTranslateStore } from "../store/translate";
import { toast } from "../store/toast";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Radio from "../ui/Radio";
import Select from "../ui/Select";
import type { AgentId, Settings, SkillOpenView, Theme, TranslateTo } from "../types/api";

const MODELS = ["deepseek-chat", "deepseek-reasoner"];

export default function SettingsPage({ onBack }: { onBack: () => void }) {
  const stored = useSettingsStore((s) => s.settings);
  const saveSettings = useSettingsStore((s) => s.save);
  const refresh = useSkillsStore((s) => s.refresh);
  const setTheme = useAppStore((s) => s.setTheme);
  const setAccent = useAppStore((s) => s.setAccent);
  const batch = useTranslateStore((s) => s.batch);

  const [draft, setDraft] = useState<Settings | null>(stored);
  const [testing, setTesting] = useState(false);
  const [customModel, setCustomModel] = useState(false);

  useEffect(() => {
    if (stored) setDraft(stored);
  }, [stored]);

  if (!draft) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-pane)]">
        <span className="text-[13px] text-[var(--text-muted)]">加载设置…</span>
      </div>
    );
  }

  const setTheme2 = (t: Theme) => {
    setDraft({ ...draft, theme: t });
    setTheme(t);
  };

  const setOverride = (a: AgentId, p: string) => {
    const overrides = { ...draft.agent_overrides };
    if (p.trim()) overrides[a] = p.trim();
    else delete overrides[a];
    setDraft({ ...draft, agent_overrides: overrides });
  };

  const resetOverride = (a: AgentId) => {
    const overrides = { ...draft.agent_overrides };
    delete overrides[a];
    setDraft({ ...draft, agent_overrides: overrides });
  };

  const browse = async (a: AgentId) => {
    const dir = await open({ directory: true, title: `选择 ${AGENT_META[a].display} skills 目录` });
    if (typeof dir === "string") setOverride(a, dir);
  };

  const saveAll = async () => {
    try {
      await saveSettings(draft);
      toast.success("设置已保存");
    } catch (e) {
      toast.error(`保存失败: ${(e as { message?: string })?.message ?? e}`);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      await saveSettings(draft);
      const r = await testDeepseek();
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } catch (e) {
      toast.error(`连接测试失败: ${(e as { message?: string })?.message ?? e}`);
    } finally {
      setTesting(false);
    }
  };

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

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg-pane)]">
      <div className="mx-auto max-w-[720px] px-6 py-5">
        <div className="mb-4 flex items-center gap-3">
          <Button onClick={onBack}>← 返回</Button>
          <h1 className="text-[16px] font-semibold text-[var(--text-primary)]">设置</h1>
        </div>

        {/* 主题 */}
        <section className="mb-5 rounded-[10px] border border-[var(--border-subtle)] p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">主题</h2>
          <div className="flex gap-5">
            {(["dark", "light", "system"] as Theme[]).map((t) => (
              <Radio
                key={t}
                checked={draft.theme === t}
                onChange={() => setTheme2(t)}
                className="text-[13px] text-[var(--text-secondary)]"
              >
                {t === "dark" ? "暗色" : t === "light" ? "亮色" : "跟随系统"}
              </Radio>
            ))}
          </div>
        </section>

        {/* 色调 */}
        <section className="mb-5 rounded-[10px] border border-[var(--border-subtle)] p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">色调</h2>
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => {
              const active = draft.accent === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    setDraft({ ...draft, accent: a.id });
                    setAccent(a.id);
                  }}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] transition-colors ${
                    active
                      ? "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                      : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]/50"
                  }`}
                >
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ background: `linear-gradient(90deg, ${a.from}, ${a.to})` }}
                  />
                  {a.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Agent 路径 */}
        <section className="mb-5 rounded-[10px] border border-[var(--border-subtle)] p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">
            Agent 路径覆盖
          </h2>
          <div className="space-y-2">
            {AGENT_ORDER.map((a) => {
              const meta = AGENT_META[a];
              const overridden = draft.agent_overrides[a];
              return (
                <div key={a} className="flex items-center gap-2">
                  <span className="flex w-[110px] shrink-0 items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                    <span className="h-[6px] w-[6px] rounded-full" style={{ background: meta.color }} />
                    {meta.display}
                  </span>
                  <div className="relative min-w-0 flex-1">
                    <Input
                      value={overridden ?? ""}
                      onChange={(e) => setOverride(a, e.target.value)}
                      placeholder={`默认: ~/${meta.defaultSubpath}`}
                      className="pr-24"
                    />
                    {!overridden && (
                      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">
                        默认路径
                      </span>
                    )}
                  </div>
                  <Button onClick={() => browse(a)}>浏览…</Button>
                  <Button onClick={() => resetOverride(a)} disabled={!overridden}>
                    重置
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        {/* DeepSeek */}
        <section className="mb-5 rounded-[10px] border border-[var(--border-subtle)] p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">DeepSeek 翻译</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">API Key</label>
              <Input
                type="password"
                value={draft.deepseek.api_key}
                onChange={(e) => setDraft({ ...draft, deepseek: { ...draft.deepseek, api_key: e.target.value } })}
                placeholder="sk-…"
              />
              <p className="mt-1 text-[11px] text-[var(--warning)]">
                ⚠ key 仅存本机 app 数据目录(明文),不会上传任何其他位置
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">模型</label>
                <Select
                  value={customModel ? "custom" : draft.deepseek.model}
                  onChange={(v) => {
                    if (v === "custom") setCustomModel(true);
                    else {
                      setCustomModel(false);
                      setDraft({ ...draft, deepseek: { ...draft.deepseek, model: v } });
                    }
                  }}
                  options={[...MODELS.map((m) => ({ value: m, label: m })), { value: "custom", label: "自定义…" }]}
                />
                {customModel && (
                  <Input
                    className="mt-1.5"
                    value={draft.deepseek.model}
                    onChange={(e) => setDraft({ ...draft, deepseek: { ...draft.deepseek, model: e.target.value } })}
                    placeholder="模型名"
                  />
                )}
              </div>
              <div>
                <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">Base URL</label>
                <Input
                  value={draft.deepseek.base_url}
                  onChange={(e) => setDraft({ ...draft, deepseek: { ...draft.deepseek, base_url: e.target.value } })}
                  placeholder="https://api.deepseek.com/v1"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">目标语言</label>
              <div className="flex gap-5">
                {(["zh", "en"] as TranslateTo[]).map((t) => (
                  <Radio
                    key={t}
                    checked={draft.deepseek.translate_to === t}
                    onChange={() =>
                      setDraft({ ...draft, deepseek: { ...draft.deepseek, translate_to: t } })
                    }
                    className="text-[13px] text-[var(--text-secondary)]"
                  >
                    {t === "zh" ? "中文" : "英文"}
                  </Radio>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">打开技能时默认显示</label>
              <div className="flex gap-5">
                {(["original", "translated"] as SkillOpenView[]).map((v) => (
                  <Radio
                    key={v}
                    checked={draft.default_view === v}
                    onChange={() => setDraft({ ...draft, default_view: v })}
                    className="text-[13px] text-[var(--text-secondary)]"
                  >
                    {v === "original" ? "原文" : "译文"}
                  </Radio>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                选「译文」时,打开技能优先显示缓存翻译;无缓存会提示翻译,原文变更后提示重新翻译。
              </p>
            </div>
            <div>
              <Button onClick={test} disabled={testing}>
                {testing ? "测试中…" : "连接测试"}
              </Button>
            </div>
          </div>
        </section>

        {/* 一键翻译全部 */}
        <section className="mb-5 rounded-[10px] border border-[var(--border-subtle)] p-4">
          <h2 className="mb-3 text-[13px] font-semibold text-[var(--text-primary)]">一键翻译全部</h2>
          <p className="mb-3 text-[12px] leading-relaxed text-[var(--text-secondary)]">
            按内容去重后依次翻译全部已安装 skill 并写入本地缓存,之后打开即可直接显示译文。
            <span className="text-[var(--warning)]">注意:会消耗 DeepSeek API 额度。</span>
          </p>
          <div className="mb-3 flex items-center gap-2">
            <Button
              variant="primary"
              disabled={!draft.deepseek.api_key.trim() || batch.running}
              title={!draft.deepseek.api_key.trim() ? "请先配置 DeepSeek API Key" : undefined}
              onClick={startBatch}
            >
              {batch.running ? "翻译中…" : "开始翻译全部"}
            </Button>
          </div>
          {batch.running && (
            <div className="space-y-2">
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                <div
                  className="accent-gradient h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${batch.total ? Math.round((batch.done / batch.total) * 100) : 0}%` }}
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
        </section>

        <div className="flex items-center justify-between">
          <Button onClick={refresh}>重新扫描</Button>
          <Button variant="primary" onClick={saveAll}>
            保存设置
          </Button>
        </div>

        <footer className="mt-8 pb-4 text-center text-[11px] text-[var(--text-muted)]">
          skills-hub v0.1 · Rust + Tauri v2 · React 19
        </footer>
      </div>
    </div>
  );
}
