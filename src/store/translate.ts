import { create } from "zustand";

export type TranslateStatus = "streaming" | "done" | "error";

export interface TranslateEntry {
  text: string;
  status: TranslateStatus;
  error?: string;
}

/** 批量翻译进度 */
export interface BatchProgress {
  running: boolean;
  total: number;
  done: number;
  current: string;
}

interface TranslateState {
  byRequest: Record<string, TranslateEntry>;
  batch: BatchProgress;
  begin: (requestId: string) => void;
  append: (requestId: string, delta: string) => void;
  finish: (requestId: string, text: string) => void;
  fail: (requestId: string, message: string) => void;
  get: (requestId: string) => TranslateEntry | undefined;
  batchStart: (total: number) => void;
  batchProgress: (done: number, total: number, current: string) => void;
  batchFinish: () => void;
}

export const useTranslateStore = create<TranslateState>((set, get) => ({
  byRequest: {},
  batch: { running: false, total: 0, done: 0, current: "" },
  begin: (requestId) =>
    set((s) => ({ byRequest: { ...s.byRequest, [requestId]: { text: "", status: "streaming" } } })),
  append: (requestId, delta) =>
    set((s) => {
      const cur = s.byRequest[requestId];
      if (!cur) return s;
      return { byRequest: { ...s.byRequest, [requestId]: { ...cur, text: cur.text + delta } } };
    }),
  finish: (requestId, text) =>
    set((s) => ({
      byRequest: { ...s.byRequest, [requestId]: { text, status: "done" } },
    })),
  fail: (requestId, message) =>
    set((s) => ({
      byRequest: { ...s.byRequest, [requestId]: { text: "", status: "error", error: message } },
    })),
  get: (requestId) => get().byRequest[requestId],
  batchStart: (total) =>
    set({ batch: { running: true, total, done: 0, current: "" } }),
  batchProgress: (done, total, current) =>
    set({ batch: { running: true, total, done, current } }),
  batchFinish: () => set({ batch: { running: false, total: 0, done: 0, current: "" } }),
}));
