import type { ReactNode } from "react";

/**
 * 自定义复选框:隐藏原生 input(保留键盘/无障碍),勾选时 accent 渐变底 + 白色对勾。
 * children 渲染在选框右侧(文字或任意节点),外层为 label,className 可传入卡片式布局。
 */
export default function Checkbox({
  checked,
  onChange,
  disabled,
  children,
  className = "",
  title,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <label
      title={title}
      className={`inline-flex items-center gap-2 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${className}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border transition-all duration-150 ${
          checked
            ? "accent-gradient border-transparent shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-from)_15%,transparent)]"
            : "border-[var(--border-strong)] bg-[var(--bg-elevated)]"
        } peer-focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-from)_40%,transparent)]`}
      >
        <svg
          className={`h-2.5 w-2.5 text-white transition-transform duration-150 ${checked ? "scale-100" : "scale-0"}`}
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M2.5 6.5 5 9l4.5-5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {children}
    </label>
  );
}
