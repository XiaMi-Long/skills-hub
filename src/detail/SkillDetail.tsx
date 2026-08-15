import { useEffect, useMemo, useState } from "react";
import { revealInExplorer, readSkillMd, translateSkill, checkTranslation, replaceWithTranslation } from "../api/commands";
import { AGENT_ORDER } from "../lib/agents";
import { useSkillsStore } from "../store/skills";
import { useSettingsStore } from "../store/settings";
import { useTranslateStore } from "../store/translate";
import { toast } from "../store/toast";
import ConfirmDialog from "../ui/ConfirmDialog";
import type { AgentId, CommandError, SkillInstance } from "../types/api";
import InstanceSelector from "./InstanceSelector";
import ViewPane from "./ViewPane";
import EditPane from "./EditPane";
import DeleteDialog from "../modals/DeleteDialog";
import SyncModal from "../modals/SyncModal";

type Mode = "view" | "edit";
type TranslationStatus = "hit" | "stale" | "none";

export default function SkillDetail() {
  const scan = useSkillsStore((s) => s.scan);
  const selectedGroup = useSkillsStore((s) => s.selectedGroup);
  const viewAgent = useSkillsStore((s) => s.viewAgent);
  const setViewAgent = useSkillsStore((s) => s.setViewAgent);
  const settings = useSettingsStore((s) => s.settings);
  const refresh = useSkillsStore((s) => s.refresh);

  const [raw, setRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("view");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

  // 翻译态
  const [translateMode, setTranslateMode] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [cachedText, setCachedText] = useState<string | null>(null);
  const [translationStatus, setTranslationStatus] = useState<TranslationStatus>("none");
  const [staleText, setStaleText] = useState<string | null>(null);
  const [writeBack, setWriteBack] = useState<{ force: boolean } | null>(null);
  const translateEntry = useTranslateStore((s) => (requestId ? s.byRequest[requestId] : undefined));

  const apiKey = settings?.deepseek.api_key?.trim() ?? "";
  const model = settings?.deepseek.model ?? "deepseek-chat";
  const defaultView = settings?.default_view ?? "original";

  const group = useMemo(
    () => scan?.groups.find((g) => g.name === selectedGroup) ?? null,
    [scan, selectedGroup],
  );

  // 按 AGENTS 顺序排列实例,默认选第一个 has_skill_md
  const ordered: SkillInstance[] = useMemo(() => {
    if (!group) return [];
    const byAgent = new Map(group.instances.map((i) => [i.agent_id, i]));
    return AGENT_ORDER.filter((a) => byAgent.has(a)).map((a) => byAgent.get(a)!);
  }, [group]);

  const defaultInstance = useMemo(
    () => ordered.find((i) => i.has_skill_md) ?? ordered[0] ?? null,
    [ordered],
  );

  const active: SkillInstance | null = useMemo(() => {
    if (!viewAgent) return defaultInstance;
    return ordered.find((i) => i.agent_id === viewAgent) ?? defaultInstance;
  }, [viewAgent, ordered, defaultInstance]);

  // 切换副本/技能 → 重新读取原文,回到查看态,清空翻译;随后查缓存并按默认视图进入
  useEffect(() => {
    setMode("view");
    setTranslateMode(false);
    setRequestId(null);
    setCachedText(null);
    setTranslationStatus("none");
    setStaleText(null);
    setWriteBack(null);

    if (!group || !active || !active.has_skill_md) {
      setRaw(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    readSkillMd(active.agent_id, group.name)
      .then((r) => {
        if (!cancelled) {
          setRaw(r.raw);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setRaw(null);
          setLoading(false);
          toast.error(`读取失败: ${e?.message ?? e}`);
        }
      });

    // 有 key 时查翻译缓存:hit 直接展示;stale 保留旧译文并提示;none 按默认视图决定是否进入译文页
    if (apiKey) {
      checkTranslation(active.agent_id, group.name)
        .then((r) => {
          if (cancelled) return;
          setTranslationStatus(r.status);
          if (r.status === "stale") setStaleText(r.text);
          if (r.status === "hit") setCachedText(r.text);
          if (defaultView === "translated") {
            setTranslateMode(true);
            if (r.status === "hit") setCachedText(r.text);
          }
        })
        .catch(() => {
          /* 查缓存失败不阻塞原文阅读 */
        });
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.name, active?.agent_id, apiKey, defaultView]);

  if (!group || !active) {
    return (
      <div className="pane flex h-full items-center justify-center bg-[var(--bg-pane)]">
        <span className="text-[13px] text-[var(--text-muted)]">选择一个技能查看详情</span>
      </div>
    );
  }

  const handleReveal = () => {
    revealInExplorer(active.agent_id, group.name).catch((e) =>
      toast.error(`打开目录失败: ${e?.message ?? e}`),
    );
  };

  const handleTranslate = async () => {
    if (!group || !active || !active.has_skill_md) return;
    if (!apiKey) {
      toast.error("请先在设置中配置 DeepSeek API Key");
      return;
    }
    setTranslateMode(true);
    setStaleText(null);
    setTranslationStatus("none");
    try {
      const r = await translateSkill(active.agent_id, group.name);
      if (r.cached) {
        toast.info("已命中缓存,直接显示译文");
        setCachedText(r.text);
        setTranslationStatus("hit");
        setRequestId(null);
      } else {
        setCachedText(null);
        setRequestId(r.request_id);
        useTranslateStore.getState().begin(r.request_id);
      }
    } catch (e) {
      setTranslateMode(false);
      toast.error(`翻译失败: ${(e as { message?: string })?.message ?? e}`);
    }
  };

  const translating = translateEntry?.status === "streaming";
  const translateError = translateEntry?.status === "error" ? translateEntry.error ?? null : null;

  // 展示的译文:缓存命中 > 过期旧译文(带横幅) > 流式结果
  const displayedText =
    cachedText ?? (translationStatus === "stale" ? staleText : null) ?? translateEntry?.text ?? null;

  const canWriteBack =
    translateMode && !translating && displayedText !== null && translationStatus !== "stale";

  const doWriteBack = (force: boolean) => {
    if (!group || !displayedText) return;
    replaceWithTranslation(active.agent_id, group.name, displayedText, active.mtime, force)
      .then(() => {
        toast.success("已用译文替换原文");
        setWriteBack(null);
        setRaw(displayedText);
        setTranslateMode(false);
        setCachedText(null);
        setStaleText(null);
        setTranslationStatus("hit");
        refresh();
      })
      .catch((e: CommandError) => {
        if (e?.code === "file_changed_on_disk") {
          setWriteBack({ force: true });
          return;
        }
        toast.error(`写回失败: ${e?.message ?? e}`);
      });
  };

  const canEdit = active.has_skill_md && raw !== null && !translateMode;

  return (
    <div className="pane flex h-full min-h-0 flex-col bg-[var(--bg-pane)]">
      {/* 头部:标题 + 副本选择 + tabs */}
      <div className="shrink-0 border-b border-[var(--border-subtle)] px-4 pt-3 pb-0">
        <div className="flex items-start justify-between">
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
            {group.name}
            {group.drift && (
              <span className="ml-2 align-middle text-[11px] font-normal text-[var(--warning)]">
                ● 副本内容不一致
              </span>
            )}
          </h2>
        </div>
        <InstanceSelector
          group={group}
          active={active}
          onSelect={(agentId: AgentId) => setViewAgent(agentId)}
        />
        <div className="mt-2 flex gap-1">
          {(["view", "edit"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                if (m === "edit" && !canEdit) return;
                setMode(m);
              }}
              title={
                m === "edit" && translateMode
                  ? "翻译视图只读,切回原文可编辑"
                  : m === "edit" && !canEdit
                    ? "该副本没有可编辑的 SKILL.md"
                    : undefined
              }
              className={`rounded-t-lg border-b-2 px-3 py-1.5 text-[12px] transition-colors ${
                mode === m
                  ? "border-[var(--accent-to)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              } ${m === "edit" && !canEdit ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {m === "view" ? "查看" : "编辑"}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {mode === "view" ? (
          <ViewPane
            instance={active}
            raw={raw}
            loading={loading}
            onReveal={handleReveal}
            onDelete={() => setDeleteOpen(true)}
            onSync={() => setSyncOpen(true)}
            translateMode={translateMode}
            translatedText={displayedText}
            translating={translating}
            translateError={translateError}
            translateDisabled={!apiKey}
            stale={translationStatus === "stale"}
            canWriteBack={canWriteBack}
            model={model}
            onTranslate={handleTranslate}
            onWriteBack={() => setWriteBack({ force: false })}
            onShowOriginal={() => {
              setTranslateMode(false);
              setRequestId(null);
              setCachedText(null);
            }}
          />
        ) : (
          <EditPane
            groupName={group.name}
            agentId={active.agent_id}
            initialRaw={raw ?? ""}
            loadedMtime={active.mtime}
            onSaved={(inst, savedRaw) => {
              void inst;
              setRaw(savedRaw);
              setMode("view");
            }}
            onCancel={() => setMode("view")}
          />
        )}
      </div>

      {deleteOpen && (
        <DeleteDialog
          group={group}
          defaultAgent={active.agent_id}
          onClose={() => setDeleteOpen(false)}
        />
      )}
      {syncOpen && (
        <SyncModal
          group={group}
          sourceAgent={active.agent_id}
          onClose={() => setSyncOpen(false)}
        />
      )}

      {writeBack && (
        <ConfirmDialog
          title={writeBack.force ? "文件已被外部修改" : "用译文替换原文"}
          message={
            writeBack.force
              ? "该 SKILL.md 在磁盘上已被外部修改,仍要用当前译文覆盖吗?"
              : `将用当前译文覆盖「${group.name}」的 SKILL.md 原文,原文内容会丢失(译文保留 frontmatter 与代码块)。确定继续?`
          }
          confirmText={writeBack.force ? "仍要覆盖" : "替换原文"}
          danger
          onConfirm={() => doWriteBack(writeBack.force)}
          onCancel={() => setWriteBack(null)}
        />
      )}
    </div>
  );
}
