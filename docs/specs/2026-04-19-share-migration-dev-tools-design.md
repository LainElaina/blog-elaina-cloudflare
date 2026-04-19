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

### 输入边界
- preview / execute / CLI 的唯一输入都是**磁盘上已落盘**的 `public/share/*.json` 四产物
- 本阶段**不读取** `/share` 页当前 React 内存态、未保存编辑态、临时 `logoItems`、未提交草稿或任何页面局部状态
- 如果 `/share` 页面当前处于编辑模式、存在未保存字段修改、或存在待上传 logo，工具面板只做提示；这些状态不属于本阶段工具输入

## 目标架构

本阶段沿用 blog migration 的分层方式，但先做 `/share` 专属版本，不提前抽公共框架。

### 分层结构
- **contract 层**：`src/lib/content-db/share-migration-contracts.ts`
- **API route 层**：
  - `src/app/api/share-migration/preview/route.ts`
  - `src/app/api/share-migration/execute/route.ts`
- **API helper / handler 层**：
  - `src/app/api/share-migration/share-migration-route-helper.ts`
  - `src/app/api/share-migration/share-migration-api-contracts.ts`
  - `src/app/api/share-migration/route-handlers.ts`
- **UI 层**：`src/app/share/components/share-migration-panel.tsx`
- **CLI 层**：`scripts/verify-share-runtime-artifacts.ts`

### 为什么先做专属层
- 当前需求最明确的是 `/share` 开发工具本身，而不是全站框架化
- blog 已有成熟模式，share 按同一骨架落地最快、最稳
- 等 `/share` 跑通后，再看是否抽共享层，能避免过早抽象

### 复用白名单与非目标
- 允许直接复用的能力仅限：
  - `src/lib/content-db/share-storage.ts` 中与 share storage 解析/导出相关的纯函数能力
  - `src/app/share/services/share-artifacts.ts` 中与四产物路径契约、导出内容构建相关的纯函数能力
  - `src/lib/content-db/blog-folders.ts` 中的目录树构建与规范化能力
- **不直接复用**以下内容到 migration contract：
  - `src/app/share/services/push-shares.ts` 中的 GitHub I/O、鉴权、toast、副作用逻辑
  - 任何依赖页面 React state、组件本地状态、或开发态 UI 交互的逻辑
  - 任何仅为当前保存链路宽松兼容而存在的 merge / fallback 语义
- 本阶段目标是“补工具链”，不是顺手重构现有 `/share` 保存/发布实现；若现有 helper 与本阶段 contract 不完全吻合，应在新 contract 层中显式包裹或收紧，而不是直接照搬。
- 尤其是 share migration contract 不能直接依赖现有 `upsert` 的宽松 merge 语义来实现“清空字段不残留旧值”；如有需要，应在 contract 层先做更严格的 canonical patch / normalize，再调用底层 helper。

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
- 保证稳定比较、固定规范化和字段归一化
- 本阶段不改变现有运行时写出语义，只补工具链能力

### `verifyShareLedgerAgainstRuntime(...)`
职责：
- 用“重建结果 vs 当前正式产物”的方式计算 drift
- 返回 `artifactsToRebuild` 等结构化结果
- 不直接输出“假成功”或固定空列表
- 对顺序、格式、对象 key 排列、`updatedAt` 等噪声做归一化去敏感

## 稳定性契约

这是本阶段最重要的新增约束之一。

### 验证目标
- 本阶段的 verify 目标是检测**语义 drift**，不是检测字节级差异
- 因为 `/share` 当前没有独立的显式排序字段，verify 在本阶段把列表 / 对象顺序视为“非主语义噪声”，通过 canonical 排序后再比较
- 如果未来引入明确的 `sortIndex` / 排序语义，verify 契约必须同步收紧

### 规范化与比较方式
- verify 不直接做原始字符串 `!==`
- 必须采用：`parse -> normalize -> stable stringify`
- `updatedAt` 必须在 drift 比较时剔除，不允许成为 preview 长期报错的来源
- 非法 JSON / shape 错误时必须返回错误，不得降级为空 DB 或“无需重建”

### 稳定排序
比较时采用以下 canonical 顺序：
- `list.json`：按 `url` 升序，若相同再按 `name` 升序
- `categories.json`：按 canonical category value 升序
- `folders.json`：节点按 canonical `path` 升序，递归对子节点应用同一规则
- `storage.json`：`shares` 对象按 record key 升序做 stable stringify，同时忽略 `updatedAt`

**重要：上述 canonical 顺序只用于 verify 比较，不直接改变 execute 写回时的运行时展示顺序。**
- execute 写回时必须保持当前 share 正式保存链路已经形成的运行时顺序语义，不能为了“减少 drift”而擅自把 canonical 排序落盘成新的前台展示顺序
- 如果未来希望把 canonical 排序提升为正式运行时顺序，必须在单独 phase 中显式讨论并调整 `/share` 前台契约

### legacy `folder` 策略
本阶段固定 legacy 字段策略如下：
- `folderPath` 是唯一 canonical 目录字段
- 如果 `folderPath` 和 legacy `folder` 同时存在，始终以规范化后的 `folderPath` 为准
- 如果只有 legacy `folder`，则在 **verify / rebuild 输入规范化阶段** 将其映射为临时 canonical `folderPath`
- 运行时产物（`list.json` / `folders.json`）只使用 canonical `folderPath`
- verify 比较时忽略 raw legacy `folder` 的表示差异，只比较 canonical 后的目录语义
- 本阶段不要求清理 storage 里的 legacy `folder` 历史字段，但它不能影响 drift 判断

### 清空语义
- 空白 `category` 与缺失 `category` 归一为同一语义
- 空白 `folderPath` 与缺失 `folderPath` 归一为同一语义
- `upsert` 后不得因“先扩展旧对象再条件覆写”而保留旧值

## 严格 artifact 读取

### 为什么需要严格读取层
- 现有 `parseShareStorageDB(...)` 具备宽松 fallback 语义，适合页面/保存链路容错，不适合作为 migration 工具的最终边界
- migration preview / execute / CLI 不能把非法输入静默解释为“空 DB”或“无需重建”

### 约束
- route handler / CLI 必须先经过严格 artifact 读取与 shape 校验，再进入 contract 层
- 推荐新增内部 `readStrictShareArtifacts(...)` / `validateShareArtifacts(...)` 之类的严格读取包装
- 对于以下情况必须返回结构化错误：
  - 文件缺失
  - 非法 JSON
  - 顶层 shape 不合法
  - `storage.json` 语义不合法

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

### API Contracts
文件：`src/app/api/share-migration/share-migration-api-contracts.ts`

职责：
- 约束 preview / execute 的成功与失败 payload 结构
- 与 UI 面板和 CLI 共用 machine-readable 字段，避免围绕自由文本耦合

#### 成功响应
Preview 成功：
```ts
{
  ok: true
  operation: 'preview'
  summary: string
  notice?: string
  artifactsToRebuild: string[]
}
```

Execute 成功：
```ts
{
  ok: true
  operation: 'execute'
  summary: string
  notice?: string
  writtenArtifacts: string[]
  artifactsToRebuildBeforeExecute: string[]
  artifactsToRebuildAfterExecute: string[]
}
```

#### 失败响应
Preview / Execute 统一失败结构：
```ts
{
  ok: false
  operation: 'preview' | 'execute'
  code:
    | 'DEV_ONLY'
    | 'UNCONFIRMED'
    | 'ARTIFACT_MISSING'
    | 'ARTIFACT_INVALID_JSON'
    | 'ARTIFACT_INVALID_SHAPE'
    | 'WRITE_FAILED'
  message: string
  details?: unknown
  writtenArtifactsPartial?: string[]
  shouldRepreview?: boolean
}
```

### Route Handlers
文件：`src/app/api/share-migration/route-handlers.ts`

职责：
- 做真正的业务编排
- 接受可注入的 `baseDir`，方便测试用临时目录运行
- 返回 `{ status, body }`，不直接处理 HTTP

Preview 流程：
1. dev-only 校验
2. 严格读取当前 `public/share/*.json`
3. 调 `syncShareRuntimeArtifactsToLedger(...)`
4. 调 `verifyShareLedgerAgainstRuntime(...)`
5. 返回 `artifactsToRebuild`、`notice`、`summary`

Execute 流程：
1. dev-only 校验
2. 未确认直接拒绝
3. 严格读取当前 `public/share/*.json`
4. 调 `syncShareRuntimeArtifactsToLedger(...)`
5. 先做一次 `verifyShareLedgerAgainstRuntime(...)`，记录 `before`
6. 调 `rebuildShareRuntimeArtifactsFromStorage(...)`
7. **按固定文件顺序写回**：`list.json -> categories.json -> folders.json -> storage.json`
8. 写回成功后，**重新从磁盘读取**四份正式产物
9. 再做一次 `verifyShareLedgerAgainstRuntime(...)`，记录 `after`
10. 返回 `writtenArtifacts`、`artifactsToRebuildBeforeExecute`、`artifactsToRebuildAfterExecute`、`summary`

约束补充：
- `after` 必须基于写回后重新读取的磁盘状态，而不是仅基于内存里的 rebuilt 结果
- 写回阶段必须显式记录每一步成功的文件路径，供 `writtenArtifacts` / `writtenArtifactsPartial` 使用
- 本阶段不要求事务文件写入，但要求“部分成功写入”是可观察、可回报、可重新 preview 的

## UI 设计

### 入口位置
- 不走首页配置弹窗
- 直接接入 `/share` 页面右上角现有操作区
- 采用 **dev-only 按钮 + 页内面板** 形态

### 为什么选按钮 + 面板
- 与 `/share` 当前编辑 / 保存操作区同域，心智负担最低
- 比弹窗更适合持续显示 preview 结果、待重建文件列表和执行摘要
- 不侵入单条目编辑入口（`CreateDialog` / `ShareCard`）

### 交互约束
- dev-only 按钮固定出现在 `/share` 页右上角开发工具区
- 按钮在浏览态与编辑态都可见
- preview 始终基于磁盘快照，可在编辑态触发，但必须提示“当前结果不包含未保存编辑”
- v1 的 execute 禁用判定口径固定为页面现有状态的以下直接信号：
  - `pageState.isEditMode === true`
  - `logoItems.size > 0`
  - `renamedUrls.size > 0`
  - `draftOnlyUrls.size > 0`
  - `deletedPublishedUrls.size > 0`
  - `editingAnchorUrls.length > 0`
- v1 **不额外引入**新的全局 dirty 聚合状态；若后续需要更细粒度 dirty 模型，另开 phase 讨论
- execute 在上述任一条件满足时必须禁用
- 禁用时提示：`请先保存或取消当前编辑，再执行 share 正式产物重建`
- execute 每次都重新读取磁盘并重新 verify，不依赖上一次 preview 结果
- 面板应显示最近一次操作类型与结果，避免把旧 preview 结果误读成 execute 缓存

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
  - preview 基于当前磁盘快照

## CLI 设计

文件：`scripts/verify-share-runtime-artifacts.ts`

职责：
- 复用同一套 contract 层能力
- 输出结构化 JSON 摘要
- 用于手工巡检与后续 CI

### CLI 约束
- 成功且无 drift：exit code `0`
- 成功执行但发现 drift：exit code `1`
- 输入错误 / 非法 JSON / shape 错误 / 运行时异常：exit code `2`
- 机器可读 JSON 输出走 `stdout`
- 人类可读错误说明走 `stderr`
- verify 不修改现有文件

## 错误处理策略

### 非 development
- preview / execute 一律拒绝
- 明确返回 403 与 `DEV_ONLY`

### 缺文件 / 非法 JSON / shape 错误
- 返回结构化错误
- 不能回退成“无需重建”或静默通过

### 未确认 execute
- 明确返回 400 与 `UNCONFIRMED`
- 不做任何写入

### 写入失败
- 写入异常必须返回非 2xx
- 返回：
  - `ok: false`
  - `code: 'WRITE_FAILED'`
  - `writtenArtifactsPartial`
  - `shouldRepreview: true`
- UI 应提示用户重新执行 preview，不能把失败显示成“验证通过”

## 最小测试矩阵

### Contract Tests
文件：`src/lib/content-db/share-migration-contracts.test.ts`

覆盖：
- `syncShareRuntimeArtifactsToLedger(...)`
- `rebuildShareRuntimeArtifactsFromStorage(...)`
- `verifyShareLedgerAgainstRuntime(...)`
- 同语义不同输入顺序下，verify 结果一致
- 同语义不同 key 顺序 / 缩进 / 空白 / 尾换行下，不报 drift
- `updatedAt` 不制造 drift
- 清空 `category` / `folderPath` 不残留旧值
- legacy `folder` 的 precedence matrix：
  - 只有 `folder`
  - 只有 `folderPath`
  - 同时存在且一致
  - 同时存在但冲突
  - 清空后不被 legacy 字段“复活”
- round-trip / idempotence：
  - `runtime -> sync -> rebuild -> verify` 无 drift
  - 连续 rebuild 两次结果语义一致

### API Contract Tests
文件：`src/app/api/share-migration/share-migration-api-contracts.test.ts`

覆盖：
- preview success response shape
- execute success response shape
- execute 只接受 `confirmed === true`
- 失败响应统一包含 `ok / operation / code / message`
- `WRITE_FAILED` 包含 `writtenArtifactsPartial` 与 `shouldRepreview`

### Route Handler Tests
文件：`src/app/api/share-migration/route-handlers.test.ts`

覆盖：
- 非 development 拒绝
- preview 返回真实 `artifactsToRebuild`
- execute 未确认 400
- execute 明确拒绝 `"true"`、`1`、`null`、缺失字段等 truthy/模糊输入
- preview 在缺文件 / 非法 JSON / shape 错误下返回结构化错误
- execute 确认后真实写回四产物
- execute 写后 verify 干净
- execute 部分写入失败时返回非 2xx 与 partial 信息

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
- 编辑态下 execute 禁用与提示文案
- preview 结果提示“基于当前磁盘快照”

### CLI Tests
文件：`scripts/verify-share-runtime-artifacts.test.ts`

覆盖：
- verify 成功时输出空 drift 且 exit `0`
- verify 发现 drift 时输出 `artifactsToRebuild` 且 exit `1`
- 非法 JSON / shape 错误时 exit `2`
- stdout / stderr 分工稳定
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
