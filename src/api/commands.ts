import { invoke } from "@tauri-apps/api/core";
import type {
  DeleteScope,
  ReadSkillResult,
  ScanResult,
  Settings,
  SkillInstance,
  SyncDirective,
  TestDeepseekResult,
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

export const testDeepseek = () => invoke<TestDeepseekResult>("test_deepseek");
