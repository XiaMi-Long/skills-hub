import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { AGENT_META, AGENT_ORDER } from "../lib/agents";
import { testDeepseek } from "../api/commands";
import { useSettingsStore } from "../store/settings";
import { useSkillsStore } from "../store/skills";
import { useAppStore } from "../store/app";
import { toast } from "../store/toast";
import Button from "../ui/Button";
import Input from "../ui/Input";
import type { AgentId, Settings, Theme } from "../types/api";

const MODELS = ["deepseek-chat", "deepseek-reasoner"];

export default function SettingsPage({ onBack }: { onBack: () => void }) {
  const stored = useSettingsStore((s) => s.settings);
  const saveSettings = useSettingsStore((s) => s.save);
  const refresh = useSkillsStore((s) => s.refresh);
  const setTheme = useAppStore((s) => s.setTheme);

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
          <div className="flex gap-4">
            {(["dark", "light", "system"] as Theme[]).map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
                <input
                  type="radio"
                  checked={draft.theme === t}
                  onChange={() => setTheme2(t)}
                  className="accent-[#f97316]"
                />
                {t === "dark" ? "暗色" : t === "light" ? "亮色" : "跟随系统"}
              </label>
            ))}
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
              <p className="mt-1 text-[11px] text-[#f59e0b]">
                ⚠ key 仅存本机 app 数据目录(明文),不会上传任何其他位置
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">模型</label>
                <select
                  value={customModel ? "custom" : draft.deepseek.model}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setCustomModel(true);
                    } else {
                      setCustomModel(false);
                      setDraft({ ...draft, deepseek: { ...draft.deepseek, model: e.target.value } });
                    }
                  }}
                  className="h-8 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 text-[13px] text-[var(--text-primary)] focus:outline-none"
                >
                  {MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="custom">自定义…</option>
                </select>
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
              <Button onClick={test} disabled={testing}>
                {testing ? "测试中…" : "连接测试"}
              </Button>
            </div>
          </div>
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
