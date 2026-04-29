# 全链路 E2E 测试落地说明

> 最后更新：2026-03-07
>
> 目标：建立后端 API + 前端 UI 的可持续端到端测试体系，覆盖真实鉴权、真实数据库、真实前后端交互，并默认隔离外部券商/通知依赖。

## 1. 方案摘要

- 覆盖范围：后端 API E2E + 前端 Playwright E2E。
- 外部依赖策略：默认 Mock（`BROKER_MOCK=true`，不调用真实券商与通知通道）。
- 环境编排：复用 `packages/backend/docker-compose.yml` 中的 PostgreSQL/Redis。
- 执行分层：
  - `PR`：轻量冒烟（`test:e2e:pr`）
  - `Nightly`：全量回归（`test:e2e:nightly`）

## 2. 本次新增内容

### 2.1 后端 E2E 基建

- 独立 E2E 配置与目录：
  - `packages/backend/vitest.e2e.config.ts`
  - `packages/backend/test/e2e/setup-env.ts`
  - `packages/backend/test/e2e/create-e2e-app.ts`
  - `packages/backend/test/e2e/db-utils.ts`
  - `packages/backend/test/e2e/seed.ts`
- 新增 API E2E 用例：
  - 冒烟：
    - `api/smoke/auth-health.smoke.e2e-spec.ts`
    - `api/smoke/strategy-transaction.smoke.e2e-spec.ts`
  - 全量：
    - `api/full/transactions.full.e2e-spec.ts`
    - `api/full/backtest-user-logs.full.e2e-spec.ts`

### 2.2 后端稳定性开关

- `SCHEDULER_ENABLED=false`：关闭启动即注册的 cron 任务，避免 E2E 干扰。
- `BROKER_MOCK=true`：`TiantianBrokerService` 进入 mock 行为，统一替代买入/卖出/查单/撤单。
- `TELEGRAM_POLLING_ENABLED=false`：避免测试环境轮询监听与外部副作用。

### 2.3 前端 E2E 基建（Playwright）

- 新增配置与全局准备：
  - `packages/frontend/playwright.config.ts`
  - `packages/frontend/e2e/global-setup.ts`
  - `packages/frontend/e2e/helpers.ts`
- 新增 UI E2E 用例：
  - 冒烟：
    - `auth.smoke.spec.ts`
    - `strategy.smoke.spec.ts`
  - 全量：
    - `transactions.full.spec.ts`
    - `backtest.full.spec.ts`
    - `strategy-lifecycle.full.spec.ts`

### 2.4 前端可测性增强

- 为关键页面补充 `data-testid`，覆盖认证、导航、策略表单、回测表单、交易批量操作等关键路径。
- Vite 代理目标参数化：`VITE_API_PROXY_TARGET`，避免测试环境硬编码。

### 2.5 脚本与环境模板

- 根脚本（`package.json`）新增：
  - `test:e2e:seed`
  - `test:e2e:api`
  - `test:e2e:web`
  - `test:e2e`
  - `test:e2e:pr`
  - `test:e2e:nightly`
- 后端脚本新增：
  - `test:e2e`
  - `test:e2e:pr`
  - `test:e2e:nightly`
  - `test:e2e:seed`
- 前端脚本新增：
  - `test:e2e`
  - `test:e2e:pr`
  - `test:e2e:nightly`
- 新增环境模板：`.env.e2e.example`

## 3. 用例覆盖映射

### 3.1 PR 冒烟覆盖

- API：
  - 注册 + 登录
  - 未登录访问受保护资源返回 401
  - `GET /api/health` 公共访问
  - 策略创建（含 config 校验）
  - 交易创建走“需确认”路径（不触发真实 broker）
- UI：
  - 未登录访问受保护路由重定向登录页
  - 注册/登录成功进入受保护页面
  - 新建策略并在列表可见

### 3.2 Nightly 全量覆盖

- API：
  - 单笔/批量刷新交易状态
  - 单笔/批量撤单
  - 回测执行与结果持久化查询
  - 用户资料更新、交易凭证加密存储
  - 日志创建、分页查询、统计接口
- UI：
  - 交易筛选与批量操作
  - 回测提交与结果展示
  - 策略启停、编辑、删除完整生命周期

## 4. 执行方式

### 4.1 本地准备

```bash
# 1) 启动数据库与 Redis
pnpm dcup

# 2) 准备 e2e 环境变量（可选）
cp .env.e2e.example .env.e2e

# 3) 安装依赖
pnpm install --no-frozen-lockfile
```

### 4.2 运行命令

```bash
# 全链路（API + Web）
pnpm test:e2e

# PR 冒烟
pnpm test:e2e:pr

# Nightly 全量
pnpm test:e2e:nightly
```

## 5. CI 建议（执行策略）

- PR：
  - 启动 Postgres/Redis
  - 执行 `pnpm test:e2e:pr`
  - 失败即阻断合并
- Nightly：
  - 执行 `pnpm test:e2e:nightly`
  - 归档 Playwright 报告（`playwright-report`）与失败截图/trace

## 6. 已知限制与排障

- 若出现 `Unable to connect to the database` 或 `connect ...:5432`：
  - 检查 PostgreSQL 是否启动（`pnpm dcup`）
  - 检查 `.env.e2e` 中数据库参数是否正确
- 若出现 Redis 连接错误：
  - 检查 Redis 是否启动（`pnpm dcup`）
- 若 E2E 卡在定时任务或外部服务：
  - 确认：
    - `SCHEDULER_ENABLED=false`
    - `BROKER_MOCK=true`
    - `TELEGRAM_POLLING_ENABLED=false`
- 若 Playwright 无法访问后端：
  - 检查 `VITE_API_PROXY_TARGET` 是否正确（默认 `http://127.0.0.1:3000`）

## 7. 变更边界说明

- 本次不新增业务公开 API，不改变现有业务接口协议。
- 变更集中在：
  - 测试基础设施
  - 测试环境开关
  - UI 可测性增强（`data-testid`）
  - 运行脚本与文档
