# /pictures 旧相纸布局与访客显示模式切换设计

## 目标

在保留当前图片上传/删除/保存链路的前提下，为 `/pictures` 页面补齐一个仅影响访客浏览效果的显示模式切换：默认使用旧的“相片纸叠放 + 可拖开 + 点击查看详情”布局（`RandomLayout`），并允许访客在当前会话内切换到瀑布流布局（`MasonryLayout`）。

本次设计聚焦：
- `/pictures` 默认浏览模式固定为 `RandomLayout`
- 保留现有 `MasonryLayout` 作为访客可切换的备选浏览方式
- 切换只影响访客当前会话，不写入图片数据、仓库配置或服务端状态
- 编辑态固定使用 `RandomLayout`，避免访客偏好干扰维护行为

本次设计**不包含**：
- 改动 `src/app/pictures/list.json` 数据结构
- 修改图片上传/删除/保存链路
- 新增服务端配置、数据库字段或正式持久化设置
- 调整 `/pictures` 内容本身的排序、元数据或上传逻辑
- 重写 `RandomLayout` 现有的拖拽偏移持久化逻辑

## 背景与当前事实

### 当前仓库状态
- 当前 `/pictures` 页面已经恢复为使用 `src/app/pictures/components/random-layout.tsx` 作为默认渲染布局：`src/app/pictures/page.tsx`
- 仓库中同时保留两套布局组件：
  - `src/app/pictures/components/random-layout.tsx`
  - `src/app/pictures/components/masonry-layout.tsx`
- 用户希望：
  - 默认仍是旧的相片纸叠放效果
  - 访客可在页面内手动切换到瀑布流模式
  - 切换不应改变正式内容或服务端状态

### 历史调查结论
- 旧的叠放式实现一直保留在仓库中：`RandomLayout`
- `MasonryLayout` 也是历史上已经进入仓库的正式组件，不是本次 `/share` phase 引入的临时产物
- 因此本次不需要“恢复旧组件”，而是需要在当前页面上补一个**访客态布局选择器**

## 设计约束

- 默认浏览模式必须是旧的相纸模式（`RandomLayout`）
- 访客可以在浏览态切换到瀑布流（`MasonryLayout`）
- 切换只在当前会话内有效，使用 `sessionStorage`
- 不允许把访客显示偏好写回图片数据、仓库配置或任何服务端状态
- 编辑态固定使用 `RandomLayout`
- 访客切换入口要放在 `/pictures` 页面右上角，且不与现有编辑/上传/保存按钮重叠
- 访客切换入口独立于 `hideEditButton`，即使隐藏编辑按钮，访客仍应可切换浏览布局
- 移动端本次不新增单独入口；切换入口先保持桌面端可见，移动端继续使用默认 `RandomLayout`

## 目标架构

### 页面状态
在 `src/app/pictures/page.tsx` 内新增纯前端状态：

```ts
type PicturesDisplayMode = 'random' | 'masonry'
```

并拆成两层语义：
- **preferredDisplayMode**：访客在当前会话中选择的浏览模式
- **effectiveDisplayMode**：页面实际使用的显示模式

其中：
- 桌面浏览态：`effectiveDisplayMode = preferredDisplayMode`
- 编辑态：`effectiveDisplayMode = 'random'`
- 移动端浏览态：`effectiveDisplayMode = 'random'`

也就是说：
- 即使当前会话里 `preferredDisplayMode === 'masonry'`
- 只要进入移动端视口，页面实际渲染仍强制回到 `RandomLayout`
- 该偏好不会被清空；一旦回到桌面视口，可恢复为访客此前在本会话中选择的模式

这样可以保证“移动端默认相纸模式”的规则真正体现在状态机里，而不是只停留在文案层。

### 初始化规则
页面加载时：
1. 读取 `sessionStorage`
2. 若值为 `random` / `masonry` 之一，则恢复该值
3. 否则默认使用 `random`

### 渲染规则
- `effectiveDisplayMode === 'random'` 时渲染 `RandomLayout`
- `effectiveDisplayMode === 'masonry'` 时渲染 `MasonryLayout`
- 编辑态始终渲染 `RandomLayout`

## 交互设计

### 入口位置
在 `/pictures` 页面右上角新增一个独立的小型显示模式切换区，与现有编辑按钮区并列但视觉上分组。

建议结构：
- 原有操作组：编辑 / 上传 / 保存 / 取消
- 新增访客浏览模式组：
  - `相纸`
  - `瀑布`

### 桌面端与移动端
- 桌面端：显示切换入口
- 移动端：本次不新增单独入口，继续使用默认 `RandomLayout`
- 若当前会话中保存的是 `masonry` 偏好，移动端会暂时忽略该偏好并仍渲染 `RandomLayout`
- 返回桌面端后，可以恢复该会话中原先选择的 `masonry` 模式
- 这样可以避免在小屏上与现有右上角操作区发生拥挤冲突

### 交互规则
- 默认高亮：`相纸`
- 浏览态下可点击切换
- 切换后立即更新当前页面布局
- 同一会话中刷新页面，保持当前选择
- 编辑态下：
  - 布局强制回到 `相纸`
  - 切换组显示但禁用，提示“编辑态固定使用相纸模式”
- 当 `hideEditButton === true` 时，访客切换组仍保持可见，因为它不属于编辑入口

### 为什么编辑态固定相纸模式
- 旧的相纸模式本身就支持拖开、放大和更接近“查看原图”语义
- 编辑态应该以站点维护体验为主，而不是访客浏览偏好为主
- 这样可避免 `MasonryLayout` 在编辑态下的交互与删除/选择行为出现双套心智

## 数据与持久化边界

### 会写入的地方
- `sessionStorage`
  - 仅保存 `preferredDisplayMode`

### 保留但不在本次范围内的既有持久化
- `RandomLayout` 当前已有图片拖拽 offset 的 `localStorage` 持久化
- 这属于旧布局内部行为，本次**不改**它
- 因此“仅当前会话生效”只针对**布局模式选择**本身，不追溯修改旧布局已有的拖拽 offset 存储逻辑

### 不会写入的地方
- `src/app/pictures/list.json`
- `public/images/pictures/**`
- 任何 GitHub 推送内容
- 任何正式配置文件
- 任何数据库/服务端状态

这保证该切换功能只是访客本地会话级浏览偏好，不会污染正式内容。

## 文件范围

### 主要修改
- Modify: `src/app/pictures/page.tsx`
  - 保持默认 `RandomLayout`
  - 引入 `PicturesDisplayMode` 状态
  - 增加 `sessionStorage` 读写
  - 接入右上角模式切换 UI
  - 根据编辑态/浏览态推导 `effectiveDisplayMode`

### 复用现有组件
- Reuse: `src/app/pictures/components/random-layout.tsx`
- Reuse: `src/app/pictures/components/masonry-layout.tsx`

### 测试
可选新增或补充：
- `src/app/pictures/page.test.tsx` 或现有 pictures 相关测试文件（若项目已有更合适位置）

## 最小测试矩阵

至少覆盖：
1. 默认模式为 `random`
2. 浏览态可切到 `masonry`
3. 切换后写入 `sessionStorage`
4. 同一会话刷新后会恢复上次选择
5. 编辑态强制使用 `random`
6. 编辑态下切换按钮不可误导性生效
7. `hideEditButton` 为 `true` 时访客切换入口仍存在
8. 切换行为不触发图片保存、上传或删除逻辑

## 成功标准

- `/pictures` 默认保持旧的相片纸叠放浏览效果
- 访客可在页面右上角切换到瀑布流模式
- 切换只在当前会话生效，关闭会话后恢复默认相纸模式
- 编辑态始终固定为相纸模式
- 功能不修改正式图片数据与服务端状态

## 风险与取舍

### 风险 1：两套布局长期并存
- 影响：`RandomLayout` 与 `MasonryLayout` 需要一起维护
- 取舍：当前这是合理成本，因为用户明确需要旧效果默认恢复，同时也希望保留新样式切换

### 风险 2：切换组与右上角按钮区视觉冲突
- 影响：在窄屏或按钮较多时可能拥挤
- 取舍：本次优先保持为独立小组，不做大范围右上角工具条重构；必要时只做轻量布局微调

### 风险 3：编辑态与浏览态模式不同步造成困惑
- 影响：用户可能切到瀑布流后，进入编辑态又回到相纸模式
- 取舍：通过明确提示“编辑态固定使用相纸模式”解决；这是刻意设计，不是 bug

### 风险 4：移动端没有额外切换入口
- 影响：移动端暂时无法使用访客切换
- 取舍：本次优先收口桌面端体验，避免在小屏上挤占现有操作区；若移动端确有需求，后续单独开 phase 讨论
