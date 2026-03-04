import { Injectable } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { TransactionType } from '../../models';

interface NotifyMessage {
  title: string;
  content: string;
  level?: 'info' | 'warning' | 'error';
}

/**
 * 确认请求参数接口
 */
export interface ConfirmationRequestParams {
  /** 交易 ID */
  transactionId: string;
  /** 基金代码 */
  fundCode: string;
  /** 交易金额 */
  amount: number;
  /** 交易类型 */
  type: TransactionType;
  /** 确认超时时间 */
  deadline: Date;
}

@Injectable()
export class TelegramService {
  private bot: TelegramBot;
  private chatId: string;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID;

    if (token && this.chatId) {
      this.bot = new TelegramBot(token, { polling: true });
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

  /**
   * 发送交易确认消息
   *
   * 使用 Telegram Inline Keyboard 实现确认/取消按钮。
   * 用户点击按钮后，通过 callback_query 处理确认/取消操作。
   *
   * @param params 确认请求参数
   * @returns Promise，消息发送完成后 resolve
   *
   * @example
   * await telegramService.sendConfirmationMessage({
   *   transactionId: 'txn-123',
   *   fundCode: '000001',
   *   amount: 10000,
   *   type: TransactionType.BUY,
   *   deadline: new Date('2026-03-04T15:30:00'),
   * });
   */
  async sendConfirmationMessage(params: ConfirmationRequestParams): Promise<void> {
    if (!this.bot || !this.chatId) {
      console.warn('Telegram not configured, skipping confirmation message');
      return;
    }

    try {
      const actionText = params.type === TransactionType.BUY ? '买入' : '卖出';
      const deadlineStr = new Date(params.deadline).toLocaleString('zh-CN');

      const text = `⚠️ **大额交易确认**

📊 **交易详情**
基金代码：${params.fundCode}
交易类型：${actionText}
交易金额：¥${params.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
确认截止：${deadlineStr}

⏰ 请在截止时间前确认，逾期交易将自动取消。`;

      // 创建 Inline Keyboard 按钮
      // callback_data 格式：confirm:txn_id:action (action = confirm/cancel)
      const replyMarkup = {
        inline_keyboard: [
          [
            {
              text: '✅ 确认交易',
              callback_data: `confirm:${params.transactionId}:confirm`,
            },
            {
              text: '❌ 取消交易',
              callback_data: `confirm:${params.transactionId}:cancel`,
            },
          ],
        ],
      };

      await this.bot.sendMessage(this.chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      });
    } catch (error) {
      console.error('Failed to send Telegram confirmation message:', error);
    }
  }

  /**
   * 注册确认回调处理器
   *
   * 监听用户点击确认/取消按钮的回调。
   * 应该在服务初始化时调用。
   *
   * @param handler 处理回调的函数，接收 transactionId 和 action
   *
   * @example
   * telegramService.onConfirmationCallback(async (transactionId, action) => {
   *   if (action === 'confirm') {
   *     await tradingConfirmationService.handleConfirmation(transactionId);
   *   } else {
   *     await tradingConfirmationService.handleCancellation(transactionId);
   *   }
   * });
   */
  onConfirmationCallback(
    handler: (transactionId: string, action: 'confirm' | 'cancel') => Promise<void>,
  ): void {
    if (!this.bot) {
      return;
    }

    this.bot.on('callback_query', async (callbackQuery) => {
      const data = callbackQuery.data;
      if (!data || !data.startsWith('confirm:')) {
        return;
      }

      // 解析 callback_data: confirm:txn_id:action
      const parts = data.split(':');
      if (parts.length !== 3) {
        return;
      }

      const transactionId = parts[1];
      const action = parts[2] as 'confirm' | 'cancel';

      try {
        await handler(transactionId, action);

        // 回复用户确认结果
        const successText = action === 'confirm' ? '✅ 交易已确认，正在执行...' : '❌ 交易已取消';

        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: successText,
          show_alert: true,
        });
      } catch (error) {
        const errorText = `处理失败：${error.message}`;
        await this.bot.answerCallbackQuery(callbackQuery.id, {
          text: errorText,
          show_alert: true,
        });
      }
    });
  }
}
