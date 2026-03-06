# Phase 4 执行计划 - 产品功能完善

> Phase 4 重点：风控系统、数据分析、用户体验优化

**计划周期**: 2026-03-04 ~ 2026-03-28（约 4 周）

**目标**: 完成 P0 和 P1 优先级功能，建立完整的交易安全保障体系

---

## 执行状态（2026-03-06）

### 完成度总览

- ✅ Phase 4.1 风控系统（已完成）
- ✅ Phase 4.2 交易确认机制（已完成）
- ✅ Phase 4.4 监控告警系统（已完成）
- ✅ Phase 4.5 日志与审计（已完成）
- ✅ Phase 4.6 数据备份（已完成）
- ✅ Phase 4.7 前端体验优化（已完成）
- 🟡 Phase 4.3 数据分析基础（已完成后端与前端基础能力，持续优化中）

### 实现文档索引

- [PHASE4_1_SUMMARY.md](./PHASE4_1_SUMMARY.md)
- [PHASE4.2_IMPLEMENTATION.md](./PHASE4.2_IMPLEMENTATION.md)
- [PHASE4_4_MONITORING_IMPLEMENTATION.md](./PHASE4_4_MONITORING_IMPLEMENTATION.md)
- [PHASE4_5_EXECUTION_REPORT.md](./PHASE4_5_EXECUTION_REPORT.md)
- [BACKUP_IMPLEMENTATION.md](./BACKUP_IMPLEMENTATION.md)
- [PHASE4.7_FRONTEND_OPTIMIZATION.md](./PHASE4.7_FRONTEND_OPTIMIZATION.md)

> 说明：本文件保留计划视角；当前实时状态请以 [IMPLEMENTATION.md](./IMPLEMENTATION.md) 为准。

---

## 阶段划分

### Phase 4.1: 风控系统（3-4 天）🔴 最高优先级

**目标**: 建立完整的交易风控体系，防止重大损失

#### 任务清单

| # | 任务 | 预计工时 | 产出物 |
|---|------|---------|--------|
| 1 | 设计风控数据模型 | 0.5 天 | `RiskLimit` Entity |
| 2 | 实现 `RiskControlService` | 1 天 | 风控检查服务 |
| 3 | 单日交易限额功能 | 0.5 天 | 限额检查逻辑 |
| 4 | 仓位限制功能 | 0.5 天 | 持仓比例检查 |
| 5 | 基金黑名单功能 | 0.5 天 | 黑名单检查 |
| 6 | 异常检测与自动暂停 | 1 天 | 异常策略暂停 |
| 7 | 集成到交易流程 | 0.5 天 | 交易前风控检查 |
| 8 | 风控配置 API | 0.5 天 | CRUD 接口 |

**文件变更**:
```
packages/backend/src/
├── models/risk-limit.entity.ts          # 新增
├── models/blacklist.entity.ts           # 新增
├── core/risk/
│   ├── risk-control.service.ts          # 新增
│   └── risk-control.module.ts           # 新增
├── api/risk.controller.ts               # 新增
└── services/broker/tiantian.service.ts  # 修改（集成风控检查）
```

**验收标准**:
- [ ] 创建风控策略后，超过限额的交易被自动拒绝
- [ ] 黑名单基金无法创建交易策略
- [ ] 单元测试覆盖率 90%+
- [ ] 风控配置 API 可通过 Swagger 测试

---

### Phase 4.2: 交易确认机制（2-3 天）🔴 最高优先级

**目标**: 大额交易需要人工确认，防止误操作

#### 任务清单

| # | 任务 | 预计工时 | 产出物 |
|---|------|---------|--------|
| 1 | 设计交易确认流程 | 0.5 天 | 状态机设计 |
| 2 | 扩展 Transaction 实体 | 0.5 天 | 增加确认字段 |
| 3 | 实现 `TradingConfirmationService` | 1 天 | 确认服务 |
| 4 | Telegram 确认交互 | 0.5 天 | 按钮式确认 |
| 5 | 飞书确认交互 | 0.5 天 | 卡片式确认 |
| 6 | 超时自动取消逻辑 | 0.5 天 | 延迟队列任务 |

**文件变更**:
```
packages/backend/src/
├── models/transaction.entity.ts         # 修改（增加确认字段）
├── core/trading/
│   ├── trading-confirmation.service.ts  # 新增
│   └── trading-confirmation.module.ts   # 新增
├── services/notify/
│   ├── telegram.service.ts              # 修改（增加按钮支持）
│   └── feishu.service.ts                # 修改（增加卡片支持）
└── scheduler/confirmation.processor.ts  # 新增
```

**验收标准**:
- [ ] 超过阈值的交易发送确认通知
- [ ] 用户可通过通知回复确认/取消
- [ ] 超时未确认交易自动取消
- [ ] 确认流程有完整日志记录

---

### Phase 4.3: 数据分析基础（3-4 天）🔵 高优先级

**目标**: 提供基本的收益分析和持仓分析功能

#### 任务清单

| # | 任务 | 预计工时 | 产出物 |
|---|------|---------|--------|
| 1 | 设计每日资产快照表 | 0.5 天 | `PortfolioSnapshot` Entity |
| 2 | 实现快照记录任务 | 0.5 天 | 定时任务 |
| 3 | 实现 `AnalyticsService` | 1.5 天 | 分析服务 |
| 4 | 收益分析 API | 0.5 天 | `/api/analytics/returns` |
| 5 | 持仓分析 API | 0.5 天 | `/api/analytics/positions` |
| 6 | 交易统计 API | 0.5 天 | `/api/analytics/transactions` |
| 7 | 前端收益图表组件 | 1 天 | 收益曲线图 |

**文件变更**:
```
packages/backend/src/
├── models/portfolio-snapshot.entity.ts  # 新增
├── core/analytics/
│   ├── analytics.service.ts             # 新增
│   └── analytics.module.ts              # 新增
├── api/analytics.controller.ts          # 新增
└── scheduler/snapshot.processor.ts      # 新增

packages/frontend/src/
├── analytics/
│   ├── AnalyticsPage.tsx                # 新增
│   ├── ReturnChart.tsx                  # 新增
│   └── PositionChart.tsx                # 新增
└── api/analytics.ts                     # 新增
```

**验收标准**:
- [ ] 收益曲线图正确展示历史收益
- [ ] 持仓分布图正确展示基金分布
- [ ] 交易统计数据显示正确
- [ ] API 响应时间 < 500ms

---

### Phase 4.4: 监控告警系统（2-3 天）🔵 高优先级

**目标**: 建立系统健康监控，及时发现和响应问题

#### 任务清单

| # | 任务 | 预计工时 | 产出物 |
|---|------|---------|--------|
| 1 | 健康检查端点 | 0.5 天 | `/health` 接口 |
| 2 | 数据库连接监控 | 0.5 天 | 连接池监控 |
| 3 | Redis 连接监控 | 0.5 天 | Redis 状态检查 |
| 4 | 浏览器会话监控 | 0.5 天 | Puppeteer 会话检查 |
| 5 | 错误告警通知 | 0.5 天 | 错误推送 |
| 6 | 性能指标采集 | 1 天 | 响应时间统计 |

**文件变更**:
```
packages/backend/src/
├── core/monitoring/
│   ├── health.service.ts                # 新增
│   ├── health.controller.ts             # 新增
│   └── monitoring.module.ts             # 新增
├── scheduler/health-check.processor.ts  # 新增
└── main.ts                              # 修改（增加健康端点）
```

**验收标准**:
- [ ] `/health` 端点返回各组件状态
- [ ] 服务异常时 5 分钟内发送告警通知
- [ ] 错误日志包含完整的上下文信息
- [ ] 性能指标可在接口响应头查看

---

### Phase 4.5: 日志与审计（2-3 天）🔵 高优先级

**目标**: 完整的操作日志和审计功能

#### 任务清单

| # | 任务 | 预计工时 | 产出物 |
|---|------|---------|--------|
| 1 | 集成 winston 日志库 | 0.5 天 | 结构化日志 |
| 2 | 操作日志 Entity | 0.5 天 | `OperationLog` Entity |
| 3 | 日志拦截器 | 0.5 天 | 自动记录请求 |
| 4 | 交易日志记录 | 0.5 天 | 交易详情日志 |
| 5 | 配置变更审计 | 0.5 天 | 策略变更日志 |
| 6 | 日志查询 API | 1 天 | 日志搜索接口 |

**文件变更**:
```
packages/backend/src/
├── models/operation-log.entity.ts       # 新增
├── common/
│   ├── logging.interceptor.ts           # 新增
│   └── audit.decorator.ts               # 新增
├── api/log.controller.ts                # 新增
└── main.ts                              # 修改（集成 winston）
```

**验收标准**:
- [ ] 所有用户操作有日志记录
- [ ] 交易过程有详细日志
- [ ] 策略配置变更记录完整
- [ ] 日志可按时间、类型、用户搜索

---

### Phase 4.6: 数据备份（1-2 天）🔵 高优先级

**目标**: 自动备份数据库，支持数据恢复

#### 任务清单

| # | 任务 | 预计工时 | 产出物 |
|---|------|---------|--------|
| 1 | 备份脚本 | 0.5 天 | pg_dump 脚本 |
| 2 | 定时备份任务 | 0.5 天 | 每日备份 |
| 3 | 备份列表 API | 0.5 天 | 备份文件列表 |
| 4 | 备份下载 API | 0.5 天 | 文件下载 |
| 5 | 数据恢复功能 | 1 天 | 恢复脚本 |

**文件变更**:
```
packages/backend/
├── scripts/
│   ├── backup.sh                        # 新增
│   └── restore.sh                       # 新增
└── src/
    └── api/backup.controller.ts         # 新增
```

**验收标准**:
- [ ] 每天自动备份数据库
- [ ] 备份文件保留至少 7 天
- [ ] 可通过 API 下载备份文件
- [ ] 恢复脚本可正常恢复数据

---

### Phase 4.7: 前端体验优化（3-4 天）🟡 中优先级

**目标**: 完善前端功能，提升用户体验

#### 任务清单

| # | 任务 | 预计工时 | 产出物 |
|---|------|---------|--------|
| 1 | 策略列表页面 | 1 天 | 策略管理 UI |
| 2 | 策略编辑功能 | 1 天 | 编辑弹窗/页面 |
| 3 | 快捷交易操作 | 0.5 天 | 一键买入/卖出 |
| 4 | 基金搜索功能 | 0.5 天 | 搜索组件 |
| 5 | 持仓手动刷新 | 0.5 天 | 刷新按钮 |
| 6 | 响应式布局优化 | 0.5 天 | 移动端适配 |

**文件变更**:
```
packages/frontend/src/
├── strategies/
│   ├── StrategiesPage.tsx               # 修改/新增
│   └── StrategyList.tsx                 # 新增
├── components/
│   ├── FundSearch.tsx                   # 新增
│   └── QuickTrade.tsx                   # 新增
└── dashboard/
    └── DashboardPage.tsx                # 修改（刷新功能）
```

**验收标准**:
- [ ] 策略列表展示所有策略及状态
- [ ] 可编辑策略参数
- [ ] 快捷交易有二次确认
- [ ] 基金搜索支持模糊匹配
- [ ] 页面在移动端正常显示

---

## 执行时间表

```
Week 1 (03-04 ~ 03-10): Phase 4.1 风控系统 + Phase 4.2 交易确认
Week 2 (03-11 ~ 03-17): Phase 4.3 数据分析 + Phase 4.4 监控告警
Week 3 (03-18 ~ 03-24): Phase 4.5 日志审计 + Phase 4.6 数据备份
Week 4 (03-25 ~ 03-31): Phase 4.7 前端优化 + 集成测试
```

---

## 测试计划

### 单元测试
- 所有新增 Service 必须有单元测试
- 覆盖率目标：85%+
- 关键风控逻辑覆盖率：95%+

### 集成测试
- 交易流程端到端测试
- 通知确认流程测试
- 风控限额触发测试

### 手动测试清单
- [ ] 创建风控策略并触发限额
- [ ] 大额交易确认流程
- [ ] 收益分析图表展示
- [ ] 健康检查端点
- [ ] 日志查询功能
- [ ] 数据备份与恢复

---

## 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 风控逻辑复杂 | 延期 | 优先实现核心限额功能 |
| 交易平台 API 变更 | 功能失效 | 增加异常处理，快速迭代 |
| 前端图表性能 | 加载慢 | 数据分页，虚拟滚动 |
| 备份文件过大 | 存储不足 | 自动清理 7 天前备份 |

---

## 交付物清单

1. **代码交付**
   - [ ] 风控系统模块
   - [ ] 交易确认模块
   - [ ] 数据分析模块
   - [ ] 监控告警模块
   - [ ] 日志审计模块
   - [ ] 数据备份模块
   - [ ] 前端优化功能

2. **文档交付**
   - [ ] PRODUCT_FEATURES.md（已完成）
   - [ ] PHASE4_PLAN.md（本文档）
   - [ ] PHASE4_IMPLEMENTATION.md（完成后编写）
   - [ ] API 文档更新（Swagger 自动更新）

3. **测试交付**
   - [ ] 单元测试覆盖率报告
   - [ ] 集成测试用例
   - [ ] 手动测试检查清单

---

## 参考文档

- [PRODUCT_FEATURES.md](./PRODUCT_FEATURES.md) - 产品功能完善建议
- [PLAN.md](./PLAN.md) - 完整技术方案
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) - 已实现功能总结

---

**状态**: 部分已执行并持续收尾

**创建日期**: 2026-03-03

**最后更新**: 2026-03-06
