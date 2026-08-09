/** 展示用路径:\\ → / */
export function displayPath(p: string): string {
  return p.replace(/\\/g, "/");
}
