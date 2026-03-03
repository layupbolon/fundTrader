import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ValidationPipe,
  UsePipes,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiskLimit, RiskLimitType, Blacklist, BlacklistType, BlacklistReason } from '../models';
import { CurrentUser } from '../auth/user.decorator';
import { RiskControlService } from '../core/risk/risk-control.service';

/**
 * 创建风控限额 DTO
 */
class CreateRiskLimitDto {
  @ApiProperty({
    description: '风控限额类型',
    enum: RiskLimitType,
    example: RiskLimitType.SINGLE_TRADE_LIMIT,
  })
  type: RiskLimitType;

  @ApiProperty({
    description: '限额值（金额、次数或比例）',
    example: 10000,
  })
  limit_value: number;

  @ApiProperty({
    description: '限额描述',
    example: '单笔交易最大金额',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: '是否启用',
    example: true,
    required: false,
  })
  enabled?: boolean;
}

/**
 * 更新风控限额 DTO
 */
class UpdateRiskLimitDto {
  @ApiProperty({
    description: '限额值',
    required: false,
    example: 15000,
  })
  limit_value?: number;

  @ApiProperty({
    description: '是否启用',
    required: false,
    example: true,
  })
  enabled?: boolean;

  @ApiProperty({
    description: '限额描述',
    required: false,
    example: '单日交易最大金额',
  })
  description?: string;
}

/**
 * 创建黑名单 DTO
 */
class CreateBlacklistDto {
  @ApiProperty({
    description: '黑名单类型',
    enum: BlacklistType,
    example: BlacklistType.FUND_CODE,
  })
  type: BlacklistType;

  @ApiProperty({
    description: '黑名单值（基金代码、经理姓名、公司名称）',
    example: '000001',
  })
  value: string;

  @ApiProperty({
    description: '黑名单原因',
    enum: BlacklistReason,
    example: BlacklistReason.POOR_PERFORMANCE,
  })
  reason: BlacklistReason;

  @ApiPropertyOptional({
    description: '备注信息',
    example: '连续 3 年业绩垫底',
  })
  note?: string;

  @ApiPropertyOptional({
    description: '过期时间（null 表示永久有效）',
    example: '2026-12-31T23:59:59Z',
  })
  expires_at?: Date;

  @ApiPropertyOptional({
    description: '是否启用',
    example: true,
  })
  enabled?: boolean;
}

/**
 * 更新黑名单 DTO
 */
class UpdateBlacklistDto {
  @ApiProperty({
    description: '是否启用',
    required: false,
    example: true,
  })
  enabled?: boolean;

  @ApiProperty({
    description: '备注信息',
    required: false,
  })
  note?: string;

  @ApiProperty({
    description: '过期时间',
    required: false,
  })
  expires_at?: Date;
}

@ApiBearerAuth()
@ApiTags('risk')
@Controller('risk')
export class RiskController {
  constructor(
    @InjectRepository(RiskLimit)
    private readonly riskLimitRepository: Repository<RiskLimit>,
    @InjectRepository(Blacklist)
    private readonly blacklistRepository: Repository<Blacklist>,
    private readonly riskControlService: RiskControlService,
  ) {}

  // ==================== 风控限额管理 ====================

  @Get('limits')
  @ApiOperation({ summary: '获取风控限额列表', description: '获取当前用户的所有风控限额配置' })
  @ApiResponse({ status: 200, description: '成功返回风控限额列表' })
  async getRiskLimits(@CurrentUser() user: { id: string }) {
    return this.riskLimitRepository.find({
      where: { user_id: user.id },
      order: { created_at: 'DESC' },
    });
  }

  @Get('limits/:id')
  @ApiOperation({ summary: '获取风控限额详情', description: '根据 ID 获取风控限额详细信息' })
  @ApiParam({ name: 'id', description: '风控限额 ID' })
  @ApiResponse({ status: 200, description: '成功返回风控限额详情' })
  @ApiResponse({ status: 404, description: '风控限额不存在' })
  async getRiskLimit(@Param('id') id: string) {
    const limit = await this.riskLimitRepository.findOne({ where: { id } });
    if (!limit) {
      throw new NotFoundException('Risk limit not found');
    }
    return limit;
  }

  @Post('limits')
  @ApiOperation({ summary: '创建风控限额', description: '创建新的风控限额配置' })
  @ApiResponse({ status: 201, description: '风控限额创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createRiskLimit(
    @Body() createDto: CreateRiskLimitDto,
    @CurrentUser() user: { id: string },
  ) {
    // 检查是否已存在同类型的限额
    const existingLimit = await this.riskLimitRepository.findOne({
      where: { user_id: user.id, type: createDto.type },
    });

    if (existingLimit) {
      throw new BadRequestException(`该类型的风控限额已存在：${createDto.type}`);
    }

    const limit = this.riskLimitRepository.create({
      ...createDto,
      user_id: user.id,
      current_usage: 0,
    });

    return this.riskLimitRepository.save(limit);
  }

  @Put('limits/:id')
  @ApiOperation({ summary: '更新风控限额', description: '更新风控限额配置' })
  @ApiParam({ name: 'id', description: '风控限额 ID' })
  @ApiResponse({ status: 200, description: '风控限额更新成功' })
  @ApiResponse({ status: 404, description: '风控限额不存在' })
  @ApiResponse({ status: 403, description: '无权操作该风控限额' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateRiskLimit(
    @Param('id') id: string,
    @Body() updateDto: UpdateRiskLimitDto,
    @CurrentUser() user: { id: string },
  ) {
    const limit = await this.riskLimitRepository.findOne({ where: { id } });
    if (!limit) {
      throw new NotFoundException('Risk limit not found');
    }
    if (limit.user_id !== user.id) {
      throw new ForbiddenException('You do not have permission to update this risk limit');
    }

    Object.assign(limit, updateDto);
    return this.riskLimitRepository.save(limit);
  }

  @Delete('limits/:id')
  @ApiOperation({ summary: '删除风控限额', description: '删除风控限额配置' })
  @ApiParam({ name: 'id', description: '风控限额 ID' })
  @ApiResponse({ status: 200, description: '风控限额删除成功' })
  @ApiResponse({ status: 404, description: '风控限额不存在' })
  @ApiResponse({ status: 403, description: '无权操作该风控限额' })
  async deleteRiskLimit(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    const limit = await this.riskLimitRepository.findOne({ where: { id } });
    if (!limit) {
      throw new NotFoundException('Risk limit not found');
    }
    if (limit.user_id !== user.id) {
      throw new ForbiddenException('You do not have permission to delete this risk limit');
    }

    await this.riskLimitRepository.remove(limit);
    return { message: 'Risk limit deleted successfully' };
  }

  // ==================== 基金黑名单管理 ====================

  @Get('blacklist')
  @ApiOperation({ summary: '获取基金黑名单列表', description: '获取所有启用的基金黑名单记录' })
  @ApiResponse({ status: 200, description: '成功返回黑名单列表' })
  async getBlacklist() {
    return this.blacklistRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  @Get('blacklist/:id')
  @ApiOperation({ summary: '获取黑名单详情', description: '根据 ID 获取黑名单详细信息' })
  @ApiParam({ name: 'id', description: '黑名单 ID' })
  @ApiResponse({ status: 200, description: '成功返回黑名单详情' })
  @ApiResponse({ status: 404, description: '黑名单不存在' })
  async getBlacklistItem(@Param('id') id: string) {
    const item = await this.blacklistRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Blacklist item not found');
    }
    return item;
  }

  @Post('blacklist')
  @ApiOperation({ summary: '创建黑名单', description: '创建新的基金黑名单记录' })
  @ApiResponse({ status: 201, description: '黑名单创建成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async createBlacklist(@Body() createDto: CreateBlacklistDto) {
    // 检查是否已存在
    const existingItem = await this.blacklistRepository.findOne({
      where: { type: createDto.type, value: createDto.value, enabled: true },
    });

    if (existingItem) {
      throw new BadRequestException(`该黑名单已存在：${createDto.type} - ${createDto.value}`);
    }

    const item = this.blacklistRepository.create(createDto);
    return this.blacklistRepository.save(item);
  }

  @Put('blacklist/:id')
  @ApiOperation({ summary: '更新黑名单', description: '更新黑名单记录' })
  @ApiParam({ name: 'id', description: '黑名单 ID' })
  @ApiResponse({ status: 200, description: '黑名单更新成功' })
  @ApiResponse({ status: 404, description: '黑名单不存在' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateBlacklist(@Param('id') id: string, @Body() updateDto: UpdateBlacklistDto) {
    const item = await this.blacklistRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Blacklist item not found');
    }

    Object.assign(item, updateDto);
    return this.blacklistRepository.save(item);
  }

  @Delete('blacklist/:id')
  @ApiOperation({ summary: '删除黑名单', description: '删除黑名单记录' })
  @ApiParam({ name: 'id', description: '黑名单 ID' })
  @ApiResponse({ status: 200, description: '黑名单删除成功' })
  @ApiResponse({ status: 404, description: '黑名单不存在' })
  async deleteBlacklist(@Param('id') id: string) {
    const item = await this.blacklistRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Blacklist item not found');
    }

    await this.blacklistRepository.remove(item);
    return { message: 'Blacklist item deleted successfully' };
  }

  // ==================== 风控检查 API ====================

  @Get('check/trade-limit')
  @ApiOperation({ summary: '检查交易限额', description: '检查交易是否超过限额' })
  @ApiQuery({ name: 'amount', description: '交易金额' })
  @ApiQuery({ name: 'type', description: '交易类型', enum: ['BUY', 'SELL'] })
  @ApiResponse({ status: 200, description: '成功返回检查结果' })
  @ApiResponse({ status: 400, description: '超过限额' })
  async checkTradeLimit(
    @Query('amount') amount: number,
    @Query('type') type: 'BUY' | 'SELL',
    @CurrentUser() user: { id: string },
  ) {
    const result = await this.riskControlService.checkTradeLimit(user.id, amount, type as any);
    if (!result.passed) {
      throw new BadRequestException(result.message);
    }
    return result;
  }

  @Get('check/position-limit')
  @ApiOperation({ summary: '检查持仓比例', description: '检查买入后是否超过持仓比例限制' })
  @ApiQuery({ name: 'fundCode', description: '基金代码' })
  @ApiQuery({ name: 'amount', description: '买入金额' })
  @ApiResponse({ status: 200, description: '成功返回检查结果' })
  @ApiResponse({ status: 400, description: '超过持仓比例限制' })
  async checkPositionLimit(
    @Query('fundCode') fundCode: string,
    @Query('amount') amount: number,
    @CurrentUser() user: { id: string },
  ) {
    const result = await this.riskControlService.checkPositionLimit(user.id, fundCode, amount);
    if (!result.passed) {
      throw new BadRequestException(result.message);
    }
    return result;
  }

  @Get('check/blacklist')
  @ApiOperation({ summary: '检查基金黑名单', description: '检查基金是否在黑名单中' })
  @ApiQuery({ name: 'fundCode', description: '基金代码' })
  @ApiResponse({ status: 200, description: '成功返回检查结果' })
  @ApiResponse({ status: 400, description: '基金在黑名单中' })
  async checkFundBlacklist(@Query('fundCode') fundCode: string) {
    const result = await this.riskControlService.checkFundBlacklist(fundCode);
    if (!result.passed) {
      throw new BadRequestException(result.message);
    }
    return result;
  }

  @Get('check/daily-stats')
  @ApiOperation({ summary: '获取单日交易统计', description: '获取用户当日的交易统计数据' })
  @ApiResponse({ status: 200, description: '成功返回交易统计' })
  async getDailyStats(@CurrentUser() user: { id: string }) {
    return this.riskControlService.getTodayTradeStats(user.id);
  }
}
