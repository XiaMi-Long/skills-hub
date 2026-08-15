---
layout: home

hero:
  name: skills-hub
  text: 本机 AI agent 技能统一管理中心
  tagline: 查看 · 编辑 · 新建 · 删除 · 同步 · 翻译 —— 一个桌面应用,管理 8 个 agent 的 skills
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quick-start
    - theme: alt
      text: 下载应用
      link: /download

features:
  - icon: 🗂️
    title: 8 个 agent 统一管理
    details: 扫描 Claude Code、Codex、Grok、Pi、Cursor、Trae、Qoder、Universal 的 skills 目录,同名技能自动归组,副本内容漂移一目了然。
  - icon: ⚡
    title: 命令添加技能
    details: 粘贴一条 npx skills add owner/repo --skill xxx 命令,自动从 GitHub 拉取安装,还能让 AI 解读内容生成标题与描述。
  - icon: 🔁
    title: 一键同步
    details: 把技能同步到任意 agent 组合,全部或单个任选;冲突逐条决策(覆盖/跳过),结果逐条汇总。
  - icon: 🌐
    title: DeepSeek 翻译阅读
    details: 英文技能一键翻译成中文阅读,内容寻址缓存,支持一键翻译全部与译文写回原文。
  - icon: 🎨
    title: 质感视觉
    details: 暗/亮主题、五种色调、窗口亚克力透明与渐变颗粒磨砂,Markdown 预览四种排版主题。
  - icon: 🛡️
    title: 本地优先
    details: 纯本地扫描与文件操作,无中心服务器;所有数据与 API key 仅存本机。
---

## 界面预览

### 主界面 · 暗色

技能列表按名字归组,右侧渲染 SKILL.md;窗口亚克力透明,渐变与颗粒质感穿透面板。

<img src="./images/home-dark.png" alt="skills-hub 主界面(暗色)" style="border-radius:10px;border:1px solid rgba(128,128,128,.2);box-shadow:0 8px 32px rgba(0,0,0,.18)" />

### 设置 · 外观

主题与色调按钮带功能性动画,「全局质感背景」卡片内嵌迷你窗口实时演示开关效果。

<img src="./images/settings-dark.png" alt="设置外观" style="border-radius:10px;border:1px solid rgba(128,128,128,.2);box-shadow:0 8px 32px rgba(0,0,0,.18)" />

### 命令添加技能

粘贴 `npx skills add …` 命令即可解析 GitHub 仓库、下载技能文件、AI 解读并安装到所选 agent。

<img src="./images/newskill-command.png" alt="命令添加" style="border-radius:10px;border:1px solid rgba(128,128,128,.2);box-shadow:0 8px 32px rgba(0,0,0,.18)" />

### 亮色主题

<img src="./images/home-light.png" alt="亮色主题" style="border-radius:10px;border:1px solid rgba(128,128,128,.2);box-shadow:0 8px 32px rgba(0,0,0,.18)" />

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #2563eb 30%, #3b82f6);
  --vp-home-hero-image-background-image: linear-gradient(-45deg, rgba(37, 99, 235, 0.22) 50%, rgba(59, 130, 246, 0.22) 50%);
  --vp-home-hero-image-filter: blur(56px);
}
.VPHome .vp-doc {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 24px 64px;
}
.VPHome .vp-doc img {
  border-radius: 10px;
  border: 1px solid rgba(128, 128, 128, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
}
</style>
