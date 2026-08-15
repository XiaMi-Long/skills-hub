import { defineConfig } from "vitepress";

export default defineConfig({
  title: "skills-hub",
  description: "统一管理本机 8 个 AI agent 的 skills:查看、编辑、新建、删除、同步、翻译阅读",
  lang: "zh-CN",
  base: "/skills-hub/",
  head: [["link", { rel: "icon", href: "/skills-hub/logo.svg" }]],
  themeConfig: {
    logo: "/logo.svg",
    nav: [
      { text: "指南", link: "/guide/quick-start" },
      { text: "下载", link: "/download" },
    ],
    sidebar: [
      {
        text: "开始",
        items: [{ text: "快速开始", link: "/guide/quick-start" }],
      },
      {
        text: "功能",
        items: [
          { text: "技能管理", link: "/guide/manage" },
          { text: "命令添加技能", link: "/guide/command-add" },
          { text: "同步", link: "/guide/sync" },
          { text: "翻译阅读", link: "/guide/translate" },
          { text: "外观与设置", link: "/guide/settings" },
        ],
      },
      { text: "下载", link: "/download" },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/XiaMi-Long/skills-hub" }],
    footer: {
      message: "Rust + Tauri v2 · React 19 · 本地优先",
      copyright: "skills-hub",
    },
    outline: { label: "本页目录" },
    docFooter: { prev: "上一篇", next: "下一篇" },
    lastUpdated: { text: "最后更新" },
  },
});
