import { Injectable } from '@nestjs/common';
import puppeteer, { Browser, Page } from 'puppeteer';
import { CryptoUtil } from '../../utils';

interface Session {
  cookies: any[];
  expiresAt: Date;
}

interface Order {
  id: string;
  fundCode: string;
  amount: number;
  status: string;
}

interface OrderStatus {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  shares?: number;
  price?: number;
}

@Injectable()
export class TiantianBrokerService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private session: Session | null = null;
  private cryptoUtil: CryptoUtil;

  constructor() {
    const masterKey = process.env.MASTER_KEY;
    if (!masterKey) {
      throw new Error('MASTER_KEY environment variable is required for security');
    }
    this.cryptoUtil = new CryptoUtil(masterKey);
  }

  async login(username: string, password: string): Promise<Session> {
    try {
      // 启动浏览器
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--disable-dev-shm-usage', '--disable-gpu'],
      });

      this.page = await this.browser.newPage();

      // 访问登录页面
      await this.page.goto('https://trade.1234567.com.cn/login', {
        waitUntil: 'networkidle2',
      });

      // 填写登录表单
      await this.page.type('#username', username);
      await this.page.type('#password', password);

      // 点击登录按钮
      await this.page.click('#loginBtn');

      // 等待登录完成
      await this.page.waitForNavigation({ waitUntil: 'networkidle2' });

      // 获取cookies
      const cookies = await this.page.cookies();

      this.session = {
        cookies,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30分钟后过期
      };

      return this.session;
    } catch (error) {
      console.error('Login failed:', error);
      throw new Error('登录失败');
    }
  }

  async buyFund(fundCode: string, amount: number): Promise<Order> {
    if (!this.isSessionValid()) {
      throw new Error('会话已过期，请重新登录');
    }

    try {
      // 访问买入页面
      await this.page.goto(`https://trade.1234567.com.cn/buy/${fundCode}`, {
        waitUntil: 'networkidle2',
      });

      // 填写买入金额
      await this.page.type('#amount', amount.toString());

      // 点击买入按钮
      await this.page.click('#buyBtn');

      // 等待订单确认
      await this.page.waitForSelector('.order-success', { timeout: 10000 });

      // 获取订单号
      const orderId = await this.page.$eval('.order-id', (el) => el.textContent);

      return {
        id: orderId || `ORDER_${Date.now()}`,
        fundCode,
        amount,
        status: 'PENDING',
      };
    } catch (error) {
      console.error('Buy fund failed:', error);
      throw new Error('买入失败');
    }
  }

  async sellFund(fundCode: string, shares: number): Promise<Order> {
    if (!this.isSessionValid()) {
      throw new Error('会话已过期，请重新登录');
    }

    try {
      // 访问卖出页面
      await this.page.goto(`https://trade.1234567.com.cn/sell/${fundCode}`, {
        waitUntil: 'networkidle2',
      });

      // 填写卖出份额
      await this.page.type('#shares', shares.toString());

      // 点击卖出按钮
      await this.page.click('#sellBtn');

      // 等待订单确认
      await this.page.waitForSelector('.order-success', { timeout: 10000 });

      // 获取订单号
      const orderId = await this.page.$eval('.order-id', (el) => el.textContent);

      return {
        id: orderId || `ORDER_${Date.now()}`,
        fundCode,
        amount: shares,
        status: 'PENDING',
      };
    } catch (error) {
      console.error('Sell fund failed:', error);
      throw new Error('卖出失败');
    }
  }

  async getOrderStatus(orderId: string): Promise<OrderStatus> {
    if (!this.isSessionValid()) {
      throw new Error('会话已过期，请重新登录');
    }

    try {
      // 访问订单详情页面
      await this.page.goto(`https://trade.1234567.com.cn/order/${orderId}`, {
        waitUntil: 'networkidle2',
      });

      // 获取订单状态
      const status = await this.page.$eval('.order-status', (el) => el.textContent);

      return {
        id: orderId,
        status: this.parseOrderStatus(status),
      };
    } catch (error) {
      console.error('Get order status failed:', error);
      throw new Error('查询订单状态失败');
    }
  }

  async keepAlive(): Promise<void> {
    if (!this.isSessionValid()) {
      return;
    }

    try {
      // 访问首页保持会话活跃
      await this.page.goto('https://trade.1234567.com.cn/', {
        waitUntil: 'networkidle2',
      });

      // 更新会话过期时间
      this.session.expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    } catch (error) {
      console.error('Keep alive failed:', error);
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.session = null;
    }
  }

  private isSessionValid(): boolean {
    if (!this.session) {
      return false;
    }

    return new Date() < this.session.expiresAt;
  }

  private parseOrderStatus(status: string): 'PENDING' | 'CONFIRMED' | 'FAILED' {
    if (status.includes('已确认') || status.includes('成功')) {
      return 'CONFIRMED';
    }
    if (status.includes('失败') || status.includes('取消')) {
      return 'FAILED';
    }
    return 'PENDING';
  }
}
