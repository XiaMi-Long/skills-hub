import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

/**
 * 自定义下拉选择:按钮 + 玻璃浮层列表,支持键盘(上下/回车/Esc)与点击外部关闭。
 */
export default function Select({
  value,
  onChange,
  options,
  placeholder = "选择…",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, [open]);

  // 键盘导航时让激活项滚入视野
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx, open]);

  const selected = options.find((o) => o.value === value);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      setOpen(true);
      setActiveIdx(Math.max(0, options.findIndex((o) => o.value === value)));
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % options.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i <= 0 ? options.length - 1 : i - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (activeIdx >= 0 && options[activeIdx]) choose(options[activeIdx].value);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text-primary)] transition-[border-color,box-shadow] duration-150 hover:border-[var(--border-strong)] focus:outline-none focus:border-[var(--accent-from)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-from)_18%,transparent)]"
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <svg
          className={`h-3 w-3 shrink-0 text-[var(--text-muted)] transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M3 4.5 6 7.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="glass animate-dropdown-in absolute left-0 right-0 top-[calc(100%+4px)] z-[60] max-h-56 overflow-y-auto rounded-[10px] border border-[var(--border-strong)] p-1 shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
        >
          {options.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                data-idx={i}
                onClick={() => choose(o.value)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
                  o.value === value
                    ? "bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                    : i === activeIdx
                      ? "bg-[var(--bg-elevated)]/70 text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)]"
                }`}
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && (
                  <svg className="h-3 w-3 shrink-0 text-[var(--accent-from)]" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6.5 5 9l4.5-5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
