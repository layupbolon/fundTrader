import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { RegisterDto, LoginDto } from '../dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthResult = {
    access_token: 'mock-jwt-token',
    user: {
      id: 'user-uuid-1',
      username: 'testuser',
    },
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      validateUser: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const registerDto: RegisterDto = {
        username: 'testuser',
        password: 'securePass123',
      };

      authService.register.mockResolvedValue(mockAuthResult);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith('testuser', 'securePass123');
      expect(result).toEqual(mockAuthResult);
    });

    it('should call authService.register with correct parameters', async () => {
      const registerDto: RegisterDto = {
        username: 'newuser',
        password: 'password888',
      };

      authService.register.mockResolvedValue(mockAuthResult);

      await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledTimes(1);
      expect(authService.register).toHaveBeenCalledWith('newuser', 'password888');
    });
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      const loginDto: LoginDto = {
        username: 'testuser',
        password: 'securePass123',
      };

      authService.login.mockResolvedValue(mockAuthResult);

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith('testuser', 'securePass123');
      expect(result).toEqual(mockAuthResult);
    });

    it('should call authService.login with correct parameters', async () => {
      const loginDto: LoginDto = {
        username: 'existinguser',
        password: 'anotherpass',
      };

      authService.login.mockResolvedValue(mockAuthResult);

      await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledTimes(1);
      expect(authService.login).toHaveBeenCalledWith('existinguser', 'anotherpass');
    });
  });
});
