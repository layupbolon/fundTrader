# 功能缺口分析（测试之外）

> 生成时间：2026-03-05  
> 范围：`docs/` 文档 + 当前代码实现交叉核对

## 结论摘要

当前项目在 Phase 4 文档层面“已完成”较多，但代码联调视角下仍存在若干关键缺口。除测试外，优先应补齐：

1. 前后端契约统一（策略枚举与配置结构）
2. 手动交易创建接口闭环（前端已调用、后端缺失）
3. 分析快照任务调度闭环（处理器存在但未调度）
4. 健康检查接口可用性与路径一致性

这些问题优先级高于新增功能开发，因为会直接影响现有功能可用性与运维可靠性。

---

## P0：前后端契约不一致（会导致功能失败）

### 问题 1：`StrategyType` 枚举不一致

- 共享枚举：`TAKE_PROFIT_STOP_LOSS`
- 后端枚举：`TAKE_PROFIT` / `STOP_LOSS`

**证据**
- `packages/shared/src/enums.ts:31`
- `packages/backend/src/models/enums.ts:13`

**影响**
- 前端创建“止盈止损”策略时，后端 DTO 校验/配置映射可能报错。
- 策略筛选、策略执行与展示易出现逻辑分叉。

### 问题 2：止盈止损配置结构不一致

- 前端提交扁平字段（`take_profit_rate`, `stop_loss_rate`, `sell_ratio`, `trailing_stop_rate`）
- 后端要求嵌套结构（`take_profit` + `stop_loss`）

**证据**
- `packages/frontend/src/strategies/TakeProfitStopLossForm.tsx:25`
- `packages/backend/src/api/dto/strategy-config/take-profit-config.dto.ts:31`

**影响**
- 策略创建/更新请求在运行时失败。
- 即使通过，也可能造成策略执行读取字段错误。

**建议**
- 以 `packages/shared` 为唯一契约源，统一前后端枚举与配置结构。
- 为 `CreateStrategy/UpdateStrategy` 增加端到端契约测试。

---

## P0：交易创建链路未闭环

### 问题：前端调用 `POST /transactions`，后端未实现对应接口

**证据**
- 前端：`packages/frontend/src/api/transactions.ts:18`
- 后端：`packages/backend/src/api/controllers.ts:201`（仅有 GET 列表/详情）

**影响**
- 快捷交易功能无法工作（UI 存在但接口 404/405）。
- 手动下单场景不可用，影响策略以外的操作能力。

**建议**
- 在 `TransactionController` 增加 `POST /transactions`。
- 明确与策略自动交易的关系（是否进入确认机制/风控链路/审计日志）。

---

## P1：分析快照任务未形成调度闭环

### 问题：存在 `create-snapshot` 处理器，但调度器未投递该任务

**证据**
- `packages/backend/src/scheduler/snapshot.processor.ts:20`
- `packages/backend/src/scheduler/scheduler.service.ts:19`

**影响**
- 收益曲线与资产分析数据源不足或长期为空。
- `analytics/returns` 结果依赖历史快照，数据质量受影响。

**建议**
- 在调度器新增每日快照任务（建议交易日收盘后）。
- 增加“补历史快照”管理命令/API，支持修复历史数据。

---

## P1：健康检查接口可用性与路径一致性风险

### 问题 1：全局 JWT Guard 下 `/health` 未显式公开

**证据**
- `packages/backend/src/core/monitoring/health.controller.ts:47`
- `packages/backend/src/auth/jwt-auth.guard.ts:9`

**影响**
- 运维系统可能无法匿名探活。
- 容器/网关健康检查可能误判服务异常。

### 问题 2：全局前缀为 `/api`，启动日志仍提示 `/health`

**证据**
- `packages/backend/src/main.ts:75`
- `packages/backend/src/main.ts:142`

**影响**
- 文档、脚本和真实路径不一致，增加排障成本。

**建议**
- 对健康检查端点明确 `@Public()` 或配置白名单。
- 统一健康检查地址文档与启动日志输出。

---

## P1：建议补充手动运维入口（提升可操作性）

### 问题：核心同步任务缺少手动触发 API 闭环

**背景证据**
- 产品建议中明确提出手动触发同步能力：`docs/PRODUCT_FEATURES.md`

**影响**
- 故障恢复、数据补齐、临时校验依赖等待定时任务。
- 运维响应时间长。

**建议**
- 增加手动触发接口：净值同步、持仓刷新、快照生成。
- 增加幂等与审计日志，避免误触发引发副作用。

---

## P2：订单管理能力仍不完整

### 问题：撤单、状态追踪、批量操作未形成完整可用能力

**背景证据**
- 功能规划：`docs/PRODUCT_FEATURES.md`
- 当前 broker 以基础买卖/查询为主：`packages/backend/src/services/broker/tiantian.service.ts`

**影响**
- 异常订单处理效率低。
- 用户对订单生命周期可见性不足。

**建议**
- 分阶段补齐：
  1. 撤单接口
  2. 订单状态轮询与重试策略
  3. 批量查询/批量撤单

---

## 推荐落地顺序

1. **先修契约**：统一枚举与配置结构（P0）
2. **补交易 POST 接口**：打通前端快捷交易（P0）
3. **补快照调度**：保证分析数据连续性（P1）
4. **修健康检查公开与路径**：保障运维监控（P1）
5. **再做运维入口与订单增强**：提升可维护性与操作体验（P1/P2）

---

## 备注

本分析聚焦“测试之外”的产品可用性与运行闭环问题；不否认已有模块实现与测试成果，但当前优先应从“可运行、可联调、可运维”角度先补齐关键缺口。
