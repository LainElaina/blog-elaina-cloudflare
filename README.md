# LainElaina's Personal Blog 🌌

> 欢迎来到我的个人博客仓库！这里记录了我的技术踩坑、项目复盘以及生活碎片。
> 本博客已全量部署至 Cloudflare Workers 边缘节点，享受极致的全球访问速度。

🌐 [https://blog.lainelaina.top](https://blog.lainelaina.top)

---

## 🏗️ 架构与模板 (Powered By)

本项目基于修改并适配的开源博客框架构建。如果你也想拥有一个无需服务器、免费且高度自定义的 Serverless 博客并部署到cloudflare，欢迎使用底层模板：

**底层模板只做了next.js降级和部分bug修复，以使该项目可以被顺利部署到cloudflare。**

**如果你想要更多更多我魔改而来的功能，请使用本仓库！**

👉 **底层模板仓库：[LainElaina/2025-blog-public](https://github.com/LainElaina/2025-blog-public)**

* **框架兼容cloudflare**：强制降级至 Next.js 15.1.0 + React 19.0.0，彻底解决原版 Next.js 16 在 Cloudflare 上的 `Dynamic require` 兼容性崩溃问题。
* **依赖平铺**：引入 `.npmrc` 配置，完美避开 pnpm symlink 在云端构建时的软链接坑。
* **极速部署**：一键集成 Cloudflare Git 自动构建，去除多余配置文件，大幅提升 CI/CD 速度。
* **内容分离**：支持网页端 GitHub App 鉴权直写文章，自动 commit，无需本地打开编辑器。

*Original Framework Creator: [YYsuni/2025-blog-public](https://github.com/YYsuni/2025-blog-public)*

---

## ✨ 新增功能 (New Features)

### 🎵 音乐播放器增强
- 支持多首歌曲播放（リテラチュア、リテラチュア Piano ver.、灰色のサーガ）
- 展开式歌单，点击卡片查看完整列表
- 实时显示播放进度和时间
- 自动循环播放

### 🎨 可视化布局编辑系统
- **拖拽式布局调整**：右上角"进入拖拽布局"按钮一键开启编辑模式，实时拖拽调整卡片位置和大小
- **取消编辑完整回滚**：取消编辑时同时恢复内置组件和自定义组件到编辑前的状态
- **快捷工具栏**：右上角独立按钮（从右到左）
  - 日志按钮 - 日志设置与查看
  - 组件商店 - 管理自定义组件（仅首页显示）
  - 进入拖拽布局 - 一键开启编辑模式
  - 导入布局配置 - 一键应用他人分享的布局
  - 导出布局配置 - 导出完整个性化设置
  - 首页布局 - 独立弹窗管理所有卡片参数
  - 工具栏按钮为常驻按钮，不可在布局设置中禁用，防止用户误操作锁定自己
- **首页布局管理弹窗**（独立于网站设置）：
  - 毛玻璃拟态 UI 风格，卡片式布局（每行 2 个），参数输入内凹质感
  - 支持编辑每个组件的宽度、高度、显示顺序、横纵偏移、启用状态
  - 自定义组件带蓝色边框标记，工具按钮沉到底部"常驻"区域
  - 布局导入/导出（仅卡片位置参数，不含自定义组件和图片）
  - 撤销上一步（仅开发环境）
- **双重重置**：
  - **重置内置**：仅恢复内置组件的位置和大小为默认值，不影响自定义组件
  - **重置全部**：清空所有自定义组件，内置组件的位置、大小和显示状态全部恢复默认
  - 两种重置都会自动持久化保存到项目并刷新页面（线上环境需先导入密钥）
- **双环境保存**：
  - 开发模式：直接写入本地项目文件（`src/config/card-styles.json` 和 `src/config/custom-components.json`），无需密钥
  - 生产模式：通过 GitHub App 密钥签名认证，推送到仓库
- **布局历史记录**：
  - 自动保存每次修改的布局快照（包含自定义组件）
  - 支持自定义命名、加载（图标按钮）、重命名（图标按钮）、删除（图标按钮）
  - 数据存储在浏览器 localStorage，**清除缓存后将丢失，请及时导出备份**
- **导入/导出配置**：
  - 导出内容：卡片布局、自定义组件、收藏模板、布局模板、网站主题配置
  - 不包含图片类型组件已上传的图片文件，仅保留图片路径（网络链接可正常使用）
  - 导入会替换当前所有配置，建议先导出备份

### 📊 操作日志系统
- **可拖拽日志窗口**：实时记录所有操作
- **日志分级**：info/success/warning/error 带颜色标识
- **8 大追踪类型**：布局编辑、历史记录、音乐播放、配置修改、博客操作、图片操作、网络请求、错误捕获，默认全部启用
- **错误提醒红点**：日志按钮仅在检测到错误日志时显示红色脉冲圆点，打开日志窗口后自动清除
- **详细信息**：显示时间戳和操作详情，支持复制
- **导出功能**：导出日志为 JSON 文件用于问题排查

### 🧩 自定义组件系统
- **组件商店**：右上角商店按钮（仅首页显示），管理所有自定义组件
- **三大标签页**：
  - **模板**：创建和管理自定义组件（文本/图片/链接/iframe），支持收藏
  - **收藏**：快速创建收藏的组件模板，支持导入/导出收藏为 JSON（收藏仅存浏览器本地，请及时导出备份）
  - **内置**：克隆任何内置卡片为自定义组件
- **图片组件**：
  - 支持选择本地图片文件上传或输入网络 URL
  - 开发环境通过 `/api/upload-image` 保存到 `public/images/custom-components/`
  - 生产环境通过 GitHub API 提交到仓库
  - 图片卡片采用与首图卡片一致的渲染方式（`p-2` + `rounded-[32px]` 内圆角）
- **保存到项目**：组件商店底部"保存到项目"按钮，将自定义组件持久化到项目文件（否则仅存在于浏览器缓存中）
- **样式模板**：多种预设尺寸（小方块/中矩形/大横幅等）
- **完整编辑**：支持编辑组件内容、尺寸、位置、显示顺序
- **布局集成**：自定义组件显示在首页布局设置中，带"自定义"标记和蓝色边框
- **拖拽定位**：创建后自动进入编辑模式，可拖拽到任意位置
- **网格吸附**：拖拽时自动对齐 20px 网格，保持布局整齐
- **入场动画**：自定义组件紧接内置组件之后依次入场，不使用 `Card` 的排队机制，拖拽跟手无延迟

### 🎨 色彩配置
- **基础颜色**：8 种主题色可自定义（主题色、次级主题色、主色、次色、背景色、边框色、卡片色、文章背景）
- **背景颜色**：自定义背景气泡颜色，支持添加/删除/随机配色
- **内置预设**：春暖、秋实、深夜三种预设配色方案
- **自定义预设**：
  - 保存当前配色为自定义预设（自定义命名）
  - 自定义预设支持删除，带蓝色"自定义"标签区分
  - "保存自定义预设到项目"按钮持久化到 `src/config/color-presets.json`（dev 写本地文件，prod 推 GitHub）
  - 自定义预设暂存浏览器本地，需点击持久化按钮才会写入项目文件
- **导入/导出配色**：导出当前配色为带名称的 JSON 文件，导入后自动添加为自定义预设

### 🌸 四季动态效果
- **全站四季主题背景效果**：支持春 / 夏 / 秋 / 冬四种主题动态背景，作用于全站页面，不影响布局与交互
- **统一控制方式**：在网站设置 → 色彩配置中可直接切换开关、季节主题与表现风格
- **三种表现风格**：
  - `轻量`：粒子数量少、存在感更弱
  - `明显`：粒子更多、视觉存在感更强
  - `混合`：介于两者之间
- **可持久化保存**：博客主人可通过现有“本地保存/保存”逻辑把季节和效果写回项目配置，刷新后持续生效
- **当前季节效果**：
  - 春：花瓣漂浮
  - 夏：暖光粒子 / 萤火感光斑
  - 秋：落叶漂浮
  - 冬：雪花飘落

### 🫧 首页配色蒙层
- **两种模式**：支持 `氛围染色` 与 `纯色蒙版`
- **氛围运动控制**：`氛围染色` 额外支持 `动态 / 静态` 切换
- **默认行为**：首页配色蒙层默认关闭，开启后可按博客主人的选择持久化保存到项目


### 🖼️ 图片管理
- **首页图片和背景图片**：
  - 支持上传本地图片或输入网络 URL
  - 删除图片后点击保存，会同时从项目文件中删除对应图片文件
  - 未保存的删除操作不会生效，下次打开仍可见
  - 开发环境通过 `/api/delete-image` 删除本地文件
  - 生产环境通过 GitHub API 从仓库删除文件

### ✍️ 文章编辑器
- **图片插入**（三种方式）：
  - **拖拽插入**：从侧边栏图片缩略图拖拽到编辑器，自动在光标处插入 markdown 引用；也支持从电脑文件夹直接拖拽图片文件进编辑器
  - **点击复制**：点击侧边栏图片缩略图，复制 `![](local-image:xxx)` 引用到剪贴板，在编辑器中粘贴即可
  - **粘贴图片**：在编辑器中直接 Ctrl+V 粘贴截图或复制的图片，自动添加到图片列表并插入引用
- **图片占位符**：本地图片使用 `![](local-image:<id>)` 占位，发布时自动替换为实际上传路径
- **双环境发布**：
  - 开发环境：图片保存到 `public/blogs/<slug>/`，文章数据写入本地文件
  - 生产环境：通过 GitHub API 提交图片和文章到仓库
- **Markdown 快捷键**：Ctrl+B 加粗、Ctrl+I 斜体、Ctrl+K 插入链接、Tab 缩进
- **图片工具箱**：独立页面 `/image-toolbox`，提供图片压缩功能

### ⚙️ 网站设置
- **环境指示器**：网站设置页面顶部显示当前运行环境
  - 本地开发环境（橙色标识）：保存时直接写入本地项目文件，图片通过 `/api/upload-image` 存到 public 目录，无需密钥认证
  - 线上部署环境（绿色标识）：保存时通过 GitHub API 提交到仓库，需要导入私钥进行签名认证
- **PEM 缓存**：可选开启，将 GitHub App 私钥加密后缓存到 sessionStorage，刷新页面无需重新导入（关闭标签页自动清除）

### 💾 仓库内数据库与正式产物边界（当前内容架构）
本仓库正在从“直接编辑分散 JSON 文件”迁移到“本地结构化账本 + 正式静态产物”架构：

- **本地结构化账本 / 校验 / 重建工具层：** `data/content.db`
  - 当前 schema 已包含：`site_config`、`layout_config`、`blog_entries`、`share_entries`、`draft_items`、`content_versions`、`schema_migrations`
  - 这些表对应站点配置、布局配置、博客元数据、分享元数据、草稿状态、版本记录与迁移版本管理。
  - 它当前用于本地结构化沉淀、低频校验与重建工具链，**不是页面运行时直接读取的数据源**。
- **正文正式载体：** 博客正文仍保留在 `public/blogs/<slug>/index.md`。
- **正式运行时产物：** 页面运行时当前优先消费 `public/**` 产物，而不是直接连接 `content.db`。
  - 博客：`public/blogs/index.json`、`public/blogs/categories.json`、`public/blogs/folders.json`、`public/blogs/storage.json`
  - 分享：`public/share/list.json`、`public/share/categories.json`、`public/share/folders.json`、`public/share/storage.json`
  - 其中 `public/blogs/storage.json` 会继续保留为博客正式运行时产物之一。
- **数据库外但仍属正式内容的部分：**
  - 博客 Markdown 正文与文章目录下资源文件
  - 各类图片资源（如 `public/images/**`）
  - 当前仍以 JSON 维护的页面数据：`src/app/about/list.json`、`src/app/snippets/list.json`、`src/app/bloggers/list.json`、`src/app/projects/list.json`、`src/app/pictures/list.json`
  - 首页正式配置当前仍写回 `src/config/*.json`，尚未变成“页面直接读库”的单一路径
- **旧架构纪念快照：** `/app/blog-elaina-cloudflare-无数据库版`
  - 仅作为迁移前留档，不是当前开发目录，也不能把新架构改动混入该目录。

### 📏 当前容量边界与适用范围
- **定性判断：** 当前架构更适合个人博客与中小规模内容站，不应直接理解为面向大规模多租户 CMS。
- **真实瓶颈：** 先到上限的通常不是 SQLite 本身，而是 `content.db` 的 Git 二进制冲突、`public/*.json` 全量导出体积、构建时全量读取、以及 GitHub API / Git 协作成本。
- **粗略量级判断：** 在现有“仓库内数据库 + 全量静态产物导出 + Git 协作”模型下，数百到低千级博客 / 分享记录通常仍属于合理区间；若继续增长，或进入多人高频协作场景，需要重新评估分片导出、增量构建、冲突规避与正式主源策略。
- **说明：** 上述容量判断是基于当前实现方式的工程估算，不是压测承诺。

### 🆕 最近架构更新（2026-04）
- `/share` 运行时与正式保存链路已切到 `public/share/*` 正式产物，不再以 `src/app/share/list.json` 作为运行时正式主源。
- 文档已同步补充“数据库内 / 外边界”“正式产物消费层”“冲突处理 SOP”等说明，方便后续交接。
- 当前页面运行时仍以 `public/**` 导出物为主；`content.db` 继续收敛为本地账本 / 校验 / 重建工具层，而不是页面直读主链路。
- 博客目录模式已并入 `/blog` 主切换器；目录筛选仅在“目录”模式下生效，避免隐藏过滤状态泄漏到年/月/周/分类视图。
- 写作页支持即时新建目录并自动选中；`/blog` 编辑态支持分配目录与“清空目录”独立确认动作。
- 网站设置开发环境中新增“博客账本工具”面板，可预检查或执行账本同步 / 正式产物重建；该入口只会处理 `public/blogs/*.json` 与 `storage.json`，不会修改 Markdown 或图片。

### 🧰 博客账本开发工具（仅 development）
- 预检查入口：`/api/blog-migration/preview`
  - 读取当前 `public/blogs/index.json`、`categories.json`、`folders.json`、`storage.json`
  - 基于账本契约返回当前仍需重建的正式产物列表
- 执行入口：`/api/blog-migration/execute`
  - 仅在明确确认后执行
  - 会同步账本并重建 `public/blogs/index.json`、`categories.json`、`folders.json`、`storage.json`
  - 不会修改 `public/blogs/<slug>/index.md` 或图片资源
- 路由最小集成验证已覆盖 preview / execute 的 dev-only 边界与真实写回行为

### 🗂️ 博客目录交互补充说明
- `/blog` 的“目录”是与 日 / 周 / 月 / 年 / 分类 同级的主视图，不再是独立漂浮筛选区。
- “清空目录”不再混在目录下拉的默认项中，而是独立动作，并会在执行前明确说明不会删除文章内容或目录本身。
- 当没有任何目录时，写作页和 `/blog` 页会给出显式提示，而不是静默失败。
- 当刚新建目录且服务端目录产物尚未刷新时，写作页仍会保留当前选中的新目录，避免视觉回退到“默认目录”。

### 🧪 当前阶段关键验证点
- 发布 / 删除博客后，`public/blogs/index.json`、`categories.json`、`folders.json`、`storage.json` 保持一致。
- `folderPath` / `favorite` 会在写作页、列表页、导出产物与正式存储中一致回显。
- 账本工具的 sync / verify / rebuild 契约只处理结构化产物，不触碰 Markdown 或图片。
- dev-only blog migration 入口在 preview / execute 两条路径上都有自动化验证。


### 💾 全站本地开发保存支持
所有可编辑页面在本地开发环境下均可直接保存，无需导入密钥：

| 页面 | 正式保存内容 | 图片/文件处理 |
|---|---|---|
| 首页配置（网站设置/色彩配置） | 先写 `data/site-config.draft.json`，再通过正式保存写入 `src/config/*.json` | 头像/首图/背景图上传 + 删除同步 |
| 首页布局 | 先写 `data/site-config.draft.json`，再通过正式保存写入 `src/config/*.json` | - |
| 自定义组件 | `custom-components.json` | 组件图片上传 |
| 色彩预设 | `color-presets.json` | - |
| 关于页面 | `about/list.json` | - |
| 语录页面 | `snippets/list.json` | - |
| 博主墙 | `bloggers/list.json` | 头像上传 |
| 项目展示 | `projects/list.json` | 封面上传 |
| 分享推荐 | `public/share/list.json` + `categories.json` + `folders.json` + `storage.json` | Logo 上传 |
| 图片展示 | `pictures/list.json` | 图片上传 + 孤立图片清理 |
| 博客列表管理 | `public/blogs/index.json` + `categories.json` + `folders.json` + `storage.json` | 删除博客目录 |
| 文章发布/编辑 | `blogs/<slug>/index.md` + `config.json` + `public/blogs/*.json` | 内容图片 + 封面上传 |
| 文章删除 | 删除 `blogs/<slug>/` + 更新 `public/blogs/*.json` | 目录递归删除 |

**本地开发 API 路由**（仅 `NODE_ENV === 'development'` 可用，生产环境返回 403）：
- `/api/upload-image` — 上传图片到 `public/` 目录
- `/api/delete-image` — 删除 `public/` 目录内的单个文件
- `/api/delete-dir` — 递归删除 `public/` 目录内的文件夹
- `/api/save-file` — 写入任意项目文件（用于保存 JSON/MD 等）
- `/api/config` — 写入配置文件（`site-content.json`、`card-styles.json`、`custom-components.json`、`color-presets.json`）
- `/api/drafts/site-config` — 保存/读取/清理首页配置草稿
- `/api/publish/site-config` — 将首页配置草稿正式写入仓库文件
- `/api/layout`、`/api/layout/undo` — 本地布局读取、保存与撤销
- `/api/blog-migration/preview`、`/api/blog-migration/execute` — 本地博客账本同步 / 正式产物重建工具

这些 route 的入口文件必须保持轻量：生产环境先返回 403，再在 development 分支内动态加载本地实现。不要在 `route.ts` 顶层 import `fs`、`path`、`node:*`、大迁移工具或其它只服务本地开发的重依赖，否则它们会进入 Cloudflare Worker 的生产 bundle。

### 📝 草稿保存 vs 正式保存 vs git push
- **保存本地草稿**：仅在开发环境下把首页配置写入 `data/site-config.draft.json`，不会触碰正式源。
- **正式保存**：把当前编辑结果写入仓库工作区中的正式源或正式静态产物，但**不会自动 push**。
- **git push**：由你手动把本地已正式保存的改动推到远端，随后 Cloudflare 重新构建。
- **线上正式保存**：网页端通过 GitHub API 直接更新仓库文件，等价于“远端正式保存”，随后触发 Cloudflare 构建。

### ⚠️ `content.db` Git 冲突处理 SOP
`data/content.db` 是仓库内的二进制本地账本/重建工具源，不是页面运行时直接读取的正式源。发生冲突时：

1. 不要手工合并数据库二进制内容。
2. 先备份当前数据库，例如 `data/backups/content.<timestamp>.db`。
3. 优先使用迁移/导出脚本重新生成数据库与静态产物：
   - `node scripts/migrate-legacy-to-db.ts --dry-run`
   - `node scripts/migrate-legacy-to-db.ts --confirm-overwrite`
   - `node scripts/verify-db-migration.ts`
4. 若仍无法恢复，再转人工介入，不要继续自动覆盖。
5. 处理完后核对 `public/blogs/*.json`、`public/share/*.json` 与页面展示一致。

> 当前 `.gitattributes` 尚未加入数据库专用 merge 策略，因此协作时更要避免直接手工处理二进制冲突。

### 🔒 安全措施
- **所有本地 API 路由**均仅限开发环境可用，生产环境直接返回 403
- **文件上传防护**（`/api/upload-image`）：
  - 路径穿越防护：`resolve()` 后校验必须在 `public/` 目录内
  - 文件类型白名单：仅允许图片格式（jpg/jpeg/png/gif/webp/svg/ico/avif）
  - 文件大小限制：最大 10MB
  - 错误信息不暴露内部路径
- **文件/目录删除防护**（`/api/delete-image`、`/api/delete-dir`）：
  - 路径安全校验：只能操作 `public/` 目录内的内容
- **文件写入防护**（`/api/save-file`）：
  - 路径安全校验：只能写入项目目录内的文件
- 详细安全审计报告见项目根目录 `安全风险审计.md`

---

## 💻 本地开发指南 (Local Development)

如果你想在本地预览文章效果或修改主题卡片样式，请遵循以下步骤：

### 1. 环境准备
确保你已安装 LTS 版本的 Node.js 以及最新的 `pnpm`。

```bash
# 克隆本仓库
git clone [https://github.com/LainElaina/blog-elaina-cloudflare.git](https://github.com/LainElaina/blog-elaina-cloudflare.git)
cd blog-elaina-cloudflare

# 安装依赖
pnpm install
```

### 2. 环境变量配置
在项目根目录创建 `.env.local` 文件，并填入以下内容（用于网页端编辑鉴权）：
```env
NEXT_PUBLIC_GITHUB_OWNER=LainElaina
NEXT_PUBLIC_GITHUB_REPO=blog-elaina-cloudflare
NEXT_PUBLIC_GITHUB_BRANCH=main
NEXT_PUBLIC_GITHUB_APP_ID=你的AppID
```

### 3. 启动本地服务器
```bash
# 默认采用稳定版 Webpack 启动，兼容自定义 SVG 组件
pnpm run dev
```
打开浏览器访问 `http://localhost:2025` 即可实时预览。

---

## 🚀 部署与同步日志

本项目采用 Cloudflare Git 集成自动部署。

* **线上更新**：在网页端保存文章，或本地执行 `git push` 后，Cloudflare 将在几分钟内自动完成构建并刷新全站缓存。
* **本地同步**：如果通过网页端发布了新文章，本地修改代码前请务必先执行 `git pull origin main` 以防代码冲突。
* **部署后内容未更新？** Cloudflare 可能使用了构建缓存。前往 Cloudflare Dashboard → Workers & Pages → 项目 → Settings → Builds → Purge build cache，然后 Retry deployment。部署完成后再到 Caching → Purge Everything 清除 CDN 缓存，最后浏览器 Ctrl+Shift+R 硬刷新。

### Cloudflare Worker 体积边界

Cloudflare Workers 免费版会校验压缩后的 Worker 脚本体积，当前上限是 3 MiB。OpenNext 构建后，真正受这个限制影响的是 `.open-next/worker.js` 与 server function bundle，而不是单纯的静态资源总量；Cloudflare 已按压缩后体积判断，手动把仓库或 Worker 再 gzip 一次不能绕过这个限制。

正常新增博客文章通常主要增加 `public/blogs/<slug>/`、`public/blogs/index.json`、`categories.json`、`folders.json`、`storage.json` 和图片等静态资源体积，不应把文章正文或本地管理工具重依赖打进 Worker。若新增功能需要 API route，请特别注意生产入口的顶层 import：只在本地开发使用的文件系统、迁移脚本、一次性管理工具必须放到 development guard 之后动态加载。

线上 `/write` 与网站设置保存仍保留 GitHub App PEM/private key 浏览器端直写 GitHub 的能力：浏览器签发 GitHub App JWT、获取 installation token，并通过 GitHub API commit 到仓库。不要为了“瘦身”把这条链路迁移成重型 Worker 服务端代理，除非以后单独设计鉴权、密钥托管与 Worker 体积方案。

部署配置也要避免重复构建：Cloudflare Dashboard 的 build command、`pnpm run deploy`、`wrangler.toml` 的 `[build] command` 都可能触发 OpenNext 构建。调整部署方式时保持单一可信构建入口，避免一次部署里重复运行 Next/OpenNext 构建。

---

## 🛠️ Tech Stack

* **Framework:** Next.js 15.1.0 (App Router)
* **UI & Styling:** React 19, TailwindCSS 4, Framer Motion (motion/react)
* **State Management:** Zustand 5
* **Deployment & Edge Compute:** Cloudflare Workers (@opennextjs/cloudflare)
* **Authentication:** GitHub App (jsrsasign JWT 签名)
* **Markdown:** marked + shiki (代码高亮) + KaTeX (数学公式)
* **Package Manager:** pnpm (hoisted 模式，`.npmrc` 配置 `node-linker=hoisted`)

---

## 📁 项目结构概览

```
src/
├── app/                    # Next.js App Router 页面
│   ├── (home)/             # 首页路由组
│   │   ├── config-dialog/  # 网站设置弹窗（色彩/布局/站点配置）
│   │   ├── services/       # 数据推送服务（本地/GitHub）
│   │   └── stores/         # Zustand 状态管理
│   ├── about/              # 关于页面
│   ├── api/                # 本地开发 API 路由（仅 dev 环境）
│   ├── blog/               # 博客列表 + 文章详情
│   ├── bloggers/           # 博主墙
│   ├── pictures/           # 图片展示
│   ├── projects/           # 项目展示
│   ├── share/              # 分享推荐
│   ├── snippets/           # 语录
│   └── write/              # 文章编辑器
├── components/             # 全局共享组件
├── config/                 # 静态配置文件（JSON + TS）
├── hooks/                  # 全局 React Hooks
├── layout/                 # 全局布局（导航栏/背景/页脚）
├── lib/                    # 工具库（GitHub API/认证/工具函数）
├── styles/                 # 全局样式
└── svgs/                   # SVG 图标组件
```

详细架构说明请参阅 [CONTRIBUTING.md](./CONTRIBUTING.md)。
