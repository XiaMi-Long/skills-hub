import IconRail from "./IconRail";
import TopToolbar from "./TopToolbar";
import TitleBar from "./TitleBar";
import AgentSidebar from "../sidebar/AgentSidebar";
import SkillList from "../list/SkillList";
import SkillDetail from "../detail/SkillDetail";
import SettingsPage from "../settings/SettingsPage";
import { useAppStore } from "../store/app";

/**
 * @description 应用外壳:自绘标题栏(TitleBar)+ 系统工具条(TopToolbar)+ IconRail 常驻;
 * 内容区按 route 在主页面(侧栏/列表/详情)与设置页之间同级切换。
 */
export default function AppShell() {
  const route = useAppStore((s) => s.route);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TitleBar />
      <TopToolbar />
      <div className="flex min-h-0 flex-1">
        <IconRail />
        {route === "main" ? (
          <div
            className="grid min-h-0 flex-1"
            style={{ gridTemplateColumns: "220px 320px 1fr" }}
          >
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
        ) : (
          <SettingsPage />
        )}
      </div>
    </div>
  );
}
