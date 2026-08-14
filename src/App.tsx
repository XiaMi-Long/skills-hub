import { useEffect } from "react";
import AppShell from "./shell/AppShell";
import GrainOverlay from "./shell/GrainOverlay";
import ToastHost from "./ui/Toast";
import { applyTheme, useAppStore } from "./store/app";
import { useSkillsStore } from "./store/skills";
import { useSettingsStore } from "./store/settings";
import { useTranslateStore } from "./store/translate";
import { toast } from "./store/toast";
import { listen } from "@tauri-apps/api/event";
import type {
  TranslateAllDoneEvent,
  TranslateAllProgressEvent,
  TranslateChunkEvent,
  TranslateDoneEvent,
  TranslateErrorEvent,
} from "./types/api";

export default function App() {
  const resolvedTheme = useAppStore((s) => s.resolvedTheme);
  const refresh = useSkillsStore((s) => s.refresh);
  const loadSettings = useSettingsStore((s) => s.load);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // mount:加载设置(应用已保存主题/色调)+ 首次扫描
  useEffect(() => {
    loadSettings().then(() => {
      const saved = useSettingsStore.getState().settings;
      if (saved) {
        useAppStore.getState().setTheme(saved.theme);
        useAppStore.getState().setAccent(saved.accent);
      }
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

  // 翻译事件:chunk 累积 / done / error / 批量进度
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
    const unBatchProgress = listen<TranslateAllProgressEvent>("translate-all-progress", (e) => {
      useTranslateStore.getState().batchProgress(e.payload.done, e.payload.total, e.payload.current);
    });
    const unBatchDone = listen<TranslateAllDoneEvent>("translate-all-done", (e) => {
      useTranslateStore.getState().batchFinish();
      const p = e.payload;
      if (p.cancelled) {
        toast.info(`批量翻译已取消:完成 ${p.translated} 个`);
      } else if (p.failed === 0) {
        toast.success(`批量翻译完成:新翻译 ${p.translated} 个,命中缓存 ${p.skipped} 个`);
      } else {
        const first = p.errors[0];
        toast.error(
          `批量翻译完成:成功 ${p.translated} 个,缓存 ${p.skipped} 个,失败 ${p.failed} 个${first ? ` · ${first.name}: ${first.message}` : ""}`,
        );
      }
    });
    return () => {
      unChunk.then((f) => f());
      unDone.then((f) => f());
      unError.then((f) => f());
      unBatchProgress.then((f) => f());
      unBatchDone.then((f) => f());
    };
  }, []);

  return (
    <>
      <AppShell />
      <GrainOverlay />
      <ToastHost />
    </>
  );
}
