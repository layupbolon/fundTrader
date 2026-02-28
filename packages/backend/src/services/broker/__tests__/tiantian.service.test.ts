jest.mock('puppeteer', () => {
  const mockPage = {
    goto: jest.fn().mockResolvedValue(undefined),
    type: jest.fn().mockResolvedValue(undefined),
    click: jest.fn().mockResolvedValue(undefined),
    waitForNavigation: jest.fn().mockResolvedValue(undefined),
    waitForSelector: jest.fn().mockResolvedValue(undefined),
    cookies: jest.fn().mockResolvedValue([{ name: 'session', value: 'abc' }]),
    $eval: jest.fn().mockResolvedValue('ORDER_123'),
  };

  const mockBrowser = {
    newPage: jest.fn().mockResolvedValue(mockPage),
    close: jest.fn().mockResolvedValue(undefined),
  };

  return {
    __esModule: true,
    default: {
      launch: jest.fn().mockResolvedValue(mockBrowser),
    },
    __mockBrowser: mockBrowser,
    __mockPage: mockPage,
  };
});

describe('TiantianBrokerService', () => {
  const originalEnv = process.env;
  let TiantianBrokerService: any;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      MASTER_KEY: 'test-master-key-that-is-at-least-32-chars-long',
      ENCRYPTION_SALT: 'test-salt-at-least-16-chars-long',
    };

    // Re-import after setting env
    const mod = require('../tiantian.service');
    TiantianBrokerService = mod.TiantianBrokerService;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should create instance with valid MASTER_KEY', () => {
      const service = new TiantianBrokerService();
      expect(service).toBeDefined();
    });

    it('should throw when MASTER_KEY is missing', () => {
      delete process.env.MASTER_KEY;
      jest.resetModules();
      const mod = require('../tiantian.service');
      expect(() => new mod.TiantianBrokerService()).toThrow(
        'MASTER_KEY environment variable is required for security',
      );
    });
  });

  describe('login', () => {
    it('should launch browser and log in', async () => {
      const service = new TiantianBrokerService();
      const session = await service.login('user', 'pass');

      const puppeteer = require('puppeteer').default;
      expect(puppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({ headless: true }),
      );
      expect(session).toHaveProperty('cookies');
      expect(session).toHaveProperty('expiresAt');
    });

    it('should fill username and password fields', async () => {
      const service = new TiantianBrokerService();
      await service.login('myuser', 'mypass');

      const { __mockPage } = require('puppeteer');
      expect(__mockPage.type).toHaveBeenCalledWith('#username', 'myuser');
      expect(__mockPage.type).toHaveBeenCalledWith('#password', 'mypass');
    });

    it('should throw on login failure', async () => {
      const { __mockPage } = require('puppeteer');
      __mockPage.waitForNavigation.mockRejectedValueOnce(new Error('timeout'));

      const service = new TiantianBrokerService();
      await expect(service.login('user', 'pass')).rejects.toThrow('登录失败');
    });
  });

  describe('buyFund', () => {
    it('should throw when session is invalid', async () => {
      const service = new TiantianBrokerService();
      await expect(service.buyFund('000001', 500)).rejects.toThrow('会话已过期');
    });

    it('should buy fund successfully with valid session', async () => {
      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      const order = await service.buyFund('000001', 500);

      expect(order).toHaveProperty('id');
      expect(order.fundCode).toBe('000001');
      expect(order.amount).toBe(500);
      expect(order.status).toBe('PENDING');
    });

    it('should navigate to buy page for the fund', async () => {
      const service = new TiantianBrokerService();
      await service.login('user', 'pass');
      await service.buyFund('110011', 1000);

      const { __mockPage } = require('puppeteer');
      expect(__mockPage.goto).toHaveBeenCalledWith(
        'https://trade.1234567.com.cn/buy/110011',
        expect.any(Object),
      );
    });

    it('should throw on buy failure', async () => {
      const { __mockPage } = require('puppeteer');

      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      __mockPage.waitForSelector.mockRejectedValueOnce(new Error('timeout'));
      await expect(service.buyFund('000001', 500)).rejects.toThrow('买入失败');
    });
  });

  describe('sellFund', () => {
    it('should throw when session is invalid', async () => {
      const service = new TiantianBrokerService();
      await expect(service.sellFund('000001', 100)).rejects.toThrow('会话已过期');
    });

    it('should sell fund successfully with valid session', async () => {
      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      const order = await service.sellFund('000001', 100);

      expect(order).toHaveProperty('id');
      expect(order.fundCode).toBe('000001');
      expect(order.status).toBe('PENDING');
    });

    it('should throw on sell failure', async () => {
      const { __mockPage } = require('puppeteer');

      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      __mockPage.waitForSelector.mockRejectedValueOnce(new Error('timeout'));
      await expect(service.sellFund('000001', 100)).rejects.toThrow('卖出失败');
    });
  });

  describe('getOrderStatus', () => {
    it('should throw when session is invalid', async () => {
      const service = new TiantianBrokerService();
      await expect(service.getOrderStatus('ORDER_1')).rejects.toThrow('会话已过期');
    });

    it('should parse CONFIRMED status', async () => {
      const { __mockPage } = require('puppeteer');
      __mockPage.$eval.mockResolvedValueOnce('ORDER_123').mockResolvedValueOnce('已确认');

      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      const status = await service.getOrderStatus('ORDER_123');
      expect(status.id).toBe('ORDER_123');
    });

    it('should throw on query failure', async () => {
      const { __mockPage } = require('puppeteer');

      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      __mockPage.goto.mockRejectedValueOnce(new Error('network error'));
      await expect(service.getOrderStatus('ORDER_1')).rejects.toThrow('查询订单状态失败');
    });
  });

  describe('keepAlive', () => {
    it('should visit homepage to keep session alive', async () => {
      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      const { __mockPage } = require('puppeteer');
      __mockPage.goto.mockClear();
      await service.keepAlive();

      expect(__mockPage.goto).toHaveBeenCalledWith(
        'https://trade.1234567.com.cn/',
        expect.any(Object),
      );
    });

    it('should skip when session is invalid', async () => {
      const service = new TiantianBrokerService();
      // No login, so no session
      await service.keepAlive(); // Should not throw
    });

    it('should handle errors gracefully', async () => {
      const { __mockPage } = require('puppeteer');

      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      __mockPage.goto.mockRejectedValueOnce(new Error('network'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await service.keepAlive(); // Should not throw

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('close', () => {
    it('should close browser and clear session', async () => {
      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      const { __mockBrowser } = require('puppeteer');
      await service.close();

      expect(__mockBrowser.close).toHaveBeenCalled();
    });

    it('should do nothing when browser is null', async () => {
      const service = new TiantianBrokerService();
      await service.close(); // Should not throw
    });
  });

  describe('session validity', () => {
    it('should reject operations after session expires', async () => {
      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      // Manually expire the session by reaching into private field
      (service as any).session.expiresAt = new Date(Date.now() - 1000);

      await expect(service.buyFund('000001', 500)).rejects.toThrow('会话已过期');
    });
  });
});
