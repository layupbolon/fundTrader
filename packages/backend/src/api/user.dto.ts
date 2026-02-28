import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ description: '用户名', example: 'newusername', minLength: 3, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username?: string;
}

export class UpdateBrokerCredentialsDto {
  @ApiProperty({ description: '交易平台名称', example: 'tiantian' })
  @IsString()
  platform: string;

  @ApiProperty({ description: '平台账号' })
  @IsString()
  username: string;

  @ApiProperty({ description: '平台密码' })
  @IsString()
  password: string;
}

export class UserProfileResponseDto {
  @ApiProperty({ description: '用户ID' })
  id: string;

  @ApiProperty({ description: '用户名' })
  username: string;

  @ApiProperty({ description: '创建时间' })
  created_at: Date;

  @ApiProperty({ description: '是否已配置交易平台凭证' })
  has_broker_credentials: boolean;
}
