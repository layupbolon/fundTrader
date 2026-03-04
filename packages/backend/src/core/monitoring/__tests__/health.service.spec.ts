import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { HealthService, HealthStatusResponse } from '../health.service';
import { TiantianBrokerService } from '../../../services/broker/tiantian.service';
import { NotifyService } from '../../../services/notify/notify.service';

/**
 * HealthService 单元测试
 *
 * 测试覆盖：
 * - 数据库健康检查
 * - Redis 健康检查
 * - 浏览器会话健康检查
 * - 整体健康检查
 * - 告警通知发送
 */
describe('HealthService', () => {
  let service: HealthService;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockConfigService: jest.Mocked<ConfigService>;
  let mockBrokerService: jest.Mocked<TiantianBrokerService>;
  let mockNotifyService: jest.Mocked<NotifyService>;

  // Mock Redis class
  class MockRedis {
    static pingMock = jest.fn();

    ping() {
      return MockRedis.pingMock();
    }
  }

  beforeEach(async () => {
    // 创建 mock 对象
    mockDataSource = {
      query: jest.fn(),
    } as any;

    mockConfigService = {
      get: jest.fn(),
    } as any;

    mockBrokerService = {} as any;

    mockNotifyService = {
      send: jest.fn(),
    } as any;

    // Reset Redis mock
    MockRedis.pingMock.mockReset();
    MockRedis.pingMock.mockResolvedValue('PONG');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: TiantianBrokerService,
          useValue: mockBrokerService,
        },
        {
          provide: NotifyService,
          useValue: mockNotifyService,
        },
      ],
    })
      .overrideProvider(DataSource)
      .useValue(mockDataSource)
      .compile();

    service = module.get<HealthService>(HealthService);

    // Override Redis instantiation in service
    (service as any).redis = new MockRedis() as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkDatabase', () => {
    it('should return up status when database connection is healthy', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValueOnce([{ '?column?': 1 }]);

      // Act
      const result = await service.checkDatabase();

      // Assert
      expect(result).toEqual({
        name: 'database',
        status: 'up',
        message: 'Database connection healthy',
        responseTime: expect.any(Number),
      });
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should return down status when database connection fails', async () => {
      // Arrange
      mockDataSource.query.mockRejectedValueOnce(new Error('Connection refused'));

      // Act
      const result = await service.checkDatabase();

      // Assert
      expect(result).toEqual({
        name: 'database',
        status: 'down',
        message: expect.stringContaining('Connection refused'),
        responseTime: expect.any(Number),
      });
    });
  });

  describe('checkRedis', () => {
    it('should return up status when Redis connection is healthy', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue('localhost');
      MockRedis.pingMock.mockResolvedValueOnce('PONG');

      // Act
      const result = await service.checkRedis();

      // Assert
      expect(result).toEqual({
        name: 'redis',
        status: 'up',
        message: 'Redis connection healthy',
        responseTime: expect.any(Number),
      });
    });

    it('should return down status when Redis connection fails', async () => {
      // Arrange
      mockConfigService.get.mockReturnValue('localhost');
      MockRedis.pingMock.mockRejectedValueOnce(new Error('Connection refused'));

      // Act
      const result = await service.checkRedis();

      // Assert
      expect(result).toEqual({
        name: 'redis',
        status: 'down',
        message: expect.stringContaining('Connection refused'),
        responseTime: expect.any(Number),
      });
    });
  });

  describe('checkBrowserSession', () => {
    it('should return up status when browser session is valid', async () => {
      // Arrange
      (mockBrokerService as any).session = {
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 分钟后过期
      };

      // Act
      const result = await service.checkBrowserSession();

      // Assert
      expect(result).toEqual({
        name: 'browser',
        status: 'up',
        message: 'Browser session is active and valid',
        responseTime: expect.any(Number),
      });
    });

    it('should return degraded status when browser session is expired', async () => {
      // Arrange
      (mockBrokerService as any).session = {
        expiresAt: new Date(Date.now() - 60 * 1000), // 1 分钟前过期
      };

      // Act
      const result = await service.checkBrowserSession();

      // Assert
      expect(result).toEqual({
        name: 'browser',
        status: 'degraded',
        message: 'Browser session is invalid or expired, re-login may be required',
        responseTime: expect.any(Number),
      });
    });

    it('should return degraded status when no browser session exists', async () => {
      // Arrange
      (mockBrokerService as any).session = null;

      // Act
      const result = await service.checkBrowserSession();

      // Assert
      expect(result).toEqual({
        name: 'browser',
        status: 'degraded',
        message: 'Browser session is invalid or expired, re-login may be required',
        responseTime: expect.any(Number),
      });
    });
  });

  describe('checkHealth', () => {
    it('should return overall up status when all components are healthy', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValueOnce([{ '?column?': 1 }]);
      mockConfigService.get.mockReturnValue('localhost');
      MockRedis.pingMock.mockResolvedValueOnce('PONG');
      (mockBrokerService as any).session = {
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };

      // Act
      const result = await service.checkHealth();

      // Assert
      expect(result.status).toBe('up');
      expect(result.components.database.status).toBe('up');
      expect(result.components.redis.status).toBe('up');
      expect(result.components.browser.status).toBe('up');
      expect(result.timestamp).toBeDefined();
    });

    it('should return overall degraded status when browser session is degraded', async () => {
      // Arrange
      mockDataSource.query.mockResolvedValueOnce([{ '?column?': 1 }]);
      mockConfigService.get.mockReturnValue('localhost');
      MockRedis.pingMock.mockResolvedValueOnce('PONG');
      (mockBrokerService as any).session = null; // 浏览器会话无效

      // Act
      const result = await service.checkHealth();

      // Assert
      expect(result.status).toBe('degraded');
      expect(result.components.browser.status).toBe('degraded');
    });

    it('should return overall down status when database is down', async () => {
      // Arrange
      mockDataSource.query.mockRejectedValueOnce(new Error('Connection refused'));
      mockConfigService.get.mockReturnValue('localhost');
      MockRedis.pingMock.mockResolvedValueOnce('PONG');
      (mockBrokerService as any).session = {
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      };

      // Act
      const result = await service.checkHealth();

      // Assert
      expect(result.status).toBe('down');
      expect(result.components.database.status).toBe('down');
    });
  });

  describe('sendAlert', () => {
    it('should send alert when components are unhealthy', async () => {
      // Arrange
      const health: HealthStatusResponse = {
        status: 'degraded',
        components: {
          database: { name: 'database', status: 'up', message: 'OK' },
          redis: { name: 'redis', status: 'down', message: 'Redis connection failed' },
          browser: { name: 'browser', status: 'degraded', message: 'Session expired' },
        },
        timestamp: new Date().toISOString(),
      };

      // Act
      await service.sendAlert(health);

      // Assert
      expect(mockNotifyService.send).toHaveBeenCalledWith({
        title: '系统健康告警',
        content: expect.stringContaining('Redis connection failed'),
        level: 'error',
      });
    });

    it('should not send alert when all components are healthy', async () => {
      // Arrange
      const health: HealthStatusResponse = {
        status: 'up',
        components: {
          database: { name: 'database', status: 'up', message: 'OK' },
          redis: { name: 'redis', status: 'up', message: 'OK' },
          browser: { name: 'browser', status: 'up', message: 'OK' },
        },
        timestamp: new Date().toISOString(),
      };

      // Act
      await service.sendAlert(health);

      // Assert
      expect(mockNotifyService.send).not.toHaveBeenCalled();
    });
  });
});
