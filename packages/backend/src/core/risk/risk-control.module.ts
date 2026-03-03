import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RiskLimit, Blacklist, Position, Transaction } from '../../models';
import { RiskControlService } from './risk-control.service';

/**
 * 风控模块
 *
 * 提供风险控制相关的服务和配置。
 * 全局模块，可在整个应用中使用。
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([RiskLimit, Blacklist, Position, Transaction])],
  providers: [RiskControlService],
  exports: [RiskControlService],
})
export class RiskControlModule {}
