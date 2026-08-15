import { useMemo, useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Checkbox from "../ui/Checkbox";
import Segmented from "../ui/Segmented";
import { AGENT_META, AGENT_ORDER } from "../lib/agents";
import {
  aiReadSkill,
  createSkill,
  fetchRemoteSkill,
  installRemoteSkill,
  listRemoteSkills,
} from "../api/commands";
import { toast } from "../store/toast";
import { useSkillsStore } from "../store/skills";
import { useSettingsStore } from "../store/settings";
import TargetPicker from "./TargetPicker";
import InstallResultSummary from "./InstallResultSummary";
import type {
  AgentId,
  AiSkillRead,
  FetchedSkillMeta,
  RemoteRepoInfo,
  RemoteSkillInfo,
  ScanResult,
  SkillInstance,
} from "../types/api";

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TEMPLATE = (name: string) => `# ${name}

## 描述

这个技能用于…

## 使用方式

- 步骤 1
- 步骤 2
`;
const EXAMPLE_CMD = "npx skills add https://github.com/humanlayer/skills --skill show-me";

type Mode = "manual" | "command";
type CmdPhase = "input" | "picking" | "loading" | "preview" | "result";
type AiStatus = "idle" | "loading" | "done" | "error" | "no-key";

type InstallResults = [AgentId, { Ok: SkillInstance } | { Err: string }][];

/** invoke/异常的错误对象 → 可读文案(Rust AppError 序列化为 { code, message }) */
function errMsg(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

/** 与已有技能同名的冲突 agent 列表(两种模式共用) */
function findConflicts(scan: ScanResult | null, name: string, targets: Set<AgentId>): AgentId[] {
  if (!scan || !name) return [];
  const key = name.toLowerCase();
  const g = scan.groups.find((gg) => gg.name === key);
  if (!g) return [];
  return AGENT_ORDER.filter((a) => targets.has(a) && g.instances.some((i) => i.agent_id === a));
}

export default function NewSkillModal({ onClose }: { onClose: () => void }) {
  const scan = useSkillsStore((s) => s.scan);
  const refresh = useSkillsStore((s) => s.refresh);

  const [mode, setMode] = useState<Mode>("manual");

  // ---- 表单(两种模式共用) ----
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [targets, setTargets] = useState<Set<AgentId>>(new Set());
  const [overwrite, setOverwrite] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ---- 命令添加 ----
  const [cmdInput, setCmdInput] = useState("");
  const [phase, setPhase] = useState<CmdPhase>("input");
  const [resolving, setResolving] = useState(false);
  const [fetchingSkill, setFetchingSkill] = useState(false);
  const [repoInfo, setRepoInfo] = useState<RemoteRepoInfo | null>(null);
  const [pickedDir, setPickedDir] = useState<string | null>(null);
  const [fetched, setFetched] = useState<FetchedSkillMeta | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
  const [aiResult, setAiResult] = useState<AiSkillRead | null>(null);
  const [aiError, setAiError] = useState("");
  const [installResult, setInstallResult] = useState<InstallResults | null>(null);

  const nameValid = name.length > 0 && NAME_RE.test(name);
  const nameError =
    name.length > 0 && !NAME_RE.test(name) ? "仅允许小写字母、数字、连字符(如 my-skill)" : null;

  const conflicts = useMemo(
    () => (nameValid ? findConflicts(scan, name, targets) : []),
    [scan, name, nameValid, targets],
  );

  const canSubmit = nameValid && targets.size > 0 && (conflicts.length === 0 || overwrite);

  // ---- 手动创建 ----

  const submitManual = () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    createSkill(name, description, body || TEMPLATE(name), AGENT_ORDER.filter((a) => targets.has(a)), overwrite)
      .then((r) => {
        let okCount = 0;
        for (const [, res] of r.results) {
          if ("Ok" in res) {
            okCount++;
          } else {
            toast.error(`创建到某 agent 失败: ${res.Err}`);
          }
        }
        if (okCount > 0) {
          toast.success(`已创建 ${name} 到 ${okCount} 个 agent`);
        }
        refresh();
        onClose();
      })
      .catch((e) => {
        toast.error(`创建失败: ${e?.message ?? e}`);
        setSubmitting(false);
      });
  };

  // ---- 命令添加:AI 解读 ----

  /** 让 AI 读取 SKILL.md 内容,返回标题/描述/摘要并预填描述。 */
  const runAiRead = async (raw: string) => {
    const key = useSettingsStore.getState().settings?.deepseek?.api_key?.trim();
    if (!key) {
      setAiStatus("no-key");
      return;
    }
    setAiStatus("loading");
    setAiResult(null);
    setAiError("");
    try {
      const r = await aiReadSkill(raw);
      setAiResult(r);
      setAiStatus("done");
      if (r.description) setDescription(r.description);
    } catch (e) {
      setAiStatus("error");
      setAiError(errMsg(e));
    }
  };

  // ---- 命令添加:解析 → 选技能 → 下载 ----

  /** 下载某个技能的全部文件并预填表单,完成后进入预览。 */
  const doFetchSkill = async (info: RemoteRepoInfo, skill: RemoteSkillInfo) => {
    setFetchingSkill(true);
    setPhase("loading");
    try {
      const meta = await fetchRemoteSkill(info.owner, info.repo, info.git_ref, skill.dir);
      setFetched(meta);
      // 预填:name 不合 slug 规则时退回目录名/仓库名
      const dirBase = skill.dir.split("/").pop() || info.repo;
      setName(NAME_RE.test(meta.name) ? meta.name : dirBase);
      setDescription(meta.description);
      setBody(meta.body);
      setOverwrite(false);
      setTargets(new Set(AGENT_ORDER)); // 默认添加到全部,可取消
      setInstallResult(null);
      setPhase("preview");
      runAiRead(meta.skill_md_raw);
    } catch (e) {
      toast.error(errMsg(e));
      setPhase(info.skills.length > 1 ? "picking" : "input");
    } finally {
      setFetchingSkill(false);
    }
  };

  /** 解析命令/链接,列出仓库技能;单个或 --skill 命中时直接下载。 */
  const resolveCommand = async () => {
    const cmd = cmdInput.trim();
    if (!cmd || resolving) return;
    setResolving(true);
    setRepoInfo(null);
    try {
      const info = await listRemoteSkills(cmd);
      setRepoInfo(info);
      const hint = (cmd.match(/--skill(?:=|\s+)(\S+)/)?.[1] ?? "").toLowerCase();
      const matched = hint
        ? info.skills.find((s) => {
            const dirBase = s.dir.split("/").pop()?.toLowerCase() ?? "";
            return [s.name.toLowerCase(), s.dir.toLowerCase(), dirBase].includes(hint);
          })
        : undefined;
      if (info.skills.length === 1) {
        await doFetchSkill(info, info.skills[0]);
      } else if (matched) {
        await doFetchSkill(info, matched);
      } else {
        setPickedDir(info.skills[0]?.dir ?? null);
        setPhase("picking");
      }
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setResolving(false);
    }
  };

  // ---- 命令添加:安装 ----

  const submitInstall = () => {
    if (!fetched || !canSubmit || submitting) return;
    setSubmitting(true);
    installRemoteSkill(
      fetched.fetch_id,
      name,
      description,
      body || TEMPLATE(name),
      AGENT_ORDER.filter((a) => targets.has(a)),
      overwrite,
    )
      .then((r) => {
        setInstallResult(r.results);
        setPhase("result");
        const okCount = r.results.filter(([, res]) => "Ok" in res).length;
        if (okCount > 0) toast.success(`已添加 ${name} 到 ${okCount} 个 agent`);
        for (const [agent, res] of r.results) {
          if ("Err" in res) toast.error(`${AGENT_META[agent].display}: ${res.Err}`);
        }
        refresh();
      })
      .catch((e) => {
        toast.error(`添加失败: ${e?.message ?? e}`);
      })
      .finally(() => setSubmitting(false));
  };

  // ---- 渲染 ----

  const nameField = (
    <div>
      <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">名字</label>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value.trim())}
        placeholder="my-skill"
        autoFocus={mode === "manual"}
      />
      {nameError && <p className="mt-1 text-[11px] text-[var(--danger)]">{nameError}</p>}
    </div>
  );

  const descriptionField = (
    <div>
      <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">描述</label>
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="一句话说明这个技能"
      />
    </div>
  );

  const bodyField = (
    <div>
      <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">正文 Markdown</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={TEMPLATE(name || "my-skill")}
        className="h-40 w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-[border-color,box-shadow] duration-150 hover:border-[var(--border-strong)] focus:border-[var(--accent-from)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-from)_18%,transparent)] focus:outline-none"
      />
    </div>
  );

  const conflictsBox = conflicts.length > 0 && (
    <div className="rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-2">
      <p className="text-[12px] text-[var(--warning)]">
        以下 agent 已有同名技能:{" "}
        {conflicts.map((a) => AGENT_META[a].display).join("、")}
      </p>
      <Checkbox
        checked={overwrite}
        onChange={setOverwrite}
        className="mt-1.5 text-[12px] text-[var(--text-secondary)]"
      >
        覆盖已有副本
      </Checkbox>
    </div>
  );

  return (
    <Modal title="新建技能" onClose={onClose} width={600}>
      <div className="space-y-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "manual", label: "手动创建" },
            { value: "command", label: "命令添加" },
          ]}
        />

        {/* ================= 手动创建 ================= */}
        {mode === "manual" && (
          <>
            {nameField}
            {descriptionField}
            {bodyField}
            <TargetPicker targets={targets} onChange={setTargets} conflicts={conflicts} />
            {conflictsBox}
            <div className="flex justify-end gap-2 pt-1">
              <Button onClick={onClose}>取消</Button>
              <Button variant="primary" disabled={!canSubmit || submitting} onClick={submitManual}>
                {submitting ? "创建中…" : "创建"}
              </Button>
            </div>
          </>
        )}

        {/* ================= 命令添加 ================= */}
        {mode === "command" && phase === "input" && (
          <>
            <div>
              <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">安装命令</label>
              <textarea
                value={cmdInput}
                onChange={(e) => setCmdInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    resolveCommand();
                  }
                }}
                placeholder={EXAMPLE_CMD}
                rows={2}
                autoFocus
                className="w-full resize-y rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-[border-color,box-shadow] duration-150 hover:border-[var(--border-strong)] focus:border-[var(--accent-from)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-from)_18%,transparent)] focus:outline-none"
              />
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
                支持直接粘贴 <span className="mono">npx skills add …</span> 命令,或 GitHub 仓库链接、
                <span className="mono">owner/repo</span>;可用 <span className="mono">--skill</span> 指定技能。
              </p>
              <button
                type="button"
                onClick={() => setCmdInput(EXAMPLE_CMD)}
                title="点击填入示例"
                className="mono mt-1.5 block w-full truncate rounded-md border border-dashed border-[var(--border-subtle)] px-2 py-1 text-left text-[10px] text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text-secondary)]"
              >
                示例:{EXAMPLE_CMD}
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button onClick={onClose}>取消</Button>
              <Button
                variant="primary"
                disabled={!cmdInput.trim() || resolving}
                onClick={resolveCommand}
              >
                {resolving ? "解析并获取中…" : "解析并获取"}
              </Button>
            </div>
          </>
        )}

        {mode === "command" && phase === "picking" && repoInfo && (
          <>
            <p className="text-[12px] text-[var(--text-secondary)]">
              仓库 <span className="mono text-[var(--text-primary)]">{repoInfo.owner}/{repoInfo.repo}</span>
              <span className="mono text-[var(--text-muted)]">@{repoInfo.git_ref}</span> 包含{" "}
              {repoInfo.skills.length} 个技能,选择要添加的:
            </p>
            <div className="max-h-64 space-y-1.5 overflow-y-auto pr-0.5">
              {repoInfo.skills.map((s) => {
                const selected = pickedDir === s.dir;
                return (
                  <button
                    key={s.dir || "(root)"}
                    type="button"
                    onClick={() => setPickedDir(s.dir)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      selected
                        ? "border-[var(--accent-from)] bg-[var(--bg-elevated)]"
                        : "border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">{s.name}</span>
                      <span className="mono truncate text-[10px] text-[var(--text-muted)]">
                        {s.dir || "(仓库根)"}
                      </span>
                      <span className="ml-auto shrink-0 rounded-md bg-[var(--bg-elevated)] px-1.5 py-px text-[10px] text-[var(--text-muted)]">
                        {s.file_count} 个文件
                      </span>
                    </div>
                    {s.description && (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                        {s.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button onClick={() => setPhase("input")}>上一步</Button>
              <Button
                variant="primary"
                disabled={pickedDir === null || fetchingSkill}
                onClick={() => {
                  const skill = repoInfo.skills.find((s) => s.dir === pickedDir);
                  if (skill) doFetchSkill(repoInfo, skill);
                }}
              >
                {fetchingSkill ? "获取中…" : "获取技能内容"}
              </Button>
            </div>
          </>
        )}

        {mode === "command" && phase === "loading" && (
          <div className="flex flex-col items-center gap-2 py-12">
            <span className="animate-pulse text-[13px] text-[var(--text-secondary)]">
              正在下载技能文件…
            </span>
            {repoInfo && (
              <span className="mono text-[11px] text-[var(--text-muted)]">
                {repoInfo.owner}/{repoInfo.repo}@{repoInfo.git_ref}
              </span>
            )}
          </div>
        )}

        {mode === "command" && phase === "preview" && fetched && (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 px-3 py-2">
              <span className="shrink-0 text-[11px] text-[var(--text-muted)]">来源</span>
              <span className="mono truncate text-[11px] text-[var(--text-secondary)]">
                github.com/{fetched.owner}/{fetched.repo}@{fetched.git_ref}
                {fetched.dir ? `/${fetched.dir}` : ""}
              </span>
              <button
                type="button"
                onClick={() => setPhase(repoInfo && repoInfo.skills.length > 1 ? "picking" : "input")}
                className="ml-auto shrink-0 text-[11px] text-[var(--accent-from)] transition-opacity hover:opacity-75"
              >
                重新获取
              </button>
            </div>

            {nameField}
            {descriptionField}

            {/* AI 解读面板 */}
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-[12px] font-medium text-[var(--text-primary)]">AI 解读</span>
                {aiStatus === "loading" && (
                  <span className="animate-pulse text-[11px] text-[var(--text-secondary)]">
                    AI 正在读取技能内容…
                  </span>
                )}
                {aiStatus === "done" && (
                  <span className="text-[11px] text-[var(--success)]">已生成描述与摘要</span>
                )}
                {aiStatus === "error" && (
                  <span className="text-[11px] text-[var(--danger)]">解读失败</span>
                )}
                {aiStatus === "no-key" && (
                  <span className="truncate text-[11px] text-[var(--text-muted)]">
                    在设置中配置 DeepSeek API Key 后,可用 AI 自动解读技能内容
                  </span>
                )}
                {(aiStatus === "done" || aiStatus === "error") && (
                  <Button
                    className="ml-auto h-6 shrink-0 px-2 text-[11px]"
                    onClick={() => runAiRead(fetched.skill_md_raw)}
                  >
                    重新解读
                  </Button>
                )}
              </div>
              {aiStatus === "done" && aiResult && (
                <div className="mt-1.5 space-y-1 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  {aiResult.title && (
                    <p>
                      <span className="text-[var(--text-muted)]">标题:</span>
                      {aiResult.title}
                    </p>
                  )}
                  {aiResult.summary && (
                    <p>
                      <span className="text-[var(--text-muted)]">摘要:</span>
                      {aiResult.summary}
                    </p>
                  )}
                  <p className="text-[10px] text-[var(--text-muted)]">描述已填入上方表单,仍可手动修改。</p>
                </div>
              )}
              {aiStatus === "error" && aiError && (
                <p className="mt-1 text-[11px] text-[var(--danger)]">{aiError}</p>
              )}
            </div>

            {bodyField}

            {fetched.files.length > 0 && (
              <div>
                <label className="mb-1 block text-[12px] text-[var(--text-secondary)]">
                  辅助文件({fetched.files.length})
                </label>
                <div className="flex flex-wrap gap-1">
                  {fetched.files.slice(0, 10).map((f) => (
                    <span
                      key={f.path}
                      className="mono rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)]"
                    >
                      {f.path}
                    </span>
                  ))}
                  {fetched.files.length > 10 && (
                    <span className="self-center text-[10px] text-[var(--text-muted)]">
                      +{fetched.files.length - 10} 个
                    </span>
                  )}
                </div>
              </div>
            )}

            {fetched.skipped.length > 0 && (
              <p className="rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-3 py-1.5 text-[11px] text-[var(--warning)]">
                部分文件未下载:{fetched.skipped.join(";")}
              </p>
            )}

            <TargetPicker targets={targets} onChange={setTargets} conflicts={conflicts} />
            {conflictsBox}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                onClick={() => setPhase(repoInfo && repoInfo.skills.length > 1 ? "picking" : "input")}
              >
                上一步
              </Button>
              <Button onClick={onClose}>取消</Button>
              <Button variant="primary" disabled={!canSubmit || submitting} onClick={submitInstall}>
                {submitting ? "添加中…" : "添加"}
              </Button>
            </div>
          </>
        )}

        {mode === "command" && phase === "result" && installResult && (
          <InstallResultSummary skillName={name} results={installResult} onClose={onClose} />
        )}
      </div>
    </Modal>
  );
}
