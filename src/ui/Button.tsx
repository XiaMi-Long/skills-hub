import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

/**
 * @description 按钮系统(统一控件):primary=纵向渐变+内高光主操作,ghost=描边次级,danger=危险。
 * 统一高度 30px、圆角 9px、按压微缩;禁用态降透明度。
 */
const VARIANTS: Record<Variant, string> = {
  primary: "btn-primary text-white",
  ghost:
    "border border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]",
  danger:
    "border border-[var(--danger)]/25 bg-transparent text-[var(--danger)] hover:border-[var(--danger)]/50 hover:bg-[var(--danger)]/10",
};

export default function Button({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex h-[30px] items-center justify-center gap-1.5 rounded-[9px] px-3.5 text-[12px] font-medium transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-45 ${VARIANTS[variant]} ${className}`}
    />
  );
}
