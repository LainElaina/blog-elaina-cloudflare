# LainElaina's Personal Blog 🌌

> 欢迎来到我的个人博客仓库！这里记录了我的技术踩坑、项目复盘以及生活碎片。
> 本博客已全量部署至 Cloudflare Workers 边缘节点，享受极致的全球访问速度。

🌐 [https://blog.lainelaina.top](https://blog.lainelaina.top) 

---

## 🏗️ 架构与模板 (Powered By)

本项目基于修改并适配的开源博客框架构建。如果你也想拥有一个无需服务器、免费且高度自定义的 Serverless 博客并部署到cloudflare，欢迎使用底层模板：

👉 **底层模板仓库：[LainElaina/2025-blog-public](https://github.com/LainElaina/2025-blog-public)**

**模板核心优势：**
* **框架升级**：强制降级至 Next.js 15.1.0 + React 19.0.0，彻底解决原版 Next.js 16 在 Cloudflare 上的 `Dynamic require` 兼容性崩溃问题。
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
- **拖拽式布局调整**：在配置对话框中启用"进入主页拖拽布局"，实时拖拽调整卡片位置和大小
- **双环境保存**：
  - 开发模式：自动保存到本地 `src/config/card-styles.json`
  - 生产模式：通过 GitHub App 密钥推送到仓库（commit: "修改主页拖拽布局"）
- **布局历史记录**：
  - 自动保存每次修改的布局快照
  - 支持自定义命名、加载、重命名、删除历史布局
  - 数据存储在浏览器 localStorage
- **导入/导出**：支持导出布局为 JSON 文件，或导入已有配置
- **一键重置**：恢复到项目默认布局配置

### 📊 操作日志系统
- **可拖拽日志窗口**：实时记录所有布局编辑操作
- **日志分级**：info/success/warning/error 带颜色标识
- **详细信息**：显示时间戳和操作详情，支持复制
- **导出功能**：导出日志为 JSON 文件用于问题排查
- **开关控制**：在配置对话框的布局标签中启用/禁用

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

---

## 🛠️ Tech Stack

* **Framework:** Next.js 15.1.0 (App Router)
* **UI & Styling:** React 19, TailwindCSS
* **Deployment & Edge Compute:** Cloudflare Workers
* **Package Manager:** pnpm
