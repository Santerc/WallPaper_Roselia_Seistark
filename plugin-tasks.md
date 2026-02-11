

## 快速说明 ⚡
- 将想要执行的 task 的完整 prompt 原封不动地发送给你的 agent。每个 prompt 说明了要改动/新增的文件、验收条件与测试步骤。
- PR 标题格式：`Feature: <短描述>` 或 `RFC: <短描述>`；分支名：`feature/plugin-<task-key>`。
- 如果在运行过程中遇到架构或权限的关键决策，agent 必须打开 Issue 并等待确认，不得擅自决定。

---

## 通用 PR 要求 ✅
- 实现说明、改动文件列表、如何手动验证、自动化测试、估时与检查清单。
- CI 必须通过（后端用 `pytest`，前端用 Playwright 或等效工具）。
- 单个 PR 保持原子（1 个功能点 + 测试 + 文档）。
- 不要直接合并到 `main`：创建 PR 并等待 code review。

---

# 任务 Prompts（直接发送给 agent）

> 每个任务以标题、目标、输出、涉及文件、验收标准与估时给出。请按需使用或全部执行（推荐：按照 Orchestration 的顺序执行）。


## Prompt A — RFC: 插件系统设计与 manifest 规范 (估时 0.5–1d)

你是 AI 开发者。请生成 `docs/plugin_spec.md`，内容包括：
- manifest schema：`id, name, version, type (frontend|backend), entry, editable, lockable, capabilities, permissions, checksum`。
- 生命周期：`init/start/stop/unload`，事件列表，hostApi 接口（`emit/call/requestPermission`）。
- IPC 协议：`stdin/stdout` 的 JSON-RPC（exe 模式）和 `HTTP localhost`（长期服务）。
- 安全：checksum/签名校验规则、layout 更新的 editor token 规范。

交付物：
- `docs/plugin_spec.md`
- 一个示例 manifest：`plugins/example/plugin.json`

验收条件：文档包含示例流程、消息格式与一张 mermaid（或等效）架构图；至少一位开发审阅并通过。


## Prompt B — Feature: 前端 Plugin Host SDK (`scripts/plugin-sdk.js`) (估时 1–1.5d)

你是 AI 开发者。实现 `scripts/plugin-sdk.js`：
- API：`register(meta, render)`, `mount(id, container)`, `hostApi`（含 `emit`, `call(pluginId, method, args)`）。
- 动态加载：`loadPlugin(url)`，导入/执行 bundle 并调用 `register`。
- 尊重 manifest 的 `editable` 字段并暴露 `meta.editable`。
- 添加基础单元测试（Jest 或 node harness）并更新使用示例。

涉及文件：
- 新增 `scripts/plugin-sdk.js`
- 更新 `index.html` 示例，演示加载 `plugins/frontend/clock/bundle.js`

验收：能动态加载示例插件并完成 `register`；测试通过（`npm test` 或 node harness）。


## Prompt C — Feature: 后端 Plugin Manager (`backend/plugin_manager.py`) (估时 1.5–2d)

你是 AI 开发者。实现插件管理器：
- 发现 `plugins/backend/*/plugin.json`；
- 以子进程方式启动插件（Windows 下用 `subprocess.Popen`），监听 stdout JSON 心跳；
- 实现重启策略（最多重启 N 次）、日志收集与状态查询接口；
- 为 `server.py` 提供接口以列出插件状态并向插件发命令。

涉及文件：
- 新增 `backend/plugin_manager.py`
- 修改 `server.py`，增加 `/api/plugins/list`（或同等接口）

验收：管理器能启动 `plugins/backend/echo/run.py` 示例并收到心跳；为发现与启动行为提供单元测试。


## Prompt D — Feature: 编辑模式拖拽与碰撞检测（前端） (估时 1–1.5d)

你是 AI 开发者。实现 `scripts/plugin-drag.js`：
- 仅在 `body.edit-mode` 时启用拖拽；仅允许句柄 `.drag-handle` 触发拖动；
- 使用 AABB 碰撞检测（gutter = 4px），对比同容器内其它 `.plugin` 的矩形；
- 当发生碰撞：阻止放置，显示 `.invalid-position`（红框 + 动画），pointerup 时回退上一个合法位置；
- 合法时：使用 transform 平滑移动并在 debounce 后 POST `/api/layout/update`。

涉及文件：
- 新增 `scripts/plugin-drag.js`
- 在 `styles/main.css` 中添加 `.drag-handle`, `.invalid-position`, `.dragging` 样式

验收：编辑模式下不能放置重叠插件并显示提示；运行模式下拖拽不可用；Playwright 脚本验证行为。


## Prompt E — Feature: 后端 layout 保存与校验 (估时 0.5d)

你是 AI 开发者。修改 `server.py`：
- 添加函数 `validate_layout_no_overlap(layout, gutter=4)`（O(n^2) 检查，返回冲突 ids）；
- 修改 `/api/layout/update`：
  - 验证编辑权限（`X-Editor-Token` 或 `server.edit_mode`）；
  - 若有重叠则返回 400，JSON 格式 `{ok:false,msg:'...',clash:[idA,idB]}`；
  - 合法则保存到 `user_config.json` 并返回 `{ok:true}`。

测试：新增 `tests/test_layout_validation.py`（覆盖无重叠、边界接触、显式重叠）。

验收：单元测试通过；API 在冲突时返回 400 并包含冲突信息。


## Prompt F — Example Plugins & Demo (估时 1d)

你是 AI 开发者。创建两个示例插件：
- `plugins/frontend/clock/`：`plugin.json` + `bundle.js`，bundle 调用 `register(meta, render)` 并渲染一个时钟组件；
- `plugins/backend/echo/`：`plugin.json` + `run.py`，从 stdin 读 JSON 行并按需回送心跳与 `ping` 响应；

添加 README 指南（如何运行、如何观察心跳/加载）。

验收：前端可加载并展示时钟；后端可被管理器启动并发送心跳。


## Prompt G — Security: Checksum/Signature & Permissions (估时 0.5–1d)

你是 AI 开发者。实现简单的 checksum 校验：
- 加载插件时计算 entry bundle 的 SHA256 并与 manifest 中 `checksum` 比对；不匹配则拒绝加载并记录日志；
- manifest 中的 `permissions` 列表应被 host 检查，若权限缺失则拒绝对应能力调用。

验收：有测试用例证明 checksum 不匹配时加载失败；文档更新说明如何生成 checksum。


## Prompt H — Tests & CI (估时 1.5d)

你是 AI 开发者。增加测试并接入 CI：
- 后端：`pytest` 覆盖 `validate_layout_no_overlap`、plugin manager 的基本行为；
- 前端：Playwright 脚本覆盖编辑模式拖拽、重叠阻止与保存流程；
- 添加 GitHub Actions Workflow：PR 上运行 `pytest` 与 Playwright。

验收：CI 配置提交；PR 上测试任务能成功运行并通过。


## Prompt I — Orchestration Prompt（一键执行）

你是部署/协调的 AI agent。按顺序执行：A → B → C → F → D → E → G → H。每个任务：
- 创建分支 `feature/plugin-<task-key>`；
- 如果没有 Issue，则先创建对应 Issue；
- 实现功能、添加测试、运行本地测试、推送分支并开 PR，PR 描述包含实现说明、手动验证步骤与测试结果；
- 若遇阻塞或需架构决策，创建 Issue 并暂停执行，等待确认。


---

## PR 描述模板（Agent 用）

```
Title: Feature: <short description>

Summary:
- 简述改动与目的

Files changed:
- list

How to test (manual):
1. ...
2. ...

Automated tests:
- `pytest` / Playwright script

Related issue: #xx
Estimated time: 1.5d
```

---

## Tips & Agent 行为规范 🧠
- 在修改前运行现有 tests / lint（若存在）。
- 每个 PR 保持小且原子；每步提交需有对应测试。
- 使用 mock 来避免暴露 secret。若需要 DB 或凭证，先使用本地 dev 模式。


---

## 导出格式
若需要我可以把这些 prompts 导出为 `plugin-tasks.md`（done）或 `plugin-agent-prompts.json`（要我生成请回复 `json`）。

---

文档已生成并保存在仓库根目录： `plugin-tasks.md`。如需我把每个 prompt 自动拆成 GitHub Issues 或直接在仓库中开始执行 PoC，告诉我下一步（例如：`create_issues` / `start_poc`）。

把现有应用改造成插件化平台（前端 UI 插件 + 后端 可执行/服务 插件），并支持 编辑模式（可拖拽/不可重叠） 与 运行模式（锁定），同时后端做保存校验和安全检查。🔧
# 架构要点：
## 前端（Plugin Host）
插件注册/加载 API：scripts/plugin-sdk.js（register/mount/hostApi）
编辑器（Edit Mode）与运行（Runtime）模式切换 UI
拖拽模块：scripts/plugin-drag.js（handle-only、pointer events、AABB 碰撞检测、gutter、视觉提示）
布局保存接口：POST /api/layout/update（debounced）
## 后端（Plugin Manager）
插件发现与启动：backend/plugin_manager.py
与插件进程通信：stdin/stdout JSON 或本地 HTTP（heartbeat、command）
layout 保存校验：validate_layout_no_overlap（后端二次校验）
## 插件规范（Manifest）
plugin.json：id, name, type, entry, editable, permissions, checksum, capabilities
# 关键行为细节 ✅
## 模式区分
Edit Mode：显示 .drag-handle，启用拖拽和碰撞检测，仅在编辑模式/有编辑权限时允许保存。
Runtime Mode：禁用拖拽，插件运行其内部交互（点击、播放等）。
## 碰撞策略（用户已确定）
拖拽过程中检测 AABB 碰撞；若发生碰撞则阻止放置、显示 .invalid-position（红框/动画），pointerup 时回退到上次合法位置。
## 保存与校验
前端尝试保存；后端再次验证无重叠并返回 success/fail，失败时给出冲突 ids。
## 安全
加载时校验 entry checksum（sha256）；保存需要 editor_token 或 server.edit_mode 验证；记录审计日志。