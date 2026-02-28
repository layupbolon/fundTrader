import { Controller, Post, Body, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto';
import { Public } from './public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: '用户注册', description: '注册新用户并返回 JWT token' })
  @ApiResponse({ status: 201, description: '注册成功，返回 access_token 和用户信息' })
  @ApiResponse({ status: 409, description: '用户名已存在' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.username, dto.password);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: '用户登录', description: '使用用户名密码登录，返回 JWT token' })
  @ApiResponse({ status: 200, description: '登录成功，返回 access_token 和用户信息' })
  @ApiResponse({ status: 401, description: '用户名或密码错误' })
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password);
  }
}
