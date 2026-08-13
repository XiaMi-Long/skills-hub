import type { ReactNode } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function Modal({
  title,
  onClose,
  children,
  width = 520,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  // Esc 关闭
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Portal 到 body:挂载点祖先若有 backdrop-filter/transform(如 .glass 工具栏),
  // 会劫持 fixed 定位与层叠上下文,导致弹窗位置/层级错乱。
  return createPortal(
    <div
      className="fixed inset-0 z-[50] flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="animate-fade-in absolute inset-0 bg-black/40" />
      <div
        className="glass animate-modal-pop relative flex max-h-[85vh] flex-col rounded-[10px] border border-[var(--border-strong)] shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
        style={{ width }}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h3>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
