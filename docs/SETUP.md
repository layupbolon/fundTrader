# 项目启动指南

## 前置条件

确保已安装以下软件：
- Node.js >= 18
- PostgreSQL >= 13
- Redis >= 6
- pnpm (推荐) 或 npm

## 快速启动步骤

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动数据库服务

使用Docker Compose快速启动：

```bash
docker-compose up -d
```

或手动启动PostgreSQL和Redis。

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑`.env`文件，必须配置以下关键参数：

```env
# 数据库配置（必填）
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=fundtrader

# Redis配置（必填）
REDIS_HOST=localhost
REDIS_PORT=6379

# 加密密钥（必填，至少32字符）
MASTER_KEY=your_secure_master_key_min_32_chars

# 天天基金账号（必填）
TIANTIAN_USERNAME=your_username
TIANTIAN_PASSWORD=your_password

# 通知配置（可选）
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_USER_ID=your_user_id
```

### 4. 初始化数据库

首次运行时，TypeORM会自动创建表结构（开发模式下`synchronize: true`）。

生产环境建议手动执行迁移脚本。

### 5. 启动应用

开发模式（带热重载）：

```bash
pnpm start:dev
```

生产模式：

```bash
pnpm build
pnpm start:prod
```

### 6. 验证启动

访问 http://localhost:3000/api 查看API是否正常响应。

查看控制台输出，确认定时任务已初始化：

```
Scheduled jobs initialized
```

## 常见问题

### Q: 数据库连接失败

检查PostgreSQL是否启动：
```bash
psql -U postgres -d fundtrader
```

### Q: Redis连接失败

检查Redis是否启动：
```bash
redis-cli ping
```

### Q: Puppeteer启动失败

安装Chromium依赖：
```bash
# macOS
brew install chromium

# Ubuntu/Debian
sudo apt-get install chromium-browser
```

### Q: 加密密钥错误

确保`MASTER_KEY`至少32字符长度。

## 下一步

1. 通过API创建第一个定投策略
2. 配置通知渠道（Telegram或飞书）
3. 运行回测验证策略效果
4. 监控定时任务执行日志

详细使用说明见 [README.md](../README.md)
