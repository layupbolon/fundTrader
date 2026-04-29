import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { AppModule } from '../../src/app.module';

const E2E_BULL_PREFIX = 'fundtrader:e2e';

async function cleanE2EQueues(): Promise<void> {
  process.env.BULL_PREFIX = E2E_BULL_PREFIX;
  const prefix = process.env.BULL_PREFIX;
  if (!prefix || !prefix.toLowerCase().includes('e2e')) {
    throw new Error(`Refusing to clean Bull queues with unsafe prefix: ${prefix || '<empty>'}`);
  }

  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    lazyConnect: true,
    maxRetriesPerRequest: 0,
  });

  try {
    await redis.connect();
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${prefix}:*`, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        try {
          await redis.unlink(...keys);
        } catch {
          await redis.del(...keys);
        }
      }
    } while (cursor !== '0');
  } finally {
    redis.disconnect();
  }
}

export async function createE2EApp(): Promise<INestApplication> {
  await cleanE2EQueues();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useLogger(['error', 'warn']);
  await app.init();
  return app;
}
