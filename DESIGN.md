# skills-hub v1 实施规格

**交付方式**:本文档为完整实施规格,由其他模型/人按文档执行,无需额外上下文。
**项目位置**:`E:/私人项目/skills-hub/`(greenfield,当前不存在)。
**一句话**:Rust+Tauri v2 桌面 app,统一管理本机 8 个 AI agent 的 skills(查看/编辑/新建/删除/互相同步),附 DeepSeek 翻译阅读。

---

## 0. 已锁定决策(不许重议)

| # | 决策 |
|---|------|
| 1 | 数据模型:纯扫描,无中心主库。扫描各 agent skills 目录,同名归组;同步=递归文件夹复制 |
| 2 | 8 个 agent 目标(见 §2),含 universal `.agents/skills` |
| 3 | v1 功能:列表+搜索、详情 Markdown 渲染、raw 编辑、新建、删除、同步(冲突弹窗)、资源管理器打开、漂移圆点提示、focus 自动重扫+手动刷新、暗/亮主题、设置页(路径覆盖+DeepSeek 配置)、翻译阅读 |
| 4 | 不做(v2 候选):collections/分组、收藏、Discover 在线市场、fs watcher、项目级 skills、i18n 英文版、agent 命令执行/MCP |
| 5 | 栈:Tauri v2 + Rust;React 19 + TS + Vite + Tailwind v4 + zustand;CodeMirror 6;react-markdown+remark-gfm+rehype-highlight;async-openai |
| 6 | UI 语言:中文(术语 skill/agent/sync/SKILL.md 保留英文) |
| 7 | 视觉:现代扁平为底 + 三层质感(磨砂 glass 仅浮层、微妙渐变、颗粒噪点),暗色默认 + 亮色切换;色调默认蓝,设置页可选蓝/橙/绿/紫/粉 |
| 8 | 翻译:视图层展示 + 内容寻址缓存(相同内容副本共享)+ 打开自动读缓存(stale 提醒)+ 一键翻译全部 + 确认后用译文替换原文;翻译态禁止编辑;目标语言(中/英)/默认视图可设置 |
| 9 | 平台:Win11 先做;路径全走 `dirs::home_dir()`,mac/linux 理论可跑但不测试不承诺 |

环境:Win11,MSVC VS2019 BuildTools(14.29,已有 C++ 负载),rustup 在 `C:\Users\admin\.cargo\bin`(Git Bash 需 `export PATH="$PATH:/c/Users/admin/.cargo/bin"`)。

---

## 1. 项目结构

```
E:/私人项目/skills-hub/
├── package.json                 # react19, react-dom, zustand, codemirror, @codemirror/lang-markdown,
│                                # react-markdown, remark-gfm, rehype-highlight, tailwindcss@4, @tailwindcss/vite
├── vite.config.ts               # react() + tailwindcss() 插件
├── tsconfig.json
├── index.html
├── src/                         # 前端,见 §7
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json          # productName "skills-hub", identifier "com.skillshub.app"
    ├── capabilities/default.json
    ├── icons/
    └── src/
        ├── main.rs              # Builder + plugins(opener, dialog)+ invoke_handler
        ├── lib.rs               # mod 声明 + run()
        ├── agents.rs            # AgentId + AGENTS 常量表
        ├── skill.rs             # SkillInstance/SkillGroup/ScanResult/group_key
        ├── frontmatter.rs       # gray_matter + serde_yaml 解析与兜底
        ├── scanner.rs           # 并发扫 8 目录,归组,算漂移
        ├── sync.rs              # stage_then_replace 复制引擎
        ├── llm.rs               # DeepSeek 客户端 + 流式 + 缓存
        ├── settings.rs          # Settings 读写(原子写)
        ├── commands.rs          # 全部 #[tauri::command]
        └── error.rs             # AppError → InvokeError
```

**Cargo.toml deps**:`tauri = "2"`, `tauri-plugin-opener = "2"`, `tauri-plugin-dialog = "2"`, `serde = {1, derive}`, `serde_json`, `serde_yaml = "0.9"`, `gray_matter = "0.2"`, `walkdir = "2"`, `dirs = "5"`, `thiserror = "1"`, `uuid = {1, v4}`, `async-openai = "0.27"`, `tokio = {1, full}`, `futures = "0.3"`。dev-deps:`tempfile = "3"`。
**不需要** tauri-plugin-fs(fs 全在 Rust 侧直接做)。

**capabilities/default.json**:`core:default`, `opener:default`, `dialog:default`, `core:event:default`。

---

## 2. Agent 注册表(agents.rs)

| id | display | default_subpath(相对 home) | badge 色 | 备注 |
|----|---------|------------------------------|----------|------|
| claude_code | Claude Code | `.claude/skills` | #E8865A | |
| codex | Codex | `.codex/skills` | #10A37F | |
| grok | Grok | `.grok/skills` | #3B82F6 | 实现时 web 查证 SKILL.md 约定;不符则降级(§5 兜底) |
| pi | Pi | `.pi/agent/skills` | #8B5CF6 | 同上 |
| cursor | Cursor | `.cursor/skills` | #06B6D4 | |
| trae | Trae | `.trae/skills` | #22C55E | |
| qoder | Qoder | `.qoder/skills` | #F59E0B | |
| universal | Universal | `.agents/skills` | #EF6C4D | |

8 个目录本机已验证存在。`AgentMeta { id, display, default_subpath, icon_color }`。
路径解析:`Settings.agent_overrides.get(id)` 优先,否则 `dirs::home_dir().join(default_subpath)`。目录不存在 = 该 agent 0 skills,不报错(sidebar 显示 0 + 「未检测到」灰字)。

---

## 3. Rust 数据模型(skill.rs)

```rust
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum AgentId { ClaudeCode, Codex, Grok, Pi, Cursor, Trae, Qoder, Universal }

pub struct SkillInstance {
    pub agent_id: AgentId,
    pub abs_path: PathBuf,        // skill 文件夹绝对路径
    pub name: String,             // frontmatter name,缺则 dirname
    pub description: String,      // frontmatter description,缺则 ""
    pub supporting_files: u32,    // 除 SKILL.md 外的文件数(递归)
    pub has_skill_md: bool,
    pub mtime: i64,               // SKILL.md mtime epoch 秒;无则 0
    pub content_hash: u64,        // SKILL.md 字节 DefaultHasher;无则 0
}

pub struct SkillGroup {
    pub name: String,             // group_key
    pub instances: Vec<SkillInstance>,   // 按 AGENTS 表顺序排
    pub drift: bool,              // has_skill_md 的实例中 content_hash 有 ≥2 种
}

pub struct ScanResult { pub groups: Vec<SkillGroup>, pub scanned_at: i64, pub errors: Vec<ScanError> }
pub struct ScanError { pub agent_id: AgentId, pub path: PathBuf, pub message: String }

pub enum DeleteScope { ThisCopy, AllCopies }
pub enum OnConflict { Overwrite, Skip }
pub struct SyncDirective { pub target: AgentId, pub on_conflict: OnConflict }
```

group_key:`name.to_ascii_lowercase().trim()` 后空白换 `-`。"My Skill"=="my-skill"。

**Settings**(settings.rs,存 `app_data_dir/settings.json`,原子写 `.tmp`+rename):

```rust
pub struct Settings {
    pub theme: Theme,                          // Dark | Light | System,默认 Dark
    pub accent: Accent,                        // Blue|Orange|Green|Purple|Pink,默认 Blue;#[serde(default)] 兼容旧配置
    pub default_view: SkillOpenView,           // Original | Translated,默认 Original;打开技能默认显示原文或译文
    pub agent_overrides: HashMap<AgentId, PathBuf>,
    pub deepseek: DeepseekSettings,
}
pub struct DeepseekSettings {
    pub api_key: String,                       // 明文存本地,设置页有警示文案
    pub model: String,                         // 默认 "deepseek-chat"
    pub base_url: String,                      // 默认 "https://api.deepseek.com/v1"
    pub translate_to: TranslateTo,             // Zh | En,默认 Zh
}
```

---

## 4. Tauri 命令面(commands.rs)

全部 `Result<T, AppError>`。AppError 用 thiserror,serde 序列化 `{ code, message }` 给前端 toast。

| 命令 | 参数 | 返回 | 行为 |
|------|------|------|------|
| `scan_all` | — | `ScanResult` | 8 目录 std::thread 并发扫;归组;算 drift;groups 按 name 升序 |
| `read_skill_md` | `agent_id, skill_name` | `{ instance, raw }` | 读该 agent 目录下副本原文 |
| `write_skill_md` | `agent_id, skill_name, raw, loaded_mtime: i64` | `SkillInstance` | 写前比对磁盘 mtime ≠ loaded_mtime 返回 `Err(FileChangedOnDisk)`,UI 弹「磁盘已变化,仍覆盖?」二次确认(force 参数重载);写后重算 instance 字段 |
| `create_skill` | `name, description, body_md, targets: Vec<AgentId>, overwrite: bool` | `Vec<(AgentId, Result<SkillInstance, String>)>` | 每 target 拼 `---\nname\ndescription\n---\n\nbody` 写 SKILL.md;已存在且 !overwrite 该 target 报错;部分失败不中断 |
| `delete_skill` | `agent_id, skill_name, scope` | `()` | AllCopies 遍历全 agent 删同名目录;remove_dir_all |
| `sync_skill` | `source_agent, skill_name, directives: Vec<SyncDirective>` | `Vec<(AgentId, Result<(), String>)>` | §5 引擎;逐 target 收集结果 |
| `reveal_in_explorer` | `agent_id, skill_name` | `()` | `Command::new("explorer.exe").arg(format!("/select,{}", path))` |
| `get_settings` / `save_settings` | — / `Settings` | `Settings` / `()` | 首跑生成默认;save 原子写 |
| `translate_skill` | `agent_id, skill_name` | `{ cached: bool, text: Option<String>, request_id: String }` | 命中缓存直接返回全文;否则 request_id=uuid,异步 spawn 流式请求,经 event 推 chunk(§6) |
| `check_translation` | `agent_id, skill_name` | `{ status: hit\|stale\|none, text }` | 纯查缓存不发请求;stale 附旧译文供过期横幅展示 |
| `replace_with_translation` | `agent_id, skill_name, translated_raw, loaded_mtime, force` | `SkillInstance` | 译文写回原文(陈旧检测同 write_skill_md),并登记为新内容缓存 |
| `translate_all` | — | `{ total }` | 扫描去重后 spawn 批量任务,事件报进度;已在运行报错 |
| `cancel_translate_all` | — | `()` | 置取消标志,任务在下一条前终止 |
| `test_deepseek` | — | `{ ok: bool, message: String }` | 发一条 "ping" 非流式请求,返回 ok/错误信息 |

**Events**(Rust `app.emit`,前端 `listen`):`translate-chunk { request_id, delta }`、`translate-done { request_id, text }`(同时写缓存)、`translate-error { request_id, message }`;批量:`translate-all-progress { done, total, current }`、`translate-all-done { translated, skipped, failed, cancelled, errors }`。

---

## 5. 核心算法

### frontmatter 解析(frontmatter.rs)
1. `read_to_string`,失败则读字节 + `from_utf8_lossy`(BOM/非 UTF-8 兜底)+ 记 ScanError。
2. `gray_matter::Matter::<YAML>::parse` 切 body + YAML。
3. `serde_yaml::from_value` 取 `name: Option<String>`、`description: Option<String>`(折叠块 `>` 自动成单串)。
4. 兜底链:YAML 坏 → name=None;name None → dirname;description None → ""。无 SKILL.md → `has_skill_md=false`,name=dirname(覆盖 grok/pi 可能不符约定)。不 panic 任何分支。

### 扫描(scanner.rs)
每 agent:`read_dir` 一层,子目录即 skill 候选(忽略 `.` 开头隐藏目录除常规 skills 外?统一:忽略所有 `.` 开头目录)。每子目录解析 → SkillInstance。content_hash 用 `std::collections::hash_map::DefaultHasher` 对 SKILL.md 全字节(确定、会话内稳定即可)。
归组后 drift = distinct(hash where has_skill_md) ≥ 2。

### 同步引擎(sync.rs)
```
sync_one(src_dir, target_parent, skill_name, on_conflict):
  target = target_parent / src_dir.file_name()
  if target.exists():
    Skip → Ok; Overwrite → stage_then_replace
  else stage_then_replace

stage_then_replace(src, target):
  staging = target.parent / format!(".skills-hub-staging-{}", uuid)
  walkdir(follow_links=false) 逐文件 fs::copy、逐目录 create_dir_all
  遇 symlink → 跳过,记入 skipped 列表(随结果返回)
  完成后:若 target 存在 remove_dir_all;fs::rename(staging, target)
  中途错:best-effort 删 staging,Err(message)
```
`.git` 目录**包含**(skill 文件夹是复制单元,不静默改内容)。rename 是最后一步,中断不会毁原目录。

### 写盘陈旧检测
`write_skill_md` 带 `loaded_mtime`,磁盘 mtime 不一致 → `Err(FileChangedOnDisk)`;前端弹确认后用 force 变体重试(命令加 `force: bool` 参数)。

---

## 6. 翻译模块(llm.rs)

- 客户端:`async_openai::Client::with_config(OpenAIConfig::new().with_api_key(k).with_api_base(base_url))`。
- 流式:`chat().create_stream(...)`,`futures::StreamExt` 逐 chunk `emit("translate-chunk")`。
- **Prompt**(`PROMPT_VERSION: u32 = 2`,入缓存 key):目标语言由 `Settings.deepseek.translate_to`(zh/en)决定,zh 用简体中文提示词,en 用英文提示词;均要求保留代码块/行内代码/路径/命令/frontmatter key,name 值不变、description 值翻译,输出含 frontmatter 的完整全文,无解释。
- **内容寻址缓存**:key = `DefaultHasher(内容字节 + 目标语言 + model + base_url + PROMPT_VERSION)` 的 hex;文件 `app_data_dir/translations/<key>.md`。**相同内容的多 agent 副本共享一份翻译**。
- **清单**:`translations/index.json` 记录 `abs_path → { content_hash, key, translated_at }`,读写走全局 Mutex。`check_translation` 纯查:当前内容 key 命中 → `hit`;清单里有旧哈希但内容已变 → `stale`(附旧译文,供"过期"横幅展示);否则 `none`。
- **打开即读缓存**:前端切换技能后调 `check_translation`;设置 `default_view=translated` 时命中直接显示译文,stale 显示旧译文+「原文已更新」横幅,none 显示「立即翻译」空态;原文视图下 stale 在翻译按钮旁显示「翻译已过期」徽标。绝不静默重译(费用可控)。
- **一键翻译全部**:`translate_all` 扫描全部实例按内容去重,顺序非流式翻译,progress/done 事件上报,`cancel_translate_all` 可取消;相同内容副本同时登记清单。
- **写回**:`replace_with_translation` 用译文覆盖 SKILL.md 原文(带 mtime 陈旧检测,force 二次确认),并把译文登记为新内容的缓存(下次打开命中)。前端仅译文视图下可写回(stale/流式中禁用),确认弹窗警示原文丢失。
- API key 未配置 → 前端翻译按钮禁用 + 提示「在设置中配置 DeepSeek API」。
- 扩展预留:目录级 `services/` 不放东西;v2 agent 命令执行用 `std::process::Command` 自包,MCP 再评 `rmcp`。v1 不引框架。

---

## 7. 前端架构

```
src/
├── main.tsx / App.tsx           # mount;<GrainOverlay/> 全局一层
├── shell/  AppShell.tsx(4 列 grid) IconRail.tsx TopToolbar.tsx GrainOverlay.tsx
├── sidebar/ AgentSidebar.tsx AgentRow.tsx        # 「全部技能」+8 agent+计数+未检测灰字
├── list/   SkillList.tsx SkillRow.tsx AgentBadge.tsx   # 搜索框+行(name+badges+漂移橙点)
├── detail/ SkillDetail.tsx ViewPane.tsx EditPane.tsx InstanceSelector.tsx
├── modals/ SyncModal.tsx ConflictResolver.tsx SyncResultSummary.tsx NewSkillModal.tsx DeleteDialog.tsx
├── settings/ SettingsPage.tsx
├── ui/     Button Input Chip Modal Toast(Sonner 或自写,自写优先少依赖)
│           + Checkbox/Radio/Select 自定义控件:勾选为 accent 渐变底+白色对勾、单选框为渐变环+内点、
│             下拉为玻璃浮层;Input/Button 聚焦 accent 光晕+按压缩放;Modal/Toast 入场轻动效,尊重 prefers-reduced-motion
├── editor/ cm-setup.ts          # codemirror meta 包 + @codemirror/lang-markdown,
│                                # EditorView.theme 读 CSS var,无独立主题文件
├── md/     Markdown.tsx         # react-markdown + remark-gfm + rehype-highlight
├── store/  app.ts(zustand: theme/route/toasts) skills.ts(ScanResult/选中 group/选中 instance/刷新触发)
│           settings.ts translate.ts(request_id→累积文本/状态)
├── api/    commands.ts          # invoke<T> 类型化 wrapper + listen 封装
├── lib/    paths.ts(展示用 \\→/)
├── styles/ globals.css          # @import "tailwindcss"; @custom-variant dark; 全部 CSS var token(§8)
└── types/  api.ts               # Rust serde 结构 TS 镜像
```

**zustand** 理由:单大数据块+多消费组件,selector 订阅免全树重渲;三 store 分治。

**刷新触发**:`scan_all` 于 mount、窗口 `focus`(debounce 500ms)、手动按钮、任何变更命令成功后。无 fs watcher。

**键盘**:Ctrl+F 聚焦搜索;Esc 关 modal;Edit 内 Ctrl+S 保存。

**关键交互规格**:
- SkillRow:name + 各实例 AgentBadge;drift=true 行右侧 6px 橙色圆点(tooltip「副本内容不一致」)。
- InstanceSelector:详情头排 badges,点击切换查看哪个副本;默认选 AGENTS 顺序第一个 has_skill_md 实例。
- ViewPane:meta chips(scope=global、辅助文件数、绝对路径 mono 字体、badges)+ 渲染 markdown;工具条:翻译/查看原文 切换、同步到…、打开目录、删除。翻译态:顶部 chip「已翻译 · deepseek-chat」,Edit tab 置灰 tooltip「翻译视图只读,切回原文可编辑」。翻译流式:chunk 累积节流 100ms 重渲 Markdown。打开技能按 `default_view` 自动读缓存进入译文;stale 显示旧译文 + 「原文已更新」横幅 + 重新翻译按钮,原文视图翻译按钮旁「翻译已过期」徽标;译文完整时提供「用译文替换原文」(ConfirmDialog 警示,force 处理 FileChangedOnDisk)。
- EditPane:CodeMirror;Cancel 丢弃;Save 调 write_skill_md;FileChangedOnDisk → 确认弹窗「文件在磁盘上已被外部修改,仍要覆盖?」。
- SyncModal:源 badge 固定;8 target checkbox,默认勾选「无副本」者,「有副本」者不勾但带橙色「已存在」chip;下一步若有勾选已存在者 → ConflictResolver:逐行 覆盖/跳过 radio + 「应用到全部」;执行后 SyncResultSummary 逐 target ✓/✗+错误文案。
- NewSkillModal:名字输入 + 描述 + body textarea(预填模板)+ targets 复选。名字校验 `^[a-z0-9]+(-[a-z0-9]+)*$`,不符红字提示;与某 target 已有同名 → 内联警告列出,出现「覆盖已有」checkbox 才可提交。
- DeleteDialog:radio「仅此副本 / 所有副本(N)」+ 红色确认按钮,二次输入名字?不,普通确认即可。
- SettingsPage 分区:主题(暗/亮/跟随系统 radio);色调(蓝/橙/绿/紫/粉 swatch,默认蓝,即选即预览,`applyAccent` 写 `--accent-from/--accent-to` 内联样式到 `<html>`);Agent 路径(8 行:display + 路径 input + 浏览按钮(dialog plugin)+ 重置默认);DeepSeek(API key password input + model select[deepseek-chat, deepseek-reasoner, 自定义输入] + base_url input + 目标语言 radio[中文/英文] + 默认视图 radio[原文/译文] + 「连接测试」按钮调 test_deepseek + 警示文案「key 仅存本机 app 数据目录,明文」);一键翻译全部(进度条 + 取消,事件驱动,无 key 禁用 + 额度警示);重新扫描按钮;版本 footer。

**Modal 挂载**:所有 Modal 经 `createPortal` 挂到 `document.body`(挂载点祖先的 backdrop-filter/transform 会劫持 fixed 定位与层叠上下文)。警示语义(漂移点/冲突/未保存)固定用 `--warning` token,不随色调变化。

**UI 文案全中文**,术语保留:skill、agent、SKILL.md、sync 场景用「同步」。示例:搜索框 placeholder「搜索技能…」、空态「选择一个技能查看详情」、按钮「新建技能 / 保存 / 取消 / 同步到… / 删除 / 打开目录 / 翻译 / 查看原文 / 重新扫描 / 连接测试」。

---

## 8. 视觉规格

布局 grid:`56px 220px 320px 1fr`,全高,列间 1px `--border-subtle` 分隔。

**Token(globals.css CSS var)**:

| token | 暗(默认) | 亮 |
|-------|-----------|-----|
| --bg-app-from / -to | #0b0b0d / #141418 | #fafafa / #f0f0f2 |
| --bg-pane | #111114 | #ffffff |
| --bg-elevated | #17171c | #f4f4f5 |
| --bg-glass | rgba(20,20,22,0.60) | rgba(255,255,255,0.55) |
| --border-subtle | rgba(255,255,255,0.08) | rgba(0,0,0,0.06) |
| --border-strong | rgba(255,255,255,0.16) | rgba(0,0,0,0.14) |
| --text-primary / secondary / muted | #ededed / #a1a1aa / #6b7280 | #18181b / #52525b / #a1a1aa |
| --accent-from / -to | #2563eb / #3b82f6(默认蓝,设置页可调) | 同 |
| --warning / --danger / --success | #f59e0b / #ef4444 / #22c55e | 同 |

圆角:控件 8px、卡片/modal 10px。无重阴影;浮层仅 `0 1px 2px rgba(0,0,0,0.4)`。

**三层质感**:
1. 渐变:body `linear-gradient(180deg, var(--bg-app-from), var(--bg-app-to))`;accent 渐变 `linear-gradient(90deg,#f97316,#f59e0b)` 仅用于主按钮/IconRail active pill/同步进度条,不上文字不上大面。
2. 颗粒:`<GrainOverlay/>` fixed inset-0 pointer-events-none z-[1],background-image 为 inline SVG feTurbulence data-URI(`baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'`,200×200),opacity 暗 0.04 / 亮 0.025,mix-blend-mode overlay。单层无动画。
3. 磨砂:`backdrop-filter: blur(14px) saturate(1.2)` + `--bg-glass` + 1px border,**仅** IconRail、TopToolbar、所有 modal/dropdown。主三列 pane 保持实心扁平。WebView2(Chromium)原生支持。

**字体**:UI `Inter, "Segoe UI", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif`;mono `ui-monospace, "JetBrains Mono", Menlo, monospace`(路径/计数/chip)。字号:chip 11 / 行 13 / 标题 14 / caption 12,line-height 1.45。

---

## 9. 里程碑(每个结束 `npm run tauri dev` 可跑 + 门禁)

- **M0 脚手架(0.5d)**:`npm create tauri-app@latest skills-hub -- --template react-ts`;Tailwind v4;token+grain+渐变落地;4 列空 grid。门禁:窗口开,暗色渐变+颗粒可见,临时按钮切亮色。
- **M1 扫描+列表+查看(1-2d)**:agents/scanner/skill/frontmatter + scan_all/read_skill_md;sidebar/list/detail ViewPane/InstanceSelector。门禁:真实列出本机 caveman、agent-browser、pptx、find-skills、grill-me、frontend-design、release-openspec、activitykit;点 caveman 渲染全文;badge 切换副本;故意造一个无 SKILL.md 目录验证降级不崩;unicode 目录 `测试-skill` 不崩。
- **M2 编辑+新建+删除(1-2d)**:write/create/delete/reveal;CodeMirror;NewSkillModal/DeleteDialog。门禁:建 demo-skill 到 claudecode+codex;只在 codex 编辑;ls 验证两份不同;删「仅此副本」后 claudecode 仍在;reveal 选中 SKILL.md。
- **M3 同步+冲突(1d)**:sync_skill + 三 modal。门禁:demo-skill 从 codex 同步 → cursor(新)+ → claudecode(冲突选覆盖);ls 验证内容;staging 目录无残留。
- **M4 设置+主题+打磨(0.5-1d)**:settings 读写、路径覆盖、theme system、toast、键盘、focus 重扫、漂移圆点(手动改一份副本验证橙点出现)。
- **M5 翻译(1d)**:llm.rs + 设置页 DeepSeek 区 + ViewPane 翻译流式 + 缓存 + 编辑禁用。门禁:填 key 后翻译 caveman 流式出中文;关窗口重开命中缓存(无网络请求,看 toast「已命中缓存」或 devtools);无 key 时按钮禁用+提示;test_deepseek 错 key 报可读错误。

合计约 5-7 人日。

---

## 10. 测试

**cargo test**(src-tauri/):
- frontmatter:最小解析 / 折叠 `>` description / 无 frontmatter 兜底 / 坏 YAML 不 panic。
- skill:group_key 大小写空白归一("My Skill"=="my-skill"=="MY SKILL")。
- scanner:合成实例归组 + drift 计算。
- sync(tempfile):overwrite 替换后内容一致 / skip 不动 / symlink 跳过记入 skipped / 一个 target 不可写其余仍成功。
- settings:原子写 roundtrip。

**e2e 手动脚本**(M5 后跑,14 步):dev 启动 → 计数与 ls 一致 → 搜 caveman → 详情切副本 → 建 verify-skill(claudecode+codex)→ ls 双份 → codex 单改 → sync codex→cursor(新)+→claudecode(覆盖)→ ls 验证 → 删仅 cursor → 删全部 → 设置覆盖 codex 路径重扫 0 条再还原 → 切亮色 → `npm run tauri build` 出 exe → 翻译流程(有 key/无 key/缓存三态)。

---

## 11. 风险与对策

| 风险 | 对策 |
|------|------|
| Win 路径 `\`/`/` | Rust PathBuf;前端仅展示时 replace;不做字符串拼路径 |
| SKILL.md BOM/非 UTF-8 | from_utf8_lossy 兜底 + ScanError |
| 外部并发改文件 | focus 重扫 + write mtime 二次确认 |
| grok/pi 约定不符 | has_skill_md=false 降级;M1 时 web 查证,若用别的 manifest 文件名给 AgentMeta 加 `manifest_filename` 字段 |
| remove_dir_all 中途失败 | rename 最后一步,原目录在;错误带上下文上报 |
| backdrop-filter 性能 | 仅小浮层,不动画;M0 门禁滚 200 行列表验证 |
| DeepSeek 404 base_url | 设置可改 base_url;默认 `/v1`,README 注 fallback 去 `/v1` |
| API key 明文 | 仅本机 app 数据目录;设置页警示;不外传任何他处 |

---

## 12. 关键文件(实现优先序)

1. `src-tauri/src/skill.rs` — 数据模型,一切依赖
2. `src-tauri/src/frontmatter.rs` — 兜底分支最多,测试最密
3. `src-tauri/src/sync.rs` — 操作风险最高
4. `src-tauri/src/commands.rs` — Rust↔TS 契约
5. `src-tauri/src/llm.rs` — 流式+缓存
6. `src/store/skills.ts` — 前端状态中枢

## 13. 验收口径

M0-M5 门禁全过 + §10 e2e 14 步全过 + cargo test 全绿 + `tauri build` 出 exe,即 v1 完成。
