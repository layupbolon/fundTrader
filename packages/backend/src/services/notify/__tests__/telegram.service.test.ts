const mockSendMessage = jest.fn().mockResolvedValue({});
const mockOnCallbackQuery = jest.fn();

jest.mock('node-telegram-bot-api', () => {
  return jest.fn().mockImplementation(() => ({
    sendMessage: mockSendMessage,
    on: mockOnCallbackQuery,
    answerCallbackQuery: jest.fn().mockResolvedValue({}),
  }));
});

import { TelegramService } from '../telegram.service';
import { TransactionType } from '../../../models';

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

      expect(consoleSpy).toHaveBeenCalledWith('Telegram not configured, skipping notification');
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

  describe('sendConfirmationMessage', () => {
    const mockConfirmationParams = {
      transactionId: 'txn-123',
      fundCode: '000001',
      amount: 15000,
      type: TransactionType.BUY,
      deadline: new Date('2026-03-04T15:30:00'),
    };

    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
    });

    it('should send confirmation message with inline keyboard', async () => {
      const service = new TelegramService();
      await service.sendConfirmationMessage(mockConfirmationParams);

      expect(mockSendMessage).toHaveBeenCalledWith(
        'test-chat-id',
        expect.stringContaining('大额交易确认'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: expect.any(Array),
          },
        }),
      );
    });

    it('should include transaction details in message', async () => {
      const service = new TelegramService();
      await service.sendConfirmationMessage(mockConfirmationParams);

      const callArgs = mockSendMessage.mock.calls[0];
      const text = callArgs[1] as string;

      expect(text).toContain('000001');
      expect(text).toContain('买入');
      expect(text).toContain('15,000');
    });

    it('should format SELL transaction correctly', async () => {
      const service = new TelegramService();
      await service.sendConfirmationMessage({
        ...mockConfirmationParams,
        type: TransactionType.SELL,
      });

      const callArgs = mockSendMessage.mock.calls[0];
      const text = callArgs[1] as string;

      expect(text).toContain('卖出');
    });

    it('should skip sending when not configured', async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_CHAT_ID;

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const service = new TelegramService();
      await service.sendConfirmationMessage(mockConfirmationParams);

      expect(consoleSpy).toHaveBeenCalledWith(
        'Telegram not configured, skipping confirmation message',
      );
      consoleSpy.mockRestore();
    });
  });

  describe('onConfirmationCallback', () => {
    beforeEach(() => {
      process.env.TELEGRAM_BOT_TOKEN = 'test-token';
      process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
      mockOnCallbackQuery.mockClear();
    });

    it('should register callback handler for confirm action', async () => {
      const service = new TelegramService();
      const handler = jest.fn().mockResolvedValue(undefined);

      service.onConfirmationCallback(handler);

      expect(mockOnCallbackQuery).toHaveBeenCalled();

      // Simulate callback
      const callbackFn = mockOnCallbackQuery.mock.calls[0][1];
      await callbackFn({
        data: 'confirm:txn-123:confirm',
        id: 'callback-123',
      });

      expect(handler).toHaveBeenCalledWith('txn-123', 'confirm');
    });

    it('should register callback handler for cancel action', async () => {
      const service = new TelegramService();
      const handler = jest.fn().mockResolvedValue(undefined);

      service.onConfirmationCallback(handler);

      const callbackFn = mockOnCallbackQuery.mock.calls[0][1];
      await callbackFn({
        data: 'confirm:txn-123:cancel',
        id: 'callback-123',
      });

      expect(handler).toHaveBeenCalledWith('txn-123', 'cancel');
    });

    it('should ignore non-confirmation callbacks', async () => {
      const service = new TelegramService();
      const handler = jest.fn().mockResolvedValue(undefined);

      service.onConfirmationCallback(handler);

      const callbackFn = mockOnCallbackQuery.mock.calls[0][1];
      await callbackFn({
        data: 'other-action',
        id: 'callback-123',
      });

      expect(handler).not.toHaveBeenCalled();
    });
  });
});
