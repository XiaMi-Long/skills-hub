/**
 * Tauri v2 IPC mock(官网截图专用):注入 window.__TAURI_INTERNALS__,
 * 让应用在普通浏览器中带模拟数据完整运行。必须在任何 @tauri-apps/api 调用前导入。
 */
import { mockScan, mockSettings, showMeRaw } from "./data";

const params = new URLSearchParams(window.location.search);
const theme = params.get("theme") === "light" ? "light" : "dark";
const settings = mockSettings(theme);

let nextId = 1;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__TAURI_INTERNALS__ = {
  metadata: { currentWindow: "main", currentWebview: "main" },
  transformCallback: (cb: (e: unknown) => void) => {
    const id = nextId++;
    void cb; // 截图场景不触发事件
    return id;
  },
  postMessage: async () => {},
  invoke: async (cmd: string, args?: Record<string, unknown>) => {
    switch (cmd) {
      case "scan_all":
        return mockScan;
      case "get_settings":
        return settings;
      case "save_settings":
        return null;
      case "read_skill_md": {
        const g = mockScan.groups.find((gg) => gg.name === args?.skillName);
        return { instance: g?.instances[0] ?? null, raw: showMeRaw };
      }
      case "check_translation":
        return { status: "none", text: null };
      case "plugin:event|listen":
        return nextId++;
      default:
        return null;
    }
  },
};

export {};
