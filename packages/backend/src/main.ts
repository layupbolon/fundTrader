import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PerformanceMiddleware } from './common/performance.middleware';
import { ErrorInterceptor } from './common/error.interceptor';
import { NotifyService } from './services/notify/notify.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn', 'log'],
  });

  // 性能指标采集中间件
  app.use(new PerformanceMiddleware());

  // Swagger configuration
  // Global prefix - must be set before Swagger document creation
  app.setGlobalPrefix('api');

  const config = new DocumentBuilder()
    .setTitle('A 股基金自动交易平台 API')
    .setDescription('场外基金自动交易系统 - 支持定投、止盈止损、策略回测')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', '认证管理')
    .addTag('strategies', '策略管理')
    .addTag('positions', '持仓管理')
    .addTag('transactions', '交易记录')
    .addTag('funds', '基金信息')
    .addTag('backtest', '策略回测')
    .addTag('监控', '系统监控和健康检查')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global error interceptor with alert notifications
  const notifyService = app.get(NotifyService);
  app.useGlobalFilters(new ErrorInterceptor(notifyService));

  const port = process.env.PORT || 3000;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 A 股基金自动交易平台                                  ║
║                                                        ║
║   服务已启动：http://localhost:${port}                   ║
║   API 文档：http://localhost:${port}/api/docs            ║
║   健康检查：http://localhost:${port}/health              ║
║                                                        ║
║   定时任务：                                              ║
║   - 每天 09:00 同步基金净值                               ║
║   - 每天 14:30 检查定投策略 (工作日)                       ║
║   - 每小时检查止盈止损                                    ║
║   - 每 30 分钟保持会话活跃                                  ║
║   - 每 5 分钟健康检查                                     ║
║                                                        ║
║   🔒 安全特性已启用：                                     ║
║   - Helmet 安全头                                       ║
║   - CORS 跨域保护                                        ║
║   - 输入验证                                             ║
║   - 速率限制                                             ║
║   - 性能监控 (X-Response-Time)                            ║
║   - 错误告警                                             ║
║                                                         ║
╚═════════════════════════════════════════════════════════╝
  `);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
