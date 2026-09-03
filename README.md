# bookmark-beautify / 收藏夹美化

A lightweight **Chrome extension (Manifest V3)** that turns your New Tab page into a clean, beautiful view of your **real bookmarks** — aggregated by domain, organized by folder tree, with search, sort, drag-and-drop reordering and one-click management. Vanilla JS, no build step, no dependencies.

一款把 Chrome 新标签页变成美观书签管理界面的轻量扩展（Manifest V3）：读取**浏览器真实收藏夹**，按域名聚合、按文件夹树展示，支持搜索、排序、拖拽整理与一键管理。纯原生 JS，无需构建、无第三方依赖。

---

## Features / 功能

- **Reads your real bookmarks** — uses the `chrome.bookmarks` API directly; nothing to import.
  **读取真实收藏夹** —— 直接调用 `chrome.bookmarks`，无需导入。

- **Three-column layout** / **三栏布局**
  - **Left** — bookmarks grouped by domain (eTLD+1) with colored badges, sorted by count.
    左侧——按域名（eTLD+1）聚合，彩色徽章，按收藏数量降序。
  - **Middle** — your folder tree, color-coded, with per-folder bookmark counts.
    中间——文件夹树，彩色标识并统计每个文件夹的书签数量。
  - **Right** — the bookmark list for the current filter (shows all bookmarks by default).
    右侧——当前筛选下的书签列表（默认展示全部）。

- **Search** by title / URL / host / domain / folder path.
  **搜索** —— 按标题、网址、主机、域名或所在文件夹路径检索。

- **Sort** — default, name ascending / descending, recently added.
  **排序** —— 默认、名称正序/逆序、最近添加。

- **Drag to resize** the left and middle panel widths.
  **拖动调节宽度** —— 左、中两栏可拖动调整。

- **Drag & drop organization** — reorder bookmarks, move bookmarks into folders, move folders (with cycle-into-descendant protection).
  **拖拽整理** —— 可重排书签、移入文件夹、移动文件夹（自动阻止拖入自己的子目录）。

- **Right-click context menu** — pin to top, rename, delete (bookmark); rename / hide content / delete folder (release contents or delete with contents), create folder.
  **右键菜单** —— 网址：置顶、改名、删除；文件夹：改名、隐藏内容、删除（释放内容或连同内容）、新建文件夹。

- **Undo delete** — a toast lets you restore what you just removed.
  **删除撤销** —— 删除后弹出提示，可一键撤销。

- **Hide folder contents** from the "All" view.
  **隐藏文件夹内容** —— 可将某些文件夹的内容从“全部”视图中隐藏。

- **Settings** — show / hide domain icons and content icons (persisted in `chrome.storage`).
  **设置** —— 可开关左侧聚合图与右侧内容区图标（通过 `chrome.storage` 持久化）。

- **Favicon with graceful fallback** — if a site icon fails to load, it falls back to a colored letter badge.
  **图标优雅降级** —— 站点图标加载失败时自动回退为彩色文字徽章。

- **Responsive** — collapses to a single column on narrow screens.
  **响应式** —— 窄屏下自动转为单栏布局。

## Screenshots / 截图

*(TODO: add a few screenshots of the New Tab page here before releasing.)*

## Install (load unpacked) / 安装（加载已解压的扩展）

1. Open `chrome://extensions` in Chrome.
   在 Chrome 打开 `chrome://extensions`。
2. Enable **Developer mode** (top-right).
   开启右上角 **开发者模式**。
3. Click **Load unpacked** and select this folder.
   点击 **加载已解压的扩展程序**，选择本目录。
4. Open a New Tab — the beautified bookmark page appears. You can also click the extension icon in the toolbar to open it.
   新建标签页即可看到美化后的书签页；也可点击工具栏上的扩展图标打开（由 `background.js` 实现）。

## Project structure / 项目结构

```text
bookmark-beautify/
├─ manifest.json            # Manifest V3 extension manifest
├─ newtab-external.html     # New Tab page (loads external app.js to comply with CSP)
├─ app.js                   # UI + logic
├─ app.css                  # Styles
├─ background.js            # Service worker — opens the page when the toolbar icon is clicked
├─ newtab.html              # Legacy standalone demo (not referenced by the manifest)
├─ index.html               # Legacy static demo page (ignorable)
├─ CONTRIBUTING.md          # Contributing guide
├─ README.md
├─ LICENSE                  # MIT
└─ .github/                 # Issue & PR templates
```

## Tech stack / 技术栈

- **Vanilla JavaScript / HTML / CSS** — no framework, no build step, no dependencies.
- **Chrome Extensions Manifest V3** — `bookmarks`, `favicon`, `storage`, `tabs` permissions.
  （无框架、无构建、无依赖；使用 `bookmarks`、`favicon`、`storage`、`tabs` 权限。）
- **eTLD+1 domain aggregation** — a small suffix list handles multi-part public suffixes (e.g. `co.uk`, `com.cn`).

## Contributing / 贡献

Contributions are welcome — Bug reports, feature suggestions, and pull requests. See [CONTRIBUTING.md](./CONTRIBUTING.md).

欢迎参与贡献，无论是 Bug 反馈、功能建议还是代码提交，详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## License / 许可

[MIT](./LICENSE)

Copyright (c) 2026 xxhh2eol
