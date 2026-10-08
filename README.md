# 档案桌面 · 互动个人作品集（Interactive Portfolio）

以「电脑桌面」为外壳的互动式作品集：视觉小说开场 → 开机动画 → 新人引导 → 选择桌面 →
桌面图标 / 文件夹 / 塔罗牌解锁 → 报告式项目页 → 完成度追踪。

- 前端：Vite 6 + React 18 + TypeScript + Zustand + Zod
- 服务端：Node 22 原生 HTTP 服务（`server/`），同时托管前端产物与内容/素材 API
- 数据：PostgreSQL —— **内容与全部素材（图片 / 音频 / 字体 / 演示小程序）都存放在数据库里，仓库中不包含任何素材文件**
- 部署：**Cloudflare Pages（静态 SPA + Pages Functions API）+ Workers KV（内容与素材）**，无需服务器、无需备案、**无需银行卡**
- 可选历史路径：`docker-compose.prod.yml` + `server/`（自托管 Node + PostgreSQL），仅作本地开发/兜底

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
│   ├── editor/                # 可视化编辑器（连 /api，改的是数据库里的 draft）
│   ├── lib/media.ts           # ★ 素材 URL 解析（bundle id / 历史 /assets 路径 → /api/assets/*）
│   └── styles.css
├── functions/                 # ★ Cloudflare Pages Functions（生产 API）
│   ├── api/[[path]].ts        # /api/health · /api/content · /api/assets（KV 读写 + Range/ETag）
│   └── demos/[[path]].ts      # /demos/**（agent 演示小程序）
├── wrangler.toml              # Pages 项目 + KV namespace 绑定
├── server/                    # 本地开发用的 Node 服务（自托管兜底）
│   ├── index.mjs              # 路由：SPA 静态托管 + /api/content + /api/assets + /demos
│   ├── db.mjs                 # PostgreSQL 访问层（content_documents / media_assets）
│   └── lib/                   # http 工具（Range/ETag/gzip/安全路径）、env 读取
├── tools/
│   ├── optimize-media.mjs     # ★ 素材压缩：PNG→WebP、WAV→OGG/Opus（体积 -90%）
│   ├── upload-assets.mjs      # ★ 优化后的素材/内容上传到 Workers KV（--publish/--prune）
│   ├── create-cloudflare-resources.mjs  # ★ 一键创建 Pages 项目 + KV + ADMIN_TOKEN
│   ├── import-media.mjs       # （本地/自托管）素材 + 内容导入 PostgreSQL
│   ├── export-media.mjs       # 从数据库导出（备份/迁移）
│   ├── publish.mjs            # draft → published
│   └── dev-all.mjs            # 一条命令起本地 API + Vite
├── tests/
│   ├── unit/                  # vitest：契约、流程、存档、桌面 reducer、http 工具、导入集成
│   ├── e2e/                   # playwright：完整通关流程 + 素材/权限断言
│   └── support/               # E2E 夹具（媒体文件在运行时生成，不入库）
├── Dockerfile                 # 多阶段构建（CI 中使用）
├── docker-compose.prod.yml    # ECS 部署文件（只有 app 服务，无 build）
└── .github/workflows/deploy.yml
```

## 2. 数据模型

数据库（生产：ECS 上已有 postgres 容器中的独立库 `seki_portfolio`）只有两张表：

| 表 | 说明 |
| --- | --- |
| `content_documents(id, doc jsonb, updated_at)` | `id` 为 `draft` / `published`；播放端只读 published，编辑器读写 draft |
| `media_assets(id, kind, path, mime_type, file_name, original_name, byte_size, sha256, data bytea, ...)` | 所有素材的二进制内容；`sha256` 同时作为 HTTP `ETag` |

素材 URL 约定：

- `/api/assets/<id>` —— 内容 bundle 里引用的素材（`asset-*`）
- `/api/assets/static/<path>` —— 代码内固定引用的素材（原 `public/assets/**`：字体、塔罗牌、引导图…）
- `/demos/<app>/...` —— agent 演示小程序（原 `public/demos/**`，以 iframe 加载，保留相对路径引用）

历史内容里的 `/assets/xxx` 引用无需改写：`src/lib/media.ts` 会在渲染时映射到 `/api/assets/static/xxx`。

## 3. 本地开发

```bash
# 1) 起一个本地 Postgres（或使用任意可访问的实例）
docker run -d --name seki-pg \
  -e POSTGRES_USER=seki -e POSTGRES_PASSWORD=seki -e POSTGRES_DB=seki_portfolio \
  -p 55432:5432 postgres:16-alpine

# 2) 准备环境变量
cp .env.example .env      # 修改 DATABASE_URL / PORT / ADMIN_TOKEN（本地可留空）

# 3) 安装依赖
npm install

# 4) 导入内容与素材（素材目录不随仓库分发，见下节）
npm run content:import -- --source /path/to/seki-media --publish

# 5) 启动（API 8787 + Vite 5173，已配置 /api、/demos 代理）
npm run dev:all
```

- 播放端：<http://localhost:5173/>
- 草稿预览：`http://localhost:5173/?preview=1`
- 编辑器：`http://localhost:5173/?editor=1`（生产环境需带 `&token=<ADMIN_TOKEN>`，会存到 localStorage）
- 指定桌面：`?desktop=content|education|sales`

### 素材源目录（不进入仓库）

`npm run content:import` 读取如下结构：

```
seki-media/
├── content.json          # 内容 bundle（含 assets[].id / assets[].path）
├── assets/**             # bundle 引用的素材，路径与 assets[].path 一致
├── static/**             # 代码固定引用的素材（fonts/ tarot/ onboarding/ canva-original/ ...）
└── demos/**              # agent 演示小程序
```

- 导入时以 `id` 为主键（static / demo 的 id 就是 `static/...`、`demo/...`），可反复执行；
- `--publish` 会同时把 draft 发布成 published；`--prune` 会删除数据库中多余素材；
- 反向导出（备份）：`npm run content:export -- --out ./seki-media-backup`。

## 4. 测试

```bash
npm run lint          # eslint（src / server / tools / tests）
npm run typecheck     # tsc --noEmit
npm test              # vitest 单元测试（设置 TEST_DATABASE_URL 时会额外跑数据库集成测试）
npm run build         # tsc -b && vite build
npm run test:e2e      # Playwright 浏览器端到端（自动启动测试库 + 夹具内容 + 站点服务）
```

E2E 说明：

- `tests/support/fixtures.mjs` 在运行时**生成**所需的 PNG / WAV / demo HTML（因此仓库里没有任何素材）；
- `tests/support/e2e-server.mjs` 会建表、导入夹具、把 `dist/` + API 一起跑起来（等价生产形态）；
  **安全阀**：该脚本会 `--prune` 目标库，因此只接受库名包含 `e2e` / `test` 的数据库（默认 `seki_e2e`）；
- 覆盖：完整通关流程（开场→开机→引导→选桌面→抽牌→项目页→进度 100%→刷新存档→重置）、
  素材 ETag/304/Range、demo 小程序相对资源、未知素材 404、健康检查、编辑器权限（无 token 写接口 403）；
- 首次运行需要浏览器：`npx playwright install chromium`。

```bash
# 本地一次性跑完整流水线（与 CI 一致）
TEST_DATABASE_URL=postgres://seki:seki@127.0.0.1:55432/seki_e2e \
  npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e
```

## 5. 部署（Cloudflare Pages + Workers KV，无需备案、无需银行卡）

```
GitHub Actions: verify(lint/type/单测/E2E) → build → wrangler pages deploy dist
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

### 5.5 历史自托管（可选，仓库仍保留）

`docker-compose.prod.yml` + `server/` 可在任意支持 Docker 的机器上运行（Node + PostgreSQL），
用于本地开发或作为备份方案；不再随 CI 自动部署。

## 6. 运维

```bash
# 线上健康检查（Cloudflare）
curl -fsS https://seki-portfolio.pages.dev/api/health     # {"ok":true,"storage":"kv","assets":{...}}

# 查看 Pages 部署记录 / 日志
npx wrangler pages deployment list --project-name seki-portfolio

# 回滚：Pages 控制台 → Deployments → 选中上一个版本 → Rollback
```

备份：素材源目录（`seki-media/`）+ KV 里的 `content/*.json` 即可完整恢复（`tools/export-media.mjs` 用于自托管数据库导出）。

## 7. 常见问题

| 现象 | 处理 |
| --- | --- |
| 页面显示“内容加载失败 / 内容尚未初始化” | KV 里没有 published 文档：执行 5.3 上传或调 `POST /api/publish` |
| 图片/音频 404 | 素材未导入该 id：检查 `--source` 目录结构，重新 `npm run upload:assets -- --source ... --publish` |
| 编辑器保存报 403 | 生产环境需要 `?editor=1&token=<ADMIN_TOKEN>` |
| E2E 起不来 | 检查 `TEST_DATABASE_URL` 可写、`dist/` 已构建、浏览器已 `npx playwright install chromium` |
| 想换域名 | Cloudflare 控制台 → Pages → Custom domains（自己的域名需先托管到 Cloudflare DNS；**无需 ICP 备案**） |
| 素材没更新 | 浏览器对素材是强缓存（immutable），改名或清缓存；`upload:assets --prune` 可清理 KV 里的旧 key |
