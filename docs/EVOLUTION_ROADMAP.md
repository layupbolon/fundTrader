# 项目演进路线

> 目标：服务于后续持续开发。本文按“单人使用、部署在服务器上”的前提规划，不追求多人 SaaS 化，但保留必要的安全边界、可恢复性和运维能力。
>
> 最近更新：2026-04-29

## 当前定位

本项目是个人使用的 A 股场外基金自动交易平台，适合部署在自有服务器上长期运行。后续演进重点不是扩展为多租户产品，而是把单人自动交易系统做得更可靠、可恢复、可观测、可审计。

## 已完成的第一批硬化

已完成：

- 后端详情接口增加当前用户范围过滤：
  - 策略详情
  - 持仓详情
  - 交易详情
- 回测结果增加用户归属：
  - 新回测结果写入 `user_id`
  - 回测列表和详情按当前用户查询
  - `user_id` 设为 nullable，兼容旧数据
  - 生产升级通过 `pnpm --filter @fundtrader/backend migrate:backtest-user-id` 添加列、索引、外键，并在单用户部署场景回填旧数据
- 前端路由级拆包：
  - 使用 `React.lazy` 和 `Suspense`
  - 为路由 chunk/import 加载失败增加刷新恢复界面，避免旧 tab 或部署期间白屏
  - 首屏主包从约 `729.55 kB` 降到约 `240.12 kB`

对应验证：

```bash
pnpm build
pnpm test
pnpm lint
git diff --check
```

## 下一阶段执行顺序

### Phase A：交易状态机与可恢复性

优先级：最高。

目标：避免“券商下单成功但本地状态失败”这类不可恢复状态。

建议任务：

1. 引入交易意图状态：
   - 本地先创建交易记录
   - 状态从 `CREATED` / `PENDING_SUBMIT` / `SUBMITTED` / `CONFIRMED` / `FAILED` / `CANCELLED` 明确流转
2. 下单改为后台任务执行：
   - API 只创建交易意图
   - Bull job 负责调用 broker
   - job 支持幂等重试
3. 增加交易补偿任务：
   - 对 `SUBMITTED` 但长期未确认的订单定时查询券商状态
   - 对有 `order_id` 但本地状态异常的订单做 reconciliation
4. 审计每次状态迁移：
   - 记录 old status / new status / reason / broker response

验收标准：

```bash
pnpm --filter @fundtrader/backend test -- src/api/__tests__/transaction-controller.test.ts
pnpm --filter @fundtrader/backend test -- src/scheduler/__tests__/trading.processor.test.ts
pnpm test
```

### Phase B：Broker Adapter 生产化

优先级：高。

目标：把当前天天基金 Puppeteer 示例接入演进为可替换、可测试、可人工接管的交易适配层。

建议任务：

1. 抽象 `BrokerAdapter` 接口：
   - `login`
   - `buyFund`
   - `sellFund`
   - `getOrderStatus`
   - `cancelOrder`
   - `keepAlive`
2. 拆分实现：
   - `MockBrokerAdapter`
   - `ReplayBrokerAdapter`
   - `TiantianBrokerAdapter`
3. 每用户会话隔离：
   - 不再用全局共享 `page/session`
   - 会话过期、验证码、登录失败要有明确状态
4. 增加 dry-run / paper trading 模式：
   - 服务器长期运行前先模拟完整交易链路

验收标准：

```bash
pnpm --filter @fundtrader/backend test -- src/services/broker
pnpm --filter @fundtrader/backend test -- src/scheduler
pnpm test
```

### Phase C：数据库迁移与服务器部署硬化

优先级：高。

目标：减少服务器部署时 schema 自动同步、环境变量缺失、备份恢复不可验证带来的风险。

当前已补一个过渡迁移脚本：

```bash
pnpm --filter @fundtrader/backend migrate:backtest-user-id
```

该脚本只覆盖 `backtest_results.user_id` 的生产升级缺口。后续仍建议引入完整 TypeORM migrations，把类似 schema 变更统一纳入版本化迁移体系。

建议任务：

1. 引入 TypeORM migrations：
   - 生产环境禁用 `synchronize`
   - 所有实体变更通过 migration 落库
2. 增加部署前检查脚本：
   - 检查 `MASTER_KEY`
   - 检查 `JWT_SECRET`
   - 检查数据库和 Redis 连接
   - 检查备份目录可写
3. 补充服务器部署文档：
   - systemd / pm2 二选一即可
   - Nginx 反代
   - HTTPS
   - 防火墙只暴露必要端口
4. 做备份恢复演练：
   - 生成备份
   - 恢复到临时库
   - 校验关键表数据量

验收标准：

```bash
pnpm build
pnpm test
pnpm test:e2e:pr
```

如果本机或服务器没有启动数据库 / Redis，需要先执行：

```bash
pnpm dcup
```

### Phase D：数据源质量与性能

优先级：中高。

目标：保证净值、基金基础信息和回测数据长期可用。

建议任务：

1. 优化历史净值查询：
   - 数据库层按 `fund_code + date range` 查询
   - 避免先查全量再内存过滤
2. 批量 upsert 历史净值：
   - 避免逐条 upsert
   - 增加失败重试和速率限制
3. 补齐基金基础信息真实解析：
   - 当前占位的 `基金xxxx` 需要替换为真实数据源
4. 增加数据完整性检查：
   - 缺失交易日
   - 异常净值跳变
   - 长期未更新基金

验收标准：

```bash
pnpm --filter @fundtrader/backend test -- src/services/data
pnpm --filter @fundtrader/backend test -- src/core/backtest
pnpm test
```

### Phase E：策略和投研能力深化

优先级：中。

目标：从“能自动交易”演进为“能辅助决策和风险控制”。

建议任务：

1. 策略组合层：
   - 组合回测
   - 组合再平衡
   - 单基金和组合级风险预算
2. 风险层：
   - 最大回撤预算
   - 单基金集中度
   - 基金经理 / 基金公司集中度
   - 连续失败熔断
3. 投研层：
   - 基金画像
   - 基金经理变更
   - 费用、规模、同类排名
   - 基金相关性
4. 前端体验：
   - 确认工作台
   - 异常订单处理页
   - 运维任务面板
   - 移动端只保留确认、告警、持仓查看

验收标准：

```bash
pnpm build
pnpm test
pnpm test:e2e:pr
```

## 推荐下次执行入口

下次继续开发时，建议直接从 **Phase A：交易状态机与可恢复性** 开始。

推荐提示词：

```text
继续执行 docs/EVOLUTION_ROADMAP.md 中的 Phase A：交易状态机与可恢复性。
先按 TDD 补交易状态机测试，再做最小实现。
范围控制在后端交易创建、交易任务执行、交易状态迁移和对应测试。
不要先重构 broker adapter，除非 Phase A 无法推进。
```

## 暂不做的事项

- 不做多租户 SaaS 化。
- 不做多人权限体系。
- 不做复杂组织、角色、团队能力。
- 不做移动端复杂策略编辑。
- 不在未完成交易状态机前继续堆新策略。

## 长期原则

1. 自动交易优先保证可恢复，不优先追求功能数量。
2. 服务器部署优先保证最小暴露面、可备份、可恢复。
3. 单人使用也保留用户归属过滤，因为它能降低 token 泄漏、误请求和历史数据混杂风险。
4. broker 真实接入必须可 dry-run、可 replay、可人工接管。
5. 新策略上线前必须有回测、模拟运行和小额验证路径。
