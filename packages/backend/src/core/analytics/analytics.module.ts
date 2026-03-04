import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsService } from './analytics.service';
import { PortfolioSnapshot, Position, Transaction } from '../../models';

@Module({
  imports: [TypeOrmModule.forFeature([PortfolioSnapshot, Position, Transaction])],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
