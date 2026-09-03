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
