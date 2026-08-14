import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { useSettingsStore } from "../store/settings";
import type { MarkdownTheme } from "../types/api";

/** MarkdownTheme → 附加的排版类名(基础 .md-body 之上) */
const THEME_CLASS: Record<MarkdownTheme, string> = {
  default: "",
  docs: "md-body--docs",
  paper: "md-body--paper",
  compact: "md-body--compact",
};

/**
 * @description 技能内容 Markdown 渲染,排版主题取设置里的 markdown_theme。
 * 可传入 theme 覆盖(供设置页预览卡片使用)。
 * @param text - markdown 原文
 * @param theme - 可选主题覆盖
 */
export default function Markdown({ text, theme }: { text: string; theme?: MarkdownTheme }) {
  const storedTheme = useSettingsStore((s) => s.settings?.markdown_theme ?? "default");
  const active = theme ?? storedTheme;

  return (
    <div className={`md-body ${THEME_CLASS[active]}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
