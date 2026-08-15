# 下载

## 最新版本

从 GitHub Releases 下载 Windows 安装包:

<div style="margin: 16px 0;">
  <a class="download-btn" href="https://github.com/XiaMi-Long/skills-hub/releases/latest" target="_blank" rel="noopener">
    ⬇ 前往 GitHub Releases 下载
  </a>
</div>

下载 `skills-hub_x.x.x_x64-setup.exe`,双击运行,按向导完成安装。

## 系统要求

- Windows 10 / 11(x64)
- 「全局质感背景」窗口亚克力透明需要系统「设置 → 个性化 → 颜色 → 透明度效果」开启

## 说明

::: info 当前版本
暂为手动下载安装,**暂未配置自动更新**。新版本发布后,到 Releases 页重新下载安装包覆盖安装即可(设置与翻译缓存保存在应用数据目录,不受影响)。
:::

## 从源码构建

```bash
git clone https://github.com/XiaMi-Long/skills-hub.git
cd skills-hub
npm install
npm run tauri build -- --bundles nsis
```

产物位于 `src-tauri/target/release/bundle/nsis/`。需要 Rust 工具链与 Tauri v2 环境。

<style>
.download-btn {
  display: inline-block;
  padding: 12px 24px;
  border-radius: 10px;
  background: linear-gradient(90deg, #2563eb, #3b82f6);
  color: #fff !important;
  font-weight: 600;
  text-decoration: none !important;
  transition: filter 0.15s ease, transform 0.15s ease;
}
.download-btn:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}
</style>
