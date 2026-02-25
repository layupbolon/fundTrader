# A股基金自动交易平台技术方案

## Context

开发一个个人使用的A股场外基金自动交易平台，实现自动定投、智能止盈止损、策略回测和实时监控功能。用户是专业开发者,选择Node.js/TypeScript技术栈，本地运行，使用PostgreSQL数据库，通过Telegram/微信/飞书接收通知。

场外基金交易的特点：
- T+1确认机制（今天买入，明天确认份额）
- 交易时间限制（工作日15:00前）
- 需要处理登录态和会话管理
- 净值更新延迟（通常晚上更新）

## 技术架构

### 整体架构
采用**单体应用 + 模块化设计**，避免过度设计：

```
fundTrader/
├── src/
│   ├── core/           # 核心业务逻辑
│   │   ├── strategy/   # 策略引擎（定投、止盈止损）
│   │   ├── backtest/   # 回测系统
│   │   └── risk/       # 风控模块
│   ├── services/       # 外部服务集成
│   │   ├── broker/     # 交易平台接入（天天基金等）
│   │   ├── data/       # 数据获取（基金净值、行情）
│   │   └── notify/     # 通知服务（Telegram/飞书）
│   ├── scheduler/      # 定时任务调度
│   ├── api/            # REST API（可选Web界面）
│   ├── models/         # 数据模型
│   └── utils/          # 工具函数
├── config/             # 配置文件
├── migrations/         # 数据库迁移
└── tests/              # 测试
```

### 技术栈选型

**核心框架**
- **NestJS**: 企业级Node.js框架，内置依赖注入、模块化、装饰器支持
- **TypeORM**: ORM框架，支持PostgreSQL，类型安全
- **Bull**: 基于Redis的任务队列，处理定时任务和异步任务

**数据采集**
- **Puppeteer**: 无头浏览器，用于模拟登录和交易操作
- **Axios**: HTTP客户端，调用公开API获取基金数据
- **AKShare** (Python): 可选，通过子进程调用获取金融数据

**通知服务**
- **node-telegram-bot-api**: Telegram Bot集成
- **@larksuiteoapi/node-sdk**: 飞书开放平台SDK
- **wechaty**: 微信机器人（需要注意微信风控）

**数据存储**
- **PostgreSQL**: 主数据库，存储用户、持仓、交易记录
- **Redis**: 缓存和任务队列
- **TimescaleDB扩展**: 时序数据优化（可选，用于存储历史净值）

## 数据模型设计

### 核心表结构

```typescript
// 用户表
User {
  id: string (UUID)
  username: string
  encrypted_credentials: jsonb  // 加密的交易平台账号密码
  created_at: timestamp
}

// 基金信息表
Fund {
  code: string (PK)           // 基金代码
  name: string
  type: string                // 股票型、债券型、混合型等
  manager: string
  updated_at: timestamp
}

// 基金净值表（时序数据）
FundNav {
  id: bigserial (PK)
  fund_code: string (FK)
  nav: decimal                // 单位净值
  acc_nav: decimal            // 累计净值
  date: date
  growth_rate: decimal        // 日增长率
}

// 持仓表
Position {
  id: string (UUID)
  user_id: string (FK)
  fund_code: string (FK)
  shares: decimal             // 持有份额
  cost: decimal               // 持仓成本
  avg_price: decimal          // 平均成本价
  current_value: decimal      // 当前市值
  profit: decimal             // 浮动盈亏
  profit_rate: decimal        // 收益率
  updated_at: timestamp
}

// 交易记录表
Transaction {
  id: string (UUID)
  user_id: string (FK)
  fund_code: string (FK)
  type: enum                  // BUY, SELL
  amount: decimal             // 交易金额
  shares: decimal             // 交易份额
  price: decimal              // 交易价格（净值）
  status: enum                // PENDING, CONFIRMED, FAILED
  order_id: string            // 平台订单号
  submitted_at: timestamp     // 提交时间
  confirmed_at: timestamp     // 确认时间
  strategy_id: string (FK)    // 关联策略
}

// 策略配置表
Strategy {
  id: string (UUID)
  user_id: string (FK)
  name: string
  type: enum                  // AUTO_INVEST, TAKE_PROFIT, STOP_LOSS
  fund_code: string (FK)
  config: jsonb               // 策略参数
  enabled: boolean
  created_at: timestamp
}

// 策略参数示例
AutoInvestConfig {
  amount: number              // 每期投资金额
  frequency: string           // daily, weekly, monthly
  day_of_week?: number        // 周几（weekly）
  day_of_month?: number       // 几号（monthly）
  start_date: date
  end_date?: date
}

TakeProfitConfig {
  target_rate: number         // 目标收益率（如15%）
  sell_ratio: number          // 卖出比例（如50%）
  trailing_stop?: number      // 移动止盈（可选）
}

StopLossConfig {
  max_drawdown: number        // 最大回撤（如-10%）
  sell_ratio: number          // 卖出比例
}

// 回测结果表
BacktestResult {
  id: string (UUID)
  strategy_config: jsonb
  fund_code: string
  start_date: date
  end_date: date
  initial_capital: decimal
  final_value: decimal
  total_return: decimal
  annual_return: decimal
  max_drawdown: decimal
  sharpe_ratio: decimal
  trades_count: integer
  created_at: timestamp
}
```

## 核心模块实现

### 1. 交易平台接入方案

**天天基金接入**（推荐优先实现）

```typescript
// src/services/broker/tiantian.service.ts
class TiantianBrokerService {
  // 使用Puppeteer模拟登录
  async login(username: string, password: string): Promise<Session>

  // 获取持仓信息
  async getPositions(): Promise<Position[]>

  // 买入基金
  async buyFund(fundCode: string, amount: number): Promise<Order>

  // 卖出基金
  async sellFund(fundCode: string, shares: number): Promise<Order>

  // 查询订单状态
  async getOrderStatus(orderId: string): Promise<OrderStatus>

  // 保持会话活跃
  async keepAlive(): Promise<void>
}
```

**实现要点**：
- 使用Puppeteer启动无头浏览器，模拟用户登录
- 登录后保存Cookie到数据库（加密存储）
- 定期刷新会话（每30分钟访问一次）
- 处理验证码（可能需要人工介入或使用OCR）
- 错误重试机制（网络失败、会话过期）

**数据获取方案**

```typescript
// src/services/data/fund-data.service.ts
class FundDataService {
  // 从天天基金API获取基金信息
  async getFundInfo(fundCode: string): Promise<Fund>

  // 获取基金净值
  async getFundNav(fundCode: string, date?: Date): Promise<FundNav>

  // 获取历史净值（用于回测）
  async getHistoricalNav(
    fundCode: string,
    startDate: Date,
    endDate: Date
  ): Promise<FundNav[]>

  // 批量更新净值（定时任务）
  async syncAllFundNav(): Promise<void>
}
```

**数据源**：
- 天天基金公开API: `http://fundgz.1234567.com.cn/js/{fundCode}.js`
- 东方财富API: `http://fund.eastmoney.com/`
- 备用：AKShare Python库（通过子进程调用）

### 2. 定投策略引擎

```typescript
// src/core/strategy/auto-invest.strategy.ts
class AutoInvestStrategy {
  // 检查是否需要执行定投
  async shouldExecute(strategy: Strategy): Promise<boolean> {
    // 检查日期、时间、余额等条件
  }

  // 执行定投
  async execute(strategy: Strategy): Promise<Transaction> {
    const { fund_code, config } = strategy;
    const { amount } = config as AutoInvestConfig;

    // 1. 检查交易时间（工作日15:00前）
    if (!this.isTradeTime()) {
      throw new Error('非交易时间');
    }

    // 2. 执行买入
    const order = await this.brokerService.buyFund(fund_code, amount);

    // 3. 记录交易
    const transaction = await this.saveTransaction({
      fund_code,
      type: 'BUY',
      amount,
      status: 'PENDING',
      order_id: order.id,
      strategy_id: strategy.id
    });

    // 4. 发送通知
    await this.notifyService.send({
      title: '定投执行成功',
      content: `${fund_code} 买入 ${amount}元`
    });

    return transaction;
  }
}
```

### 3. 止盈止损策略

```typescript
// src/core/strategy/take-profit-stop-loss.strategy.ts
class TakeProfitStopLossStrategy {
  // 检查止盈条件
  async checkTakeProfit(position: Position, config: TakeProfitConfig): Promise<boolean> {
    const { profit_rate } = position;
    const { target_rate, trailing_stop } = config;

    // 简单止盈：达到目标收益率
    if (profit_rate >= target_rate) {
      return true;
    }

    // 移动止盈：从最高点回撤超过阈值
    if (trailing_stop) {
      const maxProfitRate = await this.getMaxProfitRate(position.id);
      if (maxProfitRate - profit_rate >= trailing_stop) {
        return true;
      }
    }

    return false;
  }

  // 检查止损条件
  async checkStopLoss(position: Position, config: StopLossConfig): Promise<boolean> {
    const { profit_rate } = position;
    const { max_drawdown } = config;

    return profit_rate <= max_drawdown;
  }

  // 执行卖出
  async executeSell(position: Position, sellRatio: number): Promise<Transaction> {
    const sharesToSell = position.shares * sellRatio;
    const order = await this.brokerService.sellFund(position.fund_code, sharesToSell);

    // 记录交易并通知
    // ...
  }
}
```

### 4. 回测系统

```typescript
// src/core/backtest/backtest.engine.ts
class BacktestEngine {
  async runBacktest(params: BacktestParams): Promise<BacktestResult> {
    const { strategy_config, fund_code, start_date, end_date, initial_capital } = params;

    // 1. 获取历史净值数据
    const historicalNav = await this.fundDataService.getHistoricalNav(
      fund_code,
      start_date,
      end_date
    );

    // 2. 初始化回测状态
    let cash = initial_capital;
    let shares = 0;
    const trades: Trade[] = [];

    // 3. 遍历每个交易日
    for (const nav of historicalNav) {
      // 检查策略信号
      const signal = this.evaluateStrategy(strategy_config, nav, { cash, shares });

      if (signal.action === 'BUY' && cash >= signal.amount) {
        const buyShares = signal.amount / nav.nav;
        shares += buyShares;
        cash -= signal.amount;
        trades.push({ date: nav.date, type: 'BUY', amount: signal.amount, price: nav.nav });
      }

      if (signal.action === 'SELL' && shares > 0) {
        const sellShares = shares * signal.ratio;
        const sellAmount = sellShares * nav.nav;
        shares -= sellShares;
        cash += sellAmount;
        trades.push({ date: nav.date, type: 'SELL', shares: sellShares, price: nav.nav });
      }
    }

    // 4. 计算回测指标
    const finalValue = cash + shares * historicalNav[historicalNav.length - 1].nav;
    const totalReturn = (finalValue - initial_capital) / initial_capital;
    const annualReturn = this.calculateAnnualReturn(totalReturn, start_date, end_date);
    const maxDrawdown = this.calculateMaxDrawdown(trades, historicalNav);
    const sharpeRatio = this.calculateSharpeRatio(trades, historicalNav);

    return {
      initial_capital,
      final_value: finalValue,
      total_return: totalReturn,
      annual_return: annualReturn,
      max_drawdown: maxDrawdown,
      sharpe_ratio: sharpeRatio,
      trades_count: trades.length
    };
  }
}
```

### 5. 定时任务调度

```typescript
// src/scheduler/scheduler.service.ts
@Injectable()
class SchedulerService {
  constructor(
    @InjectQueue('trading') private tradingQueue: Queue,
    @InjectQueue('data-sync') private dataSyncQueue: Queue,
  ) {}

  onModuleInit() {
    // 每天早上9:00同步基金净值
    this.dataSyncQueue.add('sync-nav', {}, {
      repeat: { cron: '0 9 * * *' }
    });

    // 每天14:30检查定投策略
    this.tradingQueue.add('check-auto-invest', {}, {
      repeat: { cron: '30 14 * * 1-5' }  // 工作日14:30
    });

    // 每小时检查止盈止损
    this.tradingQueue.add('check-take-profit-stop-loss', {}, {
      repeat: { cron: '0 * * * *' }
    });

    // 每30分钟保持会话活跃
    this.tradingQueue.add('keep-session-alive', {}, {
      repeat: { cron: '*/30 * * * *' }
    });
  }
}

// 任务处理器
@Processor('trading')
class TradingProcessor {
  @Process('check-auto-invest')
  async handleAutoInvest() {
    const strategies = await this.strategyService.getEnabledStrategies('AUTO_INVEST');
    for (const strategy of strategies) {
      if (await this.autoInvestStrategy.shouldExecute(strategy)) {
        await this.autoInvestStrategy.execute(strategy);
      }
    }
  }

  @Process('check-take-profit-stop-loss')
  async handleTakeProfitStopLoss() {
    const positions = await this.positionService.getAllPositions();
    for (const position of positions) {
      const strategies = await this.strategyService.getStrategiesForPosition(position.id);
      // 检查并执行止盈止损
    }
  }
}
```

### 6. 通知系统

```typescript
// src/services/notify/notify.service.ts
interface NotifyMessage {
  title: string;
  content: string;
  level: 'info' | 'warning' | 'error';
}

@Injectable()
class NotifyService {
  constructor(
    private telegramService: TelegramService,
    private feishuService: FeishuService,
  ) {}

  async send(message: NotifyMessage) {
    // 并行发送到所有通知渠道
    await Promise.all([
      this.telegramService.sendMessage(message),
      this.feishuService.sendMessage(message),
    ]);
  }
}

// Telegram实现
@Injectable()
class TelegramService {
  private bot: TelegramBot;

  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
  }

  async sendMessage(message: NotifyMessage) {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const text = `*${message.title}*\n\n${message.content}`;
    await this.bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  }
}

// 飞书实现
@Injectable()
class FeishuService {
  private client: lark.Client;

  constructor() {
    this.client = new lark.Client({
      appId: process.env.FEISHU_APP_ID,
      appSecret: process.env.FEISHU_APP_SECRET,
    });
  }

  async sendMessage(message: NotifyMessage) {
    await this.client.im.message.create({
      params: {
        receive_id_type: 'user_id',
      },
      data: {
        receive_id: process.env.FEISHU_USER_ID,
        msg_type: 'text',
        content: JSON.stringify({
          text: `${message.title}\n${message.content}`
        }),
      },
    });
  }
}
```

## 安全性设计

### 敏感信息加密

```typescript
// src/utils/crypto.util.ts
import * as crypto from 'crypto';

class CryptoUtil {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor() {
    // 从环境变量读取主密钥
    this.key = crypto.scryptSync(process.env.MASTER_KEY, 'salt', 32);
  }

  encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return JSON.stringify({
      iv: iv.toString('hex'),
      encrypted,
      authTag: authTag.toString('hex')
    });
  }

  decrypt(encryptedData: string): string {
    const { iv, encrypted, authTag } = JSON.parse(encryptedData);

    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex')
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
```

### 配置管理

```typescript
// config/default.yml
database:
  host: localhost
  port: 5432
  database: fundtrader
  username: postgres
  password: ${DB_PASSWORD}  # 从环境变量读取

redis:
  host: localhost
  port: 6379

broker:
  tiantian:
    login_url: https://trade.1234567.com.cn/login
    session_timeout: 1800  # 30分钟

scheduler:
  timezone: Asia/Shanghai
  trading_hours:
    start: "09:30"
    end: "15:00"

notify:
  telegram:
    bot_token: ${TELEGRAM_BOT_TOKEN}
    chat_id: ${TELEGRAM_CHAT_ID}
  feishu:
    app_id: ${FEISHU_APP_ID}
    app_secret: ${FEISHU_APP_SECRET}
    user_id: ${FEISHU_USER_ID}
```

## 开发路线图

### Phase 1: MVP（最小可行产品）- 2周

**目标**：实现基本的定投功能

1. **项目初始化**（1天）
   - 创建NestJS项目
   - 配置TypeORM + PostgreSQL
   - 配置Redis + Bull
   - 设置环境变量和配置管理

2. **数据模型**（1天）
   - 创建数据库表结构
   - 实现Entity和Repository

3. **基金数据获取**（2天）
   - 实现FundDataService
   - 对接天天基金API获取净值
   - 实现定时同步任务

4. **交易平台接入**（3天）
   - 实现TiantianBrokerService
   - Puppeteer模拟登录
   - 实现买入功能
   - 会话管理

5. **定投策略**（2天）
   - 实现AutoInvestStrategy
   - 定时任务调度
   - 交易记录保存

6. **通知系统**（2天）
   - 实现Telegram通知
   - 实现飞书通知
   - 集成到策略执行流程

7. **测试和调试**（3天）
   - 单元测试
   - 集成测试
   - 模拟交易测试

### Phase 2: 完善功能 - 2周

1. **止盈止损**（3天）
   - 实现TakeProfitStopLossStrategy
   - 持仓监控
   - 卖出功能

2. **回测系统**（4天）
   - 实现BacktestEngine
   - 历史数据准备
   - 回测指标计算
   - 回测报告生成

3. **Web界面**（可选，5天）
   - 创建前端项目（React/Vue）
   - 持仓展示
   - 策略配置
   - 交易记录查询
   - 回测结果可视化

4. **优化和完善**（2天）
   - 错误处理和重试
   - 日志记录
   - 性能优化

### Phase 3: 高级功能 - 按需开发

1. **多账户支持**
2. **更多策略类型**（网格交易、动态再平衡等）
3. **风险控制**（单日最大交易额、仓位限制）
4. **数据分析**（收益分析、归因分析）
5. **移动端App**

## 验证方案

### 开发环境测试

1. **数据获取测试**
   ```bash
   npm run test:data-service
   # 验证能否正确获取基金信息和净值
   ```

2. **交易平台测试**（使用测试账号）
   ```bash
   npm run test:broker-service
   # 验证登录、买入、卖出功能
   ```

3. **策略测试**
   ```bash
   npm run test:strategy
   # 使用历史数据验证策略逻辑
   ```

4. **回测测试**
   ```bash
   npm run backtest -- --fund=000001 --start=2023-01-01 --end=2024-01-01
   # 验证回测结果准确性
   ```

### 生产环境部署

1. **配置环境变量**
   ```bash
   cp .env.example .env
   # 填写数据库、Redis、API密钥等配置
   ```

2. **数据库迁移**
   ```bash
   npm run migration:run
   ```

3. **启动服务**
   ```bash
   npm run start:prod
   ```

4. **监控日志**
   ```bash
   tail -f logs/app.log
   # 观察定时任务执行情况
   ```

5. **小额测试**
   - 先用小额资金测试定投功能
   - 验证通知是否正常接收
   - 确认交易记录准确性

## 关键文件路径

```
src/
├── main.ts                                    # 应用入口
├── app.module.ts                              # 根模块
├── core/
│   ├── strategy/
│   │   ├── auto-invest.strategy.ts           # 定投策略
│   │   └── take-profit-stop-loss.strategy.ts # 止盈止损策略
│   └── backtest/
│       └── backtest.engine.ts                # 回测引擎
├── services/
│   ├── broker/
│   │   └── tiantian.service.ts               # 天天基金接入
│   ├── data/
│   │   └── fund-data.service.ts              # 基金数据服务
│   └── notify/
│       ├── notify.service.ts                 # 通知服务
│       ├── telegram.service.ts               # Telegram
│       └── feishu.service.ts                 # 飞书
├── scheduler/
│   └── scheduler.service.ts                  # 定时任务
├── models/
│   ├── user.entity.ts
│   ├── fund.entity.ts
│   ├── position.entity.ts
│   ├── transaction.entity.ts
│   └── strategy.entity.ts
└── utils/
    └── crypto.util.ts                        # 加密工具

config/
├── default.yml                               # 默认配置
└── production.yml                            # 生产配置

migrations/                                   # 数据库迁移文件
```

## 风险提示

1. **交易风险**：自动交易系统可能因bug导致错误交易，建议：
   - 先用小额资金测试
   - 设置单日最大交易额限制
   - 重要操作增加人工确认

2. **平台风控**：频繁登录或异常操作可能触发平台风控，建议：
   - 控制登录频率
   - 模拟真实用户行为
   - 准备备用账号

3. **数据安全**：账号密码等敏感信息需妥善保管，建议：
   - 使用强加密算法
   - 定期更换密码
   - 不要将配置文件提交到Git

4. **法律合规**：确保使用方式符合平台服务条款和相关法律法规
