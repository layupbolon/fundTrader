# A股基金自动交易平台

基于 Node.js/TypeScript 的场外基金自动交易系统（Monorepo），支持策略交易、风控、交易确认、回测、监控告警与审计运维。

## 当前状态

- ✅ 可用于开发测试与联调
- ✅ 后端核心能力已落地（交易/风控/确认/分析/监控/日志/备份）
- ✅ 前端管理端已可用（认证、仪表盘、策略、交易、回测、分析）

权威状态文档：[`docs/IMPLEMENTATION.md`](./docs/IMPLEMENTATION.md)

## 核心特性

- 自动定投（`AUTO_INVEST`）
- 止盈止损（`TAKE_PROFIT_STOP_LOSS`）
- 网格交易（`GRID_TRADING`）
- 动态再平衡（`REBALANCE`）
- 手动交易闭环（下单、状态刷新、单笔/批量撤单）
- 风控与大额交易确认（Telegram/飞书）
- 回测与分析（收益、持仓分布、交易统计）
- 监控告警、日志审计、数据库备份恢复
- Swagger API 文档

## 技术栈

- NestJS + TypeScript
- PostgreSQL + TypeORM
- Bull + Redis
- Puppeteer
- React + TypeScript（frontend）
- pnpm workspaces

## 快速开始

### 1) 安装依赖

```bash
pnpm install
```

### 2) 启动数据库依赖

```bash
pnpm dcup
```

### 3) 配置环境变量

```bash
cp .env.example .env
```

按需填写数据库、Redis、JWT、通知和交易平台配置。

### 4) 启动服务

```bash
# 后端
pnpm dev

# 前端（可选）
pnpm dev:frontend
```

### 5) 常用地址

- Swagger UI: `http://localhost:3000/api/docs`
- Swagger JSON: `http://localhost:3000/api/docs-json`
- Health: `http://localhost:3000/api/health`

## 认证与调用说明

除 `auth` 和 `health` 公共端点外，API 默认需要 JWT。示例：

```bash
curl -X POST http://localhost:3000/api/strategies \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "沪深300每周定投",
    "type": "AUTO_INVEST",
    "fund_code": "000300",
    "enabled": true,
    "config": {
      "amount": 1000,
      "frequency": "WEEKLY",
      "day_of_week": 1,
      "start_date": "2024-01-01"
    }
  }'
```

## 主要定时任务（当前）

- 工作日 20:00 / 22:00 / 09:00：净值同步
- 工作日 22:35：资产快照
- 工作日 14:30：定投检查
- 每小时：止盈止损检查
- 工作日 21:00：T+1 确认
- 工作日 21:30：持仓刷新
- 每 30 分钟：会话保活
- 每 5 分钟：确认超时检查、健康检查
- 每天 02:00：数据库备份（周日 04:00 清理）

## 项目结构

```text
fundTrader/
├── packages/
│   ├── backend/
│   ├── frontend/
│   └── shared/
├── docs/
├── pnpm-workspace.yaml
└── package.json
```

## 文档导航

- [docs/README.md](./docs/README.md): docs 导航
- [docs/IMPLEMENTATION.md](./docs/IMPLEMENTATION.md): 当前权威状态
- [docs/SETUP.md](./docs/SETUP.md): 环境配置
- [docs/QUICKSTART.md](./docs/QUICKSTART.md): 快速启动
- [docs/PHASE4_PLAN.md](./docs/PHASE4_PLAN.md): Phase 4 计划与执行状态

## 风险提示

- 自动交易存在风险，建议先小额验证。
- 生产环境必须使用强密钥并妥善管理 `.env`。
- 使用前请确认符合目标平台条款与合规要求。
