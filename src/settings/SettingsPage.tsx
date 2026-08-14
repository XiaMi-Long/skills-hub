import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ACCENTS } from "../lib/accents";
import { useAppStore } from "../store/app";
import { useSettingsStore } from "../store/settings";
import { toast } from "../store/toast";
import { CATEGORY_LABELS, type SettingsCategory } from "./categories";
import SettingsNav from "./SettingsNav";
import AgentsPanel from "./panels/AgentsPanel";
import AppearancePanel from "./panels/AppearancePanel";
import BulkOpsPanel from "./panels/BulkOpsPanel";
import TranslatePanel from "./panels/TranslatePanel";
import type { Settings } from "../types/api";

type SaveStatus = "idle" | "saving" | "saved";

/** 统一缓出曲线(与全局动效一致) */
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * @description 设置页(外壳内内容视图):左侧分类导航 + 右侧内容面板。
 * 特性:主题互动背景(accent 渐变打底 + 双角光晕,随主题/色调切换)、防抖自动保存、
 * 首屏轻量入场、分类切换交错动效。顶部系统 header(TopToolbar)与 IconRail 由外壳提供。
 */
export default function SettingsPage() {
  const stored = useSettingsStore((s) => s.settings);
  const saveSettings = useSettingsStore((s) => s.save);
  const resolvedTheme = useAppStore((s) => s.resolvedTheme);

  const [draft, setDraft] = useState<Settings | null>(stored);
  const [active, setActive] = useState<SettingsCategory>("appearance");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  // 跳过水合后的首次自动保存(避免刚加载就把原样设置写回)
  const skipNextSave = useRef(true);

  // store 变化 → 水合草稿(自动保存写回的是同一引用,React 会跳过重复 setState)
  useEffect(() => {
    if (stored) setDraft(stored);
  }, [stored]);

  // 自动保存:草稿变化防抖 600ms 持久化
  useEffect(() => {
    if (!draft) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setSaveStatus("saving");
    const t = setTimeout(() => {
      saveSettings(draft)
        .then(() => setSaveStatus("saved"))
        .catch((e) => {
          setSaveStatus("idle");
          toast.error(`保存失败: ${(e as { message?: string })?.message ?? e}`);
        });
    }, 600);
    return () => clearTimeout(t);
  }, [draft, saveSettings]);

  // 互动背景的色调来源(accent)与明暗(主题)
  const accentDef = useMemo(
    () => ACCENTS.find((a) => a.id === (draft?.accent ?? "blue")) ?? ACCENTS[0],
    [draft?.accent],
  );
  const dark = resolvedTheme === "dark";

  if (!draft) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-[var(--bg-pane)]">
        <span className="text-[13px] text-[var(--text-muted)]">加载设置…</span>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className="flex min-w-0 flex-1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, ease: EASE }}
      >
        <SettingsNav active={active} onSelect={setActive} />

        {/* 右侧内容区:互动背景 = accent 渐变打底 + 右上/左下双角光晕,随主题/色调变化 */}
        <div
          className="relative flex min-w-0 flex-1 flex-col"
          style={{
            background: `radial-gradient(620px 420px at 100% -10%, color-mix(in srgb, ${accentDef.from} ${dark ? 30 : 22}%, transparent), transparent 62%),
              radial-gradient(480px 320px at 0% 110%, color-mix(in srgb, ${accentDef.to} ${dark ? 16 : 11}%, transparent), transparent 60%),
              linear-gradient(165deg, var(--settings-bg-base) 0%, var(--settings-bg-base) 45%, color-mix(in srgb, ${accentDef.to} 13%, var(--settings-bg-base)) 100%)`,
          }}
        >
          {/* 面板顶部:当前分类标题 + 自动保存状态 */}
          <header className="relative z-10 flex shrink-0 items-center justify-between px-6 pt-5 pb-3">
            <h1 className="text-[17px] font-semibold tracking-tight text-[var(--text-primary)]">
              {CATEGORY_LABELS[active]}
            </h1>
            <SaveStatusPill status={saveStatus} />
          </header>

          {/* 面板内容:切换时交错淡入 */}
          <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-6 pb-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: EASE }}
                className="mx-auto max-w-[680px]"
              >
                {active === "appearance" && <AppearancePanel draft={draft} onChange={setDraft} />}
                {active === "agents" && <AgentsPanel draft={draft} onChange={setDraft} />}
                {active === "translate" && (
                  <TranslatePanel draft={draft} onChange={setDraft} persist={saveSettings} />
                )}
                {active === "bulk" && (
                  <BulkOpsPanel apiKeyConfigured={Boolean(draft.deepseek.api_key.trim())} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </MotionConfig>
  );
}

/**
 * @description 自动保存状态指示:保存中/已保存,轻量淡入。
 * @param status - 保存状态
 */
function SaveStatusPill({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <motion.span
      key={status}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-full px-2.5 py-1 text-[11px] ${
        status === "saving"
          ? "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
          : "bg-[var(--success)]/10 text-[var(--success)]"
      }`}
    >
      {status === "saving" ? "保存中…" : "已保存 ✓"}
    </motion.span>
  );
}
