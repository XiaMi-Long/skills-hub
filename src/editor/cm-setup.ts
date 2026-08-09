import { EditorView, basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import type { Extension } from "@codemirror/state";

/**
 * CodeMirror 6 设置:meta 包 + markdown。
 * 主题读 CSS var(无独立主题文件),随暗/亮切换自动生效。
 */
const cmTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "transparent",
      color: "var(--text-primary)",
      height: "100%",
      fontSize: "13px",
    },
    ".cm-scroller": {
      fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
      lineHeight: "1.55",
    },
    ".cm-content": {
      padding: "10px 0",
      caretColor: "var(--accent-from)",
    },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor": { borderLeftColor: "var(--accent-from)" },
    ".cm-gutters": {
      backgroundColor: "transparent",
      borderRight: "1px solid var(--border-subtle)",
      color: "var(--text-muted)",
    },
    ".cm-activeLine": { backgroundColor: "var(--bg-elevated)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent" },
    ".cm-selectionBackground": {
      backgroundColor: "color-mix(in srgb, var(--accent-from) 28%, transparent)",
    },
    "&.cm-focused .cm-selectionBackground": {
      backgroundColor: "color-mix(in srgb, var(--accent-from) 36%, transparent)",
    },
    ".cm-matchingBracket": { backgroundColor: "color-mix(in srgb, var(--accent-from) 30%, transparent)" },
  },
  { dark: true },
);

export function createEditorExtensions(): Extension[] {
  return [basicSetup, markdown(), cmTheme];
}
