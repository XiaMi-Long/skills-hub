import { invoke } from "@tauri-apps/api/core";
import type {
  CheckTranslationResult,
  DeleteScope,
  ReadSkillResult,
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

export const testDeepseek = () => invoke<TestDeepseekResult>("test_deepseek");
