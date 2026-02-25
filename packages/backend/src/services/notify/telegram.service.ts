import { Injectable } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';

interface NotifyMessage {
  title: string;
  content: string;
  level?: 'info' | 'warning' | 'error';
}

@Injectable()
export class TelegramService {
  private bot: TelegramBot;
  private chatId: string;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;

    if (token && this.chatId) {
      this.bot = new TelegramBot(token, { polling: false });
    }
  }

  async sendMessage(message: NotifyMessage): Promise<void> {
    if (!this.bot || !this.chatId) {
      console.warn('Telegram not configured, skipping notification');
      return;
    }

    try {
      const emoji = this.getEmoji(message.level);
      const text = `${emoji} *${message.title}*\n\n${message.content}`;

      await this.bot.sendMessage(this.chatId, text, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      console.error('Failed to send Telegram message:', error);
    }
  }

  private getEmoji(level?: string): string {
    switch (level) {
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  }
}
