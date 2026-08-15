# 命令添加技能

用一条命令从 GitHub 仓库安装技能,无需手动下载复制。

## 使用方式

「新建技能」→ 切换到「命令添加」,粘贴命令后点「解析并获取」:

```bash
npx skills add https://github.com/humanlayer/skills --skill show-me
```

支持的来源写法:

- 完整命令:`npx skills add <来源> [--skill <名字>]`
- GitHub 链接:`https://github.com/owner/repo`(支持 `/tree/分支/子路径`)
- 简写:`owner/repo`、`owner/repo/技能目录`
- SSH 形式:`git@github.com:owner/repo.git`

::: tip 仅支持 GitHub 公开仓库
通过 GitHub API + raw 文件下载实现,未认证时 API 限流约 60 次/小时,日常使用足够。
:::

## 流程

1. **解析**:识别仓库、分支、子路径与 `--skill` 指定的技能名
2. **列技能**:仓库含多个技能时列出供选择(name + 描述 + 文件数);`--skill` 命中或仓库只有一个技能时自动选中
3. **下载预览**:SKILL.md 与全部辅助文件下载到内存缓存,表单预填名字/描述/正文,均可修改
4. **AI 解读**:配置了 DeepSeek API Key 时自动读取技能内容,生成标题、一句话描述与摘要并预填(可「重新解读」)
5. **选择目标**:安装到哪些 agent——**全部或单个任选**(与同步弹窗同款),同名冲突需勾选覆盖
6. **安装**:SKILL.md 按表单内容重建,辅助文件原样落盘;采用 staging → rename 原子替换,中途失败不留半成品;结果按 agent 逐条汇总

## 示例

从 `vercel-labs/skills` 安装单个技能:

```bash
npx skills add vercel-labs/skills --skill some-skill
```

指定分支与子路径:

```bash
npx skills add https://github.com/owner/repo/tree/main/skills/my-skill
```
