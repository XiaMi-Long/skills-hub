/**
 * @description 分段选择控件(Segmented):胶囊容器 + accent 渐变选中项,替代 radio 平铺。
 * 适用于二选一/多选一的紧凑场景(如目标语言、默认视图)。
 * @param value - 当前选中值
 * @param onChange - 变更回调
 * @param options - 选项列表
 * @param disabled - 是否禁用
 */
export default function Segmented<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-[9px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 p-0.5">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`rounded-[7px] px-3.5 py-1 text-[12px] transition-all duration-150 disabled:opacity-50 ${
              selected
                ? "accent-gradient text-white shadow-[0_1px_2px_rgba(0,0,0,0.25)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
