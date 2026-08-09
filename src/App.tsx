import { useEffect } from "react";
import AppShell from "./shell/AppShell";
import { applyTheme, useAppStore } from "./store/app";
import { useSkillsStore } from "./store/skills";

export default function App() {
  const resolvedTheme = useAppStore((s) => s.resolvedTheme);
  const refresh = useSkillsStore((s) => s.refresh);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  // mount 时扫描
  useEffect(() => {
    refresh();
  }, [refresh]);

  return <AppShell />;
}
