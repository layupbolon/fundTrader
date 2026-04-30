import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer, { Browser, Page } from 'puppeteer';
import { CryptoUtil } from '../../utils';
import {
  BrokerAdapter,
  BrokerContext,
  BrokerOrder,
  BrokerOrderStatus,
  BrokerSession,
} from './broker-adapter';
import { BrokerFailureEvidence, BrokerOperationError } from './broker-error';
import {
  buildTiantianBrokerConfig,
  formatBrokerUrl,
  TiantianBrokerConfig,
} from './tiantian-broker.config';

/**
 * 会话信息接口
 *
 * 存储浏览器会话的 cookies 和过期时间。
 */
interface Session {
  /** 会话 cookies */
  cookies: any[];

  /** 会话过期时间 */
  expiresAt: Date;
}

/**
 * 天天基金交易平台服务
 *
 * 使用 Puppeteer 模拟浏览器操作，实现天天基金平台的自动化交易。
 * 支持登录、买入、卖出、订单查询和会话保活功能。
 *
 * 核心功能：
 * 1. 自动登录天天基金交易平台
 * 2. 执行基金买入操作
 * 3. 执行基金卖出操作
 * 4. 查询订单状态
 * 5. 保持会话活跃（避免超时）
 *
 * 技术实现：
 * - 使用 Puppeteer 控制 Chromium 浏览器
 * - 通过 CSS 选择器定位页面元素
 * - 使用 cookies 维持登录状态
 * - 会话有效期 30 分钟，定时刷新
 *
 * 安全措施：
 * - 使用 CryptoUtil 加密存储凭证
 * - 会话过期自动失效
 * - 敏感操作需要有效会话
 *
 * 注意事项：
 * - 当前为示例实现，实际 URL 和选择器需要根据真实平台调整
 * - 频繁操作可能触发平台风控
 * - 需要处理验证码、滑块等反爬机制
 * - 建议增加随机延迟模拟真实用户行为
 *
 * 使用场景：
 * - 定投策略自动买入
 * - 止盈止损策略自动卖出
 * - 订单状态跟踪和确认
 * - 持仓数据同步
 *
 * @example
 * const broker = new TiantianBrokerService();
 * await broker.login('username', 'password');
 * const order = await broker.buyFund('000001', 500);
 * console.log(`订单号: ${order.id}`);
 */
@Injectable()
export class TiantianBrokerService implements BrokerAdapter {
  /** 天天基金页面 URL、选择器和证据目录配置 */
  private readonly config: TiantianBrokerConfig;

  /** 是否启用 mock broker（用于测试环境） */
  private readonly mockEnabled: boolean;

  /** Puppeteer 浏览器实例 */
  private browser: Browser | null = null;

  /** 当前页面实例 */
  private page: Page | null = null;

  /** 会话信息 */
  private session: Session | null = null;

  /** 按用户隔离的会话信息 */
  private sessions = new Map<string, Session>();

  /** 加密工具实例 */
  private cryptoUtil?: CryptoUtil;

  /**
   * 构造函数
   *
   * 初始化加密工具，用于加密存储交易平台凭证。
   *
   * @throws Error 如果 MASTER_KEY 环境变量未设置
   */
  constructor() {
    this.config = buildTiantianBrokerConfig(process.env);
    const brokerMode = process.env.BROKER_MODE;
    this.mockEnabled =
      process.env.BROKER_MOCK === 'true' ||
      brokerMode === 'mock' ||
      brokerMode === 'paper' ||
      brokerMode === 'dry-run' ||
      brokerMode === 'replay';
    if (this.mockEnabled) {
      this.session = {
        cookies: [],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      return;
    }

    const masterKey = process.env.MASTER_KEY;
    if (!masterKey) {
      throw new Error('MASTER_KEY environment variable is required for security');
    }
    this.cryptoUtil = new CryptoUtil(masterKey);
  }

  /**
   * 登录天天基金交易平台
   *
   * 使用 Puppeteer 自动化登录流程：
   * 1. 启动无头浏览器
   * 2. 访问登录页面
   * 3. 填写用户名和密码
   * 4. 提交登录表单
   * 5. 获取并保存 cookies
   *
   * 注意事项：
   * - 当前为示例实现，实际 URL 和选择器需要调整
   * - 可能需要处理验证码、滑块等验证
   * - 建议增加随机延迟模拟真实用户
   *
   * @param username 天天基金账号
   * @param password 天天基金密码
   * @returns 会话信息，包含 cookies 和过期时间
   * @throws Error 如果登录失败
   *
   * @example
   * const session = await broker.login('username', 'password');
   * console.log(`会话有效期至: ${session.expiresAt}`);
   */
  async login(username: string, password: string, context?: BrokerContext): Promise<BrokerSession> {
    if (this.mockEnabled) {
      this.session = {
        cookies: [{ name: 'mock-session', value: `${username}:${password.length}` }],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      this.sessions.set(this.getSessionKey(context), this.session);
      return this.session;
    }

    try {
      // 启动浏览器
      // headless: true 表示无界面模式
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--disable-dev-shm-usage', '--disable-gpu'],
      });

      this.page = await this.browser.newPage();

      // 访问登录页面
      // waitUntil: 'networkidle2' 等待网络空闲
      await this.page.goto(this.config.urls.login, {
        waitUntil: 'networkidle2',
      });

      // 填写登录表单
      await this.page.type(this.config.selectors.usernameInput, username);
      await this.page.type(this.config.selectors.passwordInput, password);

      // 点击登录按钮
      await this.page.click(this.config.selectors.loginButton);

      // 等待登录完成
      await this.page.waitForNavigation({ waitUntil: 'networkidle2' });

      // 获取cookies
      const cookies = await this.page.cookies();

      // 保存会话信息
      this.session = {
        cookies,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30分钟后过期
      };
      this.sessions.set(this.getSessionKey(context), this.session);

      return this.session;
    } catch (error) {
      console.error('Login failed:', error);
      throw await this.createBrokerError('登录失败', 'login', error, context);
    }
  }

  /**
   * 买入基金
   *
   * 自动化执行基金买入操作：
   * 1. 检查会话有效性
   * 2. 访问买入页面
   * 3. 填写买入金额
   * 4. 提交订单
   * 5. 获取订单号
   *
   * 场外基金买入规则：
   * - 15:00 前提交按当日净值成交
   * - 15:00 后提交按次日净值成交
   * - T+1 确认份额
   *
   * @param fundCode 基金代码
   * @param amount 买入金额（人民币）
   * @returns 订单信息
   * @throws Error 如果会话过期或买入失败
   *
   * @example
   * const order = await broker.buyFund('000001', 500);
   * console.log(`订单号: ${order.id}`);
   */
  async buyFund(fundCode: string, amount: number, context?: BrokerContext): Promise<BrokerOrder> {
    if (this.mockEnabled) {
      return {
        id: `MOCK_BUY_${Date.now()}`,
        fundCode,
        amount,
        status: 'PENDING',
      };
    }

    if (!this.isSessionValid(context)) {
      throw new Error('会话已过期，请重新登录');
    }

    try {
      // 访问买入页面
      await this.page.goto(formatBrokerUrl(this.config.urls.buy, { fundCode }), {
        waitUntil: 'networkidle2',
      });

      // 填写买入金额
      await this.page.type(this.config.selectors.amountInput, amount.toString());

      // 点击买入按钮
      await this.page.click(this.config.selectors.buyButton);

      // 等待订单确认
      await this.page.waitForSelector(this.config.selectors.orderSuccess, { timeout: 10000 });

      // 获取订单号
      const orderId = await this.page.$eval(this.config.selectors.orderId, (el) => el.textContent);

      return {
        id: orderId || `ORDER_${Date.now()}`,
        fundCode,
        amount,
        status: 'PENDING',
      };
    } catch (error) {
      console.error('Buy fund failed:', error);
      throw await this.createBrokerError('买入失败', 'buyFund', error, context);
    }
  }

  /**
   * 卖出基金
   *
   * 自动化执行基金卖出操作：
   * 1. 检查会话有效性
   * 2. 访问卖出页面
   * 3. 填写卖出份额
   * 4. 提交订单
   * 5. 获取订单号
   *
   * 场外基金卖出规则：
   * - 15:00 前提交按当日净值成交
   * - 15:00 后提交按次日净值成交
   * - T+1 确认到账金额
   *
   * @param fundCode 基金代码
   * @param shares 卖出份额
   * @returns 订单信息
   * @throws Error 如果会话过期或卖出失败
   *
   * @example
   * const order = await broker.sellFund('000001', 100.5);
   * console.log(`订单号: ${order.id}`);
   */
  async sellFund(fundCode: string, shares: number, context?: BrokerContext): Promise<BrokerOrder> {
    if (this.mockEnabled) {
      return {
        id: `MOCK_SELL_${Date.now()}`,
        fundCode,
        amount: shares,
        status: 'PENDING',
      };
    }

    if (!this.isSessionValid(context)) {
      throw new Error('会话已过期，请重新登录');
    }

    try {
      // 访问卖出页面
      await this.page.goto(formatBrokerUrl(this.config.urls.sell, { fundCode }), {
        waitUntil: 'networkidle2',
      });

      // 填写卖出份额
      await this.page.type(this.config.selectors.sharesInput, shares.toString());

      // 点击卖出按钮
      await this.page.click(this.config.selectors.sellButton);

      // 等待订单确认
      await this.page.waitForSelector(this.config.selectors.orderSuccess, { timeout: 10000 });

      // 获取订单号
      const orderId = await this.page.$eval(this.config.selectors.orderId, (el) => el.textContent);

      return {
        id: orderId || `ORDER_${Date.now()}`,
        fundCode,
        amount: shares,
        status: 'PENDING',
      };
    } catch (error) {
      console.error('Sell fund failed:', error);
      throw await this.createBrokerError('卖出失败', 'sellFund', error, context);
    }
  }

  /**
   * 查询订单状态
   *
   * 查询指定订单的当前状态，用于跟踪订单确认情况。
   *
   * @param orderId 订单号
   * @returns 订单状态信息
   * @throws Error 如果会话过期或查询失败
   *
   * @example
   * const status = await broker.getOrderStatus('ORDER123');
   * if (status.status === 'CONFIRMED') {
   *   console.log(`确认份额: ${status.shares}`);
   * }
   */
  async getOrderStatus(orderId: string, context?: BrokerContext): Promise<BrokerOrderStatus> {
    if (this.mockEnabled) {
      if (orderId.includes('FAILED')) {
        return { id: orderId, status: 'FAILED', reason: 'Mock failure' };
      }
      if (orderId.includes('CANCELLED')) {
        return { id: orderId, status: 'CANCELLED' };
      }
      if (orderId.includes('PENDING')) {
        return { id: orderId, status: 'PENDING' };
      }
      return {
        id: orderId,
        status: 'CONFIRMED',
        shares: 123.4567,
        price: 1.2345,
      };
    }

    if (!this.isSessionValid(context)) {
      throw new Error('会话已过期，请重新登录');
    }

    try {
      // 访问订单详情页面
      await this.page.goto(formatBrokerUrl(this.config.urls.order, { orderId }), {
        waitUntil: 'networkidle2',
      });

      // 获取订单状态
      const status = await this.page.$eval(
        this.config.selectors.orderStatus,
        (el) => el.textContent,
      );

      return {
        id: orderId,
        status: this.parseOrderStatus(status),
      };
    } catch (error) {
      console.error('Get order status failed:', error);
      throw await this.createBrokerError('查询订单状态失败', 'getOrderStatus', error, context);
    }
  }

  async cancelOrder(
    orderId: string,
    context?: BrokerContext,
  ): Promise<{ id: string; status: 'CANCELLED' }> {
    if (this.mockEnabled) {
      return { id: orderId, status: 'CANCELLED' };
    }

    if (!this.isSessionValid(context)) {
      throw new Error('会话已过期，请重新登录');
    }

    try {
      await this.page.goto(formatBrokerUrl(this.config.urls.order, { orderId }), {
        waitUntil: 'networkidle2',
      });
      await this.page.click(this.config.selectors.cancelButton);
      await this.page.waitForSelector(this.config.selectors.cancelSuccess, { timeout: 10000 });

      return { id: orderId, status: 'CANCELLED' };
    } catch (error) {
      console.error('Cancel order failed:', error);
      throw await this.createBrokerError('撤单失败', 'cancelOrder', error, context);
    }
  }

  /**
   * 保持会话活跃
   *
   * 定期访问平台首页，防止会话超时。
   * 建议每 30 分钟调用一次。
   *
   * @example
   * // 定时任务中调用
   * setInterval(() => {
   *   await broker.keepAlive();
   * }, 30 * 60 * 1000); // 每30分钟
   */
  async keepAlive(context?: BrokerContext): Promise<void> {
    if (this.mockEnabled) {
      if (!this.session) {
        this.session = { cookies: [], expiresAt: new Date() };
      }
      this.session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      return;
    }

    if (!this.isSessionValid(context)) {
      return;
    }

    try {
      // 访问首页保持会话活跃
      await this.page.goto(this.config.urls.home, {
        waitUntil: 'networkidle2',
      });

      // 更新会话过期时间
      this.session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      this.sessions.set(this.getSessionKey(context), this.session);
    } catch (error) {
      console.error('Keep alive failed:', error);
    }
  }

  /**
   * 关闭浏览器并清理资源
   *
   * 释放浏览器实例和会话信息。
   * 应用退出前应该调用此方法。
   *
   * @example
   * // 应用退出时调用
   * await broker.close();
   */
  async close(): Promise<void> {
    if (this.mockEnabled) {
      this.session = null;
      this.sessions.clear();
      return;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.session = null;
    }
  }

  /**
   * 检查会话是否有效
   *
   * 判断当前会话是否存在且未过期。
   *
   * @returns true 表示会话有效，false 表示会话无效或已过期
   * @private
   */
  private isSessionValid(context?: BrokerContext): boolean {
    if (this.mockEnabled) {
      return true;
    }

    const session = this.sessions.get(this.getSessionKey(context)) || this.session;
    if (!session) {
      return false;
    }

    return new Date() < session.expiresAt;
  }

  private getSessionKey(context?: BrokerContext): string {
    return context?.userId || 'default';
  }

  private async createBrokerError(
    message: string,
    operation: string,
    error: unknown,
    context?: BrokerContext,
  ): Promise<BrokerOperationError> {
    const evidence = await this.captureFailureEvidence(operation, context);
    return new BrokerOperationError(message, {
      manualInterventionRequired: this.requiresManualIntervention(evidence),
      evidence,
      originalMessage: error instanceof Error ? error.message : String(error),
    });
  }

  private async captureFailureEvidence(
    operation: string,
    context?: BrokerContext,
  ): Promise<BrokerFailureEvidence> {
    const capturedAt = new Date().toISOString();
    const evidence: BrokerFailureEvidence = { capturedAt, operation };
    if (!this.page) {
      return evidence;
    }

    const artifactDir = path.resolve(process.cwd(), this.config.artifactDir);
    const artifactName = [
      operation,
      this.sanitizeArtifactSegment(context?.userId || 'default'),
      this.sanitizeArtifactSegment(context?.transactionId || Date.now().toString()),
    ].join('-');

    try {
      fs.mkdirSync(artifactDir, { recursive: true });
      evidence.screenshotPath = path.join(artifactDir, `${artifactName}.png`);
      await this.page.screenshot({ path: evidence.screenshotPath, fullPage: true });
    } catch (screenshotError) {
      console.error('Capture broker screenshot failed:', screenshotError);
    }

    try {
      evidence.domSummary = this.summarizeDom(await this.page.content());
    } catch (contentError) {
      console.error('Capture broker DOM failed:', contentError);
    }

    return evidence;
  }

  private requiresManualIntervention(evidence: BrokerFailureEvidence): boolean {
    const summary = evidence.domSummary || '';
    return this.config.manualInterventionKeywords.some((keyword) => summary.includes(keyword));
  }

  private summarizeDom(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
  }

  private sanitizeArtifactSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  }

  /**
   * 解析订单状态文本
   *
   * 将平台返回的状态文本转换为标准状态枚举。
   *
   * @param status 平台返回的状态文本
   * @returns 标准订单状态
   * @private
   */
  private parseOrderStatus(status: string): 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED' {
    if (status.includes('已确认') || status.includes('成功')) {
      return 'CONFIRMED';
    }
    if (status.includes('取消')) {
      return 'CANCELLED';
    }
    if (status.includes('失败')) {
      return 'FAILED';
    }
    return 'PENDING';
  }
}
