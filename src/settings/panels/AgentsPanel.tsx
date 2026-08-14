import { useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { AGENT_META, AGENT_ORDER } from "../../lib/agents";
import { getAgentDir } from "../../api/commands";
import { useSkillsStore } from "../../store/skills";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import SectionTitle from "../SectionTitle";
import type { AgentId, Settings } from "../../types/api";

/**
 * @description 数据源面板:8 个 agent 的 skills 路径覆盖配置。
 * 每行显示 agent 色点/名称/检测到的技能数 + 路径输入 + 浏览/重置;底部提供全部重置与重新扫描。
 * 改动自动保存(防抖由父级处理)。
 * @param draft - 当前设置草稿
 * @param onChange - 更新草稿回调
 */
export default function AgentsPanel({
  draft,
  onChange,
}: {
  draft: Settings;
  onChange: (s: Settings) => void;
}) {
  const scan = useSkillsStore((s) => s.scan);
  const refresh = useSkillsStore((s) => s.refresh);

  // 每个 agent 的已检测技能数(来自最近一次扫描)
  const counts = useMemo(() => {
    const m = new Map<AgentId, number>();
    for (const g of scan?.groups ?? []) {
      for (const i of g.instances) {
        m.set(i.agent_id, (m.get(i.agent_id) ?? 0) + 1);
      }
    }
    return m;
  }, [scan]);

  const setOverride = (a: AgentId, p: string) => {
    const overrides = { ...draft.agent_overrides };
    if (p.trim()) overrides[a] = p.trim();
    else delete overrides[a];
    onChange({ ...draft, agent_overrides: overrides });
  };

  const resetOverride = (a: AgentId) => {
    const overrides = { ...draft.agent_overrides };
    delete overrides[a];
    onChange({ ...draft, agent_overrides: overrides });
  };

  const resetAll = () => {
    onChange({ ...draft, agent_overrides: {} });
  };

  const browse = async (a: AgentId) => {
    // 初始定位到该 agent 的 skills 基目录(覆盖值优先,否则后端算默认目录),避免对话框开在系统默认位置
    const base =
      draft.agent_overrides[a] ?? (await getAgentDir(a).catch(() => ""));
    const dir = await open({
      directory: true,
      title: `选择 ${AGENT_META[a].display} skills 目录`,
      defaultPath: base || undefined,
    });
    if (typeof dir === "string") setOverride(a, dir);
  };

  return (
    <div className="space-y-5">
      <section>
        <SectionTitle
          title="Agent 路径覆盖"
          desc="默认扫描本机各 agent 的标准 skills 目录,可在此覆盖为自定义目录"
        />
        <div className="space-y-2">
          {AGENT_ORDER.map((a) => {
            const meta = AGENT_META[a];
            const overridden = draft.agent_overrides[a];
            const count = counts.get(a) ?? 0;
            return (
              <div
                key={a}
                className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2 transition-colors hover:border-[var(--border-strong)]"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: meta.color }}
                />
                <span className="flex w-[120px] shrink-0 items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                  {meta.display}
                  <span
                    className={`rounded px-1 text-[10px] ${count ? "bg-[var(--bg-elevated)] text-[var(--text-muted)]" : "bg-[var(--warning)]/10 text-[var(--warning)]"}`}
                  >
                    {count ? `${count} 个` : "未检测"}
                  </span>
                </span>
                <div className="relative min-w-0 flex-1">
                  <Input
                    value={overridden ?? ""}
                    onChange={(e) => setOverride(a, e.target.value)}
                    placeholder={`默认: ~/${meta.defaultSubpath}`}
                    className="pr-24"
                  />
                  {!overridden && (
                    <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-[var(--text-muted)]">
                      默认路径
                    </span>
                  )}
                </div>
                <Button onClick={() => browse(a)}>浏览…</Button>
                <Button onClick={() => resetOverride(a)} disabled={!overridden}>
                  重置
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex items-center gap-2">
        <Button onClick={resetAll} disabled={Object.keys(draft.agent_overrides).length === 0}>
          全部重置默认
        </Button>
        <Button onClick={refresh}>重新扫描</Button>
      </div>
    </div>
  );
}
