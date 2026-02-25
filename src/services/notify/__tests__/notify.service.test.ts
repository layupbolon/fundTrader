import { Test, TestingModule } from '@nestjs/testing';
import { NotifyService } from '../notify.service';
import { TelegramService } from '../telegram.service';
import { FeishuService } from '../feishu.service';

describe('NotifyService', () => {
  let service: NotifyService;
  let telegramService: jest.Mocked<TelegramService>;
  let feishuService: jest.Mocked<FeishuService>;

  beforeEach(async () => {
    const mockTelegramService = {
      sendMessage: jest.fn(),
    };

    const mockFeishuService = {
      sendMessage: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotifyService,
        {
          provide: TelegramService,
          useValue: mockTelegramService,
        },
        {
          provide: FeishuService,
          useValue: mockFeishuService,
        },
      ],
    }).compile();

    service = module.get<NotifyService>(NotifyService);
    telegramService = module.get(TelegramService);
    feishuService = module.get(FeishuService);
  });

  describe('send', () => {
    it('should send message to both Telegram and Feishu', async () => {
      const message = {
        title: 'Test Title',
        content: 'Test Content',
        level: 'info' as const,
      };

      telegramService.sendMessage.mockResolvedValue(undefined);
      feishuService.sendMessage.mockResolvedValue(undefined);

      await service.send(message);

      expect(telegramService.sendMessage).toHaveBeenCalledWith(message);
      expect(feishuService.sendMessage).toHaveBeenCalledWith(message);
    });

    it('should send message without level', async () => {
      const message = {
        title: 'Test Title',
        content: 'Test Content',
      };

      telegramService.sendMessage.mockResolvedValue(undefined);
      feishuService.sendMessage.mockResolvedValue(undefined);

      await service.send(message);

      expect(telegramService.sendMessage).toHaveBeenCalledWith(message);
      expect(feishuService.sendMessage).toHaveBeenCalledWith(message);
    });

    it('should send messages in parallel', async () => {
      const message = {
        title: 'Test',
        content: 'Content',
        level: 'warning' as const,
      };

      let telegramResolved = false;
      let feishuResolved = false;

      telegramService.sendMessage.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        telegramResolved = true;
      });

      feishuService.sendMessage.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        feishuResolved = true;
      });

      const startTime = Date.now();
      await service.send(message);
      const duration = Date.now() - startTime;

      expect(telegramResolved).toBe(true);
      expect(feishuResolved).toBe(true);
      // Should complete in ~100ms (parallel) not ~200ms (sequential)
      expect(duration).toBeLessThan(150);
    });

    it('should handle error level messages', async () => {
      const message = {
        title: 'Error Occurred',
        content: 'Something went wrong',
        level: 'error' as const,
      };

      telegramService.sendMessage.mockResolvedValue(undefined);
      feishuService.sendMessage.mockResolvedValue(undefined);

      await service.send(message);

      expect(telegramService.sendMessage).toHaveBeenCalledWith(message);
      expect(feishuService.sendMessage).toHaveBeenCalledWith(message);
    });

    it('should continue if one service fails', async () => {
      const message = {
        title: 'Test',
        content: 'Content',
      };

      telegramService.sendMessage.mockRejectedValue(new Error('Telegram failed'));
      feishuService.sendMessage.mockResolvedValue(undefined);

      // Should not throw, Promise.all will reject if any promise rejects
      await expect(service.send(message)).rejects.toThrow('Telegram failed');

      expect(telegramService.sendMessage).toHaveBeenCalled();
      expect(feishuService.sendMessage).toHaveBeenCalled();
    });
  });
});
