# A股基金自动交易平台 - AI Agent 上下文

## 项目概述

这是一个基于 Node.js/TypeScript 的场外基金自动交易系统，用于个人投资管理。系统实现了自动定投、智能止盈止损、策略回测和实时监控功能。

**项目状态**: ✅ Phase 1 MVP 已完成，可用于开发测试

**关键特性**:

- 自动定投（日/周/月频率）
- 智能止盈止损（目标收益率、移动止盈、最大回撤）
- 策略回测系统（历史数据验证）
- 多渠道通知（Telegram/飞书）
- 基金净值自动同步
- 会话自动保活
- Swagger API 文档（交互式接口文档）

## 技术栈

- **框架**: NestJS 11 + TypeScript 5.9
- **数据库**: PostgreSQL 13+ + TypeORM 0.3
- **任务队列**: Bull 4 + Redis 6+
- **浏览器自动化**: Puppeteer 24
- **通知**: Telegram Bot API + 飞书 SDK
- **包管理**: pnpm

## 项目架构

### 目录结构

```
fundTrader/
├── src/
│   ├── models/              # 数据模型（7个实体）
│   │   ├── user.entity.ts
│   │   ├── fund.entity.ts
│   │   ├── fund-nav.entity.ts
│   │   ├── position.entity.ts
│   │   ├── transaction.entity.ts
│   │   ├── strategy.entity.ts
│   │   └── backtest-result.entity.ts
│   ├── services/            # 服务层
│   │   ├── broker/         # 交易平台接入
│   │   │   └── tiantian.service.ts
│   │   ├── data/           # 数据获取
│   │   │   └── fund-data.service.ts
│   │   └── notify/         # 通知服务
│   │       ├── notify.service.ts
│   │       ├── telegram.service.ts
│   │       └── feishu.service.ts
│   ├── core/               # 核心业务逻辑
│   │   ├── strategy/       # 策略引擎
│   │   │   ├── auto-invest.strategy.ts
│   │   │   └── take-profit-stop-loss.strategy.ts
│   │   └── backtest/       # 回测系统
│   │       └── backtest.engine.ts
│   ├── scheduler/          # 定时任务
│   │   ├── scheduler.service.ts
│   │   ├── trading.processor.ts
│   │   └── data-sync.processor.ts
│   ├── api/                # REST API
│   │   ├── controllers.ts
│   │   └── dto.ts
│   ├── utils/              # 工具函数
│   │   ├── crypto.util.ts  # AES-256-GCM 加密
│   │   └── time.util.ts    # 交易时间判断
│   ├── app.module.ts       # 应用模块
│   └── main.ts             # 应用入口
├── config/                 # 配置文件
│   └── default.yml
├── docs/                   # 文档
│   ├── PLAN.md            # 技术方案
│   ├── IMPLEMENTATION.md  # 实施总结
│   ├── QUICKSTART.md      # 快速开始
│   └── SECURITY_FIXES.md  # 安全修复记录
├── .env.example           # 环境变量模板
└── docker-compose.yml     # 数据库服务
```

### 核心模块说明

#### 1. 数据模型层 (models/)

- **User**: 用户信息，加密存储交易平台凭证
- **Fund**: 基金基本信息（代码、名称、类型、基金经理）
- **FundNav**: 基金净值历史数据（时序数据）
- **Position**: 持仓信息（份额、成本、收益率）
- **Transaction**: 交易记录（买入/卖出、状态跟踪）
- **Strategy**: 策略配置（定投/止盈/止损参数）
- **BacktestResult**: 回测结果（收益率、夏普比率、最大回撤）

#### 2. 服务层 (services/)

- **TiantianBrokerService**: 天天基金交易平台接入
  - Puppeteer 模拟登录和交易
  - 会话管理和保活
  - 订单状态查询
- **FundDataService**: 基金数据获取
  - 从天天基金 API 获取实时净值
  - 历史净值数据同步
- **NotifyService**: 通知服务
  - Telegram Bot 集成
  - 飞书机器人集成
  - 多渠道并行通知

#### 3. 核心业务层 (core/)

- **AutoInvestStrategy**: 定投策略引擎
  - 支持日/周/月定投频率
  - 交易时间检查（工作日 15:00 前）
  - 自动执行买入
- **TakeProfitStopLossStrategy**: 止盈止损策略
  - 目标收益率止盈
  - 移动止盈（trailing stop）
  - 最大回撤止损
- **BacktestEngine**: 回测引擎
  - 历史数据回放
  - 策略信号评估
  - 性能指标计算

#### 4. 定时任务层 (scheduler/)

- 每天 09:00 同步基金净值
- 工作日 14:30 检查定投策略
- 每小时检查止盈止损
- 每 30 分钟保持会话活跃

## 开发规范

### 代码风格

- 使用 TypeScript 严格模式
- 遵循 NestJS 依赖注入模式
- 使用装饰器进行模块化设计
- 文件命名：kebab-case（如 `fund-data.service.ts`）
- 类命名：PascalCase（如 `FundDataService`）

### 数据库操作

- 使用 TypeORM Repository 模式
- 敏感信息（账号密码）使用 AES-256-GCM 加密存储
- 时序数据（净值）考虑使用 TimescaleDB 扩展优化

### 错误处理

- 所有外部调用（API、数据库、浏览器自动化）必须有错误处理
- 使用 NestJS 内置异常过滤器
- 关键操作失败时发送通知

### 安全要求

- 不要在代码中硬编码敏感信息
- 所有敏感配置通过环境变量读取
- 交易平台凭证加密存储在数据库
- API 接口需要添加认证和限流

### 测试规范

#### 测试框架

- **测试框架**: Jest 30.2.0
- **测试工具**: @nestjs/testing + ts-jest
- **覆盖率目标**: 80% (statements, branches, functions, lines)
- **测试类型**: 单元测试、集成测试

#### 测试命令

```bash
pnpm test          # 运行所有测试
pnpm test:watch    # 监听模式（开发时使用）
pnpm test:cov      # 生成覆盖率报告
```

#### 测试文件组织

测试文件放在被测试文件同级的 `__tests__` 目录中：

```
src/
├── utils/
│   ├── time.util.ts
│   ├── crypto.util.ts
│   └── __tests__/
│       ├── time.util.test.ts
│       └── crypto.util.test.ts
├── core/
│   └── strategy/
│       ├── auto-invest.strategy.ts
│       └── __tests__/
│           └── auto-invest.strategy.test.ts
└── services/
    └── data/
        ├── fund-data.service.ts
        └── __tests__/
            └── fund-data.service.test.ts
```

#### 测试覆盖率现状

**当前覆盖率**: 47.73% (78 个测试通过)

**已完成测试** (100% 覆盖):
- ✅ `utils/` - 工具函数 (时间、加密)
- ✅ `services/data/` - 基金数据服务
- ✅ `services/notify/notify.service.ts` - 通知服务
- ✅ `core/strategy/` - 定投和止盈止损策略 (98.71%)

**部分覆盖**:
- 🟡 `core/backtest/` - 回测引擎 (68.26%)

**待测试模块**:
- ⚪ `api/` - REST API 控制器
- ⚪ `scheduler/` - 定时任务处理器
- ⚪ `services/broker/` - 交易平台接入
- ⚪ `services/notify/` - Telegram/飞书服务

#### 编写测试的最佳实践

1. **使用 NestJS Testing 模块**
   ```typescript
   import { Test, TestingModule } from '@nestjs/testing';

   const module: TestingModule = await Test.createTestingModule({
     providers: [ServiceToTest, MockDependency],
   }).compile();
   ```

2. **Mock 外部依赖**
   - 使用 `jest.fn()` 创建 mock 函数
   - 使用 `jest.Mocked<Type>` 类型化 mock 对象
   - Mock 数据库 Repository、外部 API、浏览器自动化

3. **测试命名规范**
   - 文件名: `*.test.ts` 或 `*.spec.ts`
   - describe: 描述被测试的类或函数
   - it: 描述具体的测试场景（使用 should 语句）

4. **测试覆盖要点**
   - ✅ 正常流程（happy path）
   - ✅ 边界条件（空值、极值）
   - ✅ 错误处理（异常、失败场景）
   - ✅ 业务逻辑分支

5. **时间相关测试**
   ```typescript
   jest.useFakeTimers();
   jest.setSystemTime(new Date('2026-02-25T14:00:00'));
   // ... 测试代码
   jest.useRealTimers();
   ```

6. **异步测试**
   ```typescript
   it('should handle async operation', async () => {
     const result = await service.asyncMethod();
     expect(result).toBeDefined();
   });
   ```

#### 测试注意事项

- **不要测试外部服务**: Mock 所有外部 API 调用
- **不要依赖真实数据库**: 使用 Mock Repository
- **不要依赖网络**: Mock axios 等 HTTP 客户端
- **隔离测试**: 每个测试独立，不依赖其他测试的状态
- **清理副作用**: 使用 `afterEach` 清理 mock 和定时器

## AI Agent 工作指南

### 修改代码时的注意事项

1. **场外基金交易特性**
   - T+1 确认机制：今天买入，明天确认份额
   - 交易时间限制：工作日 15:00 前
   - 净值更新延迟：通常晚上更新
   - 修改交易相关逻辑时必须考虑这些特性

2. **不要修改的核心逻辑**
   - 加密算法（crypto.util.ts）：已使用 AES-256-GCM
   - 交易时间判断（time.util.ts）：已考虑工作日和交易时段
   - 会话管理机制：已实现自动保活

3. **可以优化的部分**
   - 添加更多策略类型（网格交易、动态再平衡）
   - 优化回测性能（并行计算、缓存）
   - 添加 Web 界面（React/Vue）
   - 增强风控功能（单日限额、仓位限制）

4. **测试要求**
   - 交易相关功能必须先在测试环境验证
   - 使用小额资金测试实际交易
   - 回测系统需要验证计算准确性
   - 定时任务需要验证执行时间

### 添加新功能的流程

1. **阅读相关文档**
   - docs/PLAN.md：了解整体架构设计
   - docs/IMPLEMENTATION.md：了解已实现功能
   - 相关模块的现有代码

2. **遵循现有模式**
   - 新增 Entity 需要在 models/ 目录
   - 新增 Service 需要在 services/ 目录
   - 新增策略需要在 core/strategy/ 目录
   - 使用 NestJS 依赖注入

3. **更新配置**
   - 新增环境变量需要更新 .env.example
   - 新增配置项需要更新 config/default.yml
   - 新增 API 需要更新 controllers.ts

4. **文档同步**
   - 更新 README.md 的功能列表
   - 更新 docs/IMPLEMENTATION.md 的完成状态
   - 如有重大变更，更新 docs/PLAN.md

### 禁止的操作

1. **安全相关**
   - ❌ 不要在代码中硬编码 API 密钥、密码等敏感信息
   - ❌ 不要将 .env 文件提交到版本控制
   - ❌ 不要修改加密算法或降低安全级别
   - ❌ 不要跳过交易平台的安全验证

2. **数据相关**
   - ❌ 不要直接删除生产数据库的数据
   - ❌ 不要修改已确认的交易记录
   - ❌ 不要在未备份的情况下执行数据库迁移

3. **交易相关**
   - ❌ 不要在非交易时间执行交易操作
   - ❌ 不要跳过交易金额和持仓的验证
   - ❌ 不要在未测试的情况下直接使用真实资金

4. **代码质量**
   - ❌ 不要删除现有的错误处理逻辑
   - ❌ 不要移除关键的日志记录
   - ❌ 不要引入未声明的依赖

## 环境配置

### 必需的环境变量

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=fundtrader

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379

# 加密密钥（生产环境必须修改）
MASTER_KEY=your_secure_master_key_min_32_chars
ENCRYPTION_SALT=your_encryption_salt_min_16_chars

# 通知服务（至少配置一个）
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret
FEISHU_USER_ID=your_user_id

# 交易平台账号
TIANTIAN_USERNAME=your_username
TIANTIAN_PASSWORD=your_password
```

### 快速启动

```bash
# 1. 启动数据库
docker-compose up -d

# 2. 安装依赖
pnpm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件

# 4. 启动应用
pnpm start:dev
```

## 关键文件路径

### 配置文件

- `.env.example` - 环境变量模板
- `config/default.yml` - 应用配置
- `tsconfig.json` - TypeScript 配置
- `docker-compose.yml` - 数据库服务配置

### 核心业务

- `src/core/strategy/auto-invest.strategy.ts` - 定投策略
- `src/core/strategy/take-profit-stop-loss.strategy.ts` - 止盈止损策略
- `src/core/backtest/backtest.engine.ts` - 回测引擎

### API 文档

- Swagger UI: `http://localhost:3000/api/docs`
- Swagger JSON: `http://localhost:3000/api/docs-json`
- API 配置: `src/main.ts` (DocumentBuilder)
- DTO 装饰器: `src/api/dto.ts` (@ApiProperty)
- Controller 装饰器: `src/api/controllers.ts` (@ApiTags, @ApiOperation)

### 外部集成

- `src/services/broker/tiantian.service.ts` - 天天基金接入
- `src/services/data/fund-data.service.ts` - 基金数据获取
- `src/services/notify/notify.service.ts` - 通知服务

### 定时任务

- `src/scheduler/scheduler.service.ts` - 任务调度
- `src/scheduler/trading.processor.ts` - 交易任务处理
- `src/scheduler/data-sync.processor.ts` - 数据同步处理

### 工具函数

- `src/utils/crypto.util.ts` - 加密工具（AES-256-GCM）
- `src/utils/time.util.ts` - 时间工具（交易时间判断）

### 测试文件

- `jest.config.js` - Jest 配置文件
- `src/**/__tests__/*.test.ts` - 单元测试文件
- 测试覆盖率报告: `coverage/` 目录（运行 `pnpm test:cov` 后生成）

## 风险提示

⚠️ **重要提示**：

1. **交易风险**
   - 自动交易系统可能因程序错误导致损失
   - 建议先用小额资金测试系统稳定性
   - 设置单日最大交易额限制
   - 重要操作可增加人工确认环节

2. **平台风控**
   - 频繁登录可能触发平台风控
   - 需要控制登录频率，模拟真实用户行为
   - 准备备用账号以防主账号被限制

3. **数据安全**
   - 生产环境必须修改 MASTER_KEY 为强密码
   - 定期更换交易平台密码
   - 定期备份数据库
   - 不要将 .env 文件提交到版本控制

4. **法律合规**
   - 确保使用方式符合平台服务条款
   - 仅供个人学习和研究使用
   - 投资有风险，入市需谨慎

## 开发路线图

### Phase 1: MVP ✅ 已完成

- [x] 项目初始化
- [x] 数据模型
- [x] 基金数据获取
- [x] 交易平台接入
- [x] 定投策略
- [x] 通知系统
- [x] 回测系统

### Phase 2: 完善功能（进行中）

- [ ] 止盈止损策略优化
- [ ] Web 界面开发
- [ ] 更多策略类型
- [ ] 性能优化

### Phase 3: 高级功能（规划中）

- [ ] 多账户支持
- [ ] 风险控制增强
- [ ] 数据分析和可视化
- [ ] 移动端 App

## 参考文档

- [技术方案](./docs/PLAN.md) - 完整的技术架构设计
- [实施总结](./docs/IMPLEMENTATION.md) - 已完成功能清单
- [快速开始](./docs/QUICKSTART.md) - 部署和使用指南
- [安全修复](./docs/SECURITY_FIXES.md) - 安全问题修复记录
