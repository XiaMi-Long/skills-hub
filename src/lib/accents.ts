import type { Accent } from "../types/api";

export interface AccentDef {
  id: Accent;
  label: string;
  from: string;
  to: string;
}

/** 可选色调(默认蓝)。from/to 对应 --accent-from/--accent-to 渐变两端。 */
export const ACCENTS: AccentDef[] = [
  { id: "blue", label: "蓝色", from: "#2563eb", to: "#3b82f6" },
  { id: "orange", label: "橙色", from: "#f97316", to: "#f59e0b" },
  { id: "green", label: "绿色", from: "#16a34a", to: "#22c55e" },
  { id: "purple", label: "紫色", from: "#7c3aed", to: "#8b5cf6" },
  { id: "pink", label: "粉色", from: "#db2777", to: "#ec4899" },
];

const MAP = Object.fromEntries(ACCENTS.map((a) => [a.id, a])) as Record<Accent, AccentDef>;

/**
 * 应用色调:把 --accent-from/--accent-to 写到 <html> 内联样式,
 * 内联样式优先级高于 :root/.dark 规则,暗/亮主题下都生效。
 */
export function applyAccent(accent: Accent) {
  const def = MAP[accent] ?? MAP.blue;
  const root = document.documentElement;
  root.style.setProperty("--accent-from", def.from);
  root.style.setProperty("--accent-to", def.to);
}
