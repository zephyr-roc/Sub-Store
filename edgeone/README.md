# 在 EdgeOne Makers 部署 Sub-Store

此移植版本采用 **Node.js Cloud Functions + Blob（强一致读取）**，使用既有
`backend/` 的 Sub-Store 2.44.8 转换业务和 `cloudflare/` 的 Web API 兼容层。
**不是仅部署静态转换页**：管理 API、订阅源、合集、托管文件、分享令牌均保留。
管理前端使用 [Sub-Store 官方 Web UI](https://sub-store.vercel.app/)。

## 通过 GitHub 导入

1. 在 [EdgeOne Makers](https://pages.edgeone.ai/) 选择 GitHub 导入 `zephyr-roc/Sub-Store`，分支 `master`。
2. **项目根目录：`edgeone`**（不填仓库根目录，不能填 `backend` 或 `cloudflare`）。
3. 设置下列构建参数：

| 配置 | 值 |
| --- | --- |
| 框架 | Other / 无框架 |
| 安装命令 | `npm install` |
| 构建命令 | `npm run build` |
| 输出目录 | `public` |
| Node.js 版本 | 22 |
| 函数最长运行时间 | 60 秒（已写入 `edgeone.json`） |

4. 在 Makers 项目中添加 **敏感环境变量** `SUB_STORE_FRONTEND_BACKEND_PATH`。
   值必须是 `/` 加上至少 32 位的随机 URL-safe 字符（A-Z、a-z、数字、`_`、`-`），
   例如可以通过 `node -e "console.log('/'+require('crypto').randomBytes(32).toString('base64url'))"`
   在本机生成。**不要将该变量加入 Git 仓库。**
5. 部署后访问 `https://<your-domain>/<your-secret>/api/utils/worker-status`，
   并在官方 UI 中填写 **后端地址** `https://<your-domain>/<your-secret>`。

其他可选环境变量：

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `EDGEONE_BLOB_STORE` | `sub-store` | Blob 命名空间，改名会切换到另一套数据 |

无需创建 Cloudflare KV / Durable Object / D1，也无需外部 Redis。
第一次 Node Functions 调用 `getStore` 会创建 Makers Blob 命名空间。
部署后确保 API 能返回状态并通过前端创建一条测试订阅，刷新页面再次读取以验证数据保存。

## 内部实现

- `cloud-functions/[[default]].js`：所有非首页路径的 Handler；
  `cloud-functions/index.js`：首页跳转官方管理界面
- `src/handler.js`：鉴权、调用原 Sub-Store API、实例内请求串行化
- `src/blob-binding.mjs`：使用 Blob `get/set/delete` 实现 Sub-Store 的持久化接口
- `src/vendor/open-api.js`：复用 Worker OpenAPI 并在 Blob 读取失败时拒绝执行写操作
- `esbuild.cjs`：复用原有转换引擎、预编译 Peggy、保留 QuickJS；
  QuickJS WASM 在 Node 构建中直接嵌入模块，不依赖 Cloudflare 的 WASM 加载器

管理请求必须带不可猜测的路径，缺失或无效密钥返回 503；
匿名 `/api/` 与 `/download/` 返回 401。公开分享路由仍交由
Sub-Store 检查对应分享令牌，不会默认公开管理数据。

## 必须知道的限制

- **Blob 的强一致读取并不等于原子事务。** Node Functions 可同时在多个实例运行；
  此适配仅在同一函数实例内串行化读写，跨实例的并发修改仍可能互相覆盖。
  建议用于个人低并发管理，**不要当作多用户高并发数据库**。大量并发管理写入时，
  应改用具有事务和条件写入能力的外部数据库。
- Blob 中分别存有 `sub-store-state/sub-store` 和 `sub-store-state/root` 两份聚合数据，
  单次备份不是跨键原子快照。定期使用 Sub-Store 的备份功能导出数据。
- 此版本使用已有的 QuickJS 模拟脚本执行；Node 专有 API、自定义代理和其他
  系统级功能与纯 Node 服务器不保证完全一致。
- Makers 的 Node Functions 不是常驻服务，原 Node.js 进程内的 Cron 不会自动运行。
  此适配**未配置定时同步任务**，管理后台手动同步可用；自动同步需后续配置安全的计划任务。
- Blob 存储与 Cloudflare KV 不共享数据；迁移后需从原 Sub-Store 备份导入。
- 登录不等于用户隔离：路径密钥是持有即有权访问的共享密钥。不要将完整管理后端 URL
  发给他人，也不要公开发布包含节点凭证的订阅链接。

## 验证

在本地检出包含 `edgeone/`、`cloudflare/` 与 `backend/` 的完整仓库：

```bash
cd edgeone
npm install
npm test
npm run build
```

CI 也会运行 `edgeone makers build` 校验 EdgeOne Node Functions 二次打包；但仍不代表已在 EdgeOne 云端完成实际 Blob 认证与读写。
部署后务必检查：
1. `/api/subs` 未带密钥时为 401；
2. `/<secret>/api/subs` 能正常返回；
3. 新建订阅 → 保存 → 刷新 → 重新读取；
4. 使用分享令牌访问 `/share/`，无令牌必须拒绝；
5. 实际生成 Mihomo、Stash、sing-box 各一份配置。

源项目使用 AGPL-3.0，Cloudflare 兼容层参考
[Yu9191/sub-store-workers](https://github.com/Yu9191/sub-store-workers)。

## JSON 请求体故障诊断

如果前端 PATCH 设置时遇到 `INVALID_REQUEST_BODY`，适配层会返回仅包含
请求体长度、Content-Type 与 JSON 结构标记的 `diagnostics`，**不会返回、
记录或打印设置的具体内容**。可通过这些字段判断 EdgeOne Node Functions
是否改变了浏览器发送的请求体。

新版本在内部路径改写时显式复制 Body 字节，不再将 Makers 的 Request
对象直接作为另一个 Request 的初始化参数。若仍出错，提供不含
Token 的错误 JSON 和对应请求的响应状态即可继续诊断。
