const mockSendMessage = jest.fn().mockResolvedValue({});

jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => ({
    sendMessage: mockSendMessage,
  }));
});

import { TelegramService } from '../telegram.service';

describe('TelegramService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    mockSendMessage.mockClear();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('constructor', () => {
    it('should initialize bot when token and chatId are configured', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

      const service = new TelegramService();
      expect(service).toBeDefined();
    });

    it('should not initialize bot when token is missing', () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

      const service = new TelegramService();
      expect(service).toBeDefined();
    });

    it('should not initialize bot when chatId is missing', () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      delete process.env.TELEGRAM_CHAT_ID;

      const service = new TelegramService();
      expect(service).toBeDefined();
    });
  });

  describe('sendMessage', () => {
    it('should send formatted message with info emoji', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

      const service = new TelegramService();
      await service.sendMessage({
        title: 'Test Title',
        content: 'Test content',
        level: 'info',
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('ℹ️'),
        expect.objectContaining({ parse_mode: 'Markdown' }),
      );
    });

    it('should use warning emoji for warning level', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

      const service = new TelegramService();
      await service.sendMessage({
        title: 'Warning',
        content: 'Warn content',
        level: 'warning',
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('⚠️'),
        expect.any(Object),
      );
    });

    it('should use error emoji for error level', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

      const service = new TelegramService();
      await service.sendMessage({
        title: 'Error',
        content: 'Error content',
        level: 'error',
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('❌'),
        expect.any(Object),
      );
    });

    it('should skip sending when not configured', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const service = new TelegramService();
      await service.sendMessage({ title: 'Test', content: 'Test' });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Telegram not configured, skipping notification',
      );
      consoleSpy.mockRestore();
    });

    it('should handle send errors gracefully', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

      mockSendMessage.mockRejectedValueOnce(new Error('API error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const service = new TelegramService();
      await service.sendMessage({ title: 'Test', content: 'Test' });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send Telegram message:',
        expect.any(Error),
      );
      consoleSpy.mockRestore();
    });

    it('should format message with title in bold', async () => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';

      const service = new TelegramService();
      await service.sendMessage({ title: 'My Title', content: 'Body' });

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('*My Title*'),
        expect.any(Object),
      );
    });
  });
});
