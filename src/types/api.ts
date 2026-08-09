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

export interface DeepseekSettings {
  api_key: string;
  model: string;
  base_url: string;
}

export interface Settings {
  theme: Theme;
  agent_overrides: Record<string, string>;
  deepseek: DeepseekSettings;
}

export interface TranslateResult {
  cached: boolean;
  text: string | null;
  request_id: string;
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

/** invoke 错误形态(Rust AppError 序列化) */
export interface CommandError {
  code: string;
  message: string;
}
