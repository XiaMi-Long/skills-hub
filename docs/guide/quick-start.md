# 快速开始

skills-hub 是一个 Windows 桌面应用(Rust + Tauri v2),统一管理本机 8 个 AI agent 的 skills。

## 支持的管理对象

| Agent | 默认 skills 目录 |
| --- | --- |
| Claude Code | `~/.claude/skills` |
| Codex | `~/.codex/skills` |
| Grok | `~/.grok/skills` |
| Pi | `~/.pi/agent/skills` |
| Cursor | `~/.cursor/skills` |
| Trae | `~/.trae/skills` |
| Qoder | `~/.qoder/skills` |
| Universal | `~/.agents/skills` |

目录不存在不会报错,只是该 agent 显示 0 个技能;也可以在设置里覆盖任意路径。

## 安装

1. 到 [下载](/download) 页获取最新的 `skills-hub_x.x.x_x64-setup.exe` 安装包。
2. 运行安装包,按向导完成安装(无需管理员权限)。
3. 启动应用,首次会自动扫描全部 agent 目录。

::: tip 系统要求
Windows 10/11。「全局质感背景」的窗口亚克力透明需要 Windows 10/11,且系统「设置 → 个性化 → 颜色 → 透明度效果」处于开启状态。
:::

## 界面结构

- **左侧图标栏**:首页/设置入口,底部明暗主题切换
- **Agent 侧栏**:「全部技能」+ 8 个 agent 过滤,带计数与「未检测到」提示
- **技能列表**:搜索框(Ctrl+F)+ 技能行;行尾橙色圆点表示该技能在不同 agent 间的副本内容不一致(漂移)
- **详情区**:SKILL.md 渲染预览 / 原文编辑(CodeMirror,Ctrl+S 保存),顶部徽标切换查看不同 agent 的副本

## 下一步

- [技能管理](/guide/manage):查看、编辑、新建、删除
- [命令添加技能](/guide/command-add):一条命令从 GitHub 安装技能
- [同步](/guide/sync):把技能复制到更多 agent
- [翻译阅读](/guide/translate):DeepSeek 翻译英文技能
- [外观与设置](/guide/settings):主题、色调、质感背景、路径覆盖
