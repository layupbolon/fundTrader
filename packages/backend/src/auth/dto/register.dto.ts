import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: '用户名（3-30字符）', example: 'investor01' })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  username: string;

  @ApiProperty({ description: '密码（8-64字符）', example: 'securePass123' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;
}
