import { useEffect } from "react";
import AppShell from "./shell/AppShell";
import { applyTheme, useAppStore } from "./store/app";

export default function App() {
  const resolvedTheme = useAppStore((s) => s.resolvedTheme);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  return <AppShell />;
}
