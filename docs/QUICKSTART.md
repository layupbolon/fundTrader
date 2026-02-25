# 快速开始指南

## 1. 启动数据库服务

```bash
# 使用 Docker Compose 启动 PostgreSQL 和 Redis
docker-compose up -d

# 验证服务运行状态
docker-compose ps
```

## 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填写必要的配置
# 至少需要配置：
# - 数据库连接信息（如果使用 docker-compose，默认配置即可）
# - MASTER_KEY（用于加密敏感信息）
# - 通知服务配置（Telegram 或飞书）
```

## 3. 启动应用

```bash
# 开发模式（支持热重载）
npm run start:dev

# 生产模式
npm run build
npm run start:prod
```

## 4. 验证服务

访问 http://localhost:3000/api/funds 验证服务是否正常运行。

## 5. 创建第一个定投策略

### 方式一：通过 API

```bash
curl -X POST http://localhost:3000/api/strategies \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user",
    "name": "沪深300每周定投",
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

### 方式二：直接操作数据库

```sql
-- 连接到数据库
psql -h localhost -U postgres -d fundtrader

-- 创建用户
INSERT INTO users (id, username, created_at)
VALUES ('test-user', 'testuser', NOW());

-- 添加基金信息
INSERT INTO funds (code, name, type, manager, updated_at)
VALUES ('000300', '沪深300ETF', '指数型', '华夏基金', NOW());

-- 创建定投策略
INSERT INTO strategies (id, user_id, name, type, fund_code, config, enabled, created_at)
VALUES (
  gen_random_uuid(),
  'test-user',
  '沪深300每周定投',
  'AUTO_INVEST',
  '000300',
  '{"amount": 1000, "frequency": "weekly", "day_of_week": 1, "start_date": "2024-01-01"}',
  true,
  NOW()
);
```

## 6. 监控运行状态

```bash
# 查看应用日志
npm run start:dev

# 查看定时任务执行情况
# 应用会在控制台输出任务执行日志

# 查看数据库中的交易记录
psql -h localhost -U postgres -d fundtrader -c "SELECT * FROM transactions ORDER BY submitted_at DESC LIMIT 10;"
```

## 定时任务说明

系统会自动执行以下任务：

| 任务 | 执行时间 | 说明 |
|------|---------|------|
| 同步基金净值 | 每天 09:00 | 更新所有基金的最新净值 |
| 检查定投策略 | 工作日 14:30 | 执行符合条件的定投策略 |
| 检查止盈止损 | 每小时 | 监控持仓，触发止盈止损 |
| 保持会话活跃 | 每30分钟 | 维持交易平台登录状态 |

## 常见问题

### 1. 数据库连接失败

确保 PostgreSQL 服务正在运行：
```bash
docker-compose ps
```

### 2. Redis 连接失败

确保 Redis 服务正在运行：
```bash
docker-compose ps
```

### 3. 通知未收到

检查环境变量配置：
- Telegram: TELEGRAM_BOT_TOKEN 和 TELEGRAM_CHAT_ID
- 飞书: FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_USER_ID

### 4. 交易平台登录失败

天天基金的登录接口可能需要验证码或有反爬虫机制，建议：
- 先在浏览器手动登录一次
- 检查网络连接
- 查看应用日志了解具体错误

## 下一步

1. 配置止盈止损策略
2. 运行回测验证策略效果
3. 小额资金测试实际交易
4. 根据需要调整策略参数

## 安全提醒

⚠️ 在生产环境使用前：
1. 修改 MASTER_KEY 为强密码
2. 不要将 .env 文件提交到版本控制
3. 先用小额资金测试
4. 定期备份数据库
