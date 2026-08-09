import { useMemo, useRef } from "react";
import { useSkillsStore } from "../store/skills";
import SkillRow from "./SkillRow";
import type { AgentId } from "../types/api";

function matches(group: { name: string; instances: { name: string; description: string }[] }, q: string) {
  if (!q) return true;
  const t = q.toLowerCase();
  if (group.name.toLowerCase().includes(t)) return true;
  return group.instances.some(
    (i) =>
      i.name.toLowerCase().includes(t) ||
      (i.description || "").toLowerCase().includes(t),
  );
}

export default function SkillList() {
  const scan = useSkillsStore((s) => s.scan);
  const loading = useSkillsStore((s) => s.loading);
  const search = useSkillsStore((s) => s.search);
  const setSearch = useSkillsStore((s) => s.setSearch);
  const selectedGroup = useSkillsStore((s) => s.selectedGroup);
  const selectGroup = useSkillsStore((s) => s.selectGroup);
  const agentFilter = useSkillsStore((s) => s.agentFilter);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!scan) return [];
    let groups = scan.groups;
    if (agentFilter) {
      const a: AgentId = agentFilter;
      groups = groups.filter((g) => g.instances.some((i) => i.agent_id === a));
    }
    return groups.filter((g) => matches(g, search));
  }, [scan, search, agentFilter]);

  return (
    <div className="flex h-full flex-col bg-[var(--bg-pane)]">
      {/* 搜索框 */}
      <div className="px-3 pt-3 pb-2">
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索技能…"
          className="h-8 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--border-strong)] focus:outline-none"
        />
      </div>

      {/* 列表 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {loading && !scan ? (
          <div className="px-3 py-6 text-center text-[12px] text-[var(--text-muted)]">扫描中…</div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-[var(--text-muted)]">
            {scan ? "没有匹配的技能" : "选择一个技能查看详情"}
          </div>
        ) : (
          filtered.map((g) => (
            <SkillRow
              key={g.name}
              group={g}
              active={g.name === selectedGroup}
              onClick={() => selectGroup(g.name)}
            />
          ))
        )}
      </div>
    </div>
  );
}
