import IconRail from "./IconRail";
import TopToolbar from "./TopToolbar";
import GrainOverlay from "./GrainOverlay";
import AgentSidebar from "../sidebar/AgentSidebar";
import SkillList from "../list/SkillList";
import SkillDetail from "../detail/SkillDetail";
import ToastHost from "../ui/Toast";

export default function AppShell() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopToolbar />
      <div
        className="grid min-h-0 flex-1"
        style={{ gridTemplateColumns: "56px 220px 320px 1fr" }}
      >
        <IconRail />
        <aside className="min-h-0 overflow-hidden border-r border-[var(--border-subtle)]">
          <AgentSidebar />
        </aside>
        <section className="min-h-0 overflow-hidden border-r border-[var(--border-subtle)]">
          <SkillList />
        </section>
        <main className="min-h-0 overflow-hidden">
          <SkillDetail />
        </main>
      </div>
      <GrainOverlay />
      <ToastHost />
    </div>
  );
}
