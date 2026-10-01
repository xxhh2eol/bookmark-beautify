# bookmark-beautify / 收藏夹美化

当前版本 / Current version：**v0.1.2** · [更新记录 / Changelog](./CHANGELOG.md)

A lightweight **Chrome extension (Manifest V3)** that turns your New Tab page into a clean, beautiful view of your **real bookmarks** — aggregated by domain, organized by folder tree, with search, sort, drag-and-drop reordering and one-click management. Vanilla JS, no build step, no dependencies.

一款把 Chrome 新标签页变成美观书签管理界面的轻量扩展（Manifest V3）：读取**浏览器真实收藏夹**，按域名聚合、按文件夹树展示，支持搜索、排序、拖拽整理与一键管理。纯原生 JS，无需构建、无第三方依赖。

---

## v0.1.2 更新 / What's new

- 更清爽的紧凑三栏界面，保留书签行高与桌面网格密度。
  A cleaner compact layout with the same bookmark row height and desktop grid density.
- 当前筛选范围与匹配数量、独立清除入口、悬停操作菜单和搜索快捷键。
  Scope and result counts, separate clearing controls, hover action menus, and search shortcuts.
- 修复零散书签范围、嵌套拖拽、混合排序和删除撤销；补充隐私说明并清理旧演示页。
  Fixes for loose bookmarks, nested dragging, mixed ordering, and deletion undo; privacy documentation and legacy-page cleanup.

完整变更见 [CHANGELOG.md](./CHANGELOG.md)。
See [CHANGELOG.md](./CHANGELOG.md) for the full release notes.

## Features / 功能

- **Reads your real bookmarks** — uses the `chrome.bookmarks` API directly; nothing to import.
  **读取真实收藏夹** —— 直接调用 `chrome.bookmarks`，无需导入。

- **Three-column layout** / **三栏布局**
  - **Left** — bookmarks grouped by domain (eTLD+1) with site icons, sorted by count.
    左侧——按域名（eTLD+1）聚合，站点图标，按收藏数量降序。
  - **Middle** — your folder tree, color-coded, with per-folder bookmark counts.
    中间——文件夹树，彩色标识并统计每个文件夹的书签数量。
  - **Right** — the bookmark list for the current filter (shows all bookmarks by default).
    右侧——当前筛选下的书签列表（默认展示全部）。

- **Compact controls** — current scope and result count, separate search/filter clearing, hover action menus, and full bookmark details on hover or keyboard focus. Opening a bookmark preserves your current view.
  **紧凑操作** —— 顶栏显示当前范围与结果数量，分别清除搜索和筛选；悬停菜单管理书签/文件夹，悬停或键盘聚焦查看完整书签信息。打开书签后保留当前浏览位置。

- **Search shortcuts** — press `/`, `⌘K` (macOS), or `Ctrl+K` to focus search; `Esc` closes menus and settings.
  **搜索快捷键** —— `/`、`⌘K`（macOS）或 `Ctrl+K` 聚焦搜索；`Esc` 关闭菜单与设置。

- **Search** by title / URL / host / domain / folder path.
  **搜索** —— 按标题、网址、主机、域名或所在文件夹路径检索。

- **Sort** — default, name ascending / descending, recently added.
  **排序** —— 默认、名称正序/逆序、最近添加。

- **Drag to resize** the left and middle panel widths.
  **拖动调节宽度** —— 左、中两栏可拖动调整。

- **Drag & drop organization** — reorder bookmarks, move bookmarks into folders, move folders (with cycle-into-descendant protection).
  **拖拽整理** —— 可重排书签、移入文件夹、移动文件夹（自动阻止拖入自己的子目录）。

  中间收藏夹栏：拖到文件夹上、下边缘可前后排序，拖到中间可移入该文件夹，悬停约 0.65 秒展开子级。一级、二级及更深层文件夹都支持；拖到“零散”可移回所属系统目录的顶层。浏览器系统目录不可拖动。

  右侧书签：默认排序下，拖到另一书签左、右侧可插到其前、后，也可跨文件夹移动。按名称或最近添加排序时不接受书签之间的手动排序；仍可拖到中间栏文件夹进行归类。

- **Loose bookmarks / 零散** —— 汇总收藏夹栏、其他书签、移动设备书签等系统目录下直属的书签，不包含用户文件夹内的书签。计数、搜索和排序使用同一范围；把书签拖到“零散”可移出当前文件夹。

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

- **Responsive** — keeps the three panels side by side; compact navigation and a wrapping toolbar adapt to narrow windows.
  **响应式** —— 保留三栏并排，窄窗口下收紧侧栏控件并折行顶栏。

## Download / 下载

从 [Releases](https://github.com/xxhh2eol/bookmark-beautify/releases) 下载 `bookmark-beautify-vX.Y.Z.zip` 并解压，再按下面步骤加载解压后的目录。
Download and extract the extension ZIP from [Releases](https://github.com/xxhh2eol/bookmark-beautify/releases), then load the extracted folder as described below.

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
├─ tests/                   # Regression tests with synthetic fixtures
├─ scripts/package_release.py # Version validation, ZIP packaging and release notes
├─ CONTRIBUTING.md          # Contributing guide
├─ CHANGELOG.md             # Version history
├─ README.md
├─ LICENSE                  # MIT
└─ .github/                 # Release workflow, issue & PR templates
```

## Tech stack / 技术栈

- **Vanilla JavaScript / HTML / CSS** — no framework, no build step, no dependencies.
- **Chrome Extensions Manifest V3** — `bookmarks`, `favicon`, `storage`, `tabs` permissions.
  （无框架、无构建、无依赖；使用 `bookmarks`、`favicon`、`storage`、`tabs` 权限。）
- **eTLD+1 domain aggregation** — a small suffix list handles multi-part public suffixes (e.g. `co.uk`, `com.cn`).

## Privacy / 隐私

- Bookmarks are read and changed through the browser's `chrome.bookmarks` API. This extension has no analytics, remote backend, or application code that uploads bookmarks.
  书签通过浏览器的 `chrome.bookmarks` API 读取和修改，扩展没有统计分析、远程后端或上传书签的应用代码。
- Display settings, hidden-folder IDs, and custom domain names are saved in `chrome.storage.local`.
  显示设置、隐藏文件夹 ID 和自定义域名名称保存在 `chrome.storage.local`。
- Site icons use the browser's `/_favicon/` interface; the extension does not use a third-party favicon service. Opening a bookmark navigates to its destination normally.
  站点图标使用浏览器的 `/_favicon/` 接口，扩展不使用第三方图标服务。打开书签时会正常访问目标网站。
- The repository contains synthetic regression-test data, not exported personal bookmarks.
  仓库内的回归测试使用虚构数据，不包含个人书签导出。

## Development / 开发与验证

No build step or runtime dependencies are required. Run the regression tests with Node.js 18 or later:
无需构建步骤或运行时第三方依赖。使用 Node.js 18 或更新版本运行回归检查：

```sh
node --test tests/*.test.cjs
python3 -m unittest discover -s tests -p 'test_release.py' -v
node --check app.js
node --check background.js
git diff --check
```

Tests mock the browser boundary and do not change real bookmarks. Also verify dragging, menus, and undo in an unpacked extension before releasing. Bookmark edits affect the browser's real collection; backing up bookmarks before extensive reorganization is recommended.
测试模拟浏览器接口，不会修改真实书签。发布前还需在已解压扩展中核对拖拽、菜单和撤销。扩展的管理操作会修改真实收藏夹，建议在批量整理前备份书签。

Release-tooling checks also require Python 3.9 or later; Python is not required to use the extension.
发布工具检查另需 Python 3.9 或更新版本；使用扩展不需要 Python。

Known limits: domain aggregation uses a small public-suffix list; external bookmark changes require a page refresh; multi-step delete/undo operations are not transactions.
已知限制：域名聚合使用有限的公共后缀表；外部书签变更需刷新页面；多步骤删除与撤销不具备事务回滚能力。

## Automated releases / 自动发布

推送 `vMAJOR.MINOR.PATCH` 标签会触发 [Release extension](https://github.com/xxhh2eol/bookmark-beautify/actions/workflows/release.yml)：核对标签与 `manifest.json` 版本、运行回归检查、从 `CHANGELOG.md` 提取对应版本记录，再创建 GitHub Release 并上传 ZIP。只打包运行文件和许可证，不包含测试、开发记录或个人数据。
Pushing a version tag validates its manifest version, runs regression checks, extracts the matching changelog section, and publishes a GitHub Release with the extension ZIP. The archive includes only runtime files and the license.

补发已有标签时，在 Actions → Release extension → Run workflow 中选择 `main`，填写已有标签。已发布的同名 ZIP 不会被覆盖，失败后留下的草稿可重试。发布流程使用自动提供的 `GITHUB_TOKEN`，无需额外配置个人 token。
To backfill an existing tag, run the workflow from `main` and enter the tag. Published assets are preserved, and incomplete drafts can be retried. The workflow uses the built-in `GITHUB_TOKEN`.

维护者的版本准备和推送步骤见 [CONTRIBUTING.md](./CONTRIBUTING.md#release--发布版本)。
See [CONTRIBUTING.md](./CONTRIBUTING.md#release--发布版本) for maintainer release steps.

## Contributing / 贡献

Contributions are welcome — Bug reports, feature suggestions, and pull requests. See [CONTRIBUTING.md](./CONTRIBUTING.md).

欢迎参与贡献，无论是 Bug 反馈、功能建议还是代码提交，详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## License / 许可

[MIT](./LICENSE)

Copyright (c) 2026 xxhh2eol
