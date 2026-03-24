**2025-PUBLIC-BLOG部署到Cloudflare完整指南+避坑** 适用仓库：`YYsuni/2025-blog-public`  
环境背景：Windows 系统本地部署 / WSL 推荐  

本文在win11 25H2 系统上测试，部署到cloudflare成功，其他系统或云服务厂商未知可行性。
如有问题请提交到我的邮箱 lainelaina520@gmail.com
发送前请确保您已经询问过Gemini、Grok、ChatGPT等常见AI。确认AI无法解决您的疑惑再发送给我（对于本文的话题我不一定能提供比这些AI更有用的建议）

### 一、为什么选择 Cloudflare 而不是 Vercel？

1. **Vercel 需要花钱吗？** 不需要。Vercel Hobby 免费套餐完全够用。原仓库 README 主推 Vercel，只是因为它“一键部署”最简单，适合完全不想碰命令行的新手。

2. **为什么强烈推荐部署到 Cloudflare？** - 原生支持：仓库内置 `@opennextjs/cloudflare` 适配器，自带 `build:cf`、`deploy` 脚本，`wrangler.toml` 已预配置。  
   - 边缘计算：部署后是 Cloudflare Workers，全球 CDN 极致快、免费流量无限制。  
   - 域名优势：你的域名已在 Cloudflare，直接绑定自定义域名免费且秒生效。

### 二、部署前置准备（Windows 新手必读）

本项目强制使用 pnpm（`pnpm-lock.yaml`）。

1. 检查 Node.js（必须 LTS）  
   ```powershell
   node -v
   ```
   没有就去 nodejs.org 下载安装，重启终端。

2. 安装 pnpm（最稳方式）  
   ```powershell
   npm install -g pnpm@latest
   ```
   安装完**必须关闭当前 PowerShell，重新打开新窗口**，然后验证：
   ```powershell
   pnpm --version
   ```

### 三、核心部署流程（CLI 手动部署）—— 🚨 内含提前避坑

**Step 1：Fork + 克隆** Fork 到自己账号 → 本地克隆：
```powershell
git clone https://github.com/你的用户名/2025-blog-public.git
cd 2025-blog-public
```

> 🛑 **【核心提前避坑】** 🛑
> 在你执行 `pnpm install` 之前，**必须**先处理以下三个致命坑点，否则后续构建 100% 报错！

**坑点一：Next.js 16 不兼容 Cloudflare（最致命）** 现象：降级前无论怎么改都 500，日志各种 handler32 / middleware 报错。  
原因：原仓库默认是 Next.js 16，opennextjs-cloudflare 适配器还没完全跟上。  
解决（我们最终方案）：执行下列命令
```powershell
pnpm add next@15.1.0 react@19.0.0 react-dom@19.0.0
Remove-Item -Recurse -Force .next, .open-next
```
（降级后功能暂未发现有任何损失）

**坑点二：Cloudflare 构建失败提示 `ERROR packages field missing`（本次新增）**
现象：在 Cloudflare 自动构建时，日志报错 `ERROR packages field missing or empty. For help, run: pnpm help install`。
原因分析：原仓库遗留了 `pnpm-workspace.yaml` 文件。Cloudflare Workers 的 Git 集成构建环境是一个干净的容器（无预装缓存或本地 store），运行 `pnpm install --frozen-lockfile` 时，pnpm 在严格模式下发现该文件会误认为这是 monorepo（工作区项目），强制校验 `packages` 字段。本地有缓存能侥幸通过，云端直接拦截。
解决（采用方案一最彻底）：本地项目根目录直接删除该文件。
```powershell
Remove-Item pnpm-workspace.yaml
```

**坑点三：Dynamic require of "/.next/server/middleware-manifest.json" is not supported（500 错误）** 原因：pnpm 默认符号链接 + opennextjs-cloudflare 打包冲突。  
解决：在项目根新建 `.npmrc`：
```ini
#如果已经有.npmrc就在末尾加上这两行
node-linker=hoisted
shamefully-hoist=true
```

👉 **完成上述 3 个避坑操作后，再执行完整清理与安装命令：**
```powershell
Remove-Item -Recurse -Force node_modules, .pnpm-store, .open-next, .next
pnpm install
```

**Step 2：登录 Cloudflare** 
```powershell
npx wrangler login
```
![](/blogs/Blog-CF1/277bc4b971804b9d.png)
**Step 3：创建 GitHub App（网页编辑鉴权）** GitHub → Settings → Developer settings → New GitHub App  
- 只给仓库 **Write** 权限  
- 记下 **App ID** - 下载 **Private Key (.pem)**（本地安全保存，**绝不可以**上传或填 Cloudflare 或告诉任何其他人） 
- 把 App 安装到你的 fork 仓库
![](/blogs/Blog-CF1/09bc015135f11e21.png)

**Step 4：Windows 构建避坑** 直接 `pnpm run deploy` 容易失败。正确顺序：
强烈推荐使用**管理员权限-终端**避开报错。或者用WSL可以避开报错。
```powershell
pnpm run build:cf    # 必须先跑这个生成 .open-next
pnpm run deploy
```

> 💡 **【提前避坑：Wrangler 部署警告“会覆盖云端配置”】**
> 解决：不要直接 wrangler deploy，用 `pnpm run deploy`（它已正确处理）+ Git 集成自动部署。

**终极推荐**：用 WSL（彻底避开 Windows symlink 坑）。

### 四、Cloudflare 后台必配

1. **环境变量（4 个，必须！）** Worker → Settings → Variables and Secrets（全部选 **文本** 类型）：
   - `NEXT_PUBLIC_GITHUB_OWNER` = 你的 GitHub 用户名  
   - `NEXT_PUBLIC_GITHUB_REPO` = 2025-blog-public  
   - `NEXT_PUBLIC_GITHUB_BRANCH` = main  
   - `NEXT_PUBLIC_GITHUB_APP_ID` = 你创建的 App ID  

   保存后 **必须 Redeploy**（Deployments 页点 Redeploy）。

2. **绑定自定义域名**（lainelaina.top 或 blog.lainelaina.top）  
   Worker → Triggers → Custom domains → Add custom domain。
   > 💡 **【提前避坑：自定义域名大小写敏感】**
   > 输入 `blog.LainElaina.top` 会报“主机名不匹配”。必须全小写 `blog.lainelaina.top`。

### 五、Git 自动部署（推荐长期使用）

1. Worker 设置 → **构建** → **Git 存储库** → 连接你的仓库（LainElaina/2025-blog-public）。
2. **关键配置**（必须改成下面这样，否则构建失败）：
   - **构建命令**：`pnpm install && pnpm run build:cf`
   - **部署命令**：`pnpm run deploy`
   - **版本命令**：**清空**（不要留 `npx wrangler versions upload`）
   
   > 💡 **【提前避坑：构建缓存没开 → 每次 pnpm install 巨慢】**
   > 解决：Git 集成页面 → **构建缓存** → **启用**。第一次慢，之后恢复缓存只需几秒。

3. **环境变量迁移**：
   > 💡 **【提前避坑：环境变量在 Git 集成里丢失】**
   > Git 自动构建的运行时变量是独立的，必须在 Git 集成页的“变量和机密”再加一次 4 个NEXT_PUBLIC_ 变量。
   > ![](/blogs/Blog-CF1/d9ae22d675cc152c.png)

保存后 push 任意 commit 即可测试自动构建。

### 六、日常协作与 Git 冲突避坑

在博客日常运行后，如果你需要在本地更新代码，必定会遇到以下问题：

**坑点：Git push 被拒绝（fetch first）** 现象：`! [rejected] main -> main (fetch first)`  
解决：`git pull origin main` 先合并远程，再 `git push`（保留本地所有修改）。

每次在blog进行操作后实际上都是通过github app的一个bot来进行更新仓库，所以这时候仓库的文件会和你本地的不匹配，你需要在本地拉取更新后才能push。

### 七、日常使用与最终建议

- 网页端编辑（GitHub App + Private Key）：保存后自动 commit → Cloudflare 自动构建 → 几分钟内全站更新。  
- 本地改代码：`git add . → git commit → git push` 即可触发自动部署。  
- 想去掉右上角“草”特效：按 README 删两行代码即可。  
- 全部免费、无服务器、无隐藏费用。

部署完后你的博客已经跑在 Cloudflare 全球边缘节点上了！  

> 不过每次更新的时候cloudflare最后一步——部署到cloudflare全球网络 会花 1 分钟多。
> 所以总体而言是 3 分钟后可以看见效果，会比直接在Vercel部署要慢 1 分钟多。

本文由我拟初版，踩坑后由Gemini 3.1 pro总结重构，已人工初步审查，认为可用，如果发现有问题，您可以发送邮件联系我反馈~： lainelaina520@gmail.com
