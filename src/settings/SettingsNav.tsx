import type { ReactNode } from "react";
import { CATEGORY_LABELS, type SettingsCategory } from "./categories";

/** 分类顺序(导航展示顺序) */
const ORDER: SettingsCategory[] = ["appearance", "agents", "translate", "bulk"];

/** 分类图标:内联 SVG,风格与 IconRail 一致(16px,stroke=currentColor) */
const ICONS: Record<SettingsCategory, ReactNode> = {
  appearance: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
    </svg>
  ),
  agents: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </svg>
  ),
  translate: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  ),
  bulk: (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 2 7l10 5 10-5-10-5Z" />
      <path d="m2 12 10 5 10-5" />
      <path d="m2 17 10 5 10-5" />
    </svg>
  ),
};

/**
 * @description 设置页左侧分类导航:图标+文字,active 态 accent 渐变胶囊。
 * @param active - 当前激活的分类
 * @param onSelect - 切换分类回调
 */
export default function SettingsNav({
  active,
  onSelect,
}: {
  active: SettingsCategory;
  onSelect: (c: SettingsCategory) => void;
}) {
  return (
    <nav className="flex w-[200px] shrink-0 flex-col gap-1 border-r border-[var(--border-subtle)] bg-[var(--bg-pane)] p-3">
      {ORDER.map((id) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-all duration-150 ${
              isActive
                ? "accent-gradient font-medium text-white shadow-[0_0_12px_color-mix(in_srgb,var(--accent-from)_25%,transparent)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            }`}
          >
            {ICONS[id]}
            {CATEGORY_LABELS[id]}
          </button>
        );
      })}
    </nav>
  );
}
