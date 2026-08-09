import { useEffect, useMemo, useState } from "react";
import { revealInExplorer, readSkillMd } from "../api/commands";
import { AGENT_ORDER } from "../lib/agents";
import { useSkillsStore } from "../store/skills";
import { toast } from "../store/toast";
import type { AgentId, SkillInstance } from "../types/api";
import InstanceSelector from "./InstanceSelector";
import ViewPane from "./ViewPane";

export default function SkillDetail() {
  const scan = useSkillsStore((s) => s.scan);
  const selectedGroup = useSkillsStore((s) => s.selectedGroup);
  const viewAgent = useSkillsStore((s) => s.viewAgent);
  const setViewAgent = useSkillsStore((s) => s.setViewAgent);

  const [raw, setRaw] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  // 切换副本 → 重新读取原文
  useEffect(() => {
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
    return () => {
      cancelled = true;
    };
  }, [group?.name, active?.agent_id]);

  if (!group || !active) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--bg-pane)]">
        <span className="text-[13px] text-[var(--text-muted)]">选择一个技能查看详情</span>
      </div>
    );
  }

  const handleReveal = () => {
    revealInExplorer(active.agent_id, group.name).catch((e) =>
      toast.error(`打开目录失败: ${e?.message ?? e}`),
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-pane)]">
      {/* 头部:标题 + 副本选择 */}
      <div className="shrink-0 border-b border-[var(--border-subtle)] px-4 pt-3 pb-2">
        <h2 className="mb-1.5 text-[14px] font-semibold text-[var(--text-primary)]">
          {group.name}
          {group.drift && (
            <span className="ml-2 align-middle text-[11px] font-normal text-[#f59e0b]">
              ● 副本内容不一致
            </span>
          )}
        </h2>
        <InstanceSelector
          group={group}
          active={active}
          onSelect={(agentId: AgentId) => setViewAgent(agentId)}
        />
      </div>

      <div className="min-h-0 flex-1">
        <ViewPane
          instance={active}
          raw={raw}
          loading={loading}
          onReveal={handleReveal}
        />
      </div>
    </div>
  );
}
