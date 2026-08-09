import { create } from "zustand";

export type Theme = "dark" | "light" | "system";

interface AppState {
  theme: Theme;
  resolvedTheme: "dark" | "light";
  route: "main" | "settings";
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setRoute: (r: "main" | "settings") => void;
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
  route: "main",
  setTheme: (theme) => set({ theme, resolvedTheme: resolve(theme) }),
  toggleTheme: () => {
    const next: Theme = get().resolvedTheme === "dark" ? "light" : "dark";
    set({ theme: next, resolvedTheme: next });
  },
  setRoute: (route) => set({ route }),
}));

/** 应用 resolvedTheme 到 <html class="dark">。App 挂载时调用。 */
export function applyTheme(theme: "dark" | "light") {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}
