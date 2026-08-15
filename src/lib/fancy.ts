/**
 * 全局质感背景开关:切换 <html> 的 fancy-bg 类,样式效果全部由 CSS 承担
 * (开启=渐变背景 + 颗粒噪点 + 磨砂浮层 + 面板半透明;关闭=纯色扁平)。
 * 与 applyTheme/applyAccent 一样在设置加载与设置页改动时调用,即时生效无需刷新。
 */
export function applyFancyBackground(enabled: boolean) {
  document.documentElement.classList.toggle("fancy-bg", enabled);
}
