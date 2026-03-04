import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from '../core/analytics/analytics.service';
import { CurrentUser } from '../auth/user.decorator';

/**
 * 收益分析响应
 */
interface ReturnsResponse {
  /** 收益数据列表 */
  data: Array<{
    /** 日期 */
    date: string;
    /** 总资产 */
    total_assets: number;
    /** 总盈亏 */
    total_profit: number;
    /** 总收益率 */
    total_profit_rate: number;
    /** 持仓数量 */
    position_count: number;
  }>;
}

/**
 * 持仓分析响应
 */
interface PositionAnalysisResponse {
  /** 持仓分析列表 */
  data: Array<{
    /** 基金代码 */
    fund_code: string;
    /** 基金名称 */
    fund_name: string;
    /** 持仓市值 */
    current_value: number;
    /** 持仓占比 */
    position_ratio: number;
    /** 盈亏金额 */
    profit: number;
    /** 盈亏率 */
    profit_rate: number;
  }>;
}

/**
 * 交易统计响应
 */
interface TransactionStatsResponse {
  /** 交易统计列表 */
  data: Array<{
    /** 交易类型 */
    type: 'BUY' | 'SELL';
    /** 交易次数 */
    count: number;
    /** 交易总金额 */
    total_amount: number;
    /** 成功次数 */
    success_count: number;
    /** 失败次数 */
    failed_count: number;
  }>;
}

@ApiBearerAuth()
@ApiTags('analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('returns')
  @ApiOperation({
    summary: '获取收益分析数据',
    description: '获取指定时间段内的收益数据，用于绘制收益曲线',
  })
  @ApiQuery({
    name: 'startDate',
    description: '开始日期（格式：YYYY-MM-DD）',
    example: '2026-01-01',
    required: true,
  })
  @ApiQuery({
    name: 'endDate',
    description: '结束日期（格式：YYYY-MM-DD）',
    example: '2026-03-04',
    required: true,
  })
  @ApiResponse({ status: 200, description: '成功返回收益数据' })
  @ApiResponse({ status: 400, description: '日期格式错误' })
  async getReturns(
    @CurrentUser() user: { id: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<ReturnsResponse> {
    if (!startDate || !endDate) {
      throw new BadRequestException('Missing required parameters: startDate and endDate');
    }

    // 验证日期格式
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const data = await this.analyticsService.getReturnsData(user.id, startDate, endDate);

    return { data };
  }

  @Get('positions')
  @ApiOperation({
    summary: '获取持仓分析数据',
    description: '获取当前持仓分布情况，包括各基金的持仓占比和收益情况',
  })
  @ApiResponse({ status: 200, description: '成功返回持仓分析数据' })
  async getPositionAnalysis(
    @CurrentUser() user: { id: string },
  ): Promise<PositionAnalysisResponse> {
    const data = await this.analyticsService.getPositionAnalysis(user.id);
    return { data };
  }

  @Get('transactions')
  @ApiOperation({
    summary: '获取交易统计数据',
    description: '获取指定时间段内的交易统计数据',
  })
  @ApiQuery({
    name: 'startDate',
    description: '开始日期（格式：YYYY-MM-DD）',
    example: '2026-01-01',
    required: true,
  })
  @ApiQuery({
    name: 'endDate',
    description: '结束日期（格式：YYYY-MM-DD）',
    example: '2026-03-04',
    required: true,
  })
  @ApiResponse({ status: 200, description: '成功返回交易统计数据' })
  @ApiResponse({ status: 400, description: '日期格式错误' })
  async getTransactionStats(
    @CurrentUser() user: { id: string },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ): Promise<TransactionStatsResponse> {
    if (!startDate || !endDate) {
      throw new BadRequestException('Missing required parameters: startDate and endDate');
    }

    // 验证日期格式
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
    }

    const data = await this.analyticsService.getTransactionStats(user.id, startDate, endDate);

    return { data };
  }
}
