import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: '用户名', example: 'investor01' })
  @IsString()
  username: string;

  @ApiProperty({ description: '密码', example: 'securePass123' })
  @IsString()
  password: string;
}
