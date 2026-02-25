import { Injectable } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { FeishuService } from './feishu.service';

interface NotifyMessage {
  title: string;
  content: string;
  level?: 'info' | 'warning' | 'error';
}

@Injectable()
export class NotifyService {
  constructor(
    private telegramService: TelegramService,
    private feishuService: FeishuService,
  ) {}

  async send(message: NotifyMessage): Promise<void> {
    await Promise.all([
      this.telegramService.sendMessage(message),
      this.feishuService.sendMessage(message),
    ]);
  }
}
