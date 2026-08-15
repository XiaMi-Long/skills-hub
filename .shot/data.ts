import type { ScanResult, Settings, SkillInstance } from "../src/types/api";

/** 官网截图专用 mock 数据(不参与应用构建) */

const now = Math.floor(Date.now() / 1000);

function inst(
  agent_id: SkillInstance["agent_id"],
  name: string,
  description: string,
  supporting_files = 0,
  content_hash = 1,
): SkillInstance {
  return {
    agent_id,
    abs_path: `C:/Users/demo/${agent_id}/${name}`,
    name,
    description,
    supporting_files,
    has_skill_md: true,
    mtime: now,
    content_hash,
  };
}

export const mockScan: ScanResult = {
  groups: [
    {
      name: "agent-browser",
      drift: false,
      instances: [
        inst("claude_code", "agent-browser", "面向 AI 代理的浏览器自动化命令行工具,打开网页、填写表单、截图、抓取数据。", 3),
        inst("codex", "agent-browser", "面向 AI 代理的浏览器自动化命令行工具,打开网页、填写表单、截图、抓取数据。", 3),
      ],
    },
    {
      name: "caveman",
      drift: false,
      instances: [
        inst("claude_code", "caveman", "超压缩交流模式,保持技术准确的同时削减 65% 输出 token。"),
        inst("codex", "caveman", "超压缩交流模式,保持技术准确的同时削减 65% 输出 token。"),
        inst("universal", "caveman", "超压缩交流模式,保持技术准确的同时削减 65% 输出 token。"),
      ],
    },
    {
      name: "code-review",
      drift: false,
      instances: [inst("codex", "code-review", "沿规范与规格两个维度并行评审分支变更,输出并排报告。", 1)],
    },
    {
      name: "find-skills",
      drift: false,
      instances: [
        inst("claude_code", "find-skills", "发现、评估并安装合适的技能,扩展 Agent 能力。"),
        inst("cursor", "find-skills", "发现、评估并安装合适的技能,扩展 Agent 能力。"),
      ],
    },
    {
      name: "frontend-design",
      drift: true,
      instances: [
        inst("claude_code", "frontend-design", "创建有辨识度、生产级、高设计质量的前端界面,避免通用 AI 味审美。", 2, 11),
        inst("codex", "frontend-design", "创建有辨识度、生产级、高设计质量的前端界面,避免通用 AI 味审美。", 2, 12),
      ],
    },
    {
      name: "html-ppt",
      drift: false,
      instances: [inst("universal", "html-ppt", "HTML PPT 工作室,基于模板创建专业的静态演示文稿,支持多种风格与动画。", 5)],
    },
    {
      name: "show-me",
      drift: false,
      instances: [
        inst("claude_code", "show-me", "通过简洁的示意图、代码形状草图和聚焦的 HTML 构件,帮助用户直观理解当前主题。"),
        inst("codex", "show-me", "通过简洁的示意图、代码形状草图和聚焦的 HTML 构件,帮助用户直观理解当前主题。"),
        inst("cursor", "show-me", "通过简洁的示意图、代码形状草图和聚焦的 HTML 构件,帮助用户直观理解当前主题。"),
        inst("universal", "show-me", "通过简洁的示意图、代码形状草图和聚焦的 HTML 构件,帮助用户直观理解当前主题。"),
      ],
    },
    {
      name: "tdd",
      drift: false,
      instances: [inst("codex", "tdd", "测试驱动开发,以红-绿-重构的方式构建功能或修复缺陷。")],
    },
  ],
  scanned_at: now,
  errors: [],
};

export const showMeRaw = `---
name: show-me
description: 通过简洁的示意图、代码形状草图和聚焦的 HTML 构件,帮助用户直观地理解当前主题。
---

# show-me

用**最小化的视图**帮助用户可视化理解当前话题。跳过铺垫,保持文字简洁。

## 何时使用

- 用户请求解释某个概念或架构时
- 用户说「给我看一下」「画个图」「可视化一下」时
- 纯文字解释开始变得冗长、难以跟踪时

## 输出形式

1. **示意图** — Mermaid 图表优先,节点不超过 8 个
2. **代码形状草图** — 注释优于实现,结构优于细节
3. **HTML 构件** — 小而聚焦的单文件,直接可打开

\`\`\`mermaid
graph LR
  A[问题] --> B[最小视图]
  B --> C{够清楚吗?}
  C -->|否| B
  C -->|是| D[交付]
\`\`\`

> 原则:如果一个视图不能在一屏内说清楚,就把它拆成两个。
`;

export function mockSettings(theme: "dark" | "light"): Settings {
  return {
    theme,
    accent: "blue",
    default_view: "original",
    markdown_theme: "default",
    fancy_background: true,
    agent_overrides: {},
    deepseek: {
      api_key: "",
      model: "deepseek-chat",
      base_url: "https://api.deepseek.com/v1",
      translate_to: "zh",
    },
  };
}
