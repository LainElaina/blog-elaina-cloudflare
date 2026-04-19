# Share Migration Dev Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `/share` 增加 dev-only 的 preview / execute / verify / rebuild 工具链，并保持页面运行时继续消费 `public/share/*` 正式产物。

**Architecture:** 先建立 `share-migration-contracts.ts` 纯函数合同层，收紧 share artifacts 的 verify/normalize/sort 语义，再按 blog migration 的模式接入 API route/helper/handler，最后把 dev-only 按钮+面板接到 `/share` 页右上角，并补 CLI verify 入口。实现过程中坚持 TDD：先写失败测试锁住排序、`updatedAt`、legacy `folder`、response shape、以及 panel 禁用/preview 提示规则，再写最小实现。严格 artifact 读取明确放在 route handler 和 CLI 边界，不放进 contract 层。

**Tech Stack:** Next.js App Router、React 19、TypeScript、Node test runner、现有 share-storage/share-artifacts 层、本地 dev API route、CLI 脚本

---

## File Structure Map

### Contract layer
- Create: `src/lib/content-db/share-migration-contracts.ts`
  - 承载 `syncShareRuntimeArtifactsToLedger(...)`、`rebuildShareRuntimeArtifactsFromStorage(...)`、`verifyShareLedgerAgainstRuntime(...)`
  - 在 contract 内显式包裹现有 `share-storage.ts` / `share-artifacts.ts`，避免直接依赖宽松 merge/fallback 语义
  - **不负责** 严格读取磁盘 JSON、缺文件处理、shape 错误码映射
- Create: `src/lib/content-db/share-migration-contracts.test.ts`
  - 锁定 canonical compare、legacy `folder` 策略、清空字段、round-trip / idempotence、`updatedAt` 去噪

### API layer
- Create: `src/app/api/share-migration/share-migration-api-contracts.ts`
  - 定义 preview / execute 成功与失败响应 shape
- Create: `src/app/api/share-migration/share-migration-api-contracts.test.ts`
  - 锁定 `ok / operation / code / message / writtenArtifactsPartial / shouldRepreview`
- Create: `src/app/api/share-migration/share-migration-route-helper.ts`
  - 处理 dev-only 和 execute 确认门槛
- Create: `src/app/api/share-migration/share-migration-route-helper.test.ts`
  - 测 dev-only / `confirmed === true` 严格门槛
- Create: `src/app/api/share-migration/route-handlers.ts`
  - 真正的 preview / execute 编排、严格读取、顺序写回、写后重读磁盘
- Create: `src/app/api/share-migration/route-handlers.test.ts`
  - 测严格读取、preview drift、execute success、partial write failure
- Create: `src/app/api/share-migration/preview/route.ts`
- Create: `src/app/api/share-migration/execute/route.ts`
- Create: `src/app/api/share-migration/route-files.test.ts`
  - 测 Next route 接线

### Share page UI layer
- Create: `src/app/share/components/share-migration-panel.tsx`
  - dev-only 面板，显示 preview / execute 结果
- Create: `src/app/share/components/share-migration-panel.test.tsx`
  - 测按钮文案、确认提示、编辑态下 execute 禁用、preview 仍可运行、磁盘快照提示
- Modify: `src/app/share/page.tsx`
  - 接入右上角 dev-only 按钮+面板
  - 使用现有状态直接判定 execute 禁用口径：`pageState.isEditMode`、`logoItems`、`renamedUrls`、`draftOnlyUrls`、`deletedPublishedUrls`、`editingAnchorUrls`

### CLI layer
- Create: `scripts/verify-share-runtime-artifacts.ts`
  - 在 CLI 边界负责严格读取磁盘 artifacts，复用 contract 层，输出 JSON 摘要
- Create: `scripts/verify-share-runtime-artifacts.test.ts`
  - 测 exit code 0/1/2、stdout/stderr 分工、无写文件副作用

---

### Task 1: Build failing contract tests for share migration normalization and drift rules

**Files:**
- Create: `src/lib/content-db/share-migration-contracts.test.ts`
- Create: `src/lib/content-db/share-migration-contracts.ts`
- Inspect: `src/lib/content-db/share-storage.ts`
- Inspect: `src/app/share/services/share-artifacts.ts`
- Inspect: `src/lib/content-db/blog-folders.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that prove:
- same semantic runtime artifacts with different JSON whitespace / key order / newline formatting do not drift
- `storage.updatedAt` differences do not drift
- `runtime -> sync -> rebuild -> verify` returns no drift
- repeated rebuild is idempotent
- legacy `folder` precedence matrix is deterministic
- clearing `category` / `folderPath` does not preserve stale values
- canonical compare can report drift without changing runtime write order contract

Example test shape:
```ts
assert.deepEqual(result.artifactsToRebuild, [])
assert.equal(result.normalized.storage.updatedAt, undefined)
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/lib/content-db/share-migration-contracts.test.ts
```
Expected:
- FAIL because `share-migration-contracts.ts` does not exist yet

- [ ] **Step 3: Write minimal contract implementation**

Create `src/lib/content-db/share-migration-contracts.ts` with:
- canonical normalize/stable stringify helpers
- `syncShareRuntimeArtifactsToLedger(...)`
- `rebuildShareRuntimeArtifactsFromStorage(...)`
- `verifyShareLedgerAgainstRuntime(...)`

Important:
- contract functions operate on already-read artifact text / typed inputs
- do **not** put disk strict-read logic or HTTP error mapping here

Start minimal:
```ts
export function verifyShareLedgerAgainstRuntime(...) {
  return {
    artifactsToRebuild: []
  }
}
```
Then fill only what failing tests require.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/lib/content-db/share-migration-contracts.test.ts
```
Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/content-db/share-migration-contracts.ts src/lib/content-db/share-migration-contracts.test.ts
git commit -m "feat: 添加 share 迁移合同层"
```

---

### Task 2: Add failing API contract and helper tests

**Files:**
- Create: `src/app/api/share-migration/share-migration-api-contracts.ts`
- Create: `src/app/api/share-migration/share-migration-api-contracts.test.ts`
- Create: `src/app/api/share-migration/share-migration-route-helper.ts`
- Create: `src/app/api/share-migration/share-migration-route-helper.test.ts`
- Inspect: `src/app/api/blog-migration/blog-migration-contracts.ts`
- Inspect: `src/app/api/blog-migration/blog-migration-route-helper.ts`

- [ ] **Step 1: Write the failing API contract tests**

Add tests that prove:
- preview success body includes `ok`, `operation`, `summary`, `artifactsToRebuild`
- execute success body includes `writtenArtifacts`, `artifactsToRebuildBeforeExecute`, `artifactsToRebuildAfterExecute`
- failure body includes `ok`, `operation`, `code`, `message`
- `WRITE_FAILED` additionally includes `writtenArtifactsPartial` and `shouldRepreview`

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/app/api/share-migration/share-migration-api-contracts.test.ts ./src/app/api/share-migration/share-migration-route-helper.test.ts
```
Expected:
- FAIL because files/functions do not exist yet

- [ ] **Step 3: Write minimal API contracts and helper**

Implement:
- `buildShareMigrationPreviewResponse(...)`
- `buildShareMigrationExecuteSuccessResponse(...)`
- `validateShareMigrationExecuteRequest(...)`
- `enforceDevelopmentOnly(...)`
- helper wrappers that return `{ status, body }`

Make `confirmed === true` strict; reject `"true"`, `1`, `null`, missing fields.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/app/api/share-migration/share-migration-api-contracts.test.ts ./src/app/api/share-migration/share-migration-route-helper.test.ts
```
Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/share-migration/share-migration-api-contracts.ts src/app/api/share-migration/share-migration-api-contracts.test.ts src/app/api/share-migration/share-migration-route-helper.ts src/app/api/share-migration/share-migration-route-helper.test.ts
git commit -m "feat: 添加 share 迁移接口合同与 helper"
```

---

### Task 3: Add failing route handler tests for preview/execute orchestration

**Files:**
- Create: `src/app/api/share-migration/route-handlers.ts`
- Create: `src/app/api/share-migration/route-handlers.test.ts`
- Inspect: `src/app/api/blog-migration/route-handlers.ts`
- Inspect: `public/share/list.json`
- Inspect: `public/share/categories.json`
- Inspect: `public/share/folders.json`
- Inspect: `public/share/storage.json`

- [ ] **Step 1: Write the failing route handler tests**

Cover at minimum:
- preview rejects non-development
- preview returns real `artifactsToRebuild`
- preview returns structured error on missing / invalid / malformed artifacts
- execute rejects unconfirmed requests
- execute writes four artifacts in fixed order
- execute re-reads disk and verifies after write
- execute reports `writtenArtifactsPartial` on simulated mid-write failure

Use an injected `baseDir` with temp files; do not bind tests to `process.cwd()`.

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/app/api/share-migration/route-handlers.test.ts
```
Expected:
- FAIL because `route-handlers.ts` does not exist yet

- [ ] **Step 3: Write minimal route handler implementation**

Implement:
- strict artifact read helpers inside `route-handlers.ts` (or a private helper imported only by route/CLI boundaries)
- `previewRoute({ nodeEnv, baseDir? })`
- `executeRoute({ nodeEnv, confirmed, baseDir? })`
- fixed write order: `list -> categories -> folders -> storage`
- after-write re-read before `verify(after)`
- partial-write tracking for failure response

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/app/api/share-migration/route-handlers.test.ts
```
Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/share-migration/route-handlers.ts src/app/api/share-migration/route-handlers.test.ts
git commit -m "feat: 添加 share 迁移路由编排"
```

---

### Task 4: Add failing route file tests and wire Next API routes

**Files:**
- Create: `src/app/api/share-migration/preview/route.ts`
- Create: `src/app/api/share-migration/execute/route.ts`
- Create: `src/app/api/share-migration/route-files.test.ts`

- [ ] **Step 1: Write the failing route file tests**

Cover:
- `GET /api/share-migration/preview` happy path
- `POST /api/share-migration/execute` without confirmation returns `400`
- `POST /api/share-migration/execute` with confirmation returns `200`

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/app/api/share-migration/route-files.test.ts
```
Expected:
- FAIL because route files do not exist yet

- [ ] **Step 3: Write minimal route files**

Implement thin route adapters only:
- `preview/route.ts` delegates to `previewRoute(...)`
- `execute/route.ts` parses JSON, enforces `confirmed === true`, delegates to `executeRoute(...)`

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/app/api/share-migration/route-files.test.ts
```
Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/share-migration/preview/route.ts src/app/api/share-migration/execute/route.ts src/app/api/share-migration/route-files.test.ts
git commit -m "feat: 接入 share 迁移 API 路由"
```

---

### Task 5: Add failing panel tests and wire `/share` page dev tools panel

**Files:**
- Create: `src/app/share/components/share-migration-panel.tsx`
- Create: `src/app/share/components/share-migration-panel.test.tsx`
- Modify: `src/app/share/page.tsx`
- Inspect: `src/app/(home)/config-dialog/blog-migration-panel.tsx`

- [ ] **Step 1: Write the failing panel tests**

Cover:
- title / preview button / execute button labels
- execute confirm prompt text
- preview summary display priority
- explicit "不改 logo 文件" / "基于当前磁盘快照" messaging
- execute disabled when any v1 dirty signal is present
- preview remains available while execute is disabled during editing/dirty state
- preview in editing/dirty state shows “当前结果不包含未保存编辑”

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/app/share/components/share-migration-panel.test.tsx
```
Expected:
- FAIL because panel component does not exist yet

- [ ] **Step 3: Write minimal panel and `/share` page integration**

Implement:
- `ShareMigrationPanel`
- dev-only button in `/share` page right-side action area
- disabled state derived from existing page state only:
  - `pageState.isEditMode`
  - `logoItems.size`
  - `renamedUrls.size`
  - `draftOnlyUrls.size`
  - `deletedPublishedUrls.size`
  - `editingAnchorUrls.length`
- keep preview callable even when execute is disabled
- preview / execute fetch calls to new API routes

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/app/share/components/share-migration-panel.test.tsx ./src/app/share/share-page-state.test.ts
```
Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/share/components/share-migration-panel.tsx src/app/share/components/share-migration-panel.test.tsx src/app/share/page.tsx
git commit -m "feat: 接入 share 迁移开发工具面板"
```

---

### Task 6: Add failing CLI verify tests and implement script

**Files:**
- Create: `scripts/verify-share-runtime-artifacts.ts`
- Create: `scripts/verify-share-runtime-artifacts.test.ts`
- Inspect: `scripts/verify-db-migration.ts`

- [ ] **Step 1: Write the failing CLI tests**

Cover:
- no drift -> exit `0`
- drift -> exit `1`
- malformed input -> exit `2`
- stdout outputs machine-readable JSON
- stderr outputs human-readable errors
- no file writes occur

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./scripts/verify-share-runtime-artifacts.test.ts
```
Expected:
- FAIL because script does not exist yet

- [ ] **Step 3: Write minimal verify script**

Implement:
- arg parsing for `--base-dir`
- strict artifact reads at the CLI boundary
- call `syncShareRuntimeArtifactsToLedger(...)`
- call `verifyShareLedgerAgainstRuntime(...)`
- JSON summary to stdout
- exit codes 0/1/2

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./scripts/verify-share-runtime-artifacts.test.ts
```
Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-share-runtime-artifacts.ts scripts/verify-share-runtime-artifacts.test.ts
git commit -m "feat: 添加 share 产物校验脚本"
```

---

### Task 7: Run focused verification for the full phase

**Verification boundary rule:**
- Task 7 与 Task 9 只负责验证，不负责顺手改代码或文档
- 如果任一步验证发现问题，必须新增一个独立修复任务，单独提交，然后从 Task 7 重新开始跑验证
- 不允许把“验证中顺手修的补丁”混进文档提交或最终 handoff 阶段

**Files:**
- Verify: `src/lib/content-db/share-migration-contracts.test.ts`
- Verify: `src/app/api/share-migration/share-migration-api-contracts.test.ts`
- Verify: `src/app/api/share-migration/share-migration-route-helper.test.ts`
- Verify: `src/app/api/share-migration/route-handlers.test.ts`
- Verify: `src/app/api/share-migration/route-files.test.ts`
- Verify: `src/app/share/components/share-migration-panel.test.tsx`
- Verify: `scripts/verify-share-runtime-artifacts.test.ts`
- Re-run: existing `src/app/share/share-page-state.test.ts`
- Re-run: existing `src/app/share/services/push-shares.test.ts`

- [ ] **Step 1: Run focused test suite**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test \
  ./src/lib/content-db/share-migration-contracts.test.ts \
  ./src/app/api/share-migration/share-migration-api-contracts.test.ts \
  ./src/app/api/share-migration/share-migration-route-helper.test.ts \
  ./src/app/api/share-migration/route-handlers.test.ts \
  ./src/app/api/share-migration/route-files.test.ts \
  ./src/app/share/components/share-migration-panel.test.tsx \
  ./scripts/verify-share-runtime-artifacts.test.ts \
  ./src/app/share/share-page-state.test.ts \
  ./src/app/share/services/push-shares.test.ts
```
Expected:
- PASS

- [ ] **Step 2: Run CLI smoke check against current repository artifacts**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register ./scripts/verify-share-runtime-artifacts.ts --base-dir=/app/blog-elaina-cloudflare/.worktrees/share-runtime-artifact-closure
```
Expected:
- JSON summary on stdout
- exit `0` or `1` depending on real drift
- no file writes

- [ ] **Step 3: Run development smoke check**

Run:
```bash
corepack pnpm run dev
```
Then manually verify:
- `/share` page shows the dev-only migration tools button
- preview reports current drift from disk snapshot
- preview still works while execute is disabled during active edit/unsaved state
- execute can run after leaving edit mode
- execute only touches share artifacts, not logo files

Expected:
- `/share` loads and the panel works in development

---

### Task 8: Update docs for the new dev tools phase

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Inspect: `docs/specs/2026-04-19-share-migration-dev-tools-design.md`

- [ ] **Step 1: Write the failing doc assertions (mental/document diff)**

Confirm docs are missing:
- `/share` dev-only preview / execute tool entry
- share CLI verify script
- development-only / no-logo-touch guarantees
- how this differs from runtime DB-first

- [ ] **Step 2: Update docs minimally**

Add to `README.md`:
- `/share` dev-only migration tools overview
- four artifacts preview/execute semantics
- strict boundary: runtime still reads `public/share/*`

Add to `CONTRIBUTING.md`:
- exact API/files for share migration tools
- preview / execute / verify responsibilities
- test commands and dirty-state caveats

- [ ] **Step 3: Run focused verification after docs update**

Run:
```bash
git diff -- README.md CONTRIBUTING.md
```
Expected:
- Docs only reflect implemented behavior; no speculative claims

- [ ] **Step 4: Commit**

```bash
git add README.md CONTRIBUTING.md
git commit -m "docs: 补充 share 开发工具使用说明"
```

---

### Task 9: Final branch verification and handoff

**Files:**
- Verify: whole working tree
- Inspect: `git status`
- Inspect: `git log --oneline -10`

- [ ] **Step 1: Re-run final focused suite**

Run the same command from Task 7 Step 1.
Expected:
- PASS

- [ ] **Step 2: Check working tree and commit chain**

Run:
```bash
git status --short
git log --oneline -10
```
Expected:
- Clean working tree
- Coherent commit chain for this phase

- [ ] **Step 3: Summarize manual follow-ups**

Document in handoff message:
- optional `next build` if environment allows
- optional real GitHub-backed execute validation
- any remaining non-blocking dev-only save atomicity caveats
