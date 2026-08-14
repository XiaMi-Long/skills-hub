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
