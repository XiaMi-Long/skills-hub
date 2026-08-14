import { ACCENTS } from "../../lib/accents";
import { useAppStore } from "../../store/app";
import Markdown from "../../md/Markdown";
import SectionTitle from "../SectionTitle";
import type { Accent, MarkdownTheme, Settings, Theme } from "../../types/api";

const THEMES: { id: Theme; label: string }[] = [
  { id: "dark", label: "暗色" },
  { id: "light", label: "亮色" },
  { id: "system", label: "跟随系统" },
];

/** Markdown 排版主题配置(设置选择用) */
const MARKDOWN_THEMES: { id: MarkdownTheme; label: string; desc: string }[] = [
  { id: "default", label: "极简", desc: "当前默认排版" },
  { id: "docs", label: "文档", desc: "accent 分隔线的文档风" },
  { id: "paper", label: "暖纸", desc: "衬线标题的阅读风" },
  { id: "compact", label: "紧凑", desc: "高密度开发风" },
];

/** 阅读样式预览用的迷你 markdown 样例 */
const SAMPLE = `## 技能说明

正文段落用于预览排版效果。

- 列表项 A
- 列表项 B

> 引用示例

\`\`\`js
const skill = 1;
\`\`\`
`;

/** 主题图标:太阳/月亮/显示器,用当前主题底色做圆底,比粗糙的迷你 mock 更精细 */
function ThemeIcon({ theme }: { theme: Theme }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (theme === "dark") {
    return (
      <svg className="h-6 w-6" viewBox="0 0 24 24" {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    );
  }
  if (theme === "light") {
    return (
      <svg className="h-6 w-6" viewBox="0 0 24 24" {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
      </svg>
    );
  }
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" {...common}>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8m-4-4v4" />
    </svg>
  );
}

/**
 * @description 外观面板:主题三卡片(图标式,无粗糙 mock)+ 色调 swatch + 应用效果条。
 * 改动即时生效(调 setTheme/setAccent),持久化交给父级自动保存。
 * @param draft - 当前设置草稿
 * @param onChange - 更新草稿回调
 */
export default function AppearancePanel({
  draft,
  onChange,
}: {
  draft: Settings;
  onChange: (s: Settings) => void;
}) {
  const resolvedTheme = useAppStore((s) => s.resolvedTheme);
  const setTheme = useAppStore((s) => s.setTheme);
  const setAccent = useAppStore((s) => s.setAccent);

  const pickTheme = (t: Theme) => {
    onChange({ ...draft, theme: t });
    setTheme(t);
  };

  const pickAccent = (id: Accent) => {
    onChange({ ...draft, accent: id });
    setAccent(id);
  };

  const accentDef = ACCENTS.find((a) => a.id === draft.accent) ?? ACCENTS[0];
  const isDark = resolvedTheme === "dark";

  return (
    <div className="space-y-8">
      {/* 主题 */}
      <section>
        <SectionTitle title="主题" desc="设置界面与应用的明暗外观" />
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map((t) => {
            const selected = draft.theme === t.id;
            const chipDark = t.id === "system" ? isDark : t.id === "dark";
            return (
              <button
                key={t.id}
                onClick={() => pickTheme(t.id)}
                className={`group relative flex flex-col items-center gap-2.5 rounded-[12px] border p-4 transition-all duration-150 ${
                  selected
                    ? "border-[var(--accent-to)] bg-[var(--bg-elevated)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-from)_16%,transparent)]"
                    : "border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]/40"
                }`}
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                    chipDark
                      ? "bg-[#1d1d24] text-[#e7e7ea]"
                      : "bg-[#f2f2f4] text-[#3f3f46]"
                  }`}
                >
                  <ThemeIcon theme={t.id} />
                </span>
                <span className="text-[12px] text-[var(--text-secondary)]">{t.label}</span>
                {selected && (
                  <span className="accent-gradient absolute top-2 right-2 flex h-4.5 w-4.5 items-center justify-center rounded-full">
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 色调 */}
      <section>
        <SectionTitle title="色调" desc="主色与强调色,应用到按钮、选中态与互动背景" />
        <div className="flex flex-wrap gap-2.5">
          {ACCENTS.map((a) => {
            const selected = draft.accent === a.id;
            return (
              <button
                key={a.id}
                onClick={() => pickAccent(a.id)}
                className={`flex items-center gap-2.5 rounded-[10px] border px-3.5 py-2 text-[12px] transition-all duration-150 ${
                  selected
                    ? "border-[var(--border-strong)] bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-from)_16%,transparent)]"
                    : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]/50"
                }`}
              >
                <span
                  className="relative h-5 w-5 rounded-full"
                  style={{ background: `linear-gradient(135deg, ${a.from}, ${a.to})` }}
                >
                  {selected && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  )}
                </span>
                {a.label}
              </button>
            );
          })}
        </div>

        {/* 应用效果条:直观展示当前色调落在按钮/选中态上的样子 */}
        <div className="mt-4 flex items-center gap-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-pane)]/60 p-3">
          <span className="text-[11px] text-[var(--text-muted)]">应用效果</span>
          <span
            className="h-2.5 flex-1 rounded-full"
            style={{ background: `linear-gradient(90deg, ${accentDef.from}, ${accentDef.to})` }}
          />
          <span className="rounded-[8px] px-3 py-1 text-[11px] text-white" style={{ background: `linear-gradient(180deg, color-mix(in srgb, ${accentDef.from} 88%, #fff 12%), color-mix(in srgb, ${accentDef.to} 90%, #000 10%))` }}>
            主按钮
          </span>
          <span
            className="flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-[11px]"
            style={{ borderColor: accentDef.to, color: accentDef.to }}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: accentDef.from }} />
            选中态
          </span>
        </div>
      </section>

      {/* 阅读样式:Markdown 排版主题,真实渲染预览 */}
      <section>
        <SectionTitle title="阅读样式" desc="技能预览的 Markdown 排版主题" />
        <div className="grid grid-cols-2 gap-3">
          {MARKDOWN_THEMES.map((t) => {
            const selected = draft.markdown_theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onChange({ ...draft, markdown_theme: t.id })}
                className={`relative rounded-[12px] border p-2.5 text-left transition-all duration-150 ${
                  selected
                    ? "border-[var(--accent-to)] bg-[var(--bg-elevated)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-from)_16%,transparent)]"
                    : "border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]/40"
                }`}
              >
                <div className="pointer-events-none max-h-28 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-pane)] px-3 py-2">
                  <Markdown text={SAMPLE} theme={t.id} />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[12px] font-medium text-[var(--text-primary)]">{t.label}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">{t.desc}</span>
                </div>
                {selected && (
                  <span className="accent-gradient absolute top-3.5 right-3.5 flex h-4 w-4 items-center justify-center rounded-full">
                    <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
