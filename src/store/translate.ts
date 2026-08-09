import { create } from "zustand";

export type TranslateStatus = "streaming" | "done" | "error";

export interface TranslateEntry {
  text: string;
  status: TranslateStatus;
  error?: string;
}

interface TranslateState {
  byRequest: Record<string, TranslateEntry>;
  begin: (requestId: string) => void;
  append: (requestId: string, delta: string) => void;
  finish: (requestId: string, text: string) => void;
  fail: (requestId: string, message: string) => void;
  get: (requestId: string) => TranslateEntry | undefined;
}

export const useTranslateStore = create<TranslateState>((set, get) => ({
  byRequest: {},
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
}));
