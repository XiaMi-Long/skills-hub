import type { ReactNode } from "react";

/**
 * 自定义单选框:隐藏原生 input(保留键盘/无障碍),选中时 accent 渐变环 + 内点。
 */
export default function Radio({
  checked,
  onChange,
  disabled,
  children,
  className = "",
  name,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  children?: ReactNode;
  className?: string;
  name?: string;
}) {
  return (
    <label
      className={`inline-flex items-center gap-2 ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${className}`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange()}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border transition-all duration-150 ${
          checked
            ? "accent-gradient border-transparent shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-from)_15%,transparent)]"
            : "border-[var(--border-strong)] bg-[var(--bg-elevated)]"
        } peer-focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent-from)_40%,transparent)]`}
      >
        <span
          className={`block h-[5px] w-[5px] rounded-full bg-[var(--bg-pane)] transition-transform duration-150 ${
            checked ? "scale-100" : "scale-0"
          }`}
        />
      </span>
      {children}
    </label>
  );
}
