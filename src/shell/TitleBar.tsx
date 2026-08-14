import { useEffect, useState, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import LogoMark from "./LogoMark";

/** 标题栏上的窗口控制按钮:44px 宽、整高,悬停高亮;关闭按钮悬停红色 */
function TitleBarButton({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: () => void;
  title: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`flex w-[44px] items-center justify-center text-[var(--text-secondary)] transition-colors duration-100 ${
        danger
          ? "hover:bg-[var(--danger)] hover:text-white"
          : "hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * @description 自绘窗口标题栏(替代原生):左侧应用名可拖拽移动 + 双击最大化,右侧最小化/最大化/关闭。
 * 依赖窗口 decorations:false 与 core:window 相关权限;最大化状态实时同步图标。
 */
export default function TitleBar() {
  const appWindow = getCurrentWindow();
  const [maximized, setMaximized] = useState(false);

  // 同步最大化状态:初始化查询 + 窗口 resize 时刷新
  useEffect(() => {
    let mounted = true;
    appWindow.isMaximized().then((m) => {
      if (mounted) setMaximized(m);
    });
    const un = appWindow.onResized(() => {
      appWindow.isMaximized().then((m) => {
        if (mounted) setMaximized(m);
      });
    });
    return () => {
      mounted = false;
      un.then((f) => f());
    };
  }, [appWindow]);

  return (
    <div className="flex h-[32px] shrink-0 select-none border-b border-[var(--border-subtle)] bg-[var(--bg-pane)]/85">
      {/* 左侧:拖拽区(双击最大化) */}
      <div
        data-tauri-drag-region
        onDoubleClick={() => appWindow.toggleMaximize()}
        className="flex min-w-0 flex-1 items-center gap-2 pl-3"
      >
        <LogoMark size={14} />
        <span className="text-[12px] font-semibold tracking-tight text-[var(--text-primary)]">
          skills-hub
        </span>
        <span className="mono rounded bg-[var(--bg-elevated)] px-1.5 py-px text-[10px] text-[var(--text-muted)]">
          v0.1
        </span>
      </div>

      {/* 右侧:窗口控制 */}
      <div className="flex h-full">
        <TitleBarButton onClick={() => appWindow.minimize()} title="最小化">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M2.5 7h9" />
          </svg>
        </TitleBarButton>

        <TitleBarButton onClick={() => appWindow.toggleMaximize()} title={maximized ? "还原" : "最大化"}>
          {maximized ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="4.5" width="7" height="7" rx="1" />
              <path d="M5 4.5v-2h6.5V9H9.5" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2.5" y="2.5" width="9" height="9" rx="1" />
            </svg>
          )}
        </TitleBarButton>

        <TitleBarButton danger onClick={() => appWindow.close()} title="关闭">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="m3.5 3.5 7 7m0-7-7 7" />
          </svg>
        </TitleBarButton>
      </div>
    </div>
  );
}
