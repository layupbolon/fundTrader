import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn', 'log'],
  });

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('A股基金自动交易平台 API')
    .setDescription('场外基金自动交易系统 - 支持定投、止盈止损、策略回测')
    .setVersion('1.0')
    .addTag('strategies', '策略管理')
    .addTag('positions', '持仓管理')
    .addTag('transactions', '交易记录')
    .addTag('funds', '基金信息')
    .addTag('backtest', '策略回测')
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

  // Global prefix
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3000;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🚀 A股基金自动交易平台                                  ║
║                                                        ║
║   服务已启动: http://localhost:${port}                   ║
║   API文档: http://localhost:${port}/api/docs            ║
║                                                        ║
║   定时任务:                                              ║
║   - 每天 09:00 同步基金净值                               ║
║   - 每天 14:30 检查定投策略 (工作日)                       ║
║   - 每小时检查止盈止损                                    ║
║   - 每30分钟保持会话活跃                                  ║
║                                                        ║
║   🔒 安全特性已启用:                                     ║
║   - Helmet 安全头                                       ║
║   - CORS 跨域保护                                        ║
║   - 输入验证                                             ║
║   - 速率限制                                             ║
║                                                         ║
╚═════════════════════════════════════════════════════════╝
  `);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
