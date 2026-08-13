import { useToastStore } from "../store/toast";

const STYLES: Record<string, string> = {
  info: "border-[var(--border-strong)] text-[var(--text-secondary)]",
  success: "border-[var(--success)]/40 text-[var(--success)]",
  error: "border-[var(--danger)]/40 text-[var(--danger)]",
};

export default function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`glass animate-toast-in pointer-events-auto flex max-w-[480px] items-center gap-2 rounded-[10px] border px-3.5 py-2 text-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.4)] ${STYLES[t.type]}`}
        >
          {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}
          <span>{t.message}</span>
        </button>
      ))}
    </div>
  );
}
