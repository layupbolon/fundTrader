# 服务器部署硬化指南

本文面向单人自用部署，目标是让自动交易服务具备可迁移、可预检、可恢复的运维路径。

## 部署前检查

先准备 `.env`，至少包含：

```bash
MASTER_KEY=your_secure_master_key_min_32_chars
JWT_SECRET=your_jwt_secret_min_32_chars
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=fundtrader
REDIS_HOST=localhost
REDIS_PORT=6379
BACKUP_DIR=/var/backups/fundtrader
BROKER_MODE=paper
```

执行预检：

```bash
pnpm --filter @fundtrader/backend deploy:preflight
```

预检会检查 `MASTER_KEY`、`JWT_SECRET`、PostgreSQL、Redis 和备份目录写入能力。

## 数据库迁移

生产环境禁止依赖 `synchronize` 自动改表。实体变更需要进入 TypeORM migration：

```bash
pnpm --filter @fundtrader/backend migration:run
```

回滚最近一次迁移：

```bash
pnpm --filter @fundtrader/backend migration:revert
```

当前保留 `migrate:backtest-user-id` 作为历史过渡脚本；后续 schema 变更优先使用 `migration:run`。

## systemd 示例

```ini
[Unit]
Description=FundTrader backend
After=network.target postgresql.service redis.service

[Service]
WorkingDirectory=/opt/fundTrader
Environment=NODE_ENV=production
EnvironmentFile=/opt/fundTrader/.env
ExecStart=/usr/bin/pnpm --filter @fundtrader/backend start:prod
Restart=always
RestartSec=5
User=fundtrader

[Install]
WantedBy=multi-user.target
```

## Nginx 反代和 HTTPS

只暴露 80/443，后端端口仅监听内网：

```nginx
server {
  listen 443 ssl http2;
  server_name fundtrader.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}
```

证书建议使用 `certbot` 或云厂商托管证书。

## 备份恢复演练

备份生成后，恢复到临时库并校验关键表数量：

```bash
RESTORE_DB_DATABASE=fundtrader_restore pnpm --filter @fundtrader/backend backup:verify
```

脚本会输出 `users`、`funds`、`transactions`、`positions`、`strategies` 的源库与恢复库记录数，用于确认恢复结果。
