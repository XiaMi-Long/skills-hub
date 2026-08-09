import { create } from "zustand";
import { scanAll } from "../api/commands";
import type { AgentId, ScanResult } from "../types/api";

interface SkillsState {
  scan: ScanResult | null;
  loading: boolean;
  search: string;
  selectedGroup: string | null;
  /** sidebar 过滤:按 agent 过滤列表 */
  agentFilter: AgentId | null;
  /** 详情当前查看的副本 agent */
  viewAgent: AgentId | null;
  refresh: () => Promise<void>;
  setSearch: (s: string) => void;
  selectGroup: (name: string | null) => void;
  setAgentFilter: (a: AgentId | null) => void;
  setViewAgent: (a: AgentId | null) => void;
}

export const useSkillsStore = create<SkillsState>((set) => ({
  scan: null,
  loading: false,
  search: "",
  selectedGroup: null,
  agentFilter: null,
  viewAgent: null,

  refresh: async () => {
    set({ loading: true });
    try {
      const scan = await scanAll();
      set((s) => {
        // 选中项在重扫后仍存在则保留,否则清空
        const groupStillThere = scan.groups.some((g) => g.name === s.selectedGroup);
        return {
          scan,
          loading: false,
          selectedGroup: groupStillThere ? s.selectedGroup : null,
          viewAgent: groupStillThere ? s.viewAgent : null,
        };
      });
    } catch (e) {
      set({ loading: false });
      console.error("scan_all failed", e);
    }
  },

  setSearch: (search) => set({ search }),
  selectGroup: (selectedGroup) => set({ selectedGroup, viewAgent: null }),
  setAgentFilter: (agentFilter) => set({ agentFilter }),
  setViewAgent: (viewAgent) => set({ viewAgent }),
}));
