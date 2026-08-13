import type { ComponentProps } from "react";

/** 统一样式输入框:悬停加深边框,聚焦 accent 光晕。React 19 下 ref 直接作为 prop 透传。 */
export default function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      {...props}
      className={`h-8 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-[border-color,box-shadow] duration-150 hover:border-[var(--border-strong)] focus:border-[var(--accent-from)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-from)_18%,transparent)] focus:outline-none ${className}`}
    />
  );
}
