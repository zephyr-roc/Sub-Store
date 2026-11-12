# Cloudflare Workers 移植版（适配 Sub-Store 2.44.8）

本目录是基于原项目后端的独立移植层，**保留现有订阅管理与转换业务代码**。
前端直接使用 [官方 Sub-Store Web UI](https://sub-store.vercel.app/)，不需要另外部署静态页面。

## 部署

在 Cloudflare Worker 环境使用 SQLite-backed **Durable Objects**，无需 KV、R2、D1、Redis 或 VPS。
请求在同一个 Durable Object 中顺序执行，以避免 Sub-Store 原有聚合 JSON 数据的并发覆盖。

需要 Node.js 22 或更新版本。

```bash
git clone https://github.com/zephyr-roc/Sub-Store.git
cd Sub-Store/cloudflare
npm install
npx wrangler login
```

**必须先设置鉴权 Secret**。不要把口令写在 `wrangler.toml`：

```bash
# 输入以 / 开头、长度至少 32 字符的随机 URL-safe 字符串
npx wrangler secret put SUB_STORE_FRONTEND_BACKEND_PATH
npm run check
npm run deploy
```

如果尚未在 Cloudflare 创建该 Worker，`wrangler secret put` 可能要求创建一个占位 Worker；
按提示操作即可。正式部署后请确认 Secret 保留在同一 Worker。

部署完成后打开 https://sub-store.vercel.app ，后端地址填入：

```text
https://sub-store-cf.<account>.workers.dev/<your-random-secret>
```

将 `<account>` 换成自己的 workers.dev 子域前缀，`<your-random-secret>` 换成自己的路径口令（不包括另一个 /）。
之后可以在官方 UI 管理订阅源、合集、脚本和规则、托管文件、分享令牌。

如要用 **Cloudflare Git 集成**：选择本仓库、分支 `master`，根目录填写 `cloudflare`，
安装命令 `npm install`，构建命令 `npm run build`，部署命令 `npx wrangler deploy`。
先在 Worker 配置 Secret，并确认 `wrangler.toml` 的 `name` 与 Cloudflare Worker 名称一致。

## 目录

- `src/worker.js`：Workers 入口、鉴权失败关闭、定时任务转发、SQLite Durable Object 串行化
- `src/index.js`：Sub-Store 的 REST 路由注册、管理路径与分享路由校验
- `src/vendor/open-api.js`：HTTP fetch 与持久化缓存适配
- `src/vendor/express.js`：Express API 到 Request/Response 的轻量兼容
- `esbuild.js`：从本仓库的 `backend/src` 读取未改动的业务逻辑，预编译 Peggy 语法并处理平台限制
- `scripts/prepare-wasm.cjs`：构建期从 npm 依赖复制 QuickJS 的 WASM

## 运行时约束

- Cloudflare Workers 不允许直接使用 Node `eval/new Function`，脚本功能使用 QuickJS WASM；
  兼容性不能与 Node.js 完全等同，尤其是 `require`、文件操作与网络代理。
- 订阅源 HTTP 请求来自 Cloudflare 边缘网络；部分站点可能拒绝访问或限制响应体大小。
- 单一 Durable Object 串行处理 API；非常耗时的转换可能阻塞其他管理请求。
- 入口没有集成官方 UI 的静态资源；根路径跳转到官方 UI。
- 管理 API 必须有口令路径；已发布的分享/下载链接按原 Sub-Store 分享逻辑提供，
  **有权访问这些链接的人可以获取对应的订阅凭据**。
- 默认每天 15:55 UTC 触发一次 Gist 同步；需在 Sub-Store 设置里正确配置凭据。
- 需要在 Cloudflare 上真实验证首轮写入、重新访问、重启后读取、分享令牌、Cron 和 QuickJS。
  GitHub CI 的构建成功并不意味着云端所有功能都已验证。

## 开发与鸣谢

适配层参考并复用了 [Yu9191/sub-store-workers](https://github.com/Yu9191/sub-store-workers) 的 GPL-3.0
兼容实现与 QuickJS 处理器（原版贡献者 0xPoker）。Sub-Store 主项目采用 AGPL-3.0。
保留署名与协议约束。新适配层独立存放在 `cloudflare/`，便于继续同步上游更新。
