import type winston from 'winston';
import { WinstonNestLogger } from '../winston-nest-logger';

describe('WinstonNestLogger', () => {
  function createLogger() {
    const log = vi.fn<(level: string, message: string, meta: Record<string, unknown>) => void>();
    const logger = new WinstonNestLogger({ log } as unknown as winston.Logger);
    return { logger, log };
  }

  it('should map Nest log messages to Winston info level', () => {
    const { logger, log } = createLogger();

    logger.log('Mapped {/api/health, GET} route', 'RouterExplorer');

    expect(log).toHaveBeenCalledWith('info', 'Mapped {/api/health, GET} route', {
      context: 'RouterExplorer',
    });
  });

  it('should preserve structured metadata from optional params', () => {
    const { logger, log } = createLogger();

    logger.log('GET /api/health 200 - 6ms', {
      method: 'GET',
      statusCode: 200,
      durationMs: 6,
    });

    expect(log).toHaveBeenCalledWith('info', 'GET /api/health 200 - 6ms', {
      method: 'GET',
      statusCode: 200,
      durationMs: 6,
    });
  });

  it('should map warn, debug and verbose to valid Winston levels', () => {
    const { logger, log } = createLogger();

    logger.warn('cache is stale', 'CacheService');
    logger.debug('refresh skipped', 'SchedulerService');
    logger.verbose('request metadata', { requestId: 'req-1' });

    expect(log).toHaveBeenNthCalledWith(1, 'warn', 'cache is stale', {
      context: 'CacheService',
    });
    expect(log).toHaveBeenNthCalledWith(2, 'debug', 'refresh skipped', {
      context: 'SchedulerService',
    });
    expect(log).toHaveBeenNthCalledWith(3, 'verbose', 'request metadata', {
      requestId: 'req-1',
    });
  });

  it('should map Nest error trace and context without treating the message as a level', () => {
    const { logger, log } = createLogger();

    logger.error('Database health check failed', 'Error: Connection refused', 'HealthService');

    expect(log).toHaveBeenCalledWith('error', 'Database health check failed', {
      trace: 'Error: Connection refused',
      context: 'HealthService',
    });
  });
});
