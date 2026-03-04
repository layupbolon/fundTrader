import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { TiantianBrokerService } from '../../services/broker/tiantian.service';
import { NotifyService } from '../../services/notify/notify.service';

/**
 * 健康状态枚举
 */
export type HealthStatus = 'up' | 'down' | 'degraded';

/**
 * 组件健康状态接口
 */
export interface ComponentHealth {
  /** 组件名称 */
  name: string;

  /** 健康状态 */
  status: HealthStatus;

  /** 详细信息或错误消息 */
  message?: string;

  /** 响应时间（毫秒） */
  responseTime?: number;
}

/**
 * 整体健康状态接口
 */
export interface HealthStatusResponse {
  /** 整体状态 */
  status: HealthStatus;

  /** 各组件健康状态 */
  components: {
    /** 数据库健康状态 */
    database: ComponentHealth;
    /** Redis 健康状态 */
    redis: ComponentHealth;
    /** 浏览器会话健康状态 */
    browser: ComponentHealth;
  };

  /** 检查时间戳 */
  timestamp: string;
}

/**
 * 健康检查服务
 *
 * 负责执行实际的健康检查逻辑，验证各组件的连接状态。
 *
 * 核心功能：
 * - 数据库连接检查：执行 SELECT 1 查询验证连接
 * - Redis 连接检查：执行 PING 命令验证连接
 * - 浏览器会话检查：验证 Puppeteer 会话状态
 *
 * 使用场景：
 * - /health 端点返回系统状态
 * - 定时任务定期检查系统健康
 * - 触发告警通知
 *
 * @example
 * const health = await healthService.checkHealth();
 * console.log(`系统状态：${health.status}`);
 */
@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private redis: Redis | null = null;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly brokerService: TiantianBrokerService,
    private readonly notifyService: NotifyService,
  ) {}

  /**
   * 执行全面的健康检查
   *
   * 检查所有组件（数据库、Redis、浏览器会话）的状态，
   * 并返回整体健康状态。
   *
   * @returns 健康状态响应
   */
  async checkHealth(): Promise<HealthStatusResponse> {
    const startTime = Date.now();

    const [database, redis, browser] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkBrowserSession(),
    ]);

    // 确定整体状态
    const components = [database, redis, browser];
    const allUp = components.every((c) => c.status === 'up');
    const anyDown = components.some((c) => c.status === 'down');

    const status: HealthStatus = allUp ? 'up' : anyDown ? 'down' : 'degraded';

    return {
      status,
      components: {
        database,
        redis,
        browser,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 检查数据库连接
   *
   * 执行简单的 SELECT 1 查询验证数据库连接是否正常。
   *
   * @returns 数据库组件健康状态
   */
  async checkDatabase(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      // 执行简单的查询验证连接
      await this.dataSource.query('SELECT 1');
      const responseTime = Date.now() - startTime;

      this.logger.debug(`Database health check passed (${responseTime}ms)`);

      return {
        name: 'database',
        status: 'up',
        message: 'Database connection healthy',
        responseTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Database health check failed: ${errorMessage}`);

      return {
        name: 'database',
        status: 'down',
        message: `Database connection failed: ${errorMessage}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 检查 Redis 连接
   *
   * 执行 PING 命令验证 Redis 连接是否正常。
   *
   * @returns Redis 组件健康状态
   */
  async checkRedis(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      // 获取或创建 Redis 连接
      if (!this.redis) {
        this.redis = new Redis({
          host: this.configService.get('redis.host') || process.env.REDIS_HOST || 'localhost',
          port: parseInt(this.configService.get('redis.port') || process.env.REDIS_PORT || '6379'),
          lazyConnect: true,
          maxRetriesPerRequest: 1,
        });
      }

      // 执行 PING 命令
      await this.redis.ping();
      const responseTime = Date.now() - startTime;

      this.logger.debug(`Redis health check passed (${responseTime}ms)`);

      return {
        name: 'redis',
        status: 'up',
        message: 'Redis connection healthy',
        responseTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Redis health check failed: ${errorMessage}`);

      return {
        name: 'redis',
        status: 'down',
        message: `Redis connection failed: ${errorMessage}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 检查浏览器会话
   *
   * 验证 TiantianBrokerService 中的浏览器会话是否有效。
   *
   * @returns 浏览器会话组件健康状态
   */
  async checkBrowserSession(): Promise<ComponentHealth> {
    const startTime = Date.now();

    try {
      // 检查浏览器会话状态
      // TiantianBrokerService 内部维护会话状态
      const isSessionValid = this.isBrokerSessionValid();

      if (isSessionValid) {
        this.logger.debug('Browser session health check passed');
        return {
          name: 'browser',
          status: 'up',
          message: 'Browser session is active and valid',
          responseTime: Date.now() - startTime,
        };
      } else {
        this.logger.warn('Browser session is invalid or expired');
        return {
          name: 'browser',
          status: 'degraded',
          message: 'Browser session is invalid or expired, re-login may be required',
          responseTime: Date.now() - startTime,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Browser session health check failed: ${errorMessage}`);

      return {
        name: 'browser',
        status: 'down',
        message: `Browser session check failed: ${errorMessage}`,
        responseTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 检查经纪人服务会话是否有效
   *
   * 由于 TiantianBrokerService 没有公开会话状态方法，
   * 这里通过内部属性访问来检查会话状态。
   *
   * @returns true 表示会话有效，false 表示会话无效
   * @private
   */
  private isBrokerSessionValid(): boolean {
    // 访问 TiantianBrokerService 的私有属性
    // 在实际应用中，可能需要修改 TiantianBrokerService 添加 getSessionStatus() 方法
    const session = (this.brokerService as any).session;
    if (!session) {
      return false;
    }

    const now = new Date();
    const expiresAt = new Date(session.expiresAt);

    return now < expiresAt;
  }

  /**
   * 发送告警通知
   *
   * 当检测到组件异常时，发送告警通知到配置的通知渠道。
   *
   * @param health 健康状态响应
   */
  async sendAlert(health: HealthStatusResponse): Promise<void> {
    const unhealthyComponents = Object.values(health.components).filter(
      (component) => component.status !== 'up',
    );

    if (unhealthyComponents.length === 0) {
      return;
    }

    const componentDetails = unhealthyComponents
      .map((c) => `- ${c.name}: ${c.status} - ${c.message}`)
      .join('\n');

    const alertMessage: Parameters<typeof this.notifyService.send>[0] = {
      title: '系统健康告警',
      content: `检测到系统组件异常:\n\n${componentDetails}\n\n请检查相关服务状态。`,
      level: 'error',
    };

    try {
      await this.notifyService.send(alertMessage);
      this.logger.log('Health alert notification sent');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send health alert: ${errorMessage}`);
    }
  }
}
