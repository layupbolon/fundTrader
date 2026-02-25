import { Injectable } from '@nestjs/common';
import * as lark from '@larksuiteoapi/node-sdk';

interface NotifyMessage {
  title: string;
  content: string;
  level?: 'info' | 'warning' | 'error';
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
