import "./mock-tauri"; // 必须最先:注入 IPC mock,早于任何 @tauri-apps/api 调用
import React from "react";
import ReactDOM from "react-dom/client";
import App from "../src/App";
import "../src/styles/globals.css";

// URL 参数控制拍摄场景:?theme=light | ?route=settings
const params = new URLSearchParams(window.location.search);
if (params.get("theme") === "light") {
  document.documentElement.classList.remove("dark");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// 等待设置加载与扫描完成后,跳到目标视图
setTimeout(async () => {
  if (params.get("route") === "settings") {
    const { useAppStore } = await import("../src/store/app");
    useAppStore.getState().setRoute("settings");
  } else {
    // 选中 show-me 展示详情页
    const { useSkillsStore } = await import("../src/store/skills");
    useSkillsStore.getState().selectGroup("show-me");
  }
}, 700);
