import { invoke } from "@tauri-apps/api/core";
import type {
  AiSkillRead,
  CheckTranslationResult,
  CountReplaceableResult,
  DeleteScope,
  FetchedSkillMeta,
  ReadSkillResult,
  RemoteRepoInfo,
  ReplaceAllResult,
  ScanResult,
  Settings,
  SkillInstance,
  SyncDirective,
  TestDeepseekResult,
  TranslateAllStart,
  TranslateResult,
} from "../types/api";
import type { AgentId } from "../types/api";

export const scanAll = () => invoke<ScanResult>("scan_all");

export const readSkillMd = (agentId: AgentId, skillName: string) =>
  invoke<ReadSkillResult>("read_skill_md", { agentId, skillName });

export const writeSkillMd = (
  agentId: AgentId,
  skillName: string,
  raw: string,
  loadedMtime: number,
  force = false,
) =>
  invoke<SkillInstance>("write_skill_md", {
    agentId,
    skillName,
    raw,
    loadedMtime,
    force,
  });

export const createSkill = (
  name: string,
  description: string,
  bodyMd: string,
  targets: AgentId[],
  overwrite: boolean,
) =>
  invoke<{ results: [AgentId, { Ok: SkillInstance } | { Err: string }][] }>("create_skill", {
    name,
    description,
    bodyMd,
    targets,
    overwrite,
  });

export const deleteSkill = (agentId: AgentId, skillName: string, scope: DeleteScope) =>
  invoke<void>("delete_skill", { agentId, skillName, scope });

export const syncSkill = (
  sourceAgent: AgentId,
  skillName: string,
  directives: SyncDirective[],
) =>
  invoke<{ results: [AgentId, { Ok: null } | { Err: string }][] }>("sync_skill", {
    sourceAgent,
    skillName,
    directives,
  });

export const revealInExplorer = (agentId: AgentId, skillName: string) =>
  invoke<void>("reveal_in_explorer", { agentId, skillName });

export const getSettings = () => invoke<Settings>("get_settings");

export const saveSettings = (settings: Settings) =>
  invoke<void>("save_settings", { settings });

export const getAgentDir = (agentId: AgentId) =>
  invoke<string>("get_agent_dir", { agentId });

export const translateSkill = (agentId: AgentId, skillName: string) =>
  invoke<TranslateResult>("translate_skill", { agentId, skillName });

export const checkTranslation = (agentId: AgentId, skillName: string) =>
  invoke<CheckTranslationResult>("check_translation", { agentId, skillName });

export const replaceWithTranslation = (
  agentId: AgentId,
  skillName: string,
  translatedRaw: string,
  loadedMtime: number,
  force = false,
) =>
  invoke<SkillInstance>("replace_with_translation", {
    agentId,
    skillName,
    translatedRaw,
    loadedMtime,
    force,
  });

export const translateAll = () => invoke<TranslateAllStart>("translate_all");

export const cancelTranslateAll = () => invoke<void>("cancel_translate_all");

export const countReplaceableTranslations = () =>
  invoke<CountReplaceableResult>("count_replaceable_translations");

export const replaceAllWithTranslations = () =>
  invoke<ReplaceAllResult>("replace_all_with_translations");

export const testDeepseek = () => invoke<TestDeepseekResult>("test_deepseek");

/** 开/关窗口亚克力透明(质感背景设置项的窗口层部分) */
export const setWindowFancy = (enabled: boolean) =>
  invoke<void>("set_window_fancy", { enabled });

// ---- 远程技能(命令添加) ----

/** 解析安装命令/链接,列出 GitHub 仓库内的技能 */
export const listRemoteSkills = (source: string) =>
  invoke<RemoteRepoInfo>("list_remote_skills", { source });

/** 下载仓库中某个技能的全部文件,返回预览元信息 */
export const fetchRemoteSkill = (owner: string, repo: string, gitRef: string, dir: string) =>
  invoke<FetchedSkillMeta>("fetch_remote_skill", { owner, repo, gitRef, dir });

/** 用 fetch_id 把已获取的远程技能安装到所选 agent */
export const installRemoteSkill = (
  fetchId: string,
  name: string,
  description: string,
  bodyMd: string,
  targets: AgentId[],
  overwrite: boolean,
) =>
  invoke<{ results: [AgentId, { Ok: SkillInstance } | { Err: string }][] }>(
    "install_remote_skill",
    { fetchId, name, description, bodyMd, targets, overwrite },
  );

/** AI 读取 SKILL.md 内容,返回标题/描述/摘要 */
export const aiReadSkill = (raw: string) => invoke<AiSkillRead>("ai_read_skill", { raw });
