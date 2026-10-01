# Contributing / 贡献指南

Thank you for your interest in contributing to **bookmark-beautify**!

感谢你对 **bookmark-beautify** 的关注与贡献！

## Ways to contribute / 参与方式

- **报告 Bug / Bug reports** — 使用 `.github/ISSUE_TEMPLATE/bug_report.md` 创建 Issue。
- **提功能建议 / Feature suggestions** — 使用 `.github/ISSUE_TEMPLATE/feature_request.md` 创建 Issue。
- **提交代码 / Code** — Fork 本仓库，新建分支，修改后提交 Pull Request。

## Development setup / 开发环境

本项目无构建步骤，是纯 HTML / CSS / JS，直接改代码即可。

1. 打开 Chrome 的 `chrome://extensions`。
2. 开启右上角「开发者模式 / Developer mode」。
3. 点击「加载已解压的扩展程序 / Load unpacked」，选择本仓库文件夹。
4. 打开新标签页即可看到效果。修改代码后点扩展页的「刷新」图标应用变更。

（在 `chrome://extensions` 里刷新扩展即可重新加载改动。）

## Validation / 验证

Use Node.js 18 or later and Python 3.9 or later for automated checks (neither is needed to use the extension):
自动检查需要 Node.js 18 或更新版本及 Python 3.9 或更新版本（使用扩展本身不需要这两个环境）：

```sh
node --test tests/*.test.cjs
python3 -m unittest discover -s tests -p 'test_release.py' -v
node --check app.js
node --check background.js
git diff --check
```

Load the unpacked extension to verify real browser interaction. Use synthetic bookmarks for screenshots and test fixtures. Do not commit browser exports, credentials, local assistant records, or environment configuration; redact private URLs and folder names in bug reports.
在已解压扩展中核对真实浏览器交互。截图和测试数据请使用虚构书签；不要提交浏览器书签导出、凭证、本地助手记录或环境配置。提交问题反馈前请遮盖私人网址和文件夹名称。

## How to submit changes / 提交改动

1. Fork 仓库并克隆到本地。
2. 新建分支：`git checkout -b feature/your-feature`。
3. 修改代码，尽量**小而聚焦**（保持改动范围最小）。
4. 提交信息用清晰的一句话描述，例如 `feat: add search sort`.
5. 推送分支并打开 Pull Request（使用 `.github/pull_request_template.md` 模板）。

## Code style / 代码规范

- 保持改动最小、聚焦。
- UI 文案尽量做到中英文兼顾（项目本身双语）。
- 尽量与现有代码风格一致，不引入构建步骤或第三方依赖。
- 保持 `manifest.json` 的 `version` 与发布版本一致。

## Issue / PR 模板

创建 Issue 或 PR 时，请使用仓库内自带的模板（`.github/` 目录），并尽量填全信息，便于定位和跟进。

## Code of Conduct / 行为准则

请友善、平等地交流，尊重每位贡献者。提交内容需遵守本项目采用的 [MIT License](./LICENSE)。


## Release / 发布版本

1. 更新 `manifest.json`、README 的版本号，并在 `CHANGELOG.md` 中添加 `## [X.Y.Z] - YYYY-MM-DD` 及该版本内容。
   Update the manifest and README version, and add a versioned changelog section.
2. 运行上述检查；也可用 `python3 scripts/package_release.py --tag vX.Y.Z` 在本地验证安装包。输出位于已忽略的 `release/` 目录。
   Run the checks and optionally validate the package locally. Generated files stay in the ignored `release/` directory.
3. 提交改动后，创建版本标签并一起推送当前提交到远端 `main`。以下命令中的 `vX.Y.Z` 需替换为实际版本：
   Commit changes, create an annotated tag, and push the current commit and tag together. Replace `vX.Y.Z` below with the actual version:

   ```sh
   git tag -a vX.Y.Z -m 'Release vX.Y.Z'
   git push --atomic origin HEAD:main refs/tags/vX.Y.Z
   ```

4. 在 Actions 中确认 Release extension 运行成功，随后检查 Releases 中的更新记录和 `bookmark-beautify-vX.Y.Z.zip`。标签、manifest 和更新记录不一致会中止发布。
   Confirm the workflow succeeds and verify the release notes and ZIP. Tag/manifest/changelog mismatches stop publication.

补发已有标签时，手动运行 `release.yml`，选择 `main` 并填写已有标签。无需移动、删除或重新推送标签。已发布的安装包不会被覆盖。
To backfill an existing tag, manually dispatch `release.yml` from `main` with that tag. Existing tags and published packages are preserved.
