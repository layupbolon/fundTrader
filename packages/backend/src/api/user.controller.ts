import {
  Controller,
  Get,
  Put,
  Body,
  ValidationPipe,
  UsePipes,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../models';
import { CryptoUtil } from '../utils';
import { CurrentUser } from '../auth/user.decorator';
import { UpdateUserDto, UpdateBrokerCredentialsDto, UserProfileResponseDto } from './user.dto';

@ApiBearerAuth()
@ApiTags('users')
@Controller('users')
export class UserController {
  private cryptoUtil: CryptoUtil;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    const masterKey = process.env.MASTER_KEY;
    if (masterKey) {
      this.cryptoUtil = new CryptoUtil(masterKey);
    }
  }

  @Get('me')
  @ApiOperation({ summary: '获取当前用户信息', description: '返回当前登录用户的基本信息' })
  @ApiResponse({ status: 200, description: '成功返回用户信息', type: UserProfileResponseDto })
  async getProfile(@CurrentUser() currentUser: { id: string }): Promise<UserProfileResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: currentUser.id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      created_at: user.created_at,
      has_broker_credentials: !!user.encrypted_credentials,
    };
  }

  @Put('me')
  @ApiOperation({ summary: '更新用户信息', description: '更新当前用户的用户名' })
  @ApiResponse({ status: 200, description: '用户信息更新成功', type: UserProfileResponseDto })
  @ApiResponse({ status: 409, description: '用户名已存在' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateProfile(
    @Body() updateDto: UpdateUserDto,
    @CurrentUser() currentUser: { id: string },
  ): Promise<UserProfileResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: currentUser.id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (updateDto.username) {
      const existing = await this.userRepository.findOne({
        where: { username: updateDto.username },
      });
      if (existing && existing.id !== user.id) {
        throw new ConflictException('Username already exists');
      }
    }

    const updated = await this.userRepository.save({
      ...user,
      ...updateDto,
    });

    return {
      id: updated.id,
      username: updated.username,
      created_at: updated.created_at,
      has_broker_credentials: !!updated.encrypted_credentials,
    };
  }

  @Put('me/broker-credentials')
  @ApiOperation({ summary: '更新交易平台凭证', description: '加密存储交易平台的账号密码' })
  @ApiResponse({ status: 200, description: '凭证更新成功', type: UserProfileResponseDto })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async updateBrokerCredentials(
    @Body() credentialsDto: UpdateBrokerCredentialsDto,
    @CurrentUser() currentUser: { id: string },
  ): Promise<UserProfileResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: currentUser.id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Decrypt existing credentials or start fresh
    let credentials: Record<string, any> = {};
    if (user.encrypted_credentials && this.cryptoUtil) {
      try {
        const decrypted = this.cryptoUtil.decrypt(
          typeof user.encrypted_credentials === 'string'
            ? user.encrypted_credentials
            : JSON.stringify(user.encrypted_credentials),
        );
        credentials = JSON.parse(decrypted);
      } catch {
        credentials = {};
      }
    }

    // Update credentials for the specified platform
    credentials[credentialsDto.platform] = {
      username: credentialsDto.username,
      password: credentialsDto.password,
    };

    // Encrypt and store
    const encrypted = this.cryptoUtil
      ? this.cryptoUtil.encrypt(JSON.stringify(credentials))
      : JSON.stringify(credentials);

    const updated = await this.userRepository.save({
      ...user,
      encrypted_credentials: encrypted,
    });

    return {
      id: updated.id,
      username: updated.username,
      created_at: updated.created_at,
      has_broker_credentials: !!updated.encrypted_credentials,
    };
  }
}
