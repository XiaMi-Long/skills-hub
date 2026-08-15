# skills-hub

统一管理本机 8 个 AI agent 的 skills(查看/编辑/新建/删除/互相同步),附 DeepSeek 翻译阅读。

技术栈:Rust + Tauri v2 · React 19 + TypeScript + Vite + Tailwind v4 + zustand · CodeMirror 6 · async-openai。

详见 `DESIGN.md`(完整实施规格)。

## 全局质感背景(设置 → 外观 → 背景质感)

「全局质感背景」开关(默认开启):窗口启用 **Windows 亚克力透明**(可透到桌面),叠加渐变背景、颗粒噪点、磨砂玻璃与半透明面板;关闭则为实心纯色风格。

- 需要 Windows 10/11,且系统「个性化 → 颜色 → 透明度效果」开启(关闭时亚克力会退化为不透明)。
- 实现:`tauri.conf.json` 窗口 `transparent: true` + 运行时 `set_effects(Acrylic)`(启动按设置应用,开关即时切换),页面背景在质感模式下改为半透明 CSS token。

## 命令添加技能(新建技能 → 命令添加)

直接粘贴 `npx skills add …` 命令即可从 GitHub 仓库添加技能:

```
npx skills add https://github.com/humanlayer/skills --skill show-me
```

- 也接受裸链接或 `owner/repo`(支持 `/tree/<分支>/子路径`、`--skill=name` 写法);仅支持 GitHub 公开仓库。
- 仓库含多个技能时列出供选择;`--skill` 命中时自动选中。
- 下载前可在预览表单编辑名字/描述/正文;配置 DeepSeek API Key 后可用「AI 解读」自动读取技能内容生成描述与摘要。
- 目标模块支持全选/单选(同「同步到…」弹窗样式);已存在的同名技能需勾选覆盖。
- 技能文件夹(SKILL.md + 辅助文件)原样安装到所选 agent 的 skills 目录。
