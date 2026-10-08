# 档案桌面 · 互动个人作品集（Interactive Portfolio）

以「电脑桌面」为外壳的互动式作品集：视觉小说开场 → 开机动画 → 新人引导 → 选择桌面 →
桌面图标 / 文件夹 / 塔罗牌解锁 → 报告式项目页 → 完成度追踪。

- 前端：Vite 6 + React 18 + TypeScript + Zustand + Zod
- 服务端：Node 22 原生 HTTP 服务（`server/`），同时托管前端产物与内容/素材 API
- 数据：PostgreSQL —— **内容与全部素材（图片 / 音频 / 字体 / 演示小程序）都存放在数据库里，仓库中不包含任何素材文件**
- 部署：GitHub Actions 构建镜像 → 阿里云 ACR → ECS 只 `docker compose pull && up`（**禁止在 ECS 上 build**）

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
├── server/                    # 站点服务
│   ├── index.mjs              # 路由：SPA 静态托管 + /api/content + /api/assets + /demos
│   ├── db.mjs                 # PostgreSQL 访问层（content_documents / media_assets）
│   └── lib/                   # http 工具（Range/ETag/gzip/安全路径）、env 读取
├── tools/
│   ├── import-media.mjs       # 素材 + 内容导入数据库（--publish/--prune）
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

## 5. 部署（GitHub Actions → 阿里云 ACR → ECS）

流水线 `.github/workflows/deploy.yml`：

1. **verify**：`npm ci` → lint → typecheck → 单元测试（自带 postgres service）→ build → 安装 Chromium → 浏览器 E2E；
2. **build-and-push**：多阶段构建镜像并推送到 ACR（`provenance/sbom` 关闭，个人版 ACR 不支持）；
3. **deploy**：`scp` compose 文件到 ECS → `docker login` → 写入 `.env` → `docker compose pull app` → `up -d --no-deps app` → 健康检查 `/api/health`。

触发条件：推送到 `master`/`main`（PR 只跑 verify）；也支持手动 `workflow_dispatch`。
**ECS 上不会执行任何构建**：compose 只有 `image:`，没有 `build:`。

### 5.1 需要在 GitHub 仓库里配置的 Secrets / Variables

| 类型 | 名称 | 说明 |
| --- | --- | --- |
| Secret | `ACR_USERNAME` | 阿里云容器镜像服务用户名（固定密码方式） |
| Secret | `ACR_PASSWORD` | ACR 固定密码 |
| Secret | `ECS_HOST` | ECS 公网 IP |
| Secret | `ECS_USER` | `root` |
| Secret | `ECS_SSH_KEY` | 部署私钥全文（见 5.3 生成方式） |
| Secret | `ECS_PORT` | 可选，默认 22 |
| Secret | `DATABASE_URL_B64` | 数据库连接串的 base64（见 5.4） |
| Secret | `ADMIN_TOKEN_B64` | 编辑器写入令牌的 base64（可留空则写接口在 production 关闭） |
| Variable | `ACR_REPOSITORY` | 可选，默认 `touhou-trpg/seki-portfolio` |
| Variable | `ACR_REGISTRY` / `ACR_PULL_REGISTRY` | 可选，默认 `crpi-nqwu6u57qjindq7p.cn-hangzhou.personal.cr.aliyuncs.com` |
| Variable | `DEPLOY_DIR` | 可选，默认 `/opt/seki-portfolio` |

### 5.2 服务器侧现状（已配置）

```
/opt/seki-portfolio/
├── docker-compose.prod.yml
├── .env                  # APP_IMAGE / DATABASE_URL / ADMIN_TOKEN（600 权限）
└── deploy_key            # GitHub Actions 部署私钥（复制到 Secrets.ECS_SSH_KEY 后建议删除）
```

- 数据库：复用 `touhou-trpg-db`（postgres:16-alpine）容器内的独立库 `seki_portfolio`，
  角色 `seki` 只拥有该库；应用容器通过外部网络 `touhou-trpg_default` 以 `touhou-trpg-db:5432` 访问；
- 端口：容器发布在宿主机 `8080`；
- 资源限制：`mem_limit 384m` / `cpus 0.5`，避免影响同机 n8n 与 touhou-trpg。

### 5.3 生成部署密钥（服务器上执行）

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions-seki-portfolio" -f /opt/seki-portfolio/deploy_key
cat /opt/seki-portfolio/deploy_key.pub >> /root/.ssh/authorized_keys
cat /opt/seki-portfolio/deploy_key        # 复制到 GitHub Secret ECS_SSH_KEY，然后删除该文件
```

### 5.4 DATABASE_URL_B64 / ADMIN_TOKEN_B64 的生成

```bash
# 在服务器上读取（不要在聊天/日志里明文粘贴）
grep '^DATABASE_URL=' /opt/seki-portfolio/.env | cut -d= -f2- | base64 -w0
grep '^ADMIN_TOKEN='  /opt/seki-portfolio/.env | cut -d= -f2- | base64 -w0
```

### 5.5 首次部署（数据库为空时）

```bash
# 在能访问数据库的机器上执行一次（素材目录见第 3 节）
DATABASE_URL='postgresql://seki:<密码>@<host>:5432/seki_portfolio' \
  npm run content:import -- --source ./seki-media --publish
```

数据库建表由服务启动时自动完成（`ensureSchema`）。

## 6. 运维

```bash
cd /opt/seki-portfolio
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=100 app
curl -fsS http://127.0.0.1:8080/api/health    # {"ok":true,"db":"up","assets":{...}}

# 回滚：把 .env 里 APP_IMAGE 换成上一个 sha，然后
docker compose -f docker-compose.prod.yml pull app && docker compose -f docker-compose.prod.yml up -d --no-deps app
```

备份（内容 + 素材都在库里，一条命令即可）：

```bash
docker exec touhou-trpg-db pg_dump -U seki -Fc seki_portfolio > seki_portfolio-$(date +%F).dump
```

## 7. 常见问题

| 现象 | 处理 |
| --- | --- |
| 页面显示“内容加载失败 / 内容尚未初始化” | 数据库里没有 published 文档：执行第 5.5 节导入，或调 `POST /api/publish` |
| 图片/音频 404 | 素材未导入该 id：检查 `--source` 目录结构，重新 `npm run content:import` |
| 编辑器保存报 403 | 生产环境需要 `?editor=1&token=<ADMIN_TOKEN>` |
| E2E 起不来 | 检查 `TEST_DATABASE_URL` 可写、`dist/` 已构建、浏览器已 `npx playwright install chromium` |
| 想改端口/域名 | 改 `.env`、`docker-compose.prod.yml` 的端口映射，或在前面挂一层反向代理（Caddy/Nginx） |
