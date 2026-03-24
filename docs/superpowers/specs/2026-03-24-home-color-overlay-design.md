# 2026-03-24 首页配色蒙层可选恢复设计

## 背景

在前端优化前，首页的整体氛围会明显受到配色影响。当前项目中，这种“首页被配色染上一层颜色”的感觉，主要来自首页背景层里由 `backgroundColors` 驱动的彩色模糊背景：

- `src/layout/index.tsx` 会在首页背景链路中渲染 `CssBlurBackground`
- `src/layout/backgrounds/css-blur-background.tsx` 会根据 `siteContent.backgroundColors` 生成 4 个彩色模糊 blob

用户希望把这种“首页配色蒙层感”加回来，并做成可选项，同时新增一种更直接的“纯色蒙版”模式。

重要约束：
- **只作用首页**
- **默认关闭**
- **不改首页布局，不动卡片坐标、尺寸、顺序与拖拽逻辑**
- **只增加背景视觉层，不改卡片本身样式逻辑**

---

## 目标

在网站设置 → 配色/主题页中新增“首页配色蒙层”设置，满足：

1. 仅首页生效
2. 默认关闭
3. 支持实时预览
4. 保存后写回现有站点配置文件
5. 支持两种模式：
   - `atmosphere`：氛围染色
   - `solid`：纯色蒙版
6. 不影响其他页面
7. 不影响任何首页布局逻辑

---

## 设计原则

### 1. 蒙层属于视觉主题的一部分
“首页配色蒙层”本质上是主题视觉效果，不是布局配置，因此应放在：

- `siteContent.theme`

与现有主题字段并列管理。

### 2. 只新增背景层，不碰布局层
本次改动只允许：
- 调整首页背景视觉叠层
- 新增首页 overlay 层
- 控制 overlay 的开关与模式

不允许触碰：
- 首页卡片排布
- 卡片位置、尺寸、顺序
- 拖拽逻辑
- 首页组件树结构中的布局职责

### 3. 保持当前站点为默认行为
由于默认值是关闭，因此上线后：
- 当前首页视觉效果保持不变
- 只有用户主动打开后才会出现新的首页配色蒙层

### 4. 两种模式都应复用现有主题数据
不新增独立的“蒙层颜色配置器”。
颜色来源应优先复用现有主题字段或现有 `backgroundColors`：
- `atmosphere` 复用 `backgroundColors`
- `solid` 由现有主题色推导

这样可以避免配置膨胀。

---

## 数据结构设计

在 `src/config/site-content.json` 的 `theme` 下新增：

```json
"theme": {
  "colorBrand": "#35bfab",
  "colorPrimary": "#334f52",
  "colorSecondary": "#7b888e",
  "colorBrandSecondary": "#1fc9e7",
  "colorBg": "#eeeeee",
  "colorBorder": "#ffffff",
  "colorCard": "#ffffff66",
  "colorArticle": "#ffffffcc",
  "cardStylePreset": "classic",
  "enableHomeColorOverlay": false,
  "homeColorOverlayMode": "atmosphere"
}
```

### 字段定义

```ts
enableHomeColorOverlay: boolean
homeColorOverlayMode: 'atmosphere' | 'solid'
```

### 默认行为
- `enableHomeColorOverlay` 默认 `false`
- `homeColorOverlayMode` 默认 `atmosphere`
- 当配置缺失时：
  - `enableHomeColorOverlay` 按 `false` 处理
  - `homeColorOverlayMode` 按 `atmosphere` 处理

---

## 运行时实现设计

### 生效范围
该功能 **仅在首页生效**。

实现位置应放在首页现有背景链路附近，而不是放到全站根布局中全局生效。

当前首页背景链路位于：
- `src/layout/index.tsx`

现有顺序大致为：
1. 背景图层
2. `CssBlurBackground`
3. 首页内容

本次建议扩展为：
1. 背景图层
2. `CssBlurBackground`
3. 首页配色 overlay 层（仅在开启时渲染）
4. 首页内容

### 模式一：`atmosphere`
目标是恢复“首页整体被配色轻微染色”的旧感觉。

实现策略：
- 不重做一套新背景系统
- 继续复用 `backgroundColors` 的色彩来源
- 在现有背景之上增加一层更轻的氛围染色 overlay
- overlay 形态可以是渐变 / 模糊渐变层，而不是实心纯色

视觉目标：
- 首页整体更吃主题配色
- 保留背景图细节
- 比纯色蒙版更柔和、更空气感

### 模式二：`solid`
目标是提供一个更稳定、更直接的“蒙上一层颜色”的效果。

实现策略：
- 新增固定 overlay 层
- 用主题色推导半透明背景色
- 不允许覆盖内容层

建议颜色来源：
- 优先使用 `theme.colorBrand` 与 `theme.colorBg` 做轻量混合
- 最终输出为较低透明度的半透明色层

视觉目标：
- 效果简单直接
- 用户容易理解
- 不会过度污染页面内容区域

---

## 设置面板设计

### 入口位置
放在：
- **网站设置 → 配色/主题页**

### UI 形式
新增一个“首页配色蒙层”设置组，包含：

1. **总开关**
   - 开 / 关
2. **模式选择**
   - 氛围染色
   - 纯色蒙版

### 交互规则
- 当总开关关闭时：
  - 首页保持当前效果
  - 模式选择可禁用或弱化显示
- 当总开关开启时：
  - 模式选择生效
  - 切换后实时预览首页视觉效果

### 为什么不用单个下拉框
虽然“关闭 / 氛围染色 / 纯色蒙版”也能实现，但：
- 可读性略差
- “是否开启”和“具体模式”耦合在一起

总开关 + 模式选择更清晰，也更符合现有设置页的认知方式。

---

## 预览、保存与取消逻辑

### 预览
切换开关或模式时：
- 只更新 `formData.theme`
- 沿用现有设置面板的预览流
- 页面实时反映首页配色蒙层效果

### 保存
保存时：
- 与现有主题配置一起写回 `site-content.json`
- 不修改布局配置
- 不触碰卡片样式配置文件

### 取消
取消时：
- 恢复打开设置前的原始 `siteContent`
- 恢复原始首页蒙层状态
- 保证预览态不残留

---

## 影响范围

### 受影响
- 首页背景视觉层
- 配色/主题设置面板
- `site-content.json` 中的主题配置

### 不受影响
- 博客页
- 图片页
- share / projects / bloggers / about / snippets 等页面
- 首页卡片布局
- 卡片风格切换逻辑

---

## 需要修改的文件

### 核心文件
- `src/config/site-content.json`
- `src/app/(home)/config-dialog/index.tsx`
- `src/app/(home)/config-dialog/color-config.tsx`
- `src/layout/index.tsx`
- `src/layout/backgrounds/css-blur-background.tsx`（如果需要抽取或复用颜色逻辑）

### 可选新增文件
如果为了隔离职责更清晰，可以新增一个首页背景 overlay 组件，例如：
- `src/layout/backgrounds/home-color-overlay.tsx`

该组件职责应保持单一：
- 只负责根据主题配置渲染首页配色 overlay

---

## 风险与应对

### 风险 1：首页视觉过重，影响可读性
**应对：**
- 使用保守透明度
- overlay 仅叠在背景层，不覆盖内容层

### 风险 2：与背景图冲突，导致页面发灰或发脏
**应对：**
- `atmosphere` 模式使用更柔和的渐变染色
- `solid` 模式使用较低透明度
- 默认关闭

### 风险 3：错误扩散到全站
**应对：**
- 只在首页背景链路中渲染 overlay
- 不放到全局根布局通用逻辑里

### 风险 4：设置预览 / 取消状态不一致
**应对：**
- 沿用当前主题预览逻辑
- 只通过 `formData.theme` 驱动
- 在保存 / 取消流程中统一恢复与应用

---

## 非目标

本次不做：
- 全站统一蒙层系统
- 第三种以上蒙层模式
- 单独的蒙层颜色选择器
- 蒙层强度滑杆
- 对卡片、正文、按钮做连带视觉重构

---

## 最终建议

采用如下定稿方案：

- **作用范围**：仅首页
- **默认值**：关闭
- **入口位置**：网站设置 → 配色/主题页
- **数据结构**：`theme.enableHomeColorOverlay` + `theme.homeColorOverlayMode`
- **模式**：`atmosphere` / `solid`
- **UI 形式**：总开关 + 模式选择
- **实现方式**：在首页背景链路中增加可控 overlay 层
- **范围控制**：只改背景视觉层，不改布局

这个方案能把用户记忆中的“首页被配色染上一层颜色”的感觉带回来，同时保持当前站点默认不变，并以最小范围的方式接入现有主题系统。
