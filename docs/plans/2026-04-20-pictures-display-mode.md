# Pictures Display Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `/pictures` 保持默认相纸布局，并新增一个仅影响访客当前会话的显示模式切换，在 `RandomLayout` 与 `MasonryLayout` 之间切换。

**Architecture:** 继续以 `src/app/pictures/page.tsx` 作为页面状态编排入口，但把可测试的布局切换 UI 与渲染分支抽到一个无 hooks 的 `PicturesPageView` 里，避免在 Node test 里直接挂载依赖 `next/navigation`、Zustand store 和浏览器尺寸 hooks 的默认页面组件。显示模式状态机单独放在 `display-mode.ts`，通过 `preferredDisplayMode` / `effectiveDisplayMode` 和 `sessionStorage` 明确表达“桌面浏览态可切换、编辑态强制 random、移动端强制 random、且不写入图片内容/服务端状态”的边界。

**Tech Stack:** Next.js App Router、React 19、TypeScript、motion/react、Node test runner、`react-dom/server`、现有 `RandomLayout` / `MasonryLayout` 组件、`sessionStorage`

---

## File Structure Map

### State machine layer
- Create: `src/app/pictures/display-mode.ts`
  - 定义 `PicturesDisplayMode = 'random' | 'masonry'`
  - 提供 `normalizePicturesDisplayMode(...)`
  - 提供 `resolvePicturesEffectiveDisplayMode(...)`
  - 提供 `PICTURES_DISPLAY_MODE_SESSION_STORAGE_KEY` 与小型读写 helper，明确“仅 sessionStorage”边界
- Create: `src/app/pictures/display-mode.test.ts`
  - 锁住默认值、非法存储值回退、桌面/编辑态/移动端状态机、`sessionStorage` 边界

### Page orchestration layer
- Modify: `src/app/pictures/page.tsx`
  - 保持默认页面入口与现有上传/删除/保存链路
  - 读取/写入 `sessionStorage`
  - 维护 `preferredDisplayMode`
  - 推导 `effectiveDisplayMode`
  - 负责移动端检测、编辑态切换、router/store 接线
  - 把可测试的展示 props 传给 `PicturesPageView`

### Hook-free view layer
- Create: `src/app/pictures/page-view.tsx`
  - 导出无 hooks 的 `PicturesPageView`
  - 渲染右上角访客模式切换组与既有编辑按钮区
  - 根据 `effectiveDisplayMode` 选择 `RandomLayout` 或 `MasonryLayout`
  - 保持切换入口独立于 `hideEditButton`
  - 展示编辑态禁用文案
  - 为测试提供可注入的 layout renderers 或等价的轻量 seam，避免在测试中直接跑 `RandomLayout` / `MasonryLayout` 的浏览器依赖

### Existing layout components reused as-is
- Reuse: `src/app/pictures/components/random-layout.tsx`
  - 继续承担默认相纸布局、拖拽、放大、详情展示
  - 本 phase 不改其已有 `localStorage` 偏移逻辑
- Reuse: `src/app/pictures/components/masonry-layout.tsx`
  - 作为访客可切换的备选浏览布局
  - 不承担偏好持久化职责

### Test layer
- Create: `src/app/pictures/page.test.tsx`
  - 用 `renderToStaticMarkup(...)` + 直接检查 `PicturesPageView` 返回的元素树，验证文案、desktop-only class contract、按钮可用性、布局分支与回调边界
  - 不直接挂载默认 `Page`，从而避免 Next/router/Zustand/browser-size mocking 噪音

---

### Task 1: Build the pictures display mode state machine

**Files:**
- Create: `src/app/pictures/display-mode.ts`
- Create: `src/app/pictures/display-mode.test.ts`

- [ ] **Step 1: Write the failing tests**

Add tests that prove:
- default `preferredDisplayMode` normalizes to `random`
- invalid stored values fall back to `random`
- desktop browse mode resolves to `preferredDisplayMode`
- edit mode forces `effectiveDisplayMode` to `random`
- mobile viewport forces `effectiveDisplayMode` to `random` even if `preferredDisplayMode === 'masonry'`
- display mode preference is modeled as a `sessionStorage` concern only, via an explicit storage key/helper rather than `localStorage` or content-data writes

Example test shape:
```ts
assert.equal(resolvePicturesEffectiveDisplayMode({
  preferredDisplayMode: 'masonry',
  isEditMode: false,
  isMobile: true
}), 'random')
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/app/pictures/display-mode.test.ts
```
Expected:
- FAIL because `display-mode.ts` does not exist yet

- [ ] **Step 3: Write minimal state-machine implementation**

Implement in `src/app/pictures/display-mode.ts`:
- `type PicturesDisplayMode = 'random' | 'masonry'`
- `normalizePicturesDisplayMode(...)`
- `resolvePicturesEffectiveDisplayMode(...)`
- `PICTURES_DISPLAY_MODE_SESSION_STORAGE_KEY`
- the smallest read/write helpers needed to keep the session-only boundary explicit

Start minimal:
```ts
export function normalizePicturesDisplayMode() {
  return 'random'
}
```
Then fill only what failing tests require.

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/app/pictures/display-mode.test.ts
```
Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/pictures/display-mode.ts src/app/pictures/display-mode.test.ts
git commit -m "feat: 添加 pictures 显示模式状态机"
```

---

### Task 2: Add a testable visitor toggle view for /pictures

**Files:**
- Create: `src/app/pictures/page-view.tsx`
- Create: `src/app/pictures/page.test.tsx`
- Modify: `src/app/pictures/page.tsx`

- [ ] **Step 1: Write the failing UI tests**

Add tests against `PicturesPageView` that prove:
- the top-right visitor toggle group renders `相纸` and `瀑布`
- `相纸` is active by default
- `hideEditButton === true` still leaves the visitor toggle visible
- edit mode disables the toggle and shows copy like `编辑态固定使用相纸模式`
- the toggle group keeps the desktop-only visibility contract via the existing `max-sm:hidden`-style class hook, without turning “server-rendered markup must disappear on mobile” into a test requirement
- selecting `瀑布` only triggers the display-mode callback / session-preference path, and does not trigger save/upload/delete callbacks

Example assertion:
```ts
assert.match(markup, /相纸/)
assert.match(markup, /瀑布/)
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/app/pictures/page.test.tsx
```
Expected:
- FAIL because the view and toggle UI do not exist yet

- [ ] **Step 3: Write minimal UI integration**

Implement in `src/app/pictures/page-view.tsx` and `src/app/pictures/page.tsx`:
- a hook-free `PicturesPageView`
- a separate visitor-facing mode toggle group in the top-right area
- no overlap with the existing edit/upload/save buttons
- active styling for the selected display mode
- disabled state/copy for edit mode
- the same desktop-only class contract used by the existing top-right controls
- page-level wiring that passes the toggle callback independently from `hideEditButton`

Important:
- keep the visitor toggle independent from `hideEditButton`
- do not let the toggle write to picture content, config files, or save-chain callbacks
- keep the page’s upload/save/delete flows behaviorally unchanged

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/app/pictures/page.test.tsx
```
Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/pictures/page.tsx src/app/pictures/page-view.tsx src/app/pictures/page.test.tsx
git commit -m "feat: 接入 pictures 访客布局切换入口"
```

---

### Task 3: Switch actual rendering between RandomLayout and MasonryLayout

**Files:**
- Modify: `src/app/pictures/page.tsx`
- Modify: `src/app/pictures/page-view.tsx`
- Test: `src/app/pictures/page.test.tsx`
- Inspect: `src/app/pictures/components/random-layout.tsx`
- Inspect: `src/app/pictures/components/masonry-layout.tsx`

- [ ] **Step 1: Write the failing rendering tests**

Add tests that prove:
- desktop browse mode renders `RandomLayout` by default
- after switching to `masonry`, the page view renders `MasonryLayout`
- entering edit mode from `masonry` switches effective rendering back to `RandomLayout`
- leaving edit mode restores the previously chosen desktop preference
- mobile mode keeps rendering `RandomLayout` even if `preferredDisplayMode === 'masonry'`
- returning from mobile to desktop can resume the previously chosen `masonry` preference

Example test shape:
```ts
assert.equal(result.layoutKind, 'random')
assert.equal(result.layoutKind, 'masonry')
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/app/pictures/page.test.tsx
```
Expected:
- FAIL because the page still renders only one layout path

- [ ] **Step 3: Write minimal rendering switch**

Implement in `src/app/pictures/page.tsx` and `src/app/pictures/page-view.tsx`:
- restore `preferredDisplayMode` from `sessionStorage` on mount
- keep `preferredDisplayMode` in sync with `sessionStorage` for this tab/session only
- derive `effectiveDisplayMode` from `preferredDisplayMode`, `isEditMode`, and `isMobile`
- `effectiveDisplayMode === 'random'` -> `<RandomLayout ... />`
- `effectiveDisplayMode === 'masonry'` -> `<MasonryLayout ... />`
- preserve current edit callbacks and edit-mode props where relevant

Important:
- keep the `RandomLayout` drag-offset `localStorage` behavior untouched
- do not refactor `RandomLayout` or `MasonryLayout` internals unless a tiny compatibility fix is strictly needed
- keep the mobile rule in the state machine; do not rely on copy-only enforcement

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/app/pictures/display-mode.test.ts ./src/app/pictures/page.test.tsx
```
Expected:
- PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/pictures/display-mode.ts src/app/pictures/page.tsx src/app/pictures/page-view.tsx src/app/pictures/page.test.tsx
git commit -m "feat: 支持 pictures 访客布局切换"
```

---

### Task 4: Run focused verification for the /pictures phase

**Verification boundary rule:**
- This task verifies only; do not slip extra fixes into this step
- If verification finds issues, create a separate fix task and commit before re-running verification
- Do not start the dev server in this session; hand off the manual smoke command to the user instead

**Files:**
- Verify: `src/app/pictures/display-mode.ts`
- Verify: `src/app/pictures/display-mode.test.ts`
- Verify: `src/app/pictures/page.tsx`
- Verify: `src/app/pictures/page-view.tsx`
- Verify: `src/app/pictures/page.test.tsx`
- Re-check: `src/app/pictures/components/random-layout.tsx`
- Re-check: `src/app/pictures/components/masonry-layout.tsx`

- [ ] **Step 1: Run focused automated tests**

Run:
```bash
node --require ./test-alias-register.cjs --import jiti/register --test ./src/app/pictures/display-mode.test.ts ./src/app/pictures/page.test.tsx
```
Expected:
- PASS

- [ ] **Step 2: Prepare the manual smoke checklist**

Hand off this command for the user to run on their machine:
```bash
corepack pnpm run dev
```
Then ask them to verify:
- `/pictures` defaults to the photo-paper layout
- desktop visitor can switch to `瀑布`
- refresh in the same session keeps the chosen mode
- mobile view stays on photo-paper layout
- entering edit mode from `瀑布` forces the page back to photo-paper layout
- leaving edit mode restores the prior desktop preference
- the visitor toggle remains visible even when the edit button is hidden

Expected:
- `/pictures` loads and the toggle works as designed

- [ ] **Step 3: Check working tree status**

Run:
```bash
git status --short
```
Expected:
- Only the intended changes for this phase remain

- [ ] **Step 4: Summarize follow-ups**

Document in the handoff message:
- optional broader UI regression checks across `/pictures`
- whether mobile needs a dedicated toggle in a future phase
