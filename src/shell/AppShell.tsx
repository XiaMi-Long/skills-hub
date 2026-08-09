import IconRail from "./IconRail";
import TopToolbar from "./TopToolbar";
import GrainOverlay from "./GrainOverlay";

export default function AppShell() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopToolbar />
      <div
        className="grid min-h-0 flex-1"
        style={{ gridTemplateColumns: "56px 220px 320px 1fr" }}
      >
        <IconRail />
        {/* 第 2 列:Agent sidebar(M1 填充) */}
        <aside className="min-h-0 overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-pane)]" />
        {/* 第 3 列:Skill list(M1 填充) */}
        <section className="min-h-0 overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--bg-pane)]" />
        {/* 第 4 列:Detail(M1 填充) */}
        <main className="min-h-0 overflow-hidden bg-[var(--bg-pane)]" />
      </div>
      <GrainOverlay />
    </div>
  );
}
