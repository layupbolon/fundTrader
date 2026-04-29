# 项目启动指南

## 前置条件

确保已安装以下软件：
- Node.js >= 18
- PostgreSQL >= 13
- Redis >= 6
- pnpm

## 快速启动步骤

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动数据库服务

使用Docker Compose快速启动：

```bash
pnpm dcup
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

生产环境必须通过迁移脚本升级数据库，不要依赖 TypeORM 自动同步。当前应用入口在 `NODE_ENV=production` 下不会自动 `synchronize` 表结构。

通用升级顺序：

```bash
# 1. 拉取或发布新版本代码后，先安装依赖
pnpm install --frozen-lockfile

# 2. 执行部署前检查，确认密钥、数据库、Redis 和备份目录可用
pnpm --filter @fundtrader/backend deploy:preflight

# 3. 执行 TypeORM 版本化迁移
pnpm --filter @fundtrader/backend migration:run

# 4. 构建并启动新版本
pnpm build
pnpm start:prod
```

当前版本化迁移包含：

- `20260429000000-HardenTradingLifecycle`：为交易状态枚举补充 `CREATED`、`PENDING_SUBMIT`，并为交易状态查询补索引。

#### 生产升级：回测结果用户归属迁移

从包含 `backtest_results.user_id` 的版本开始，生产环境在启动新版本前必须先执行一次迁移脚本。生产环境 `NODE_ENV=production` 下 TypeORM 不会自动同步表结构，如果跳过此步骤，回测接口会因 `backtest_results.user_id` 列不存在而失败。

该脚本是历史过渡迁移，仍需保留给尚未升级过的服务器；新版本升级还应执行上面的 `migration:run`。

建议升级顺序：

```bash
# 1. 可选：先 dry-run 验证数据库连接和 SQL 路径，dry-run 会回滚
pnpm --filter @fundtrader/backend migrate:backtest-user-id -- --dry-run

# 2. 正式执行幂等迁移
pnpm --filter @fundtrader/backend migrate:backtest-user-id

# 3. 再执行当前版本 TypeORM 迁移
pnpm --filter @fundtrader/backend migration:run
```

脚本行为：

- 幂等添加 `backtest_results.user_id` nullable `uuid` 列。
- 幂等添加 `idx_backtest_results_user_id` 索引。
- 幂等添加 `backtest_results.user_id -> users.id` 外键，删除用户时置空。
- 如果服务器只有 1 个用户，会把旧回测记录的 `NULL user_id` 回填为该用户。
- 如果没有用户，只添加列、索引和外键，不回填。
- 如果有多个用户，不自动回填旧记录，并在输出中提示需要人工确认归属。

### 5. 启动应用

开发模式（带热重载）：

```bash
pnpm dev
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
