import { create } from "zustand";
import { getSettings, saveSettings } from "../api/commands";
import type { Settings } from "../types/api";

interface SettingsState {
  settings: Settings | null;
  loaded: boolean;
  load: () => Promise<void>;
  save: (s: Settings) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  loaded: false,
  load: async () => {
    try {
      const s = await getSettings();
      set({ settings: s, loaded: true });
    } catch (e) {
      console.error("get_settings failed", e);
      set({ loaded: true });
    }
  },
  save: async (s) => {
    await saveSettings(s);
    set({ settings: s });
  },
}));
