# /share 开发环境迁移工具设计

## 目标

在不把 `/share` 切换为直接读取数据库的前提下，为 `/share` 补齐一套与 blog migration 同等级的开发环境工具链，用于预检查、执行重建、校验 drift，并把这条工具链接到 `/share` 页内可见的 dev-only 入口。

本阶段聚焦：
- 为 `/share` 增加 `preview / execute / verify / rebuild` 工具链
- 保持 `/share` 前台运行时继续消费 `public/share/*` 正式产物
- 让开发环境下的 `/share` 具备真实 drift 检测与重建能力
- 复用现有 `share-storage`、`share-artifacts`、`push-shares` 的纯能力，而不是另起一套并行逻辑
- 为后续 CLI / CI 校验留出稳定入口

本阶段**不包含**：
- 把 `/share` 页面改成直接读取 `content.db`
- 提前抽全站通用 migration 框架
- 扩展新的 `/share` 产品能力
- 修改 logo 图片存储策略或图片文件生命周期

## 背景与约束

### 当前事实
- `/share` 运行时已闭环到四份正式产物：
  - `public/share/list.json`
  - `public/share/categories.json`
  - `public/share/folders.json`
  - `public/share/storage.json`
- `/share` 页面当前直接消费前三份运行时产物，`storage.json` 主要承载正式保存 / 发布语义
- 本地保存和远端发布都已经复用 share artifact builder，URL 冲突已收口到写出前原子失败
- 但 `/share` 仍缺 blog 同等级的开发工具：没有 share 专属 preview / execute API，没有脚本级 verify，也没有页内开发工具面板

### 设计约束
- 运行时主源不变：页面仍读取 `public/share/*`
- 工具链只在 development 暴露
- execute 必须显式确认，不能靠 truthy 值触发
- verify 不能直接做原始字符串比较，必须做规范化与稳定序列化
- 工具链只处理 `public/share/*.json` 四产物，不碰 logo 图片或其他内容模块文件

## 目标架构

本阶段沿用 blog migration 的分层方式，但先做 `/share` 专属版本，不提前抽公共框架。

### 分层结构
- **contract 层**：`src/lib/content-db/share-migration-contracts.ts`
- **API route 层**：
  - `src/app/api/share-migration/preview/route.ts`
  - `src/app/api/share-migration/execute/route.ts`
- **API helper / handler 层**：
  - `src/app/api/share-migration/share-migration-route-helper.ts`
  - `src/app/api/share-migration/share-migration-contracts.ts`
  - `src/app/api/share-migration/route-handlers.ts`
- **UI 层**：`src/app/share/components/share-migration-panel.tsx`
- **CLI 层**：`scripts/verify-share-runtime-artifacts.ts`

### 为什么先做专属层
- 当前需求最明确的是 `/share` 开发工具本身，而不是全站框架化
- blog 已有成熟模式，share 按同一骨架落地最快、最稳
- 等 `/share` 跑通后，再看是否抽共享层，能避免过早抽象

## 纯函数合同层

新增 `src/lib/content-db/share-migration-contracts.ts`，集中提供三个核心入口：

### `syncShareRuntimeArtifactsToLedger(...)`
职责：
- 读取当前运行时 share artifacts（尤其是 `list.json` 与已有 `storage.json`）
- 将 runtime 状态同步为 share ledger / storage 表示
- 保留非 `published` 记录与现有 share-storage 语义
- 不写文件，不依赖 HTTP

### `rebuildShareRuntimeArtifactsFromStorage(...)`
职责：
- 从 share storage 表示稳定重建四份正式产物：
  - `list.json`
  - `categories.json`
  - `folders.json`
  - `storage.json`
- 复用现有 `share-storage.ts` 和 `share-artifacts.ts` 的导出能力
- 保证稳定排序、固定序列化和字段归一化

### `verifyShareLedgerAgainstRuntime(...)`
职责：
- 用“重建结果 vs 当前正式产物”的方式计算 drift
- 返回 `artifactsToRebuild` 等结构化结果
- 不直接输出“假成功”或固定空列表

## 稳定性契约

这是本阶段最重要的新增约束之一。

### 稳定排序
- `list.json` 与 `storage.json` 必须定义显式排序契约，不能依赖对象插入顺序
- rebuild 与 verify 必须使用同一排序逻辑
- 若后续引入 DB 读取，也必须保证 query / adapter 输出顺序与当前契约一致

### 规范化
- `category` 与 `folderPath` 必须走统一归一化
- legacy `folder` 的处理策略必须定死，不能在 rebuild 和 verify 间出现一边保留、一边忽略
- 空白输入与缺字段应归一到同一语义，避免 drift 抖动

### 比较方式
- verify 不直接做原始字符串 `!==`
- 必须采用：`parse -> normalize -> stable stringify`
- `updatedAt` 不应成为 drift 噪声源：要么单独比较，要么排除在 drift 比较之外

## API 设计

### Preview Route
文件：`src/app/api/share-migration/preview/route.ts`

职责：
- 保持 route 足够薄
- 只负责把环境和 `baseDir` 注入 handler
- 统一把 handler 返回的 `{ status, body }` 转成 `NextResponse.json(...)`

行为：
- `GET` only
- 不写文件
- 返回真实 `artifactsToRebuild`

### Execute Route
文件：`src/app/api/share-migration/execute/route.ts`

职责：
- 解析 `POST` JSON
- 只认可 `confirmed === true`
- 把 `confirmed` 和 `baseDir` 传给 handler

行为：
- 未确认返回 `400`
- 确认后执行真实写回
- 返回 before/after verify 结果和 `writtenArtifacts`

### Route Helper
文件：`src/app/api/share-migration/share-migration-route-helper.ts`

职责：
- 集中处理 dev-only 限制
- 集中定义 response shape
- 集中校验 execute 的确认门槛
- 不碰文件读写，不依赖 `NextResponse`

### Route Contracts
文件：`src/app/api/share-migration/share-migration-contracts.ts`

职责：
- 约束 preview / execute 的 payload 结构
- 提供 `summary`、`notice`、`writtenArtifacts` 等统一字段定义
- 与 UI 面板对齐字段语义，减少前后端分叉

### Route Handlers
文件：`src/app/api/share-migration/route-handlers.ts`

职责：
- 做真正的业务编排
- 接受可注入的 `baseDir`，方便测试用临时目录运行
- 返回 `{ status, body }`，不直接处理 HTTP

Preview 流程：
1. dev-only 校验
2. 读取当前 `public/share/*.json`
3. 调 `syncShareRuntimeArtifactsToLedger(...)`
4. 调 `verifyShareLedgerAgainstRuntime(...)`
5. 返回 `artifactsToRebuild`、`notice`、`summary`

Execute 流程：
1. dev-only 校验
2. 未确认直接拒绝
3. 读取当前 `public/share/*.json`
4. 先做一次 verify，记录 `before`
5. 调 `syncShareRuntimeArtifactsToLedger(...)`
6. 调 `rebuildShareRuntimeArtifactsFromStorage(...)`
7. 写回四份正式产物
8. 再做一次 verify，记录 `after`
9. 返回 `writtenArtifacts`、`artifactsToRebuildBeforeExecute`、`artifactsToRebuildAfterExecute`、`summary`

## UI 设计

### 入口位置
- 不走首页配置弹窗
- 直接接入 `/share` 页面右上角现有操作区
- 采用 **dev-only 按钮 + 页内面板** 形态

### 为什么选按钮 + 面板
- 与 `/share` 当前编辑 / 保存操作区同域，心智负担最低
- 比弹窗更适合持续显示 preview 结果、待重建文件列表和执行摘要
- 不侵入单条目编辑入口（`CreateDialog` / `ShareCard`）

### 面板能力
- `预检查` 按钮
- `执行重建` 按钮
- 执行前确认提示
- 显示：
  - `summary`
  - `artifactsToRebuild`
  - `writtenArtifacts`
  - 执行前/后的 drift 对比

### 文案约束
- 明确说明：
  - 只处理 share 正式产物
  - 不修改 logo 图片
  - 不改变 `/share` 运行时主源

## CLI 设计

文件：`scripts/verify-share-runtime-artifacts.ts`

职责：
- 复用同一套 contract 层能力
- 输出结构化 JSON 摘要
- 用于手工巡检与后续 CI

最小能力：
- verify 成功输出空 drift
- verify 失败输出 `artifactsToRebuild`
- 不修改现有文件

## 错误处理策略

### 非 development
- preview / execute 一律拒绝
- 明确返回 403 与 message

### 缺文件 / 非法 JSON / shape 错误
- 返回结构化错误
- 不能回退成“无需重建”或静默通过

### 未确认 execute
- 明确返回 400
- 不做任何写入

### 写入失败
- 失败信息必须可见
- 当前 phase 不要求实现真正事务文件写入
- 但 summary 需要明确是“写入中断”而不是“验证通过”

## 最小测试矩阵

### Contract Tests
文件：`src/lib/content-db/share-migration-contracts.test.ts`

覆盖：
- `syncShareRuntimeArtifactsToLedger(...)`
- `rebuildShareRuntimeArtifactsFromStorage(...)`
- `verifyShareLedgerAgainstRuntime(...)`
- 稳定排序与 stable stringify
- 清空 `category` / `folderPath` 不残留旧值
- legacy `folder` 处理不制造假 drift

### API Contract Tests
文件：`src/app/api/share-migration/share-migration-contracts.test.ts`

覆盖：
- preview response shape
- execute response shape
- execute 确认门槛
- summary / notice 字段

### Route Handler Tests
文件：`src/app/api/share-migration/route-handlers.test.ts`

覆盖：
- 非 development 拒绝
- preview 返回真实 `artifactsToRebuild`
- execute 未确认 400
- execute 确认后真实写回四产物
- execute 写后 verify 干净

### Route File Tests
文件：`src/app/api/share-migration/route-files.test.ts`

覆盖：
- `GET preview` happy path
- `POST execute` 未确认 400
- `POST execute` 确认 200

### Panel Tests
文件：`src/app/share/components/share-migration-panel.test.tsx`

覆盖：
- 标题与按钮文案
- execute 确认提示
- summary 展示优先级
- 明确说明“不改 logo 文件”

### CLI Tests
文件：`scripts/verify-share-runtime-artifacts.test.ts`

覆盖：
- verify 成功时输出空 drift
- verify 失败时输出 `artifactsToRebuild`
- verify 不修改现有文件

## 分步实施顺序

1. 先实现 `share-migration-contracts.ts`
2. 先补 contract tests，锁定排序 / normalize / verify 语义
3. 再实现 API helper / handler / routes
4. 再补 route handler / route file 测试
5. 最后接 `/share` 页右上角 dev-only 按钮 + 面板
6. 最后补 CLI verify 与脚本测试

## 成功标准

- `/share` 页出现 dev-only 的迁移工具按钮与面板
- preview 返回真实 `artifactsToRebuild`
- execute 只有显式确认后才会写回四产物
- verify 对顺序 / 格式噪声不敏感，对真实 drift 敏感
- 工具链不改变 `/share` 前台运行时主源
- 最小测试矩阵全部通过

## 不做项再确认

- 不改 `/share` 为 DB-first runtime
- 不抽全站通用 migration 平台
- 不处理 logo 图片生命周期
- 不扩 `/share` 的新产品功能
