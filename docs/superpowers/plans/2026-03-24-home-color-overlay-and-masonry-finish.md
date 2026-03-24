# Home Color Overlay and Masonry Card Finish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为首页增加可选的配色蒙层（默认关闭，支持 atmosphere / solid 两种模式），并补齐图片页瀑布流卡片壳对 classic/refined 卡片风格的跟随。

**Architecture:** 该功能继续沿用 `siteContent.theme` 作为视觉主题配置来源：首页蒙层只在首页背景链路中生效，不进入全站布局逻辑。蒙层渲染通过一个单一职责的背景组件完成，设置面板只更新 `formData.theme` 并复用现有 preview/save/cancel 流程；图片页瀑布流仅补齐卡片壳的背景与边框变量继承，不触碰布局。

**Tech Stack:** Next.js App Router、React 19、TypeScript、Zustand、Motion、Tailwind CSS v4、现有 ConfigDialog / ColorConfig 体系。仓库当前未配置项目级自动化测试框架，本计划以最小改动为原则，验证方式使用 `npm run build` + 手工页面验收。

---

## File Structure

### Create / Write
- Create: `src/layout/backgrounds/home-color-overlay.tsx`
  - 单一职责：首页背景蒙层组件
  - 负责根据 `theme.enableHomeColorOverlay` / `theme.homeColorOverlayMode`、`theme`、`backgroundColors` 输出首页 overlay 层
  - 内部自行判断当前是否为首页，确保其他页面完全不受影响
- Create/Write: `docs/superpowers/plans/2026-03-24-home-color-overlay-and-masonry-finish.md`

### Modify
- Modify: `src/config/site-content.json`
  - 在 `theme` 下新增首页蒙层默认字段
- Modify: `src/app/(home)/config-dialog/color-config.tsx`
  - 新增首页配色蒙层设置组（总开关 + 模式选择）
  - 只更新 `formData.theme`
- Modify: `src/layout/index.tsx`
  - 在现有首页背景链路中接入 `HomeColorOverlay`
- Modify: `src/app/pictures/components/masonry-layout.tsx`
  - 让瀑布流卡片壳的背景 / 边框跟随当前卡片风格变量

### Inspect / Verify
- Inspect: `src/app/(home)/config-dialog/index.tsx`
  - 确认 preview/save/cancel 已能通过 `setSiteContent(formData)` 覆盖首页蒙层配置，无需额外 helper
- Inspect: `src/layout/backgrounds/css-blur-background.tsx`
  - 参考现有 `backgroundColors` 的背景氛围实现，不直接改动除非发现必须抽公共逻辑
- Verify: `package.json`
  - 使用现有 `npm run build` / `npm run dev` 作为验证手段

---

## Task 1: Add persisted homepage overlay theme fields

**Files:**
- Modify: `src/config/site-content.json`
- Inspect: `src/app/(home)/stores/config-store.ts`

- [ ] **Step 1: Add default theme fields**

Edit `src/config/site-content.json` and add these keys under `theme`:

```json
"enableHomeColorOverlay": false,
"homeColorOverlayMode": "atmosphere"
```

Place them next to the other visual theme fields, after `cardStylePreset`.

- [ ] **Step 2: Confirm `SiteContent` inference still works**

Open `src/app/(home)/stores/config-store.ts` and confirm `export type SiteContent = typeof siteContent` still covers the new keys without adding manual types.

Expected outcome:
- no manual interface changes
- later reads can safely use:

```ts
const enableHomeColorOverlay = siteContent.theme?.enableHomeColorOverlay ?? false
const homeColorOverlayMode = siteContent.theme?.homeColorOverlayMode ?? 'atmosphere'
```

- [ ] **Step 3: Do a static sanity read of existing config flow**

Confirm all theme writes still use object spread and won’t break when two new keys exist:

```ts
theme: {
  ...prev.theme,
  someKey: value
}
```

Expected:
- no layout logic touched
- no config migration needed

- [ ] **Step 4: Commit config defaults**

```bash
git add src/config/site-content.json
git commit -m "feat: add homepage overlay theme defaults"
```

---

## Task 2: Add a homepage-only background overlay component

**Files:**
- Create: `src/layout/backgrounds/home-color-overlay.tsx`
- Inspect: `src/layout/backgrounds/css-blur-background.tsx`

- [ ] **Step 1: Create the component shell**

Create `src/layout/backgrounds/home-color-overlay.tsx` with a focused API:

```tsx
'use client'

import { usePathname } from 'next/navigation'
import type siteContent from '@/config/site-content.json'

type Theme = typeof siteContent.theme

interface HomeColorOverlayProps {
  theme?: Theme
  backgroundColors?: string[]
}

export default function HomeColorOverlay({ theme, backgroundColors = [] }: HomeColorOverlayProps) {
  const pathname = usePathname()

  if (pathname !== '/') return null
  if (!(theme?.enableHomeColorOverlay ?? false)) return null

  return null
}
```

The component must early-return for non-home pages and for the default-off state.

- [ ] **Step 2: Implement `atmosphere` mode minimally**

Inside the component, add an `atmosphere` branch that reuses `backgroundColors` and renders a soft tinted overlay layer above the existing blur background, not a replacement.

Implementation direction:

```tsx
const mode = theme?.homeColorOverlayMode ?? 'atmosphere'
const c0 = backgroundColors[0] ?? theme?.colorBrand ?? '#35bfab'
const c1 = backgroundColors[1] ?? theme?.colorBrandSecondary ?? c0

if (mode === 'atmosphere') {
  return (
    <div
      aria-hidden='true'
      className='pointer-events-none fixed inset-0 z-0'
      style={{
        background: `radial-gradient(circle at 20% 80%, ${c0}22 0%, transparent 55%), radial-gradient(circle at 75% 25%, ${c1}1f 0%, transparent 50%)`,
        backdropFilter: 'blur(6px)'
      }}
    />
  )
}
```

Requirements:
- soft tint only
- keep background image detail visible
- no content coverage

- [ ] **Step 3: Implement `solid` mode minimally**

Add a solid branch that derives a semi-transparent overlay from theme colors.

Implementation direction:

```tsx
const solidColor = theme?.colorBrand ?? '#35bfab'

return (
  <div
    aria-hidden='true'
    className='pointer-events-none fixed inset-0 z-0'
    style={{
      backgroundColor: `${solidColor}26`
    }}
  />
)
```

If the direct hex+alpha approach is awkward because the color may not be 6-digit hex, normalize to a safe fallback rather than adding a broad color utility system.

- [ ] **Step 4: Keep the component single-purpose**

Do not add:
- intensity slider props
- global page support
- extra configuration fields
- helper abstractions unless there is actual duplication

Expected outcome:
- one small component
- two simple rendering branches
- homepage-only behavior enforced inside the component

- [ ] **Step 5: Build mental z-index sanity check**

Before wiring it in, confirm the component is intended to sit:
- above background image / blur blobs
- below `<main className='relative z-10 h-full'>`

Expected:
- no overlap with interactive content
- no pointer-event changes needed beyond `pointer-events-none`

- [ ] **Step 6: Commit overlay component**

```bash
git add src/layout/backgrounds/home-color-overlay.tsx
git commit -m "feat: add homepage color overlay component"
```

---

## Task 3: Wire homepage overlay into the existing background chain

**Files:**
- Modify: `src/layout/index.tsx`
- Inspect: `src/layout/backgrounds/css-blur-background.tsx`

- [ ] **Step 1: Import the new component**

In `src/layout/index.tsx`, add:

```tsx
import HomeColorOverlay from './backgrounds/home-color-overlay'
```

- [ ] **Step 2: Render it in the background stack**

Render the component immediately after `CssBlurBackground` and before content/UI layers:

```tsx
<CssBlurBackground colors={siteContent.backgroundColors} />
<HomeColorOverlay theme={siteContent.theme} backgroundColors={siteContent.backgroundColors} />
```

- [ ] **Step 3: Do not move existing layout nodes**

Keep all of these structurally unchanged:
- background image block
- `CssBlurBackground`
- `GlobalErrorHandler`
- `LogWindow`
- `LogButton`
- `<main className='relative z-10 h-full'>`
- desktop/mobile nav and music card logic

Expected:
- only one extra background visual layer added
- homepage layout behavior unchanged

- [ ] **Step 4: Verify existing preview/save/cancel flow is enough**

Read `src/app/(home)/config-dialog/index.tsx` and confirm no extra runtime helper is required:
- `handlePreview()` already calls `setSiteContent(formData)`
- `handleSave()` / `handleLocalSave()` persist `formData`
- `handleCancel()` restores `originalData`

Expected:
- homepage overlay follows `siteContent.theme`
- no custom DOM attribute helper like card style preset is needed

- [ ] **Step 5: Run a build verification**

Run:

```bash
npm run build
```

Expected:
- build succeeds
- no type errors from new theme fields or component props

- [ ] **Step 6: Commit layout wiring**

```bash
git add src/layout/index.tsx
git commit -m "feat: wire homepage color overlay into layout"
```

---

## Task 4: Add homepage overlay controls to the color settings panel

**Files:**
- Modify: `src/app/(home)/config-dialog/color-config.tsx`

- [ ] **Step 1: Read current theme values with fallbacks**

Near the existing `cardStylePreset` read, add:

```ts
const enableHomeColorOverlay = theme.enableHomeColorOverlay ?? false
const homeColorOverlayMode = theme.homeColorOverlayMode ?? 'atmosphere'
```

- [ ] **Step 2: Add the toggle handler**

Add a focused handler:

```ts
const handleHomeColorOverlayToggle = (value: boolean) => {
  setFormData(prev => ({
    ...prev,
    theme: {
      ...prev.theme,
      enableHomeColorOverlay: value
    }
  }))
}
```

- [ ] **Step 3: Add the mode handler**

Add a second focused handler:

```ts
const handleHomeColorOverlayModeChange = (value: 'atmosphere' | 'solid') => {
  setFormData(prev => ({
    ...prev,
    theme: {
      ...prev.theme,
      homeColorOverlayMode: value
    }
  }))
}
```

- [ ] **Step 4: Render the new settings group**

Insert a new section in the color page near the existing visual theme controls, after the card style section.

Implementation direction:

```tsx
<div className='space-y-3'>
  <label className='block text-sm font-medium'>首页配色蒙层</label>

  <div className='flex gap-3'>
    <button type='button' ...>关闭</button>
    <button type='button' ...>开启</button>
  </div>

  <div className={enableHomeColorOverlay ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-2 gap-3 opacity-50 pointer-events-none'}>
    <button type='button' ...>氛围染色</button>
    <button type='button' ...>纯色蒙版</button>
  </div>
</div>
```

Requirements:
- selected state must be visually obvious
- mode buttons must look disabled/weak when overlay is off
- only mutate `formData.theme`
- visual changes should still be applied through the existing 预览 / 保存 flow, not by adding new immediate DOM-write logic

- [ ] **Step 5: Keep the interaction model minimal**

Do not add:
- sliders
- color pickers for overlay
- third mode
- per-page options

Expected:
- one toggle group
- one mode group
- behavior matches the approved spec exactly

- [ ] **Step 6: Run a build verification**

Run:

```bash
npm run build
```

Expected:
- build succeeds
- no TypeScript errors from the new theme keys or handlers

- [ ] **Step 7: Commit settings UI**

```bash
git add src/app/(home)/config-dialog/color-config.tsx src/config/site-content.json
git commit -m "feat: add homepage overlay controls"
```

---

## Task 5: Finish the masonry card shell so it follows card style presets

**Files:**
- Modify: `src/app/pictures/components/masonry-layout.tsx`

- [ ] **Step 1: Keep the existing radius binding**

Preserve:

```tsx
borderRadius: 'var(--card-inner-radius)'
```

Do not alter the masonry columns layout, image loading, hover zoom, or edit mode behavior.

- [ ] **Step 2: Replace hard-coded shell background with card variable**

Change:

```tsx
background: 'rgba(255,255,255,0.3)'
```

to follow the active card preset, for example:

```tsx
background: 'var(--card-bg)'
```

If `var(--card-bg)` feels too heavy in visual review, use a derived lighter version only if absolutely necessary. Prefer direct reuse first.

- [ ] **Step 3: Replace hard-coded shell border with card variable**

Change:

```tsx
border: '1px solid rgba(255,255,255,0.15)'
```

to:

```tsx
border: '1px solid var(--card-border-color)'
```

- [ ] **Step 4: Leave non-card UI alone**

Do not change:
- description gradient overlay
- delete button styling
- hover scale behavior
- masonry columns count / spacing

Expected:
- only the card shell follows classic/refined
- no layout or interaction changes

- [ ] **Step 5: Run a build verification**

Run:

```bash
npm run build
```

Expected:
- build succeeds
- no rendering/type regressions

- [ ] **Step 6: Commit masonry finish**

```bash
git add src/app/pictures/components/masonry-layout.tsx
git commit -m "fix: align masonry cards with card style preset"
```

---

## Task 6: Manually verify homepage overlay and card-style finish

**Files:**
- Verify only

- [ ] **Step 1: Start the dev server**

Run:

```bash
npm run dev
```

Expected:
- local dev server starts on port 2025
- homepage and settings dialog are reachable

- [ ] **Step 2: Verify default behavior on first load**

Open the homepage before changing settings.

Expected:
- homepage overlay is off by default
- homepage still looks like the current version
- homepage layout is unchanged
- no cards move, resize, or reflow

- [ ] **Step 3: Verify homepage overlay toggle UI**

Open 网站设置 → 色彩配置.

Expected:
- a new “首页配色蒙层” group is visible
- 开 / 关 state is obvious
- 模式 buttons are visible and disabled/weak when overlay is off

- [ ] **Step 4: Verify atmosphere mode**

Enable homepage overlay and select “氛围染色”. Then preview/save according to the existing dialog flow.

Expected:
- only homepage gains a softer, color-led tint
- background image remains visible
- no non-home pages change

- [ ] **Step 5: Verify solid mode**

Switch to “纯色蒙版” and preview/save.

Expected:
- homepage gains a steadier, more direct semi-transparent color veil
- content remains readable
- no layout changes occur

- [ ] **Step 6: Verify cancel restores original state**

Open settings, change overlay toggle/mode, then press 取消.

Expected:
- homepage returns to the original overlay state from when the dialog opened
- no preview state remains stuck

- [ ] **Step 7: Verify save persists after refresh**

Turn the feature on, save, refresh the homepage.

Expected:
- the saved overlay mode persists
- re-opening settings shows the saved state

- [ ] **Step 8: Verify non-home pages remain untouched**

Visit:
- 博客详情页
- 图片页
- share / projects / bloggers
- about / snippets

Expected:
- homepage overlay never appears on those pages
- existing visuals remain unchanged except the masonry card shell on 图片页 now follows classic/refined

- [ ] **Step 9: Verify classic/refined still affect masonry shell**

On 图片页, switch card style between classic and refined.

Expected:
- masonry card shell radius/background/border now follow the preset
- image grid layout remains unchanged

---

## Task 7: Final cleanup and lightweight regression pass

**Files:**
- Modify only if verification finds issues

- [ ] **Step 1: Fix only issues discovered during verification**

If anything looks wrong, limit fixes to:
- overlay opacity / tint balance
- homepage-only guard
- masonry shell variable usage

Do not expand scope.

- [ ] **Step 2: Run the final build**

Run:

```bash
npm run build
```

Expected:
- build succeeds cleanly

- [ ] **Step 3: Do a final homepage safety pass**

Re-check the homepage after all fixes.

Expected:
- no layout damage
- no new positioning regressions
- homepage cards remain exactly where they were

- [ ] **Step 4: Commit the final polish**

```bash
git add src/config/site-content.json src/layout/index.tsx src/layout/backgrounds/home-color-overlay.tsx src/app/(home)/config-dialog/color-config.tsx src/app/pictures/components/masonry-layout.tsx
git commit -m "feat: add homepage color overlay options"
```
