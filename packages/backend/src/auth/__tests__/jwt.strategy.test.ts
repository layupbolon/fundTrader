import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from '../jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    configService = {
      get: vi.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with JWT_SECRET from config service', () => {
      configService.get.mockReturnValue('custom-secret-key');

      // Re-create strategy with mocked config
      const customStrategy = new JwtStrategy(configService);

      expect(customStrategy).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
    });

    it('should use default secret if JWT_SECRET is not configured', () => {
      configService.get.mockReturnValue(undefined);

      const customStrategy = new JwtStrategy(configService);

      expect(customStrategy).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('JWT_SECRET');
    });

    it('should use default secret if JWT_SECRET is null', () => {
      configService.get.mockReturnValue(null);

      const customStrategy = new JwtStrategy(configService);

      expect(customStrategy).toBeDefined();
    });

    it('should use default secret if JWT_SECRET is empty string', () => {
      configService.get.mockReturnValue('');

      const customStrategy = new JwtStrategy(configService);

      expect(customStrategy).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should return user object with id and username from payload', async () => {
      const payload = {
        sub: 'user-uuid-123',
        username: 'testuser',
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'user-uuid-123',
        username: 'testuser',
      });
    });

    it('should extract id from sub field', async () => {
      const payload = {
        sub: 'different-user-id',
        username: 'anotheruser',
      };

      const result = await strategy.validate(payload);

      expect(result.id).toBe('different-user-id');
      expect(result.username).toBe('anotheruser');
    });

    it('should handle payload with only required fields', async () => {
      const payload = {
        sub: 'minimal-user',
        username: 'minimal',
      };

      const result = await strategy.validate(payload);

      expect(result).toHaveProperty('id', 'minimal-user');
      expect(result).toHaveProperty('username', 'minimal');
    });
  });
});
