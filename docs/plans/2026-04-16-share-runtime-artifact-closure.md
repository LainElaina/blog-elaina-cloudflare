# Share Runtime Artifact Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `/share` 在继续消费 `public/share/*` 正式产物的前提下，完成双栏导航、分类/目录正式能力、保存链路一致性与文档收口。

**Architecture:** `/share` 运行时继续以 `public/share/list.json` 为页面列表与过滤的直接来源，`categories.json` 负责分类 tabs，`folders.json` 负责目录树，`storage.json` 负责保存链路的完整结构化基底。实现顺序先用失败测试锁定过滤与正式产物契约，再抽离页面纯逻辑、接入 UI、补齐编辑态 category/folderPath 与 URL 冲突校验，最后做真实页面验收与文档更新。

**Tech Stack:** Next.js App Router、React 19、TypeScript、Node test runner、local dev API routes、GitHub API tree/commit write path、现有 share-storage/share-artifacts 导出层

---

## File Structure Map

### Share page runtime and view-model layer
- Create: `src/app/share/share-runtime.ts`
  - 抽出 `/share` 的目录/分类/搜索/标签过滤、空状态与目录树候选逻辑，避免 `page.tsx` 继续膨胀
- Create: `src/app/share/share-runtime.test.ts`
  - 纯逻辑测试：目录主导、分类回退、搜索/标签叠加、空状态语义
- Create: `src/app/share/share-page-state.ts`
  - 抽出 `page.tsx` 的状态编排层，承接 list/categories/folders 三份正式产物、当前筛选状态与编辑上下文
- Create: `src/app/share/share-page-state.test.ts`
  - 验证页面确实消费 `list.json` / `categories.json` / `folders.json`，并锁定目录/分类/编辑上下文状态保持合同
- Modify: `src/app/share/page.tsx`
  - 使用新 view-model，接入双栏布局、目录树、分类 tabs、编辑态上下文保持
- Modify: `src/app/share/grid-view.tsx`
  - 降级为卡片区渲染组件，接收外部过滤结果与筛选控件状态，不再内部私自持有全部主过滤逻辑
- Possibly Create: `src/app/share/folder-tree.tsx`
  - 如果 `page.tsx` 变得过厚，则拆出左侧目录树 UI 组件
- Possibly Create: `src/app/share/category-tabs.tsx`
  - 如果 `page.tsx` 变得过厚，则拆出分类 tabs UI 组件

### Share editing UI and form contract
- Modify: `src/app/share/components/share-card.tsx`
  - 让编辑态支持 `category` / `folderPath`
- Modify: `src/app/share/components/create-dialog.tsx`
  - 新建/编辑 share 时支持 category 输入与 folderPath 选择/新建
- Modify: `src/app/share/page.tsx`
  - 承接 `oldUrl/currentUrl` 编辑会话合同，不再通过 `name` 推断 rename
- Create: `src/app/share/components/share-folder-select.tsx`
  - 复用 blog 的目录选择/新建模式，服务于 share 编辑态
- Create: `src/app/share/components/share-folder-select-view-model.ts`
  - 处理目录选项、新建目录回显、空状态与 representableValue 语义
- Create: `src/app/share/components/share-folder-select-view-model.test.ts`
  - 覆盖 share 目录选择器的纯逻辑契约
- Extend: `src/app/share/share-page-state.test.ts`
  - 覆盖真实 create/edit 字段传递、oldUrl/currentUrl 合同、改名+改 URL 场景，以及 URL 变更时 pending `logoItems` 迁移
- Possibly Create: `src/app/share/components/share-form-types.ts`
  - 若字段扩展使现有 `Share` 类型过于混用，拆出编辑态/运行时共用表单类型

### Share storage and save contract
- Modify: `src/lib/content-db/share-storage.ts`
  - 明确 `category` / `folderPath` 归一化、legacy `folder` 兼容边界、URL 唯一性与冲突语义
- Modify: `src/lib/content-db/share-index.test.ts`
  - 新增 URL 冲突、同批保存 URL 重复、URL swap/rebind 拒绝、删后同批复用 URL 拒绝、category/folderPath 导出与未归档/无分类语义测试
- Modify: `src/app/share/services/share-artifacts.ts`
  - 在导出前执行 URL 冲突校验，并维持四个正式产物一起更新
- Modify: `src/app/share/services/push-shares.ts`
  - 远端保存遵循与本地一致的 URL 锚点/冲突语义与字段导出契约
- Create: `src/app/share/services/push-shares.test.ts`
  - 覆盖远端保存时正式产物与 URL 变更/冲突语义
- Possibly Create: `src/app/share/services/share-save-errors.ts`
  - 若需要统一显式错误消息，集中定义 URL 冲突等保存错误文本

### Docs and verification
- Modify: `README.md`
  - 补充 `/share` 的双栏导航、分类/目录正式能力与正式产物边界
- Modify: `CONTRIBUTING.md`
  - 补充 `/share` 的运行时正式产物、编辑字段、保存一致性与验收建议
- Create: `src/app/(home)/share-consumers.test.ts`
  - 纯 node 测试首页 share consumer 继续只依赖 `public/share/list.json` 的基础列表能力，不回退
- Verify: `public/share/list.json`
- Verify: `public/share/categories.json`
- Verify: `public/share/folders.json`
- Verify: `public/share/storage.json`
  - 作为真实数据样本，必要时随实现一起收口到新契约

---

### Task 1: Add failing runtime tests for `/share` dual-navigation filtering semantics

**Files:**
- Create: `src/app/share/share-runtime.test.ts`
- Create: `src/app/share/share-runtime.ts`
- Inspect: `src/app/share/grid-view.tsx`
- Inspect: `src/app/share/page.tsx`
- Inspect: `public/share/list.json`
- Inspect: `public/share/categories.json`
- Inspect: `public/share/folders.json`

- [ ] **Step 1: Write the failing tests**

Add tests that prove:
- directory is the primary filter axis
- selecting a parent directory includes share items from all descendant folder paths, not just exact path matches
- category tabs only filter within the active directory scope
- search and tag filters apply after directory/category filtering
- switching directory keeps the current category when that category is still valid in the new directory scope
- switching directory resets category to `all` only when the current category is no longer valid
- switching directory preserves the current search term and selected tag
- switching category preserves the current search term and selected tag
- unfiled items appear in all-directory aggregate results but do not create a fake folder node
- uncategorized items appear in `all` results but do not create a dedicated category tab
- empty-state reason is distinguishable (`directory-empty`, `category-empty`, `filter-empty`, `global-empty`)

Example test shape:
```ts
assert.deepEqual(result.visibleItems.map(item => item.url), ['https://alpha.dev'])
assert.equal(result.activeCategory, 'all')
assert.equal(result.emptyState, 'category-empty')
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node --require /app/blog-elaina-cloudflare/test-alias-register.cjs --import jiti/register --test /app/blog-elaina-cloudflare/src/app/share/share-runtime.test.ts
```
Expected:
- FAIL because the share runtime view-model does not exist yet and current filtering semantics only cover search/tag.

- [ ] **Step 3: Write minimal implementation**

Implement `src/app/share/share-runtime.ts` with:
- normalized directory/category helpers
- directory-tree source adapters from `folders.json`
- category candidate calculation from current directory scope
- ordered filtering: directory -> category -> search -> tag
- empty-state classification

Keep it pure; no React hooks or DOM code.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node --require /app/blog-elaina-cloudflare/test-alias-register.cjs --import jiti/register --test /app/blog-elaina-cloudflare/src/app/share/share-runtime.test.ts
```
Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/share/share-runtime.ts src/app/share/share-runtime.test.ts
git commit -m "test: 固化 share 双栏过滤与空状态语义"
```

---

### Task 2: Wire `/share` page to runtime artifacts and dual-navigation layout

**Files:**
- Create: `src/app/share/share-page-state.ts`
- Create: `src/app/share/share-page-state.test.ts`
- Modify: `src/app/share/page.tsx`
- Modify: `src/app/share/grid-view.tsx`
- Possibly Create: `src/app/share/folder-tree.tsx`
- Possibly Create: `src/app/share/category-tabs.tsx`
- Test: `src/app/share/share-runtime.test.ts`
- Test: `src/app/share/share-page-state.test.ts`
- Verify: `src/app/(home)/share-card.tsx`
- Verify: `src/app/(home)/mobile-quick-info.tsx`

- [ ] **Step 1: Write the failing integration-oriented checks**

Add tests that prove:
- `/share` page state consumes `list.json` as the direct card/filter data source
- directory tree consumes `folders.json`
- category tabs consume `categories.json` as candidate source, then narrow by current directory scope
- current filtered context is preserved across edit mode entry/exit
- search/tag UI state still exists after dual-navigation is added
- homepage share card still only depends on the base list behavior and does not regress

Do not rely on checklist-only acceptance here; make `share-page-state.test.ts` the executable gate for the page-level data wiring contract.

- [ ] **Step 2: Run existing focused tests as the red baseline**

Run:
```bash
node --require /app/blog-elaina-cloudflare/test-alias-register.cjs --import jiti/register --test /app/blog-elaina-cloudflare/src/app/share/share-runtime.test.ts /app/blog-elaina-cloudflare/src/app/share/share-page-state.test.ts
```
Expected:
- `share-runtime.test.ts` may already PASS for pure filtering logic once Task 1 lands
- `share-page-state.test.ts` FAILS because page-level artifact consumption and state orchestration do not exist yet.

- [ ] **Step 3: Write minimal page implementation**

Update `page.tsx` to:
- load `initialList` from `public/share/list.json`
- load category candidates from `public/share/categories.json`
- load folder tree from `public/share/folders.json`
- keep edit-mode save orchestration in `page.tsx`
- move directory/category/search/tag filtering to `share-runtime.ts`
- maintain current filtered context through edit mode

Update `grid-view.tsx` to:
- become a presentational card-grid block
- accept already-filtered shares plus search/tag state props from the parent
- stop owning the full main filtering semantics internally

Split out small UI files only if `page.tsx` grows too much.

- [ ] **Step 4: Run focused tests to verify behavior stays green**

Run:
```bash
node --require /app/blog-elaina-cloudflare/test-alias-register.cjs --import jiti/register --test /app/blog-elaina-cloudflare/src/app/share/share-runtime.test.ts /app/blog-elaina-cloudflare/src/app/share/share-page-state.test.ts /app/blog-elaina-cloudflare/src/lib/load-blog.test.ts
```
Expected:
- PASS
- No regression in unrelated runtime-artifact consumer tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/share/page.tsx src/app/share/grid-view.tsx src/app/share/share-runtime.ts src/app/share/share-page-state.ts src/app/share/share-page-state.test.ts
git commit -m "feat: 接入 share 双栏导航与正式产物过滤模型"
```

---

### Task 3: Add category and folderPath editing with share-specific folder selection

**Files:**
- Modify: `src/app/share/components/share-card.tsx`
- Modify: `src/app/share/components/create-dialog.tsx`
- Modify: `src/app/share/page.tsx`
- Create: `src/app/share/components/share-folder-select.tsx`
- Create: `src/app/share/components/share-folder-select-view-model.ts`
- Create: `src/app/share/components/share-folder-select-view-model.test.ts`
- Extend: `src/app/share/share-page-state.test.ts`
- Inspect: `src/app/write/components/ui/folder-select.tsx`
- Inspect: `src/app/write/components/ui/folder-select-view-model.ts`
- Inspect: `src/app/blog/folder-interactions.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that prove:
- share folder selector normalizes created paths like blog (`/设计/图片工具`)
- newly created folder remains representable before runtime artifacts refresh
- empty folder source shows explicit empty message and create button label
- create/edit UI can round-trip `category` and `folderPath`
- create/edit UI carries `oldUrl/currentUrl` explicitly through the editing flow rather than inferring rename from `name`
- category blank input normalizes to undefined rather than a literal sentinel value
- saving an edited share after changing both `name` and `url` still preserves the correct old URL anchor
- changing URL and replacing logo in the same edit session migrates pending `logoItems` to the new URL key before save

Example test shape:
```ts
assert.equal(viewModel.nextValueAfterCreate, '/设计/图片工具')
assert.equal(viewModel.options.some(option => option.value === '/设计/图片工具'), true)
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node --require /app/blog-elaina-cloudflare/test-alias-register.cjs --import jiti/register --test /app/blog-elaina-cloudflare/src/app/share/components/share-folder-select-view-model.test.ts /app/blog-elaina-cloudflare/src/app/share/share-page-state.test.ts
```
Expected:
- FAIL because the share folder selector/view-model does not exist yet and the real create/edit propagation contract is not implemented.

- [ ] **Step 3: Write minimal implementation**

Implement:
- `share-folder-select-view-model.ts` by reusing blog folder normalization semantics
- `share-folder-select.tsx` as a small wrapper component
- `share-card.tsx` edit mode fields for category + folderPath
- `create-dialog.tsx` fields for category + folderPath on create/edit
- an explicit edit-session contract carrying `oldUrl/currentUrl` from UI -> `page.tsx` -> save service, so rename detection never depends on `name`
- a minimal component/integration test target that actually exercises create/edit field propagation instead of only the selector view-model

Do not invent a second folder model; reuse the blog-tested normalization behavior.
Do not keep `name`-based rename inference alive in parallel with the new URL-anchor contract.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node --require /app/blog-elaina-cloudflare/test-alias-register.cjs --import jiti/register --test /app/blog-elaina-cloudflare/src/app/share/components/share-folder-select-view-model.test.ts /app/blog-elaina-cloudflare/src/app/share/share-page-state.test.ts
```
Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/share/page.tsx src/app/share/components/share-card.tsx src/app/share/components/create-dialog.tsx src/app/share/components/share-folder-select.tsx src/app/share/components/share-folder-select-view-model.ts src/app/share/components/share-folder-select-view-model.test.ts src/app/share/share-page-state.test.ts
git commit -m "feat: 支持 share 分类与目录编辑能力"
```

---

### Task 4: Enforce URL conflict rules and four-artifact atomic save semantics

**Files:**
- Modify: `src/lib/content-db/share-storage.ts`
- Modify: `src/lib/content-db/share-index.test.ts`
- Modify: `src/app/share/services/share-artifacts.ts`
- Create: `src/app/share/services/push-shares.test.ts`
- Modify: `src/app/share/services/push-shares.ts`
- Inspect: `src/app/share/page.tsx:97-150`

- [ ] **Step 1: Write the failing tests**

Add tests that prove:
- `list.json` export explicitly carries `category` and `folderPath`
- blank category/folderPath normalize to omitted fields
- new share URL conflicting with existing published URL fails before any payload write
- editing share URL into another existing published URL fails before any payload write
- same-save duplicate target URLs fail as a batch
- URL swap / rebind in one save batch is rejected (e.g. A:`url-a` -> `url-b`, B:`url-b` -> `url-a`)
- deleting one record and reusing its URL for another record in the same save batch is rejected
- conflict failures leave all four share artifacts unchanged
- remote push uses the same save contract as local save

Example assertions:
```ts
assert.throws(() => buildLocalShareSaveFilePayloads(...), /URL 已存在/)
assert.deepEqual(payloads.map(p => p.path), [
  'public/share/list.json',
  'public/share/categories.json',
  'public/share/folders.json',
  'public/share/storage.json'
])
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node --require /app/blog-elaina-cloudflare/test-alias-register.cjs --import jiti/register --test /app/blog-elaina-cloudflare/src/lib/content-db/share-index.test.ts /app/blog-elaina-cloudflare/src/app/share/services/push-shares.test.ts
```
Expected:
- FAIL because URL conflict enforcement and remote-save parity are not fully implemented.

- [ ] **Step 3: Write minimal implementation**

Implement:
- URL conflict validation in the share save/export path
- same-save duplicate target URL validation
- explicit error messages for conflict failure
- `push-shares.ts` parity with local save contract
- preservation of archived/non-published records per current model, without allowing published URL collisions

Keep the failure atomic: do not emit any payloads when conflicts are detected.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node --require /app/blog-elaina-cloudflare/test-alias-register.cjs --import jiti/register --test /app/blog-elaina-cloudflare/src/lib/content-db/share-index.test.ts /app/blog-elaina-cloudflare/src/app/share/services/push-shares.test.ts
```
Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/content-db/share-storage.ts src/lib/content-db/share-index.test.ts src/app/share/services/share-artifacts.ts src/app/share/services/push-shares.ts src/app/share/services/push-shares.test.ts
git commit -m "fix: 收紧 share 正式产物保存与 URL 冲突语义"
```

---

### Task 5: Run focused verification and update repo docs for share closure

**Files:**
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`
- Verify: `public/share/list.json`
- Verify: `public/share/categories.json`
- Verify: `public/share/folders.json`
- Verify: `public/share/storage.json`
- Verify: `/share` runtime via `pnpm run dev`

- [ ] **Step 1: Re-read the approved spec and create a completion checklist**

Checklist must include:
- `/share` runtime still reads `public/share/*`
- dual-navigation is live: directory tree + category tabs
- search + tag filtering still work
- edit/create can maintain `category` and `folderPath`
- `list.json`, `categories.json`, `folders.json`, `storage.json` update together
- URL conflicts fail atomically
- homepage share consumers do not regress
- README / CONTRIBUTING match final behavior

- [ ] **Step 2: Run the focused automated test suites**

Run:
```bash
node --require /app/blog-elaina-cloudflare/test-alias-register.cjs --import jiti/register --test /app/blog-elaina-cloudflare/src/app/share/share-runtime.test.ts /app/blog-elaina-cloudflare/src/app/share/share-page-state.test.ts /app/blog-elaina-cloudflare/src/app/share/components/share-folder-select-view-model.test.ts /app/blog-elaina-cloudflare/src/lib/content-db/share-index.test.ts /app/blog-elaina-cloudflare/src/app/share/services/push-shares.test.ts
```
Expected:
- PASS

- [ ] **Step 3: Run broader regression checks touching shared runtime consumers**

Run:
```bash
node --require /app/blog-elaina-cloudflare/test-alias-register.cjs --import jiti/register --test /app/blog-elaina-cloudflare/src/app/(home)/share-consumers.test.ts /app/blog-elaina-cloudflare/src/lib/load-blog.test.ts /app/blog-elaina-cloudflare/src/app/(home)/config-dialog/blog-migration-panel.test.ts /app/blog-elaina-cloudflare/src/app/api/blog-migration/route-files.test.ts
```
Expected:
- PASS
- Homepage share consumers still only depend on `public/share/list.json`
- No collateral regression in other runtime-artifact-first areas.

- [ ] **Step 4: Update README and CONTRIBUTING**

Document specifically:
- `/share` runtime consumes `public/share/list.json` directly and uses `categories.json` / `folders.json` for navigation
- `storage.json` remains the formal share storage artifact
- editing now supports category input and folder selection/new-folder creation
- URL conflicts fail before writing any share artifact
- manual acceptance should be done through `pnpm run dev`

- [ ] **Step 5: Run manual acceptance in the real dev app**

Run:
```bash
pnpm run dev
```
Then verify in browser:
- `/share` left directory tree works
- category tabs are scoped to current directory
- search/tag still function
- create/edit supports category + folder selection/new folder
- save + refresh preserve data results
- conflicting URL save is rejected with no partial write
- homepage share references still render

- [ ] **Step 6: Run post-doc verification and inspect final repo diff**

Run:
```bash
git diff -- README.md CONTRIBUTING.md && node --require /app/blog-elaina-cloudflare/test-alias-register.cjs --import jiti/register --test /app/blog-elaina-cloudflare/src/app/share/share-runtime.test.ts /app/blog-elaina-cloudflare/src/app/share/share-page-state.test.ts /app/blog-elaina-cloudflare/src/lib/content-db/share-index.test.ts /app/blog-elaina-cloudflare/src/app/(home)/share-consumers.test.ts
```
Expected:
- Doc diff matches final behavior
- Targeted tests PASS

- [ ] **Step 7: Commit**

```bash
git add README.md CONTRIBUTING.md src/app/share src/app/(home)/share-consumers.test.ts public/share src/lib/content-db/share-storage.ts src/lib/content-db/share-index.test.ts
git commit -m "feat: 完成 share 正式产物闭环与双栏导航收口"
```
