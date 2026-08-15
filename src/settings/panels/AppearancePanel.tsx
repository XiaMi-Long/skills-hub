import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { ACCENTS } from "../../lib/accents";
import { applyFancyBackground } from "../../lib/fancy";
import { setWindowFancy } from "../../api/commands";
import { useAppStore } from "../../store/app";
import Checkbox from "../../ui/Checkbox";
import Markdown from "../../md/Markdown";
import SectionTitle from "../SectionTitle";
import { toast } from "../../store/toast";
import type { Accent, MarkdownTheme, Settings, Theme } from "../../types/api";

const THEMES: { id: Theme; label: string; from: string; to: string }[] = [
  { id: "dark", label: "暗色", from: "#6366f1", to: "#8b5cf6" },
  { id: "light", label: "亮色", from: "#f59e0b", to: "#fbbf24" },
  { id: "system", label: "跟随系统", from: "#38bdf8", to: "#818cf8" },
];

/** Markdown 排版主题配置(设置选择用):from/to 用于按钮水纹与图形标识 */
const MARKDOWN_THEMES: { id: MarkdownTheme; label: string; desc: string; from: string; to: string }[] = [
  { id: "default", label: "极简", desc: "当前默认排版", from: "#64748b", to: "#94a3b8" },
  { id: "docs", label: "文档", desc: "accent 分隔线的文档风", from: "#2563eb", to: "#3b82f6" },
  { id: "paper", label: "暖纸", desc: "衬线标题的阅读风", from: "#d97706", to: "#f59e0b" },
  { id: "compact", label: "紧凑", desc: "高密度开发风", from: "#0891b2", to: "#22d3ee" },
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

  /** 水纹波原点跟随光标:把鼠标位置写入按钮的 --ripple-x/--ripple-y */
  const setRippleOrigin = (e: ReactMouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty("--ripple-x", `${x.toFixed(1)}%`);
    e.currentTarget.style.setProperty("--ripple-y", `${y.toFixed(1)}%`);
  };

  return (
    <div className="space-y-8">
      {/* 主题:与色调同体系的紧凑胶囊,悬停/选中触发功能性动画
          (暗色=月牙星星闪烁,亮色=太阳光芒旋转,跟随系统=屏幕昼夜流转) */}
      <section>
        <SectionTitle title="主题" desc="设置界面与应用的明暗外观" />
        <div className="flex flex-wrap gap-2.5">
          {THEMES.map((t) => {
            const selected = draft.theme === t.id;
            return (
              <button
                key={t.id}
                onClick={(e) => {
                  setRippleOrigin(e);
                  pickTheme(t.id);
                }}
                onMouseEnter={setRippleOrigin}
                className={`accent-swatch flex items-center rounded-[10px] px-4 py-2.5 text-[12px] ${
                  selected
                    ? "is-selected text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                style={{ "--sw-from": t.from, "--sw-to": t.to } as CSSProperties}
              >
                <span className="accent-swatch-glow" aria-hidden />
                <span className="accent-swatch-wave" aria-hidden />
                <span className="relative flex items-center gap-2">
                  <span className={`theme-ico theme-ico-${t.id}`} aria-hidden>
                    {t.id === "dark" && (
                      <>
                        <i className="star s1" />
                        <i className="star s2" />
                      </>
                    )}
                    {t.id === "system" && <i className="stand" />}
                  </span>
                  {t.label}
                </span>
                {selected && (
                  <span
                    className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-white"
                    style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
                  >
                    <svg
                      className="h-2 w-2"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 色调:光晕浅渐变打底,悬停/点击以水纹波晕染覆盖(无大圆点、无纯色填充) */}
      <section>
        <SectionTitle title="色调" desc="主色与强调色,应用到按钮、选中态与互动背景" />
        <div className="flex flex-wrap gap-2.5">
          {ACCENTS.map((a) => {
            const selected = draft.accent === a.id;
            return (
              <button
                key={a.id}
                onClick={(e) => {
                  setRippleOrigin(e);
                  pickAccent(a.id);
                }}
                onMouseEnter={setRippleOrigin}
                className={`accent-swatch flex items-center rounded-[10px] px-4 py-2.5 text-[12px] ${
                  selected
                    ? "is-selected text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                style={{ "--sw-from": a.from, "--sw-to": a.to } as CSSProperties}
              >
                <span className="accent-swatch-glow" aria-hidden />
                <span className="accent-swatch-wave" aria-hidden />
                <span className="accent-swatch-rings" aria-hidden />
                <span className="relative flex items-center gap-2">
                  <span className="accent-swatch-bar" aria-hidden />
                  {a.label}
                </span>
                {selected && (
                  <span
                    className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-white"
                    style={{ background: `linear-gradient(135deg, ${a.from}, ${a.to})` }}
                  >
                    <svg
                      className="h-2 w-2"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* 背景质感:窗口亚克力透明 + 渐变 + 颗粒噪点 + 磨砂玻璃 + 半透明面板;
          卡片内嵌迷你窗口演示,开关时以动画展示对应效果 */}
      <section>
        <SectionTitle title="背景质感" desc="窗口亚克力透明、渐变背景、颗粒噪点与半透明磨砂面板" />
        <div
          className={`flex items-center justify-between gap-4 rounded-[12px] border bg-[var(--bg-pane)]/60 p-4 transition-[border-color,box-shadow] duration-500 ${
            draft.fancy_background
              ? "border-[color-mix(in_srgb,var(--accent-from)_38%,var(--border-subtle))] shadow-[0_0_18px_color-mix(in_srgb,var(--accent-from)_13%,transparent)]"
              : "border-[var(--border-subtle)]"
          }`}
        >
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[var(--text-primary)]">全局质感背景</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
              开启后窗口使用亚克力透明(可透到桌面),叠加渐变背景、颗粒噪点与半透明磨砂面板;关闭则为实心纯色风格。需要
              Windows 10/11,且系统「个性化 → 颜色 → 透明度效果」处于开启状态。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <FancyPreview on={draft.fancy_background ?? true} />
            <Checkbox
              checked={draft.fancy_background ?? true}
              onChange={(v) => {
                onChange({ ...draft, fancy_background: v });
                applyFancyBackground(v);
                setWindowFancy(v).catch((e) => {
                  toast.error(`窗口透明切换失败: ${(e as { message?: string })?.message ?? e}`);
                });
              }}
              title="全局质感背景"
            />
          </div>
        </div>
      </section>

      {/* 阅读样式:与主题/色调同体系的胶囊按钮(文字线条图形 + 波动动画),
          下方单区实时预览按当前所选排版渲染样例 */}
      <section>
        <SectionTitle title="阅读样式" desc="技能预览的 Markdown 排版主题" />
        <div className="flex flex-wrap gap-2.5">
          {MARKDOWN_THEMES.map((t) => {
            const selected = draft.markdown_theme === t.id;
            return (
              <button
                key={t.id}
                onClick={(e) => {
                  setRippleOrigin(e);
                  onChange({ ...draft, markdown_theme: t.id });
                }}
                onMouseEnter={setRippleOrigin}
                className={`accent-swatch flex items-center rounded-[10px] px-4 py-2.5 text-[12px] ${
                  selected
                    ? "is-selected text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
                style={{ "--sw-from": t.from, "--sw-to": t.to } as CSSProperties}
              >
                <span className="accent-swatch-glow" aria-hidden />
                <span className="accent-swatch-wave" aria-hidden />
                <span className="relative flex items-center gap-2">
                  <span className={`md-ico md-ico-${t.id}`} aria-hidden>
                    {t.id === "paper" ? (
                      <span className="aa">Aa</span>
                    ) : t.id === "compact" ? (
                      <>
                        <i />
                        <i />
                        <i />
                        <i />
                      </>
                    ) : (
                      <>
                        <i />
                        <i />
                        <i />
                      </>
                    )}
                  </span>
                  {t.label}
                </span>
                {selected && (
                  <span
                    className="absolute top-1.5 right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-white"
                    style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
                  >
                    <svg
                      className="h-2 w-2"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 实时预览:跟随当前所选排版即时渲染 */}
        <div className="mt-3 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-pane)]/60 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">
              实时预览 · {MARKDOWN_THEMES.find((t) => t.id === draft.markdown_theme)?.label}
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              {MARKDOWN_THEMES.find((t) => t.id === draft.markdown_theme)?.desc}
            </span>
          </div>
          <div className="pointer-events-none max-h-44 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-pane)] px-4 py-3">
            <Markdown text={SAMPLE} theme={draft.markdown_theme} />
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * @description 迷你窗口演示:质感背景的开关效果可视化。
 * 开=光晕漂移 + 颗粒 + 面板半透明 + 玻璃高光周期扫过;关=实心扁平。
 * @param on - 质感背景是否开启
 */
function FancyPreview({ on }: { on: boolean }) {
  return (
    <div className={`fancy-preview ${on ? "is-on" : ""}`} aria-hidden>
      <div className="fancy-preview-glow" />
      <div className="fancy-preview-titlebar" />
      <div className="fancy-preview-panes">
        <i />
        <i />
        <i />
      </div>
      <div className="fancy-preview-grain" />
      <div className="fancy-preview-sheen" />
    </div>
  );
}
