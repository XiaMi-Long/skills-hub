/**
 * @description 设置面板通用的区块标题:标题 + 一句话说明。
 * @param title - 区块标题
 * @param desc - 区块说明(可选)
 */
export default function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h2>
      {desc && <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{desc}</p>}
    </div>
  );
}
