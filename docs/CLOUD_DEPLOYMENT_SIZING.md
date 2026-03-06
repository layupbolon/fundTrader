# 云端部署配置评估（fundTrader）

更新时间：2026-03-06

## 1. 结论速览

### 推荐基线（生产可用，成本可控）

- 应用机：`2C4G`（运行 NestJS + Bull + Scheduler + Puppeteer）
- PostgreSQL：`2C4G`（托管数据库优先）
- Redis：`1C1G`（托管 Redis 优先）
- 系统盘：应用机至少 `60GB SSD`（建议 `80GB`，包含日志与备份缓冲）

### 最低可用（仅开发/轻量试运行）

- 单机合并部署（应用+PostgreSQL+Redis）：`4C8G / 80GB SSD`
- 说明：可跑通，但运维隔离性和稳定性弱于分离部署。

### 压力上升后的升级点

- 应用机升级到 `4C8G`（策略数量增多、回测频繁、Puppeteer 调用增加时）
- PostgreSQL 升级到 `4C8G`（历史净值/交易数据增长明显时）

## 2. 资源拆分建议

| 组件 | 部署建议 | 最低规格 | 推荐规格 | 备注 |
|---|---|---:|---:|---|
| Backend（API+任务） | 云主机/Docker | 2C4G | 2C4G~4C8G | 当前代码中调度与处理器在同一进程 |
| Frontend（静态） | Nginx 或对象存储/CDN | 0.5C0.5G | 1C1G | 也可与后端同机 |
| PostgreSQL | 托管服务优先 | 2C4G | 2C4G~4C8G | 交易与净值核心数据 |
| Redis | 托管服务优先 | 1C1G | 1C1G~2C2G | Bull 队列与任务调度 |
| 备份存储 | 对象存储 | 20GB 起 | 按保留周期扩展 | 当前备份脚本先落本地文件 |

## 3. 环境变量配置量

`.env.example` 当前共 `24` 个变量：

1. `NODE_ENV`
2. `PORT`
3. `ALLOWED_ORIGINS`
4. `JWT_SECRET`
5. `DB_HOST`
6. `DB_PORT`
7. `DB_USERNAME`
8. `DB_PASSWORD`
9. `DB_DATABASE`
10. `REDIS_HOST`
11. `REDIS_PORT`
12. `MASTER_KEY`
13. `ENCRYPTION_SALT`
14. `TELEGRAM_BOT_TOKEN`
15. `TELEGRAM_CHAT_ID`
16. `TELEGRAM_POLLING_ENABLED`
17. `FEISHU_APP_ID`
18. `FEISHU_APP_SECRET`
19. `FEISHU_USER_ID`
20. `TIANTIAN_USERNAME`
21. `TIANTIAN_PASSWORD`
22. `BACKUP_DIR`
23. `BACKUP_RETENTION_DAYS`
24. `BACKUP_SCHEDULE`

按能力分层：

- 最低可启动核心：约 `10` 项（DB/Redis/JWT/加密/服务端基础）
- 可执行交易：约 `12` 项（增加天天基金账号）
- 可告警：约 `14~15` 项（Telegram 2 项或飞书 3 项）
- 全功能：`24` 项

## 4. 云上上线必备条件

1. 只启动 `1` 个 backend 实例（当前调度器内置，先避免多实例重复调度）
2. Puppeteer 运行环境可用（Chromium 与系统依赖齐全）
3. 主机具备 `pg_dump/psql`（当前备份/恢复脚本依赖）
4. 数据库与 Redis 走内网访问，不对公网暴露
5. 公网仅开放 `80/443`，后端端口经反向代理转发
6. `MASTER_KEY / ENCRYPTION_SALT / JWT_SECRET` 使用高强度随机值
7. `ALLOWED_ORIGINS` 设置为正式域名，避免通配
8. 日志目录与备份目录挂载持久化存储

## 5. 成本与稳定性建议

1. 预算优先：后端单机 + 托管 PG/Redis，是目前性价比最高组合。
2. 稳定优先：前后端分离部署，后端与数据库同地域低延迟互通。
3. 后续扩展：先升级应用机，再拆分 worker（调度/API 与任务处理解耦）。

## 6. 与当前代码实现相关的说明

1. 定时任务与队列处理在同一服务进程中（`SchedulerService` + `@Processor`）。
2. 交易链路依赖 Puppeteer 访问外部站点，云主机需保证网络连通与浏览器能力。
3. 备份服务调用本地脚本（`backup.sh`/`restore.sh`），依赖系统 PostgreSQL 客户端工具。
4. 前端当前通过 `/api` 代理访问后端，生产环境建议由 Nginx 统一反向代理。
