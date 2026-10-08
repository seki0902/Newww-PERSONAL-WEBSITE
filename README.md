# 档案桌面 · 互动个人作品集（Interactive Portfolio）

以「电脑桌面」为外壳的互动式作品集：视觉小说开场 → 开机动画 → 新人引导 → 选择桌面 →
桌面图标 / 文件夹 / 塔罗牌解锁 → 报告式项目页 → 完成度追踪。

- 前端：Vite 6 + React 18 + TypeScript + Zustand + Zod（构建产物是纯静态文件）
- 服务端：**只有一套实现** —— Cloudflare Pages Functions（`functions/`），本地与线上跑同一份代码
- 数据：Workers KV —— **内容与全部素材（图片 / 音频 / 字体 / 演示小程序）都在 KV 里，仓库中不包含任何素材文件**
- 部署：**Cloudflare Pages（静态 SPA + Pages Functions API）+ Workers KV**，无需服务器、无需备案、**无需银行卡**，生产不依赖 Node 进程
- 本地开发：`wrangler pages dev`（生产同款 Workers 运行时 + 本地 KV），不需要 Postgres

---

## 1. 目录结构

```
.
├── index.html                 # SPA 入口
├── src/
│   ├── App.tsx                # 播放器入口（?editor=1 走编辑器）
│   ├── blocks/                # 项目页区块渲染（text/image/video/metrics/comparison/table/flow/cards/...）
│   ├── renderers/             # 画面层（视觉小说、开机、引导、桌面窗口、塔罗、项目页）
│   ├── runtime/               # 状态机：zustand store / 存档 / 桌面窗口 reducer / 进度 flow
│   ├── schema/                # ★ 内容契约（zod）：区块、项目、页面、桌面、素材、校验函数
│   ├── content/               # 仅保留 projects.json（纯文本内容数据，不含素材）
│   ├── content-bundle/        # 拉取 /api/content 并校验合并
│   ├── editor/                # 可视化编辑器（连 /api，改的是 KV 里的 draft）
│   ├── lib/media.ts           # ★ 素材 URL 解析（bundle id / 历史 /assets 路径 → /api/assets/*）
│   └── styles.css
├── functions/                 # ★ 唯一的服务端实现（生产 + 本地共用）
│   ├── api/[[path]].ts        # /api/health · /api/content · /api/assets（KV 读写 + Range/ETag）
│   └── demos/[[path]].ts      # /demos/**（agent 演示小程序）
├── wrangler.toml              # Pages 项目 + KV namespace 绑定
├── tools/
│   ├── optimize-media.mjs     # ★ 素材压缩：PNG→WebP、WAV→OGG/Opus（体积 -90%）
│   ├── upload-assets.mjs      # ★ 内容/素材上传：远程 Workers KV 或本地 KV（--local）
│   ├── create-cloudflare-resources.mjs  # ★ 一键创建 Pages 项目 + KV + ADMIN_TOKEN
│   └── dev-all.mjs            # 一条命令起本地 Workers 运行时 + Vite
├── tests/
│   ├── unit/                  # vitest：契约、流程、存档、桌面 reducer、素材 URL
│   ├── e2e/                   # playwright：完整通关流程 + 素材/权限断言
│   └── support/               # E2E 夹具与本地 Workers 服务器（媒体文件运行时生成，不入库）
└── .github/workflows/deploy.yml
```

## 2. 数据模型（Workers KV）

| Key | 说明 |
| --- | --- |
| `content/draft.json` | 编辑器保存的草稿内容 bundle（metadata 记 `uploaded` 时间） |
| `content/published.json` | 发布后的内容 bundle；播放端只读这个 |
| `content/assets.json` | 素材索引：id / 类型 / 路径 / MIME / 字节数 / `url`（含 `static/**`） |
| `media/<id>` | bundle 素材的二进制（metadata：`contentType` / `fileName` / `size`） |
| `media/static/<path>` | 代码内固定引用的素材（字体、塔罗牌、引导图…） |
| `demo/<path>` | agent 演示小程序（`/demos/<app>/...`） |

素材 URL 约定：

- `/api/assets/<id>` —— 内容 bundle 里引用的素材
- `/api/assets/static/<path>` —— 代码内固定引用的素材（原 `public/assets/**`）
- `/demos/<app>/...` —— agent 演示小程序（原 `public/demos/**`，以 iframe 加载，保留相对路径引用）

历史内容里的 `/assets/xxx` 引用无需改写：`src/lib/media.ts` 会在渲染时映射到 `/api/assets/static/xxx`。

## 3. 本地开发

本地不需要数据库：`wrangler pages dev` 用 miniflare 起与生产同款的 Workers 运行时，
本地 KV 存在 `.wrangler/state`（已 gitignore）。

```bash
# 1) 安装依赖
npm install

# 2) 灌入内容与素材（素材目录不随仓库分发，见下节）
#    本地 KV；--publish 会同时写 published.json
npm run content:local -- --source ../seki-media-opt --publish

# 3) 启动（Workers 运行时 8788 + Vite 5173，已配置 /api、/demos 代理；dist 缺失时会自动构建）
npm run dev:all
```

- 播放端：<http://localhost:5173/>
- 草稿预览：`http://localhost:5173/?preview=1`
- 编辑器：`http://localhost:5173/?editor=1&token=dev-token`（本地 ADMIN_TOKEN 由 `dev:all` / `dev:api` 注入 `dev-token`）
- 指定桌面：`?desktop=content|education|sales`
- 只起 API：`npm run dev:api`（8788，数据在 `.wrangler/state`）

### 素材源目录（不进入仓库）

`content:local` / `upload:assets` 读取如下结构：

```
seki-media-opt/
├── content.json          # 内容 bundle（含 assets[].id / assets[].path）
├── assets/**             # bundle 引用的素材，路径与 assets[].path 一致  → media/<id>
├── static/**             # 代码固定引用的素材（fonts/ tarot/ onboarding/ canva-original/ ...）→ media/static/<相对路径>
└── demos/**              # agent 演示小程序                             → demo/<相对路径>
```

- 以 key 为单位覆盖写入，可反复执行；`--publish` 同时写 `content/published.json`；
- 本地 `--prune` 会重置 `.wrangler/state/v3/kv`；远程 `--prune` 会删掉 KV 里多余的 key；
- 备份就是素材源目录 + KV 里的 `content/*.json`。

## 4. 测试

```bash
npm run lint          # eslint（src / functions / tools / tests）
npm run typecheck     # tsc --noEmit（前端 + functions 两套 tsconfig）
npm test              # vitest 单元测试（纯前端逻辑，无需外部依赖）
npm run build         # tsc -b && vite build
npm run test:e2e      # Playwright：夹具 → 本地 KV → wrangler pages dev → 浏览器用例
```

E2E 说明：

- `tests/support/fixtures.mjs` 在运行时**生成**所需的 PNG / WAV / demo HTML（因此仓库里没有任何素材文件）；
- `tests/support/e2e-worker.mjs` 把夹具写进本地 KV，再起 `wrangler pages dev`：
  浏览器用例跑的就是**生产同一份 Functions 代码 + 同一套 KV 键布局**，本地没有第二套 API 实现；
- 覆盖：完整通关流程（开场→开机→引导→选桌面→抽牌→项目页→进度 100%→刷新存档→重置）、
  素材 ETag/304/Range、demo 小程序相对资源、未知素材 404、健康检查、素材删除接口、编辑器权限（无 token 写接口 403）；
- 首次运行需要浏览器：`npx playwright install chromium`。

```bash
# 本地一次性跑完整流水线（与 CI 一致）
npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e
```

## 5. 部署（Cloudflare Pages + Workers KV，无需备案、无需银行卡）

```
GitHub Actions: verify(lint/类型/单测/E2E) → build → wrangler pages deploy dist
素材与内容：   本地 npm run media:optimize → npm run upload:assets（Workers KV）
运行时：       Pages Functions 从 KV 读取 content/*.json 与 media/*，支持 Range/ETag/强缓存
容量：         素材压缩后约 7MB（KV 免费额度：1GB 存储 / 10 万读 / 1 千写每天）
```

### 5.1 一次性配置（Cloudflare，无需绑卡）

1. 注册/登录 **Cloudflare**（免费）
2. 创建 **API Token**：右上头像 → My Profile → **API Tokens** → Create Token → *Custom token*
   - `Account` → `Cloudflare Pages` → **Edit**
   - `Account` → `Workers KV Storage` → **Edit**
3. 记下 **Account ID**（控制台首页右侧 / URL 里的 32 位串）

然后一条命令建好所有资源（Pages 项目 + KV 命名空间 + 编辑器密钥，并写回 `wrangler.toml`）：
```bash
CLOUDFLARE_ACCOUNT_ID=<account id> CLOUDFLARE_API_TOKEN=<token> npm run cf:setup
```

### 5.2 GitHub 仓库 Secrets / Variables

| 类型 | 名称 | 用途 |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | CI 发布 Pages |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | CI 发布 Pages |
| Variable | `CF_PAGES_PROJECT` | 可选，默认 `seki-portfolio` |
| Variable | `PUBLIC_BASE_URL` | 可选，冒烟测试地址（默认 `https://seki-portfolio.pages.dev`） |

编辑器写权限（`ADMIN_TOKEN`）由 `cf:setup` 随机生成并写入 Pages 项目密钥（只在执行时打印一次，可用
`npx wrangler pages secret put ADMIN_TOKEN --project-name seki-portfolio` 轮换）。

### 5.3 首次/日常发布

```bash
# 1) 压缩素材（PNG→WebP、WAV→OGG，约 -90%）
npm run media:optimize -- --source ../seki-media --out ../seki-media-opt

# 2) 上传内容与素材到 Workers KV（首次需 --publish）
CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... KV_NAMESPACE_ID=... npm run upload:assets -- --source ../seki-media-opt --publish

# 3) 发布前端（本地或直接合并到 master 让 CI 发布）
npx wrangler pages deploy dist --project-name seki-portfolio
```

### 5.4 内容日常更新

- 线上编辑器：`https://<项目>.pages.dev/?editor=1&token=<ADMIN_TOKEN>`（保存 Draft → 发布，写入 KV）
- 或本地改完用 `upload:assets --publish` 覆盖

## 6. 运维

```bash
# 线上健康检查（Cloudflare）
curl -fsS https://seki-portfolio.pages.dev/api/health     # {"ok":true,"storage":"kv","assets":{...}}

# 查看 Pages 部署记录 / 日志
npx wrangler pages deployment list --project-name seki-portfolio

# 回滚：Pages 控制台 → Deployments → 选中上一个版本 → Rollback
```

备份：素材源目录（`seki-media-opt/`）+ KV 里的 `content/*.json`，用 `npm run upload:assets` 即可回灌。

## 7. 常见问题

| 现象 | 处理 |
| --- | --- |
| 页面显示“内容加载失败 / 内容尚未初始化” | KV 里没有 published 文档：执行 5.3 上传，或本地先 `npm run content:local -- --publish` |
| 图片/音频 404 | 素材未导入该 id：检查 `--source` 目录结构，重新 `npm run upload:assets -- --source ... --publish` |
| 编辑器保存报 403 | 线上需要 `?editor=1&token=<ADMIN_TOKEN>`；本地默认 token 是 `dev-token` |
| 本地改了内容不生效 | 本地 KV 在 `.wrangler/state`，确认用的是同一 `--persist-to`；必要时 `content:local -- --prune` 重置 |
| E2E 起不来 | 检查 `dist/` 已构建（`npm run build`）、浏览器已 `npx playwright install chromium`；端口默认 8790，可用 `E2E_PORT` 覆盖 |
| 想换域名 | Cloudflare 控制台 → Pages → Custom domains（自己的域名需先托管到 Cloudflare DNS；**无需 ICP 备案**） |
| 素材没更新 | 浏览器对素材是强缓存（immutable），改名或清缓存；`upload:assets --prune` 可清理 KV 里的旧 key |
