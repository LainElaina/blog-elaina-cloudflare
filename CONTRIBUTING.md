# 贡献指南 & 架构文档

本文档面向需要接手或参与本项目开发的开发者，涵盖完整的项目架构、数据流、代码规范和开发流程。

---

## 目录

- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [核心架构](#核心架构)
  - [双环境保存策略](#双环境保存策略)
  - [状态管理（Zustand Stores）](#状态管理zustand-stores)
  - [配置文件系统](#配置文件系统)
  - [GitHub API 认证链路](#github-api-认证链路)
  - [组件注册与渲染](#组件注册与渲染)
  - [动画系统](#动画系统)
  - [首页布局系统](#首页布局系统)
- [页面模块详解](#页面模块详解)
- [本地开发 API 路由](#本地开发-api-路由)
- [关键代码模式](#关键代码模式)
- [SSR 注意事项](#ssr-注意事项)
- [样式规范](#样式规范)
- [部署流程](#部署流程)
- [常见问题排查](#常见问题排查)
- [当前数据库主源补充（2026-04）](#当前数据库主源补充2026-04)

---

## 当前数据库主源补充（2026-04）

### 正式信息来源与协作边界
- 仓库内文档（`README.md`、本文件）是长期有效的正式说明。
- `/app` 根目录下的续接说明只用于会话/本地交接，不替代仓库规范。
- 不要提交 `.claude/**` 与 `docs/superpowers/**`。
- 不要覆盖与当前任务无关的本地未提交改动（例如 `src/config/site-content.json`）。

### 仓库内数据库与正式产物边界
- **本地结构化账本 / 校验 / 重建工具层：** `data/content.db`
  - 当前 schema 已包含：`site_config`、`layout_config`、`blog_entries`、`share_entries`、`draft_items`、`content_versions`、`schema_migrations`
  - 对应站点配置、布局配置、博客元数据、分享元数据、草稿状态、版本记录与迁移版本管理。
  - 当前职责是本地结构化沉淀、低频校验与重建工具链，不是页面运行时直接读取的数据源。
- **正文正式载体：** `public/blogs/<slug>/index.md`
- **正式运行时产物：**
  - 博客：`public/blogs/index.json`、`public/blogs/categories.json`、`public/blogs/folders.json`、`public/blogs/storage.json`
  - 分享：`public/share/list.json`、`public/share/categories.json`、`public/share/folders.json`、`public/share/storage.json`
  - 其中 `public/blogs/storage.json` 与 `public/share/storage.json` 继续保留为正式运行时产物的一部分。
- `src/app/share/list.json` 当前仅保留为迁移输入/编辑入口遗留数据，不再作为运行时正式主逻辑。
- 旧架构纪念快照：`/app/blog-elaina-cloudflare-无数据库版`

### 当前数据库覆盖范围与数据库外内容
- **已纳入数据库主源设计的结构化内容：**
  - 站点配置、布局配置
  - 博客 / 分享的结构化元数据
  - 草稿状态与版本记录
- **当前仍在数据库外的正式内容：**
  - `public/blogs/<slug>/index.md` 正文与文章目录下资源
  - `public/images/**` 等图片资源
  - 仍以 JSON 维护的页面数据：`src/app/about/list.json`、`src/app/snippets/list.json`、`src/app/bloggers/list.json`、`src/app/projects/list.json`、`src/app/pictures/list.json`
  - 首页正式配置当前仍写回 `src/config/*.json`
- **当前运行时消费边界：**
  - 页面运行时当前仍以 `public/**` 导出物为主，而不是页面直接读 `content.db`
  - 例如博客读取 `public/blogs/storage.json` 等正式产物，并在兼容场景下才回退 `config.json`，分享读取 `public/share/*.json`

### 容量边界与维护建议
- 当前架构适用于个人博客与中小规模内容站，不应直接视为通用大规模 CMS 方案。
- 在现有“仓库内数据库 + 全量静态产物导出 + Git 协作”模型下，数百到低千级博客 / 分享记录通常仍是合理区间；再往上或进入多人高频协作时，需要重新评估架构。
- 主要扩展瓶颈通常不是 SQLite 本身，而是：
  - `content.db` 的 Git 二进制冲突
  - `public/*.json` 导出体积与回写成本
  - 构建时全量读取正式产物
  - GitHub API / Git 协作频率升高后的维护成本
- 若内容量继续增长，优先考虑：静态产物分片、增量导出、更明确的主源/派生产物重建流程、以及数据库冲突规避策略。
- 以上容量判断属于基于当前实现方式的工程估算，不是压测结论。

### 最近架构更新（2026-04）
- `/share` 已切到 `public/share/*` 正式产物链路，运行时与正式保存不再把 `src/app/share/list.json` 当正式主逻辑。
- 文档已同步明确数据库内 / 外边界、正式产物消费层与冲突处理 SOP，便于后续交接。
- 当前运行时继续优先消费 `public/**` 导出物；`content.db` 收敛为本地账本 / 校验 / 重建工具层，而不是“全站页面直接读库”。
- 博客目录模式已经并入 `/blog` 的主切换器；目录过滤只在 `displayMode === 'folder'` 时生效，避免不可见的目录过滤状态泄漏到其他浏览模式。
- 写作页支持即时新建目录并自动选中；`/blog` 编辑态支持显式分配目录与“清空目录”独立确认动作。
- 开发环境新增博客账本工具入口：preview 会返回真实 `artifactsToRebuild`，execute 会在明确确认后同步账本并重建正式产物，且不会修改 Markdown / 图片。

### 博客账本开发工具补充（仅 development）
- `preview`: `src/app/api/blog-migration/preview/route.ts`
  - 基于当前 `public/blogs/index.json`、`categories.json`、`folders.json`、`storage.json` 计算 verify 结果
  - 返回真实待重建产物列表，而不是固定空结果
- `execute`: `src/app/api/blog-migration/execute/route.ts`
  - 必须显式确认后才允许执行
  - 当前会同步账本并重建：
    - `public/blogs/index.json`
    - `public/blogs/categories.json`
    - `public/blogs/folders.json`
    - `public/blogs/storage.json`
  - 不修改 `public/blogs/<slug>/index.md` 与图片资源
- 关键契约入口：`src/lib/content-db/migration-contracts.ts`
  - `syncBlogRuntimeArtifactsToLedger`
  - `verifyBlogLedgerAgainstRuntime`
  - `rebuildBlogRuntimeArtifactsFromStorage`

### share 正式产物开发工具补充（仅 development）
- 关键文件：`src/app/api/share-migration/preview/route.ts`、`src/app/api/share-migration/execute/route.ts`、`src/app/api/share-migration/route-handlers.ts`、`src/app/api/share-migration/share-migration-route-helper.ts`、`src/app/api/share-migration/share-migration-api-contracts.ts`、`src/app/share/components/share-migration-panel.tsx`、`scripts/verify-share-runtime-artifacts.ts`
- `preview` 责任：严格读取 `public/share/list.json`、`public/share/categories.json`、`public/share/folders.json`、`public/share/storage.json`，只返回当前 `artifactsToRebuild` 与摘要，不写文件
- `execute` 责任：仅接受 `confirmed === true`；每次都基于当前磁盘快照重新读取并执行，不依赖上一次 preview；按 `list.json -> categories.json -> folders.json -> storage.json` 固定顺序写回四份正式产物；写后重新从磁盘读取并复检；失败时响应会带 `writtenArtifactsPartial`，应先重新 preview
- 边界约束：工具链只处理 share 四份正式产物，不修改 logo 图片；`/share` 运行时仍继续读取 `public/share/*`，首页 share consumers 继续只读 `public/share/list.json`，本阶段不是 DB-first runtime 改造
- `/share` 面板 dirty-state caveat：面板只在 development 的 `/share` 右上角显示；preview 在编辑态或脏状态下仍可用，但会提示“当前结果不包含未保存编辑”；只要 `pageState.isEditMode`、`logoItems.size`、`renamedUrls.size`、`draftOnlyUrls.size`、`deletedPublishedUrls.size`、`editingAnchorUrls.length` 任一存在，execute 就必须禁用
- `verify` 责任：`scripts/verify-share-runtime-artifacts.ts` 只做严格读取与 drift 校验，不写文件；exit code 约定为无 drift 返回 `0`、发现 drift 返回 `1`、输入或运行时错误返回 `2`

### share 开发工具测试命令
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
node --require ./test-alias-register.cjs --import jiti/register ./scripts/verify-share-runtime-artifacts.ts --base-dir=<repo-root>
```

### 目录交互验收补充
- `/blog` 目录模式切换到其他模式后，不应继续隐式保留目录过滤。
- `/blog` 编辑态默认“选择目录”状态下点击“分配目录”必须给出显式提示，不允许默默等价为清空目录。
- 写作页新建目录后，即使服务端目录产物尚未刷新，也应继续保留当前选中的新目录。
- “清空目录”必须明确说明：不会删除文章内容、不会删除目录本身、只会清除所选文章的目录归属。

### 本阶段维护者最小验证建议
1. 运行目录交互相关测试，确认 folder mode / assign / clear / create-folder 行为一致。
2. 运行 share focused tests，确认 `/share` 双导航、URL 冲突原子失败、以及 homepage share consumer 的 list-only 边界仍成立。
3. 运行账本契约与 blog migration API 测试，确认 preview / execute 不再是空壳。
4. 手动检查 development 下配置弹窗里的“博客账本工具”是否可见，并能返回真实 summary。
5. 提交时继续排除 `.claude/**`、`docs/superpowers/**` 与其他无关本地文件。


### 草稿保存、正式保存与发布边界
- **首页配置草稿：** `/api/drafts/site-config` → `data/site-config.draft.json`
- **首页配置正式保存：** `/api/publish/site-config` → 写入 `src/config/site-content.json`、`card-styles.json`、`custom-components.json`、`color-presets.json`
- **博客正式保存：** 围绕 `public/blogs/storage.json` 及其导出产物写入，同时保留正文 Markdown 文件。
- **分享正式保存：** 围绕 `public/share/storage.json` 及其导出产物写入。
- **动作区别：**
  - 保存本地草稿：仅写草稿文件，不更新正式源。
  - 正式保存：更新本地仓库工作区中的正式源/正式产物，但不会自动 `git push`。
  - git push / 线上正式保存：前者由你手动推送，后者由 GitHub API 直接更新仓库；两者都会触发 Cloudflare 构建。

### 关键语义
- `folderPath`：博客目录路径，用于目录树与筛选聚合。
- `favorite`：博客是否为精选。
- `/share` 是独立的分享推荐数据，不是 favorites 系统，禁止混用。
- 新增可编辑模块时，优先沿用“storage 主源 + public 正式静态产物 + 页面只消费正式产物”的模式；不要把旧 JSON 路径继续当长期唯一主逻辑。

### `/share` 运行时与保存约束（2026-04）
- `/share` 正式数据链路围绕四份正式产物展开：`public/share/list.json`、`public/share/categories.json`、`public/share/folders.json`、`public/share/storage.json`；其中页面运行时直接消费前 3 份，`storage.json` 主要承载正式保存 / 发布语义。
- `/share` 双导航职责固定：左侧目录树读 `folders.json`，顶部分类 tabs 读 `categories.json`，列表本体读 `list.json`；不要把目录/分类候选改成由组件各自临时推断。
- 首页 share consumers 仍保持最小契约，只读 `public/share/list.json` 与首页实际渲染所需的基础展示字段；不要让首页卡片依赖 `/share` 的目录树、分类 tabs 或 `storage.json`。
- share 编辑字段中的 `category` 与 `folderPath` 都属于正式元数据，保存后必须同时回流到 list 导出、导航产物与 storage，而不是只更新当前页面局部状态。
- 本地正式保存与远端发布必须复用同一套 share artifact builder，确保四产物同批重建；禁止出现只更新 `list.json` 或本地/远端语义分叉的实现。
- URL 冲突必须在写出前整体失败：包括重复目标 URL、rename 后复用旧 URL、swap/rebind、删除后同批复用已删除 published URL；失败时不能留下半套产物。

### 本地开发 API 路由补充
- `/api/drafts/site-config` — 首页配置草稿读写/清理
- `/api/publish/site-config` — 首页配置正式保存

### `content.db` 冲突处理 SOP
1. 不要手工合并数据库二进制内容。
2. 先备份当前数据库，例如 `data/backups/content.<timestamp>.db`。
3. 优先通过迁移/重建流程恢复：
   - `node scripts/migrate-legacy-to-db.ts --dry-run`
   - `node scripts/migrate-legacy-to-db.ts --confirm-overwrite`
   - `node scripts/verify-db-migration.ts`
4. 基于恢复后的数据库重新生成 `public/blogs/*.json`、`public/share/*.json` 正式产物。
5. 若仍无法恢复，再转人工介入，不要继续自动覆盖。

> 当前 `.gitattributes` 还没有数据库专用 merge 策略，因此更要避免手工处理二进制冲突。

### 最小维护者验收清单
1. `data/content.db` 与导出的 `public/blogs/*.json`、`public/share/*.json` 语义一致。
2. 首页配置草稿不会直接覆盖正式源；正式保存只改工作区，不自动 push。
3. 博客的 `folderPath`、`favorite` 与列表/筛选/导出产物一致。
4. `/share` 不引入 favorites 语义，且 `public/share/*.json` 彼此一致。
5. 提交中不包含 `.claude/**`、`docs/superpowers/**`，也不误覆盖无关本地改动。

## 技术栈

| 技术 | 版本 | 用途 |
|---|---|---|
| Next.js | 15.1.0 | App Router 框架（**必须锁定此版本**，更高版本在 Cloudflare 上有 `Dynamic require` 兼容性问题） |
| React | 19.0.0 | UI 库 |
| TailwindCSS | 4 | 原子化 CSS |
| Zustand | 5 | 轻量状态管理 |
| Framer Motion | `motion/react` | 动画库（注意：导入路径是 `motion/react` 而非 `framer-motion`） |
| @opennextjs/cloudflare | ^1.14 | Next.js → Cloudflare Workers 适配层 |
| jsrsasign | ^11 | GitHub App JWT 签名 |
| marked + shiki + KaTeX | - | Markdown 渲染 + 代码高亮 + 数学公式 |
| pnpm | latest | 包管理器（必须用 hoisted 模式） |

### 版本锁定说明

- **Next.js 必须为 15.1.0**：更高版本（如 16+）在 Cloudflare Workers 上会触发 `Dynamic require of "xxx" is not supported` 错误
- **React 必须为 19.0.0**：配合 Next.js 15.1.0
- `.npmrc` 配置了 `node-linker=hoisted` 和 `shamefully-hoist=true`，解决 pnpm symlink 在 Cloudflare 构建时的问题

---

## 项目结构

```
blog-elaina-cloudflare/
├── public/                         # 静态资源
│   ├── blogs/                      # 博客文章（markdown + 图片）
│   │   └── <slug>/
│   │       ├── index.md            # 文章正文
│   │       └── config.json         # 文章元数据（标题/标签/日期/封面）
│   ├── images/
│   │   └── custom-components/      # 自定义组件上传的图片
│   ├── about/list.json             # 关于页面数据
│   ├── bloggers/list.json          # 博主墙数据
│   ├── blogs/index.json            # 博客索引
│   ├── blogs/categories.json       # 分类数据
│   ├── pictures/list.json          # 图片展示数据
│   ├── projects/list.json          # 项目展示数据
│   ├── share/list.json             # 分享推荐数据
│   └── snippets/list.json          # 语录数据
│
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── layout.tsx              # 根布局
│   │   ├── (home)/                 # 首页路由组（括号 = 不生成路径段）
│   │   │   ├── page.tsx            # 首页入口
│   │   │   ├── config-dialog/      # 网站设置弹窗
│   │   │   │   ├── index.tsx       # 弹窗容器 + 标签页切换
│   │   │   │   ├── color-config.tsx    # 色彩配置（含预设系统）
│   │   │   │   ├── home-layout.tsx     # 首页布局管理（卡片参数编辑）
│   │   │   │   ├── layout-history.tsx  # 布局历史记录
│   │   │   │   ├── layout-manager.tsx  # 布局导入/导出
│   │   │   │   └── site-settings/      # 站点设置子模块
│   │   │   │       ├── index.tsx           # 设置主页（环境指示器/保存逻辑）
│   │   │   │       ├── art-images-section.tsx   # 首图管理
│   │   │   │       ├── background-images-section.tsx  # 背景图管理
│   │   │   │       ├── favicon-avatar-upload.tsx      # 头像上传
│   │   │   │       ├── hat-section.tsx     # 帽子配置
│   │   │   │       ├── site-meta-form.tsx  # 站点元信息
│   │   │   │       ├── social-buttons-section.tsx  # 社交按钮
│   │   │   │       ├── beian-form.tsx      # 备案信息
│   │   │   │       └── types.ts
│   │   │   ├── services/
│   │   │   │   ├── push-site-content.ts        # 生产环境推送（GitHub API）
│   │   │   │   └── push-site-content-local.ts  # 开发环境保存（本地 API）
│   │   │   ├── stores/              # 首页相关 Zustand stores
│   │   │   │   ├── config-store.ts          # 站点配置 + 卡片样式（核心）
│   │   │   │   ├── custom-component-store.ts # 自定义组件
│   │   │   │   ├── component-favorite-store.ts # 组件收藏
│   │   │   │   ├── layout-edit-store.ts     # 拖拽编辑状态
│   │   │   │   ├── log-store.ts             # 操作日志
│   │   │   │   └── template-store.ts        # 布局模板
│   │   │   ├── layout-save-panel.tsx  # 拖拽编辑时的保存/取消面板
│   │   │   ├── home-draggable-layer.tsx  # 拖拽层
│   │   │   ├── log-window.tsx        # 日志窗口
│   │   │   ├── art-card.tsx          # 头像卡片
│   │   │   ├── hi-card.tsx           # 问候卡片
│   │   │   ├── clock-card.tsx        # 时钟卡片
│   │   │   ├── calendar-card.tsx     # 日历卡片
│   │   │   ├── aritcle-card.tsx      # 文章卡片
│   │   │   ├── share-card.tsx        # 分享卡片
│   │   │   ├── social-buttons.tsx    # 社交按钮组
│   │   │   ├── write-buttons.tsx     # 写作按钮
│   │   │   ├── like-position.tsx     # 点赞位
│   │   │   ├── hat-card.tsx          # 帽子卡片
│   │   │   └── beian-card.tsx        # 备案卡片
│   │   │
│   │   ├── api/                     # 本地开发专用 API 路由
│   │   │   ├── config/route.ts      # 写入配置文件
│   │   │   ├── upload-image/route.ts    # 上传图片
│   │   │   ├── delete-image/route.ts    # 删除图片
│   │   │   ├── delete-dir/route.ts      # 删除目录
│   │   │   ├── save-file/route.ts       # 写入任意文件
│   │   │   └── layout/              # 布局相关
│   │   │       ├── route.ts         # 保存布局
│   │   │       └── undo/route.ts    # 撤销布局
│   │   │
│   │   ├── blog/                    # 博客
│   │   │   ├── page.tsx             # 博客列表
│   │   │   ├── [id]/page.tsx        # 文章详情（动态路由）
│   │   │   ├── components/          # 博客专属组件
│   │   │   └── services/            # 博客数据服务
│   │   │
│   │   ├── write/                   # 文章编辑器
│   │   │   ├── page.tsx             # 新建文章
│   │   │   ├── [slug]/page.tsx      # 编辑已有文章
│   │   │   ├── components/
│   │   │   │   ├── editor.tsx       # Markdown 编辑器（含拖拽/粘贴图片）
│   │   │   │   ├── preview.tsx      # 实时预览
│   │   │   │   ├── sidebar.tsx      # 侧边栏
│   │   │   │   ├── actions.tsx      # 发布/删除按钮
│   │   │   │   ├── sections/        # 编辑器子区块
│   │   │   │   │   ├── images-section.tsx  # 图片管理
│   │   │   │   │   ├── cover-section.tsx   # 封面选择
│   │   │   │   │   └── meta-section.tsx    # 元数据编辑
│   │   │   │   └── ui/
│   │   │   │       └── tag-input.tsx  # 标签输入组件
│   │   │   ├── hooks/
│   │   │   │   ├── use-publish.ts   # 发布/删除逻辑（双环境）
│   │   │   │   ├── use-load-blog.ts # 加载已有文章
│   │   │   │   └── use-write-data.ts
│   │   │   ├── services/
│   │   │   │   ├── push-blog.ts     # 推送文章到 GitHub
│   │   │   │   └── delete-blog.ts   # 删除文章
│   │   │   └── stores/
│   │   │       ├── write-store.ts   # 编辑器状态
│   │   │       └── preview-store.ts # 预览状态
│   │   │
│   │   ├── about/                   # 关于页面
│   │   ├── bloggers/                # 博主墙
│   │   ├── pictures/                # 图片展示
│   │   ├── projects/                # 项目展示
│   │   ├── share/                   # 分享推荐
│   │   ├── snippets/                # 语录
│   │   ├── clock/                   # 独立时钟页面
│   │   ├── image-toolbox/           # 图片压缩工具
│   │   ├── music/                   # 音乐页面
│   │   └── rss.xml/                 # RSS 生成
│   │
│   ├── components/                  # 全局共享组件
│   │   ├── card.tsx                 # 通用卡片组件（处理定位/动画/拖拽）
│   │   ├── custom-card.tsx          # 自定义组件渲染器
│   │   ├── component-store.tsx      # 组件商店面板
│   │   ├── layout-dialog.tsx        # 首页布局弹窗（独立于设置弹窗）
│   │   ├── edit-layout-button.tsx   # 进入拖拽编辑按钮
│   │   ├── export-layout-button.tsx # 导出配置按钮
│   │   ├── import-layout-button.tsx # 导入配置按钮
│   │   ├── layout-settings-button.tsx # 首页布局设置按钮
│   │   ├── log-button.tsx           # 日志按钮
│   │   ├── color-picker.tsx         # 颜色选择器
│   │   ├── color-picker-panel.tsx   # 颜色选择面板
│   │   ├── music-card.tsx           # 音乐播放器卡片
│   │   ├── nav-card.tsx             # 导航卡片
│   │   ├── dialog-modal.tsx         # 通用对话框
│   │   ├── global-error-handler.tsx # 全局错误捕获
│   │   ├── markdown-image.tsx       # Markdown 图片渲染
│   │   ├── blog-preview.tsx         # 博客预览
│   │   ├── blog-sidebar.tsx         # 博客侧边栏
│   │   ├── blog-toc.tsx             # 文章目录
│   │   ├── code-block.tsx           # 代码块渲染
│   │   ├── like-button.tsx          # 点赞按钮
│   │   ├── scroll-top-button.tsx    # 回到顶部
│   │   └── liquid-grass/            # Liquid Grass 特效
│   │
│   ├── config/                      # 配置文件
│   │   ├── card-styles.json         # 当前卡片布局样式（可编辑）
│   │   ├── card-styles-default.json # 默认卡片布局样式（重置用）
│   │   ├── card-templates.ts        # 自定义组件的尺寸模板
│   │   ├── color-presets.json       # 自定义色彩预设
│   │   ├── component-registry.ts    # 内置组件注册表
│   │   ├── custom-components.json   # 自定义组件数据（部署数据源）
│   │   └── site-content.json        # 站点内容配置
│   │
│   ├── hooks/                       # 全局 Hooks
│   │   ├── use-auth.ts              # GitHub App 认证状态
│   │   ├── use-center.ts            # 视口中心计算（卡片定位基准）
│   │   ├── use-size.ts              # 响应式尺寸
│   │   ├── use-blog-index.ts        # 博客索引 SWR
│   │   ├── use-categories.ts        # 分类数据 SWR
│   │   ├── use-read-articles.ts     # 已读文章记录
│   │   └── use-markdown-render.tsx  # Markdown 渲染 Hook
│   │
│   ├── layout/                      # 全局布局
│   │   ├── index.tsx                # 布局入口（包含导航/背景/Toast/日志）
│   │   ├── header.tsx               # 顶部导航
│   │   ├── footer.tsx               # 底部
│   │   ├── head.tsx                 # <head> 元信息
│   │   └── backgrounds/
│   │       ├── blurred-bubbles.tsx   # 模糊气泡背景
│   │       ├── snowfall.tsx          # 雪花特效
│   │       └── utils.ts
│   │
│   ├── lib/                         # 工具库
│   │   ├── github-client.ts         # GitHub Git Data API 封装
│   │   ├── auth.ts                  # GitHub App 认证流程
│   │   ├── aes256-util.ts           # AES256 加密（PEM 缓存）
│   │   ├── layout-persistence.ts    # 布局持久化
│   │   ├── file-utils.ts            # 文件工具（SHA256/Base64）
│   │   ├── blog-index.ts            # 博客索引操作
│   │   ├── load-blog.ts             # 博客加载
│   │   ├── markdown-renderer.ts     # Markdown 渲染器配置
│   │   ├── color.ts                 # 颜色工具函数
│   │   ├── log.ts                   # 日志工具
│   │   └── utils.ts                 # 通用工具（cn/getFileExt 等）
│   │
│   ├── styles/                      # 全局样式
│   ├── svgs/                        # SVG 图标源文件（通过 @svgr/webpack 转为组件）
│   └── consts.ts                    # 全局常量（动画时间/间距/GitHub 配置）
│
├── next.config.ts                   # Next.js 配置（SVG loader/重定向）
├── open-next.config.ts              # OpenNext Cloudflare 适配配置
├── wrangler.toml                    # Cloudflare Workers 配置
├── .npmrc                           # pnpm 配置（hoisted 模式）
├── tsconfig.json                    # TypeScript 配置
└── 安全风险审计.md                   # 安全审计报告
```

---

## 核心架构

### 双环境保存策略

这是本项目最核心的架构决策。所有可编辑内容都支持两种保存路径：

```
┌─────────────────────────────────────────────────────────┐
│                    用户点击"保存"                         │
│                        │                                │
│            ┌───────────┴───────────┐                    │
│            │                       │                    │
│   NODE_ENV === 'development'    isAuth === true          │
│            │                       │                    │
│     POST /api/config          GitHub Git Data API       │
│     POST /api/upload-image    getRef → createBlob →     │
│     POST /api/save-file       createTree → createCommit │
│     POST /api/delete-image    → updateRef               │
│            │                       │                    │
│     写入本地项目文件            推送 commit 到仓库        │
│     （即时生效）               （触发 Cloudflare 构建）   │
└─────────────────────────────────────────────────────────┘
```

**开发环境**：通过 `src/app/api/` 下的路由直接读写本地文件系统，修改即时生效。

**生产环境**：通过 GitHub App 签发 JWT → 获取 Installation Token → 调用 GitHub Git Data API 创建 commit。Cloudflare 监听仓库变更自动触发构建。

**代码模式**：
```typescript
// 典型的双环境保存逻辑
if (process.env.NODE_ENV === 'development') {
    await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardStyles: data })
    })
} else if (isAuth) {
    const { getAuthToken } = await import('@/lib/auth')
    const { getRef, createBlob, createTree, createCommit, updateRef } = await import('@/lib/github-client')
    const { GITHUB_CONFIG } = await import('@/consts')
    const token = await getAuthToken()
    // ... GitHub API 调用链
}
```

> **重要**：生产环境的 GitHub API 函数必须使用**动态 import**，不能静态导入。这是为了避免 `jsrsasign` 等依赖在 Cloudflare Workers 环境中的 bundling 问题。

### 状态管理（Zustand Stores）

所有状态管理使用 Zustand，分布在两个位置：

#### 首页 Stores（`src/app/(home)/stores/`）

| Store | 文件 | 用途 | 持久化 |
|---|---|---|---|
| `useConfigStore` | `config-store.ts` | 站点配置 + 卡片布局样式 | 初始值来自 JSON 文件，编辑后写回 |
| `useCustomComponentStore` | `custom-component-store.ts` | 自定义组件列表 | localStorage 缓存 + JSON 文件回退 |
| `useComponentFavoriteStore` | `component-favorite-store.ts` | 组件收藏 | 仅 localStorage |
| `useLayoutEditStore` | `layout-edit-store.ts` | 拖拽编辑状态/快照 | 内存（不持久化） |
| `useLogStore` | `log-store.ts` | 操作日志 | 内存（不持久化） |
| `useTemplateStore` | `template-store.ts` | 布局模板/历史记录 | localStorage |

#### 编辑器 Stores（`src/app/write/stores/`）

| Store | 文件 | 用途 |
|---|---|---|
| `useWriteStore` | `write-store.ts` | 文章编辑状态（内容/图片/封面） |
| `usePreviewStore` | `preview-store.ts` | 预览面板状态 |

#### 自定义组件持久化策略（重点）

```
数据源优先级：
1. localStorage 中有非空数组 → 使用（用户的本地编辑缓存）
2. localStorage 为空或为 "[]" → 回退到 custom-components.json（部署数据源）
3. SSR 阶段（window === undefined） → 使用 custom-components.json

持久化流程：
- 每次增删改 → 自动写入 localStorage（即时缓存）
- 用户点击"保存到项目" → 写入 custom-components.json（持久化）
- 新访客/清缓存 → 从 custom-components.json 初始化
```

这个设计确保：
- 编辑过程中不丢失中间状态（localStorage 缓存）
- 部署后所有访客都能看到组件（JSON 文件作为数据源）
- "重置全部" 后 localStorage 存的空数组不会阻止 JSON 文件回退

### 配置文件系统

`src/config/` 下的文件既是编译时数据源，也是运行时的可编辑目标：

| 文件 | 用途 | 编辑入口 |
|---|---|---|
| `site-content.json` | 站点标题/描述/头像/首图/背景图等 | 网站设置 |
| `card-styles.json` | 每个卡片的宽/高/位置/顺序/启用状态 | 首页布局 |
| `card-styles-default.json` | 默认布局样式（重置时的参照） | 不可编辑 |
| `custom-components.json` | 自定义组件列表 | 组件商店 |
| `color-presets.json` | 自定义色彩预设 | 色彩配置 |
| `component-registry.ts` | 内置组件注册表（ID → 组件映射） | 代码修改 |
| `card-templates.ts` | 自定义组件的尺寸模板定义 | 代码修改 |

### GitHub API 认证链路

```
用户导入 PEM 私钥
    │
    ├── 可选：AES256 加密后存入 sessionStorage（PEM 缓存）
    │
    v
signAppJwt(appId, pem)  →  JWT Token
    │
    v
getInstallationId(jwt, owner, repo)  →  Installation ID
    │
    v
createInstallationToken(jwt, installationId)  →  Access Token
    │
    v
使用 Access Token 调用 GitHub REST API
    │
    ├── getRef()         获取当前分支 HEAD SHA
    ├── createBlob()     上传文件内容
    ├── createTree()     创建 tree（可批量多文件）
    ├── createCommit()   创建 commit
    └── updateRef()      更新分支指针
```

关键文件：
- `src/lib/auth.ts` — 认证流程编排（含 token 缓存）
- `src/lib/github-client.ts` — GitHub API 底层封装
- `src/hooks/use-auth.ts` — 认证状态管理（Zustand）
- `src/lib/aes256-util.ts` — PEM 加密缓存

### 组件注册与渲染

首页的卡片分为两类：

**内置组件**：在 `src/config/component-registry.ts` 中注册，通过 `COMPONENT_REGISTRY` 映射 ID → React 组件。每个组件有默认样式（宽/高/顺序/位置），实际样式从 `card-styles.json` 读取。

```typescript
// component-registry.ts 中的注册格式
export const COMPONENT_REGISTRY: Record<string, ComponentMeta> = {
    artCard: {
        id: 'artCard',
        name: '头像卡片',
        component: ArtCard,
        defaultStyle: { width: 360, height: 200, order: 3, ... }
    },
    // ...
}
```

**自定义组件**：数据存储在 `custom-components.json`，通过 `CustomCard` 组件统一渲染。支持四种类型：text、image、link、iframe。

**渲染流程**（`src/app/(home)/page.tsx`）：
```
1. 遍历 COMPONENT_REGISTRY → 按 cardStyles 配置渲染内置组件
2. 遍历 customComponents → 用 CustomCard 渲染自定义组件
```

### 动画系统

首页卡片使用两种入场动画方案：

**内置组件**（`Card` 组件）：
```
delay = order * ANIMATION_DELAY (0.1s)
使用 setTimeout + useState 控制显示时机
```

**自定义组件**（`CustomCard` 组件）：
```
delayMs = (maxBuiltinOrder + 1 + index) * ANIMATION_DELAY * 1000
使用 setTimeout + useState 控制入场
不使用 motion.div 的 transition.delay（这会导致拖拽延迟）
```

> **关键设计决策**：自定义组件不使用 `transition={{ delay }}` 是因为 Framer Motion 的 `delay` 会影响**所有**动画属性，包括位置变化。如果用了 `delay`，拖拽时组件位置更新会有明显延迟。正确做法是用 `setTimeout` + `useState` 仅控制初始入场，入场后不再有任何 delay。

### 首页布局系统

卡片定位采用**中心偏移**模式：

```
实际位置 = 视口中心(center) + 偏移量(offsetX/offsetY)

center 由 useCenterStore 计算:
  x = Math.floor(window.innerWidth / 2)
  y = Math.floor(window.innerHeight / 2) - 24
```

布局编辑时的快照/回滚：
```
startEditing() → 保存当前 cardStyles 和 customComponents 的深拷贝
cancelEditing() → 从快照恢复两者
saveEditing()   → 写入 localStorage + 可选持久化到项目
```

**常驻按钮**（ALWAYS_ENABLED_KEYS）：工具栏按钮（编辑/导入/导出/布局设置/组件商店/日志）在布局设置中不允许禁用，防止用户把自己锁在外面。

---

## 页面模块详解

### 首页 `(home)/page.tsx`

入口文件，负责：
- 注册键盘快捷键（Ctrl+L / Ctrl+, 打开设置）
- 渲染内置组件（按 `COMPONENT_REGISTRY` 顺序）
- 渲染自定义组件
- 挂载工具栏按钮（编辑/导入/导出/布局设置/组件商店）
- 挂载拖拽编辑面板

### 网站设置弹窗 `config-dialog/`

三个标签页：
1. **网站设置**（`site-settings/index.tsx`）— 站点标题/描述/首图/背景图/社交按钮
2. **色彩配置**（`color-config.tsx`）— 8 种主题色 + 背景气泡色 + 预设管理
3. **首页布局**（`home-layout.tsx`）— 已移至独立弹窗 `LayoutDialog`

### 文章编辑器 `write/`

图片管理流程：
```
1. 添加图片（URL / 本地文件 / 粘贴）→ 存入 writeStore.images
2. 图片获得临时 ID，在编辑器中用 ![](local-image:<id>) 引用
3. 发布时：
   - 本地图片上传到 public/blogs/<slug>/ 或 GitHub 仓库
   - 替换 local-image:<id> 为实际路径
   - 生成 config.json（元数据）和 index.md（正文）
```

### 其他页面（about/bloggers/pictures/projects/share/snippets）

这些页面遵循统一模式：
```
1. 从 public/<page>/list.json 加载数据
2. 页面内编辑
3. 保存时：
   - dev: POST /api/save-file 写入 JSON + POST /api/upload-image 上传图片
   - prod: GitHub API 批量提交
```

---

## 本地开发 API 路由

所有 API 路由位于 `src/app/api/`，**仅在 `NODE_ENV === 'development'` 时可用**，生产环境一律返回 403。

| 路由 | 方法 | 用途 | 安全措施 |
|---|---|---|---|
| `/api/config` | POST | 写入配置 JSON 文件 | dev-only |
| `/api/upload-image` | POST | 上传图片到 public/ | dev-only + 路径穿越检查 + 类型白名单 + 10MB 限制 |
| `/api/delete-image` | POST | 删除 public/ 下单个文件 | dev-only + 路径安全校验 |
| `/api/delete-dir` | POST | 递归删除 public/ 下目录 | dev-only + 路径安全校验 |
| `/api/save-file` | POST | 写入任意项目文件 | dev-only + 路径安全校验 |
| `/api/layout` | POST | 保存布局 | dev-only |
| `/api/layout/undo` | POST | 撤销布局 | dev-only |

---

## 关键代码模式

### 1. 双环境分支

```typescript
if (process.env.NODE_ENV === 'development') {
    // 调用本地 API
    await fetch('/api/xxx', { method: 'POST', body: ... })
} else if (isAuth) {
    // 动态导入 + GitHub API
    const { getAuthToken } = await import('@/lib/auth')
    const { ... } = await import('@/lib/github-client')
    // ...
}
```

### 2. localStorage + JSON 文件回退

```typescript
const getInitialData = () => {
    if (typeof window === 'undefined') return defaultJson  // SSR
    try {
        const saved = localStorage.getItem('key')
        if (saved) {
            const parsed = JSON.parse(saved)
            if (Array.isArray(parsed) && parsed.length > 0) return parsed
        }
    } catch {}
    return defaultJson  // 回退到项目文件
}
```

### 3. GitHub API commit 链

```typescript
const token = await getAuthToken()
const ref = await getRef(token, owner, repo, `heads/${branch}`)
const blob = await createBlob(token, owner, repo, base64Content, 'base64')
const tree = await createTree(token, owner, repo, [
    { path: 'src/config/xxx.json', mode: '100644', type: 'blob', sha: blob.sha }
], ref.sha)
const commit = await createCommit(token, owner, repo, '提交信息', tree.sha, [ref.sha])
await updateRef(token, owner, repo, `heads/${branch}`, commit.sha)
```

### 4. 图片上传（开发环境）

```typescript
const formData = new FormData()
formData.append('file', file)
formData.append('path', `public/images/xxx/${hash}${ext}`)
await fetch('/api/upload-image', { method: 'POST', body: formData })
```

### 5. 图片文件命名

图片使用 SHA256 哈希命名，避免重复和冲突：
```typescript
const hash = await hashFileSHA256(file)
const ext = getFileExt(file.name)  // .jpg, .png 等
const targetPath = `/images/custom-components/${hash}${ext}`
```

---

## SSR 注意事项

本项目部署在 Cloudflare Workers，静态页面会在服务端渲染。以下是常见陷阱：

### 必须守卫 `window` 访问

```typescript
// 错误 ❌
const width = window.innerWidth

// 正确 ✅
const width = typeof window !== 'undefined' ? window.innerWidth : 0
```

### Zustand Store 初始化

如果 store 初始值需要读取 `localStorage`，必须处理 SSR 情况：
```typescript
const getInitial = () => {
    if (typeof window === 'undefined') return fallbackValue
    // ... 读取 localStorage
}
```

### 动态导入

某些仅在客户端使用的库（如 `jsrsasign`）不应在顶层静态导入，改用动态 `import()`：
```typescript
// 错误 ❌
import { signAppJwt } from '@/lib/github-client'

// 正确 ✅（在需要时动态导入）
const { signAppJwt } = await import('@/lib/github-client')
```

### `'use client'` 指令

所有使用 React hooks、浏览器 API 或 Zustand 的组件必须标注 `'use client'`。

---

## 样式规范

### 毛玻璃拟态（Glassmorphism）

项目使用统一的毛玻璃风格，核心 CSS 类定义在 `globals.css`：

```css
.card {
    background: var(--card);
    border-radius: 40px;
    border: 1px solid var(--border);
    padding: 24px;
    backdrop-filter: blur(4px);
    box-shadow: 0 40px 50px -32px rgba(0,0,0,0.05),
                inset 0 0 20px rgba(255,255,255,0.25);
}
```

### 常用样式 token

| 用途 | className |
|---|---|
| 毛玻璃容器 | `bg-white/60 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl` |
| 主操作按钮 | `rounded-full bg-brand text-white px-5 py-2 text-sm` |
| 次级按钮 | `rounded-full bg-white/20 backdrop-blur-sm px-4 py-1.5 text-xs` |
| 内凹输入框 | `bg-white/10 rounded-xl px-2.5 py-1.5 border-none shadow-inner text-xs` |
| 标准输入框 | `bg-secondary/10 rounded-lg border px-4 py-2 text-sm` |
| 卡片项 | `rounded-2xl bg-white/10 backdrop-blur-sm p-3 hover:bg-white/20` |

### SVG 图标

SVG 文件放在 `src/svgs/`，通过 `@svgr/webpack` 自动转为 React 组件：
```typescript
import DraggerSVG from '@/svgs/dragger.svg'
// 使用：<DraggerSVG className='w-4 h-4' />
```

图标库使用 `lucide-react`。

---

## 部署流程

### Cloudflare Workers 部署

1. 代码推送到 GitHub（`git push origin main`）
2. Cloudflare Git 集成自动触发构建
3. 构建命令：`pnpm run build:cf`（执行 `opennextjs-cloudflare build`）
4. 部署到 Cloudflare Workers 边缘节点

### 部署后内容未更新？

按顺序排查：
1. **Cloudflare 构建缓存**：Dashboard → Workers & Pages → Settings → Builds → Purge build cache → Retry deployment
2. **CDN 缓存**：Dashboard → Caching → Purge Everything
3. **浏览器缓存**：Ctrl+Shift+R 硬刷新

### 通过网页端发布内容后的本地同步

```bash
git pull origin main   # 拉取网页端推送的 commit
```

不同步会导致后续 push 冲突。

---

## 常见问题排查

### 构建失败：`Dynamic require of "xxx" is not supported`

**原因**：Next.js 版本过高（>15.1.0）在 Cloudflare Workers 上不兼容。

**解决**：确保 `package.json` 中 `next` 版本锁定为 `15.1.0`。

### 构建失败：`window is not defined`

**原因**：在非 `'use client'` 组件中或 Zustand store 初始化时直接访问了 `window`。

**解决**：添加 `typeof window !== 'undefined'` 守卫。

### 自定义组件对新访客不可见

**原因**：组件只存在于 localStorage 中，没有通过"保存到项目"持久化到 `custom-components.json`。

**解决**：在组件商店中点击"保存到项目"。

### GitHub API 操作失败（422）

**原因**：操作过快，GitHub API 有速率限制。

**解决**：等待几秒后重试。代码已内置 422 错误提示。

### 图片上传失败

**原因**（开发环境）：Windows 路径分隔符问题。

**解决**：`upload-image` 路由已做 `replace(/\\/g, '/')` 处理。

### 拖拽编辑时自定义组件卡顿

**原因**：误用了 `motion.div` 的 `transition={{ delay }}`，导致位置更新也被延迟。

**解决**：自定义组件使用 `setTimeout` + `useState` 控制入场动画，入场完成后不再有 delay。

---

## 新增功能开发指南

### 添加新的内置组件

1. 在 `src/app/(home)/` 下创建组件文件（如 `my-card.tsx`）
2. 在 `src/config/component-registry.ts` 的 `COMPONENT_REGISTRY` 中注册
3. 在 `src/config/card-styles.json` 中添加默认样式
4. 在 `src/config/card-styles-default.json` 中同步添加

### 添加新的可编辑页面

1. 在对应页面添加编辑 UI
2. 实现保存逻辑（双环境分支）：
   - dev: `fetch('/api/save-file', { body: { path, content } })`
   - prod: GitHub API commit 链
3. 如有图片上传：dev 用 `/api/upload-image`，prod 用 `createBlob`

### 添加新的本地 API 路由

1. 在 `src/app/api/<name>/route.ts` 创建文件
2. **必须**在开头添加环境检查：
   ```typescript
   if (process.env.NODE_ENV !== 'development') {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
   }
   ```
3. 如涉及文件操作，必须做路径安全校验（`resolve()` + `startsWith()`）

### 添加新的配置文件

1. 在 `src/config/` 下创建 JSON 文件
2. 在 `/api/config/route.ts` 中添加对应的写入逻辑
3. 在相关 store 中导入并使用

---

## 代码风格

- **缩进**：Tab（不是空格）
- **引号**：单引号
- **分号**：不使用
- **语言**：UI 文案和注释使用中文，代码变量/函数名使用英文
- **组件**：函数组件 + Hooks（不使用 class 组件）
- **导入顺序**：React → 第三方库 → 项目内部 → 相对路径
- **路径别名**：`@/` = `src/`
