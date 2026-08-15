// Rust serde 结构镜像(src-tauri/src/*.rs)

export type AgentId =
  | "claude_code"
  | "codex"
  | "grok"
  | "pi"
  | "cursor"
  | "trae"
  | "qoder"
  | "universal";

export interface SkillInstance {
  agent_id: AgentId;
  abs_path: string;
  name: string;
  description: string;
  supporting_files: number;
  has_skill_md: boolean;
  mtime: number;
  content_hash: number;
}

export interface SkillGroup {
  name: string;
  instances: SkillInstance[];
  drift: boolean;
}

export interface ScanError {
  agent_id: AgentId;
  path: string;
  message: string;
}

export interface ScanResult {
  groups: SkillGroup[];
  scanned_at: number;
  errors: ScanError[];
}

export interface ReadSkillResult {
  instance: SkillInstance;
  raw: string;
}

export type DeleteScope = "thisCopy" | "allCopies";
export type OnConflict = "overwrite" | "skip";

export interface SyncDirective {
  target: AgentId;
  on_conflict: OnConflict;
}

export type Theme = "dark" | "light" | "system";

/** 系统色调(settings.accent,Rust Accent 枚举镜像) */
export type Accent = "blue" | "orange" | "green" | "purple" | "pink";

/** 翻译目标语言 */
export type TranslateTo = "zh" | "en";

/** 打开技能时的默认视图 */
export type SkillOpenView = "original" | "translated";

/** 技能预览 Markdown 排版主题 */
export type MarkdownTheme = "default" | "docs" | "paper" | "compact";

export interface DeepseekSettings {
  api_key: string;
  model: string;
  base_url: string;
  translate_to: TranslateTo;
}

export interface Settings {
  theme: Theme;
  accent: Accent;
  default_view: SkillOpenView;
  markdown_theme: MarkdownTheme;
  /** 全局质感背景(渐变 + 颗粒噪点 + 磨砂玻璃 + 半透明面板) */
  fancy_background: boolean;
  agent_overrides: Record<string, string>;
  deepseek: DeepseekSettings;
}

export interface TranslateResult {
  cached: boolean;
  text: string | null;
  request_id: string;
}

/** 翻译缓存检查:hit=有缓存;stale=文件已变(附旧译文);none=从未翻译 */
export interface CheckTranslationResult {
  status: "hit" | "stale" | "none";
  text: string | null;
}

export interface TranslateAllStart {
  total: number;
}

/** 批量替换预检:total = 有 SKILL.md 的副本总数,replaceable = 当前内容命中译文缓存的副本数 */
export interface CountReplaceableResult {
  total: number;
  replaceable: number;
}

/** 批量替换结果:skipped = 未翻译或译文过期被跳过的副本数 */
export interface ReplaceAllResult {
  replaced: number;
  skipped: number;
  failed: number;
  errors: BatchErrorItem[];
}

export interface TestDeepseekResult {
  ok: boolean;
  message: string;
}

/** 远程仓库中的单个技能(list_remote_skills) */
export interface RemoteSkillInfo {
  /** 技能目录相对仓库根的路径;空串 = 仓库根即技能 */
  dir: string;
  name: string;
  description: string;
  file_count: number;
}

export interface RemoteRepoInfo {
  owner: string;
  repo: string;
  git_ref: string;
  skills: RemoteSkillInfo[];
}

export interface RemoteFileMeta {
  /** 相对技能目录的路径 */
  path: string;
  size: number;
}

/** fetch_remote_skill 返回的预览元信息(文件字节留在 Rust 内存缓存,凭 fetch_id 安装) */
export interface FetchedSkillMeta {
  fetch_id: string;
  owner: string;
  repo: string;
  git_ref: string;
  dir: string;
  name: string;
  description: string;
  /** SKILL.md 去掉 frontmatter 后的正文 */
  body: string;
  /** SKILL.md 原文(AI 解读用) */
  skill_md_raw: string;
  files: RemoteFileMeta[];
  skipped: string[];
}

/** AI 读取技能内容的结果 */
export interface AiSkillRead {
  title: string;
  description: string;
  summary: string;
}

/** Rust Result<T, String> 的 JSON 形态:{ Ok: T } | { Err: string } */
export type RustResult<T> = { Ok: T } | { Err: string };

/** 翻译事件 */
export interface TranslateChunkEvent {
  request_id: string;
  delta: string;
}
export interface TranslateDoneEvent {
  request_id: string;
  text: string;
}
export interface TranslateErrorEvent {
  request_id: string;
  message: string;
}

/** 批量翻译事件 */
export interface TranslateAllProgressEvent {
  done: number;
  total: number;
  current: string;
}
export interface BatchErrorItem {
  name: string;
  message: string;
}
export interface TranslateAllDoneEvent {
  translated: number;
  skipped: number;
  failed: number;
  cancelled: boolean;
  errors: BatchErrorItem[];
}

/** invoke 错误形态(Rust AppError 序列化) */
export interface CommandError {
  code: string;
  message: string;
}
