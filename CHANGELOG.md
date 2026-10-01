# 更新记录 / Changelog

## 未发布 / Unreleased

- 新增 GitHub Actions 自动发布：版本标签校验、回归检查、运行文件打包、对应更新记录提取与 Release 发布。
  Added GitHub Actions release automation with version validation, regression checks, runtime-only packaging, and changelog-based release notes.
- 支持手动补发已有标签及失败草稿重试，保护已发布的安装包。
  Added existing-tag backfills and incomplete-draft retries while preserving published assets.

## [0.1.2] - 2026-10-01

### 新增 / Added

- 顶栏显示当前文件夹或域名范围及实际展示数量；搜索与范围筛选可以分别清除。
  The toolbar shows the current folder/domain scope and visible result count, with separate search and scope clearing.
- 书签与文件夹提供悬停管理菜单，收藏夹栏提供新建文件夹入口。
  Hover action menus for bookmarks and folders, plus a new-folder button.
- 悬停或键盘聚焦书签可查看完整标题、网址和所属路径。
  Bookmark details show the full title, URL, and folder path on hover or keyboard focus.
- `/`、`⌘K` 或 `Ctrl+K` 聚焦搜索；菜单支持方向键和 `Esc`，域名及文件夹筛选支持键盘操作。
  Search shortcuts and keyboard navigation for menus and domain/folder filters.

### 优化 / Changed

- 统一背景、文字、图标和计数样式，分类颜色集中在文件夹图标和分组细色条。
  Unified surfaces, typography, icons, and counts; category colors remain on folder icons and thin group borders.
- 保留紧凑三栏、书签行高和桌面网格密度，优化暗色主题及窄窗口布局。
  Retained the compact three-panel layout, bookmark row height, and desktop grid density; improved dark mode and narrow windows.
- 打开书签和点击空白时保留当前浏览位置；“全部”清除搜索及范围筛选，保留排序。
  Opening bookmarks and clicking blank space preserve the current view. All clears search and scope while keeping sort order.

### 修复 / Fixed

- “零散”统一统计并展示各浏览器系统目录的直属书签，搜索与排序使用同一范围。
  Loose bookmarks consistently include direct bookmarks from all browser system roots, including search and sorting.
- 文件夹拖拽区分前后排序和移入，支持跨层级移动、悬停展开及循环保护，禁止拖动系统目录。
  Folder dragging distinguishes ordering from nesting, supports cross-level moves and hover expansion, and protects against cycles and system-root dragging.
- 书签前后排序使用包含文件夹的完整子项顺序；折叠状态在页面重绘后保留。
  Bookmark ordering respects mixed bookmark/folder siblings; folder expansion survives rerendering.
- 浏览器 API 失败会展示错误并停止后续操作；删除撤销正确恢复层级及原有隐藏状态。
  Browser API failures surface errors and stop subsequent operations; undo restores hierarchy and original hidden state.
- 转义标题、网址和自定义名称，保留 `file:` 等无主机名协议的书签。
  Escaped user-provided titles, URLs, and names; retained bookmarks with protocols such as `file:`.

### 隐私与维护 / Privacy and maintenance

- 图标只使用浏览器 `/_favicon/` 接口，移除第三方图标服务备用地址。
  Favicons use only the browser interface; removed the third-party favicon fallback.
- 移除旧演示页和内部工作记录，补充本地配置、凭证及个人书签导出的忽略规则。
  Removed legacy pages and internal work notes; added ignore rules for local configuration, credentials, and personal bookmark exports.
- 补充隐私说明、开发验证步骤和虚构数据回归测试。
  Added privacy documentation, development checks, and synthetic regression fixtures.

### 验证 / Validation

- 17 项自动回归检查通过，JavaScript 语法与 Git 差异检查通过。
  All 17 automated regression checks pass, along with JavaScript syntax and Git whitespace checks.
- 示例页面在 1440 × 900 视口下与旧版保持相同的 32px 行高、5 列和首屏书签数量。
  The synthetic preview retains the previous 32px row height, five columns, and first-screen bookmark count at 1440 × 900.
- 自动测试使用模拟浏览器接口；真实扩展中的鼠标拖拽仍需人工验收。
  Automated tests mock the browser boundary; mouse dragging in the actual extension still needs manual validation.

## [0.1.1] - 2026-09-03

- 增加域名右键自定义名称，改进分类颜色、站点图标和暗色主题。
  Added custom domain names and improved category colors, favicons, and dark mode.
- 点击扩展图标时优先复用已打开的页面。
  Clicking the extension action reuses an existing bookmark page when available.

## [0.1.0] - 2026-08-22

- 首次发布 Chrome Manifest V3 收藏夹美化扩展，提供域名聚合、文件夹树和书签浏览。
  Initial Chrome Manifest V3 release with domain aggregation, folder navigation, and bookmark browsing.

[0.1.2]: https://github.com/xxhh2eol/bookmark-beautify/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/xxhh2eol/bookmark-beautify/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/xxhh2eol/bookmark-beautify/tree/v0.1.0
