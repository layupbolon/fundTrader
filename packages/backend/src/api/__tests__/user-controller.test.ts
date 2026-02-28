import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UserController } from '../user.controller';
import { User } from '../../models';

describe('UserController', () => {
  let controller: UserController;
  let userRepository: any;

  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    password_hash: 'hashed',
    encrypted_credentials: null,
    created_at: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    // Set env vars for CryptoUtil
    process.env.MASTER_KEY = 'test-master-key-that-is-at-least-32-chars';
    process.env.ENCRYPTION_SALT = 'test-salt-at-least-16-chars';

    userRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
  });

  afterEach(() => {
    delete process.env.MASTER_KEY;
    delete process.env.ENCRYPTION_SALT;
  });

  describe('GET /users/me', () => {
    it('should return user profile without sensitive fields', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await controller.getProfile({ id: 'user-1' });

      expect(result).toEqual({
        id: 'user-1',
        username: 'testuser',
        created_at: mockUser.created_at,
        has_broker_credentials: false,
      });
      expect(result).not.toHaveProperty('password_hash');
      expect(result).not.toHaveProperty('encrypted_credentials');
    });

    it('should show has_broker_credentials: true when credentials exist', async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        encrypted_credentials: '{"iv":"...","encrypted":"...","authTag":"..."}',
      });

      const result = await controller.getProfile({ id: 'user-1' });
      expect(result.has_broker_credentials).toBe(true);
    });

    it('should show has_broker_credentials: false when no credentials', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await controller.getProfile({ id: 'user-1' });
      expect(result.has_broker_credentials).toBe(false);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(controller.getProfile({ id: 'nonexistent' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('PUT /users/me', () => {
    it('should update username successfully', async () => {
      userRepository.findOne
        .mockResolvedValueOnce(mockUser) // find current user
        .mockResolvedValueOnce(null); // check uniqueness
      userRepository.save.mockResolvedValue({
        ...mockUser,
        username: 'newname',
      });

      const result = await controller.updateProfile(
        { username: 'newname' },
        { id: 'user-1' },
      );

      expect(result.username).toBe('newname');
    });

    it('should reject duplicate username with ConflictException', async () => {
      userRepository.findOne
        .mockResolvedValueOnce(mockUser) // find current user
        .mockResolvedValueOnce({ id: 'other-user', username: 'taken' }); // existing user with same name

      await expect(
        controller.updateProfile({ username: 'taken' }, { id: 'user-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should allow keeping the same username', async () => {
      userRepository.findOne
        .mockResolvedValueOnce(mockUser) // find current user
        .mockResolvedValueOnce(mockUser); // same user found (same id)
      userRepository.save.mockResolvedValue(mockUser);

      const result = await controller.updateProfile(
        { username: 'testuser' },
        { id: 'user-1' },
      );

      expect(result.username).toBe('testuser');
    });
  });

  describe('PUT /users/me/broker-credentials', () => {
    it('should encrypt and store broker credentials', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockImplementation((data) => Promise.resolve(data));

      const result = await controller.updateBrokerCredentials(
        { platform: 'tiantian', username: 'broker-user', password: 'broker-pass' },
        { id: 'user-1' },
      );

      expect(result.has_broker_credentials).toBe(true);
      expect(userRepository.save).toHaveBeenCalled();
      const savedData = userRepository.save.mock.calls[0][0];
      expect(savedData.encrypted_credentials).toBeDefined();
      expect(savedData.encrypted_credentials).not.toContain('broker-pass');
    });

    it('should overwrite existing credentials for same platform', async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        encrypted_credentials: null,
      });
      userRepository.save.mockImplementation((data) => Promise.resolve(data));

      // First set
      await controller.updateBrokerCredentials(
        { platform: 'tiantian', username: 'user1', password: 'pass1' },
        { id: 'user-1' },
      );

      // Overwrite
      await controller.updateBrokerCredentials(
        { platform: 'tiantian', username: 'user2', password: 'pass2' },
        { id: 'user-1' },
      );

      expect(userRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        controller.updateBrokerCredentials(
          { platform: 'tiantian', username: 'u', password: 'p' },
          { id: 'nonexistent' },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
