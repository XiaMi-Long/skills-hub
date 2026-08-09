import { create } from "zustand";

export type Theme = "dark" | "light" | "system";

interface AppState {
  theme: Theme;
  resolvedTheme: "dark" | "light";
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

function resolve(theme: Theme): "dark" | "light" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export const useAppStore = create<AppState>((set, get) => ({
  theme: "dark",
  resolvedTheme: "dark",
  setTheme: (theme) => set({ theme, resolvedTheme: resolve(theme) }),
  toggleTheme: () => {
    const next: Theme = get().resolvedTheme === "dark" ? "light" : "dark";
    set({ theme: next, resolvedTheme: next });
  },
}));

/** 应用 resolvedTheme 到 <html class="dark">。App 挂载时调用。 */
export function applyTheme(theme: "dark" | "light") {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}
