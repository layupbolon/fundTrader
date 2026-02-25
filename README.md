# A股基金自动交易平台

基于 Node.js/TypeScript 的场外基金自动交易系统，支持定投、止盈止损、策略回测等功能。

## 功能特性

- ✅ 自动定投（日/周/月频率）
- ✅ 智能止盈止损
- ✅ 策略回测系统
- ✅ 多渠道通知（Telegram/飞书）
- ✅ 基金净值自动同步
- ✅ 会话自动保活

## 技术栈

- **框架**: NestJS + TypeScript
- **数据库**: PostgreSQL + TypeORM
- **任务队列**: Bull + Redis
- **浏览器自动化**: Puppeteer
- **通知**: Telegram Bot API + 飞书 SDK

## 快速开始

### 1. 环境要求

- Node.js >= 18
- PostgreSQL >= 13
- Redis >= 6

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，填写以下配置：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=fundtrader

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# 加密密钥（生产环境务必修改）
MASTER_KEY=your_secure_master_key

# Telegram通知
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# 飞书通知
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_USER_ID=your_user_id

# 天天基金账号
TIANTIAN_USERNAME=your_username
TIANTIAN_PASSWORD=your_password
```

### 4. 启动数据库

```bash
# 使用 Docker 快速启动 PostgreSQL 和 Redis
docker-compose up -d
```

或手动启动：

```bash
# PostgreSQL
createdb fundtrader

# Redis
redis-server
```

### 5. 运行应用

```bash
# 开发模式
pnpm start:dev

# 生产模式
pnpm build
pnpm start:prod
```

## 使用指南

### 创建定投策略

通过 API 创建定投策略：

```bash
curl -X POST http://localhost:3000/api/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "your_user_id",
    "name": "沪深300定投",
    "type": "AUTO_INVEST",
    "fund_code": "000300",
    "enabled": true,
    "config": {
      "amount": 1000,
      "frequency": "weekly",
      "day_of_week": 1,
      "start_date": "2024-01-01"
    }
  }'
```

### 创建止盈策略

```bash
curl -X POST http://localhost:3000/api/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "your_user_id",
    "name": "15%止盈",
    "type": "TAKE_PROFIT",
    "fund_code": "000300",
    "enabled": true,
    "config": {
      "target_rate": 0.15,
      "sell_ratio": 0.5,
      "trailing_stop": 0.05
    }
  }'
```

### 创建止损策略

```bash
curl -X POST http://localhost:3000/api/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "your_user_id",
    "name": "10%止损",
    "type": "STOP_LOSS",
    "fund_code": "000300",
    "enabled": true,
    "config": {
      "max_drawdown": -0.10,
      "sell_ratio": 1.0
    }
  }'
```

### 运行回测

```bash
curl -X POST http://localhost:3000/api/backtest \
  -H "Content-Type: application/json" \
  -d '{
    "fund_code": "000300",
    "start_date": "2023-01-01",
    "end_date": "2024-01-01",
    "initial_capital": 10000,
    "strategy_config": {
      "type": "AUTO_INVEST",
      "amount": 1000,
      "frequency": "monthly"
    }
  }'
```

## 定时任务

系统会自动执行以下定时任务：

| 任务 | 执行时间 | 说明 |
|------|---------|------|
| 同步基金净值 | 每天 09:00 | 更新所有基金的最新净值 |
| 检查定投策略 | 工作日 14:30 | 执行符合条件的定投策略 |
| 检查止盈止损 | 每小时 | 监控持仓，触发止盈止损 |
| 保持会话活跃 | 每30分钟 | 维持交易平台登录状态 |

## 项目结构

```
fundTrader/
├── src/
│   ├── models/              # 数据模型
│   ├── services/            # 服务层
│   │   ├── broker/         # 交易平台接入
│   │   ├── data/           # 数据获取
│   │   └── notify/         # 通知服务
│   ├── core/               # 核心业务逻辑
│   │   ├── strategy/       # 策略引擎
│   │   └── backtest/       # 回测系统
│   ├── scheduler/          # 定时任务
│   ├── utils/              # 工具函数
│   ├── app.module.ts       # 应用模块
│   └── main.ts             # 应用入口
├── config/                 # 配置文件
├── PLAN.md                 # 技术方案文档
└── package.json
```

## 安全建议

1. **加密存储**: 敏感信息（账号密码）使用 AES-256-GCM 加密
2. **环境变量**: 不要将 `.env` 文件提交到版本控制
3. **小额测试**: 先用小额资金测试系统稳定性
4. **风控限制**: 设置单日最大交易额度
5. **定期备份**: 定期备份数据库

## 风险提示

⚠️ **重要提示**：

- 本系统仅供个人学习和研究使用
- 自动交易存在风险，可能因程序错误导致损失
- 使用前请充分测试，建议先用小额资金试运行
- 确保使用方式符合交易平台服务条款
- 投资有风险，入市需谨慎

## 开发计划

详见 [PLAN.md](./docs/PLAN.md)

- [x] Phase 1: MVP（定投功能）
- [ ] Phase 2: 止盈止损 + 回测
- [ ] Phase 3: Web界面 + 高级功能

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request
