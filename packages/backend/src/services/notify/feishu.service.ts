import { Injectable } from '@nestjs/common';
import * as lark from '@larksuiteoapi/node-sdk';
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
export class FeishuService {
  private client: lark.Client;
  private userId: string;

  constructor() {
    const appId = process.env.FEISHU_APP_ID;
    const appSecret = process.env.FEISHU_APP_SECRET;
    this.userId = process.env.FEISHU_USER_ID;

    if (appId && appSecret && this.userId) {
      this.client = new lark.Client({
        appId,
        appSecret,
      });
    }
  }

  /**
   * 发送交易确认消息
   *
   * 使用飞书交互卡片实现确认/取消按钮。
   * 用户点击按钮后，通过交互接口处理确认/取消操作。
   *
   * @param params 确认请求参数
   * @returns Promise，消息发送完成后 resolve
   */
  async sendConfirmationMessage(params: ConfirmationRequestParams): Promise<void> {
    if (!this.client || !this.userId) {
      console.warn('Feishu not configured, skipping confirmation message');
      return;
    }

    try {
      const actionText = params.type === TransactionType.BUY ? '买入' : '卖出';
      const deadlineStr = new Date(params.deadline).toLocaleString('zh-CN');

      // 创建飞书交互卡片
      // 参考：https://open.feishu.cn/document/ukTMukTMukTM/uEjNwUjLxYDM1MSM2ATN
      const cardContent = {
        config: {
          wide_screen_mode: true,
        },
        elements: [
          {
            tag: 'div',
            text: {
              content: `**⚠️ 大额交易确认**`,
              tag: 'lark_md',
            },
          },
          {
            tag: 'div',
            fields: [
              {
                is_short: true,
                text: {
                  tag: 'lark_md',
                  content: `**基金代码**\n${params.fundCode}`,
                },
              },
              {
                is_short: true,
                text: {
                  tag: 'lark_md',
                  content: `**交易类型**\n${actionText}`,
                },
              },
              {
                is_short: true,
                text: {
                  tag: 'lark_md',
                  content: `**交易金额**\n¥${params.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
                },
              },
              {
                is_short: true,
                text: {
                  tag: 'lark_md',
                  content: `**确认截止**\n${deadlineStr}`,
                },
              },
            ],
          },
          {
            tag: 'hr',
          },
          {
            tag: 'div',
            text: {
              content: '⏰ 请在截止时间前确认，逾期交易将自动取消。',
              tag: 'lark_md',
            },
          },
          {
            tag: 'action',
            actions: [
              {
                tag: 'button',
                text: {
                  tag: 'plain_text',
                  content: '✅ 确认交易',
                },
                style: 'primary',
                url: `https://api.example.com/trading/confirm/${params.transactionId}`,
                type: 'default',
              },
              {
                tag: 'button',
                text: {
                  tag: 'plain_text',
                  content: '❌ 取消交易',
                },
                style: 'red',
                url: `https://api.example.com/trading/cancel/${params.transactionId}`,
                type: 'default',
              },
            ],
          },
        ],
        header: {
          template: 'warning',
          title: {
            content: '交易确认通知',
            tag: 'plain_text',
          },
        },
      };

      await this.client.im.message.create({
        params: {
          receive_id_type: 'user_id',
        },
        data: {
          receive_id: this.userId,
          msg_type: 'interactive',
          content: JSON.stringify(cardContent),
        },
      });
    } catch (error) {
      console.error('Failed to send Feishu confirmation message:', error);
    }
  }

  async sendMessage(message: NotifyMessage): Promise<void> {
    if (!this.client || !this.userId) {
      console.warn('Feishu not configured, skipping notification');
      return;
    }

    try {
      await this.client.im.message.create({
        params: {
          receive_id_type: 'user_id',
        },
        data: {
          receive_id: this.userId,
          msg_type: 'text',
          content: JSON.stringify({
            text: `${message.title}\n${message.content}`,
          }),
        },
      });
    } catch (error) {
      console.error('Failed to send Feishu message:', error);
    }
  }
}
