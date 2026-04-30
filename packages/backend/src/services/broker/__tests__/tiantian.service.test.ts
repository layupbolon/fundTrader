const puppeteerMocks = vi.hoisted(() => {
  const mockPage = {
    goto: vi.fn().mockResolvedValue(undefined),
    type: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    waitForNavigation: vi.fn().mockResolvedValue(undefined),
    waitForSelector: vi.fn().mockResolvedValue(undefined),
    cookies: vi.fn().mockResolvedValue([{ name: 'session', value: 'abc' }]),
    screenshot: vi.fn().mockResolvedValue(undefined),
    content: vi.fn().mockResolvedValue('<html><body>交易成功</body></html>'),
    $eval: vi.fn().mockResolvedValue('ORDER_123'),
  };

  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockLaunch = vi.fn().mockResolvedValue(mockBrowser);

  return {
    mockBrowser,
    mockLaunch,
    mockPage,
  };
});

vi.mock('puppeteer', () => {
  return {
    __esModule: true,
    default: {
      launch: puppeteerMocks.mockLaunch,
    },
    __mockBrowser: puppeteerMocks.mockBrowser,
    __mockPage: puppeteerMocks.mockPage,
  };
});

const getPuppeteerMock = () => ({
  default: {
    launch: puppeteerMocks.mockLaunch,
  },
  __mockBrowser: puppeteerMocks.mockBrowser,
  __mockPage: puppeteerMocks.mockPage,
});

describe('TiantianBrokerService', () => {
  const originalEnv = process.env;
  let TiantianBrokerService: any;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      MASTER_KEY: 'test-master-key-that-is-at-least-32-chars-long',
      ENCRYPTION_SALT: 'test-salt-at-least-16-chars-long',
    };

    // Re-import after setting env
    const mod = await import('../tiantian.service');
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

    it('should throw when MASTER_KEY is missing', async () => {
      delete process.env.MASTER_KEY;
      vi.resetModules();
      const mod = await import('../tiantian.service');
      expect(() => new mod.TiantianBrokerService()).toThrow(
        'MASTER_KEY environment variable is required for security',
      );
    });
  });

  describe('login', () => {
    it('should launch browser and log in', async () => {
      const service = new TiantianBrokerService();
      const session = await service.login('user', 'pass');

      const mock = getPuppeteerMock();
      expect(mock.default.launch).toHaveBeenCalledWith(expect.objectContaining({ headless: true }));
      expect(session).toHaveProperty('cookies');
      expect(session).toHaveProperty('expiresAt');
    });

    it('should fill username and password fields', async () => {
      const service = new TiantianBrokerService();
      await service.login('myuser', 'mypass');

      const mock = getPuppeteerMock();
      expect(mock.__mockPage.type).toHaveBeenCalledWith('#username', 'myuser');
      expect(mock.__mockPage.type).toHaveBeenCalledWith('#password', 'mypass');
    });

    it('should use configured login URL and selectors', async () => {
      process.env.TIANTIAN_LOGIN_URL = 'https://trade.example.com/custom-login';
      process.env.TIANTIAN_SELECTOR_USERNAME = 'input[data-testid="username"]';
      process.env.TIANTIAN_SELECTOR_PASSWORD = 'input[data-testid="password"]';
      process.env.TIANTIAN_SELECTOR_LOGIN_BUTTON = 'button[data-testid="submit"]';

      const service = new TiantianBrokerService();
      await service.login('myuser', 'mypass');

      const mock = getPuppeteerMock();
      expect(mock.__mockPage.goto).toHaveBeenCalledWith('https://trade.example.com/custom-login', {
        waitUntil: 'networkidle2',
      });
      expect(mock.__mockPage.type).toHaveBeenCalledWith('input[data-testid="username"]', 'myuser');
      expect(mock.__mockPage.type).toHaveBeenCalledWith('input[data-testid="password"]', 'mypass');
      expect(mock.__mockPage.click).toHaveBeenCalledWith('button[data-testid="submit"]');
    });

    it('should throw on login failure', async () => {
      getPuppeteerMock().__mockPage.waitForNavigation.mockRejectedValueOnce(new Error('timeout'));

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

      expect(getPuppeteerMock().__mockPage.goto).toHaveBeenCalledWith(
        'https://trade.1234567.com.cn/buy/110011',
        expect.any(Object),
      );
    });

    it('should throw on buy failure', async () => {
      getPuppeteerMock().__mockPage.waitForSelector.mockRejectedValueOnce(new Error('timeout'));

      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      await expect(service.buyFund('000001', 500)).rejects.toThrow('买入失败');
    });

    it('should attach screenshot and DOM summary when manual intervention is required', async () => {
      getPuppeteerMock().__mockPage.waitForSelector.mockRejectedValueOnce(new Error('timeout'));
      getPuppeteerMock().__mockPage.content.mockResolvedValueOnce(
        '<html><body>请输入验证码后继续交易</body></html>',
      );

      const service = new TiantianBrokerService();
      await service.login('user', 'pass', { userId: 'user1' });

      let capturedError: any;
      try {
        await service.buyFund('000001', 500, { userId: 'user1', transactionId: 'tx1' });
      } catch (error) {
        capturedError = error;
      }

      expect(capturedError.message).toBe('买入失败');
      expect(capturedError.manualInterventionRequired).toBe(true);
      expect(capturedError.evidence.screenshotPath).toContain('tx1');
      expect(capturedError.evidence.domSummary).toContain('请输入验证码');
      expect(getPuppeteerMock().__mockPage.screenshot).toHaveBeenCalledWith(
        expect.objectContaining({ fullPage: true, path: expect.stringContaining('tx1') }),
      );
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
      getPuppeteerMock().__mockPage.waitForSelector.mockRejectedValueOnce(new Error('timeout'));

      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      await expect(service.sellFund('000001', 100)).rejects.toThrow('卖出失败');
    });
  });

  describe('getOrderStatus', () => {
    it('should throw when session is invalid', async () => {
      const service = new TiantianBrokerService();
      await expect(service.getOrderStatus('ORDER_1')).rejects.toThrow('会话已过期');
    });

    it('should parse CONFIRMED status', async () => {
      getPuppeteerMock()
        .__mockPage.$eval.mockResolvedValueOnce('ORDER_123')
        .mockResolvedValueOnce('已确认');

      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      const status = await service.getOrderStatus('ORDER_123');
      expect(status.id).toBe('ORDER_123');
    });

    it('should throw on query failure', async () => {
      const service = new TiantianBrokerService();
      await service.login('user', 'pass');
      getPuppeteerMock().__mockPage.goto.mockRejectedValueOnce(new Error('network error'));

      await expect(service.getOrderStatus('ORDER_1')).rejects.toThrow('查询订单状态失败');
    });
  });

  describe('cancelOrder', () => {
    it('should throw when session is invalid', async () => {
      const service = new TiantianBrokerService();
      await expect(service.cancelOrder('ORDER_1')).rejects.toThrow('会话已过期');
    });

    it('should cancel order successfully', async () => {
      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      const result = await service.cancelOrder('ORDER_1');
      expect(result).toEqual({ id: 'ORDER_1', status: 'CANCELLED' });
    });

    it('should throw on cancel failure', async () => {
      getPuppeteerMock().__mockPage.waitForSelector.mockRejectedValueOnce(new Error('timeout'));

      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      await expect(service.cancelOrder('ORDER_1')).rejects.toThrow('撤单失败');
    });
  });

  describe('keepAlive', () => {
    it('should visit homepage to keep session alive', async () => {
      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      getPuppeteerMock().__mockPage.goto.mockClear();
      await service.keepAlive();

      expect(getPuppeteerMock().__mockPage.goto).toHaveBeenCalledWith(
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
      const service = new TiantianBrokerService();
      await service.login('user', 'pass');
      getPuppeteerMock().__mockPage.goto.mockRejectedValueOnce(new Error('network'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await service.keepAlive(); // Should not throw

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('close', () => {
    it('should close browser and clear session', async () => {
      const service = new TiantianBrokerService();
      await service.login('user', 'pass');

      await service.close();

      expect(getPuppeteerMock().__mockBrowser.close).toHaveBeenCalled();
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
