/**
 * @description 设置分类的纯类型与文案映射(不含 JSX,避免 .ts 文件混入 JSX)。
 * 图标与顺序在 SettingsNav(.tsx) 中定义。
 */
export type SettingsCategory = "appearance" | "agents" | "translate" | "bulk";

/** 分类显示文案(顶部标题用) */
export const CATEGORY_LABELS: Record<SettingsCategory, string> = {
  appearance: "外观",
  agents: "数据源",
  translate: "AI 翻译",
  bulk: "批量操作",
};
