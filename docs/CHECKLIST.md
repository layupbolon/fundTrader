# 项目部署检查清单

## ✅ 已完成

- [x] 项目依赖安装（pnpm）
- [x] TypeScript编译通过
- [x] 核心模块实现
  - [x] 数据模型（User, Fund, Position, Transaction, Strategy等）
  - [x] 基金数据服务（天天基金API）
  - [x] 交易服务（Puppeteer自动化）
  - [x] 通知服务（Telegram + 飞书）
  - [x] 定投策略引擎
  - [x] 止盈止损策略引擎
  - [x] 回测引擎
  - [x] 定时任务调度
  - [x] REST API控制器
- [x] 安全特性
  - [x] Helmet安全头
  - [x] CORS配置
  - [x] 输入验证（class-validator）
  - [x] 速率限制（Throttler）
  - [x] 敏感信息加密（AES-256-GCM）

## ⚠️ 部署前必做

- [ ] 创建`.env`文件（从`.env.example`复制）
- [ ] 配置数据库连接信息
- [ ] 配置Redis连接信息
- [ ] 设置MASTER_KEY（至少32字符）
- [ ] 配置天天基金账号
- [ ] 配置通知渠道（Telegram或飞书）
- [ ] 启动PostgreSQL数据库
- [ ] 启动Redis服务
- [ ] 验证Puppeteer可以启动浏览器

## 🚀 启动步骤

```bash
# 1. 安装依赖
pnpm install

# 2. 启动数据库（Docker）
docker-compose up -d

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 4. 启动应用
pnpm start:dev
```

## 🧪 测试建议

1. **小额测试**：先用小额资金测试（如每次100元）
2. **单策略测试**：先测试单个定投策略
3. **回测验证**：使用历史数据回测策略效果
4. **通知测试**：验证Telegram/飞书通知是否正常
5. **监控日志**：观察定时任务执行情况

## 📊 监控指标

- 定时任务执行状态
- 交易成功率
- 通知送达率
- 数据库连接状态
- Redis队列积压情况

## ⚠️ 风险提示

1. 自动交易存在风险，可能因程序错误导致损失
2. 确保使用方式符合交易平台服务条款
3. 建议设置单日最大交易额度
4. 定期备份数据库
5. 投资有风险，入市需谨慎
