import { useEffect } from "react";
import AppShell from "./shell/AppShell";
import GrainOverlay from "./shell/GrainOverlay";
import ToastHost from "./ui/Toast";
import SettingsPage from "./settings/SettingsPage";
import { applyTheme, useAppStore } from "./store/app";
import { useSkillsStore } from "./store/skills";
import { useSettingsStore } from "./store/settings";
import { useTranslateStore } from "./store/translate";
import { listen } from "@tauri-apps/api/event";
import type { TranslateChunkEvent, TranslateDoneEvent, TranslateErrorEvent } from "./types/api";

export default function App() {
  const resolvedTheme = useAppStore((s) => s.resolvedTheme);
  const route = useAppStore((s) => s.route);
  const refresh = useSkillsStore((s) => s.refresh);
  const loadSettings = useSettingsStore((s) => s.load);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // mount:加载设置(应用已保存主题)+ 首次扫描
  useEffect(() => {
    loadSettings().then(() => {
      const saved = useSettingsStore.getState().settings;
      if (saved) useAppStore.getState().setTheme(saved.theme);
    });
    refresh();
  }, [loadSettings, refresh]);

  // 跟随系统:prefers-color-scheme 变化时重新 resolve
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = () => {
      if (useAppStore.getState().theme === "system") {
        useAppStore.getState().setTheme("system");
      }
    };
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // 窗口 focus 重扫(debounce 500ms)
  useEffect(() => {
    let t: number | undefined;
    const h = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        if (useAppStore.getState().route === "main") refresh();
      }, 500);
    };
    window.addEventListener("focus", h);
    return () => {
      window.removeEventListener("focus", h);
      window.clearTimeout(t);
    };
  }, [refresh]);

  // Ctrl+F 聚焦搜索框
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        window.dispatchEvent(new Event("focus-search"));
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  // 翻译事件:chunk 累积 / done / error
  useEffect(() => {
    const store = useTranslateStore.getState();
    const unChunk = listen<TranslateChunkEvent>("translate-chunk", (e) => {
      store.append(e.payload.request_id, e.payload.delta);
    });
    const unDone = listen<TranslateDoneEvent>("translate-done", (e) => {
      store.finish(e.payload.request_id, e.payload.text);
    });
    const unError = listen<TranslateErrorEvent>("translate-error", (e) => {
      store.fail(e.payload.request_id, e.payload.message);
    });
    return () => {
      unChunk.then((f) => f());
      unDone.then((f) => f());
      unError.then((f) => f());
    };
  }, []);

  return (
    <>
      {route === "settings" ? <SettingsPage onBack={() => useAppStore.getState().setRoute("main")} /> : <AppShell />}
      <GrainOverlay />
      <ToastHost />
    </>
  );
}
