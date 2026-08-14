/**
 * @description 应用 logo(汇聚枢纽)的 React 组件:圆角渐变底片 + 中心枢纽 + 四向卫星节点。
 * 与 brand/svg/logo-hub.svg 同源,用于标题栏等小尺寸展示。
 * @param size - 渲染尺寸(px,默认 16)
 */
export default function LogoMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect x="32" y="32" width="448" height="448" rx="104" fill="url(#logo-g)" />
      <rect x="32" y="32" width="448" height="448" rx="104" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="6" />
      <g stroke="#ffffff" strokeOpacity="0.5" strokeWidth="20" strokeLinecap="round">
        <line x1="256" y1="178" x2="256" y2="222" />
        <line x1="256" y1="290" x2="256" y2="334" />
        <line x1="178" y1="256" x2="222" y2="256" />
        <line x1="290" y1="256" x2="334" y2="256" />
      </g>
      <circle cx="256" cy="162" r="24" fill="#ffffff" opacity="0.95" />
      <circle cx="256" cy="350" r="24" fill="#ffffff" opacity="0.95" />
      <circle cx="162" cy="256" r="24" fill="#ffffff" opacity="0.95" />
      <circle cx="350" cy="256" r="24" fill="#ffffff" opacity="0.95" />
      <circle cx="256" cy="256" r="40" fill="#ffffff" />
      <circle cx="256" cy="256" r="16" fill="#1d4ed8" />
    </svg>
  );
}
