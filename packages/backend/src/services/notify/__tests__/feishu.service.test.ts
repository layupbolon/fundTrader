const mockCreate = jest.fn().mockResolvedValue({});

jest.mock('@larksuiteoapi/node-sdk', () => ({
  Client: jest.fn().mockImplementation(() => ({
    im: {
      message: {
        create: mockCreate,
      },
    },
  })),
}));

import { FeishuService } from '../feishu.service';

describe('FeishuService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockCreate.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should initialize client when all env vars are configured', () => {
      process.env.FEISHU_APP_ID = 'app-id';
      process.env.FEISHU_APP_SECRET = 'app-secret';
      process.env.FEISHU_USER_ID = 'user-id';

      const service = new FeishuService();
      expect(service).toBeDefined();
    });

    it('should not initialize client when appId is missing', () => {
      delete process.env.FEISHU_APP_ID;
      process.env.FEISHU_APP_SECRET = 'app-secret';
      process.env.FEISHU_USER_ID = 'user-id';

      const service = new FeishuService();
      expect(service).toBeDefined();
    });
  });

  describe('sendMessage', () => {
    it('should send message via im.message.create', async () => {
      process.env.FEISHU_APP_ID = 'app-id';
      process.env.FEISHU_APP_SECRET = 'app-secret';
      process.env.FEISHU_USER_ID = 'user-id';

      const service = new FeishuService();
      await service.sendMessage({
        title: 'Test',
        content: 'Test content',
        level: 'info',
      });

      expect(mockCreate).toHaveBeenCalledWith({
        params: { receive_id_type: 'user_id' },
        data: {
          receive_id: 'user-id',
          msg_type: 'text',
          content: expect.stringContaining('Test'),
        },
      });
    });

    it('should skip when not configured', async () => {
      delete process.env.FEISHU_APP_ID;
      delete process.env.FEISHU_APP_SECRET;
      delete process.env.FEISHU_USER_ID;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const service = new FeishuService();
      await service.sendMessage({ title: 'Test', content: 'Test' });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Feishu not configured, skipping notification',
      );
      consoleSpy.mockRestore();
    });

    it('should handle send errors gracefully', async () => {
      process.env.FEISHU_APP_ID = 'app-id';
      process.env.FEISHU_APP_SECRET = 'app-secret';
      process.env.FEISHU_USER_ID = 'user-id';

      mockCreate.mockRejectedValueOnce(new Error('API error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const service = new FeishuService();
      await service.sendMessage({ title: 'Test', content: 'Test' });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send Feishu message:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it('should format content as JSON text', async () => {
      process.env.FEISHU_APP_ID = 'app-id';
      process.env.FEISHU_APP_SECRET = 'app-secret';
      process.env.FEISHU_USER_ID = 'user-id';

      const service = new FeishuService();
      await service.sendMessage({ title: 'Title', content: 'Body' });

      const call = mockCreate.mock.calls[0][0];
      const content = JSON.parse(call.data.content);
      expect(content.text).toContain('Title');
      expect(content.text).toContain('Body');
    });

    it('should skip when userId is missing', async () => {
      process.env.FEISHU_APP_ID = 'app-id';
      process.env.FEISHU_APP_SECRET = 'app-secret';
      delete process.env.FEISHU_USER_ID;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const service = new FeishuService();
      await service.sendMessage({ title: 'Test', content: 'Test' });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Feishu not configured, skipping notification',
      );
      consoleSpy.mockRestore();
    });
  });
});
