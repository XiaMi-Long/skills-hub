import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "accent-gradient text-black/85 border border-transparent hover:brightness-110 font-medium shadow-[0_0_12px_color-mix(in_srgb,var(--accent-from)_25%,transparent)]",
  ghost:
    "border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]",
  danger:
    "border border-[var(--danger)]/40 text-[var(--danger)] hover:bg-[var(--danger)]/10",
};

export default function Button({
  variant = "ghost",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`rounded-lg px-3 py-1.5 text-[12px] transition-[background-color,border-color,transform,filter,color] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${VARIANTS[variant]} ${className}`}
    />
  );
}
