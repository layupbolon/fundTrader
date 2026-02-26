import { Injectable } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { FeishuService } from './feishu.service';

/**
 * 通知消息接口
 *
 * 定义通知消息的标准格式，支持多种通知级别。
 */
interface NotifyMessage {
  /**
   * 通知标题
   * 简短描述通知的主要内容
   */
  title: string;

  /**
   * 通知内容
   * 详细的通知信息，支持多行文本
   */
  content: string;

  /**
   * 通知级别（可选）
   * - info: 普通信息（如定投执行成功）
   * - warning: 警告信息（如止盈止损触发）
   * - error: 错误信息（如交易失败）
   */
  level?: 'info' | 'warning' | 'error';
}

/**
 * 通知服务
 *
 * 统一的通知发送接口，支持多渠道并行通知。
 * 当前支持 Telegram 和飞书两种通知渠道。
 *
 * 核心功能：
 * - 多渠道并行发送通知
 * - 统一的消息格式
 * - 自动处理发送失败
 *
 * 使用场景：
 * - 定投执行成功/失败通知
 * - 止盈止损触发通知
 * - 系统错误告警
 * - 交易确认通知
 *
 * 配置要求：
 * - 至少配置一个通知渠道（Telegram 或飞书）
 * - 通过环境变量配置各渠道的凭证
 *
 * @example
 * await notifyService.send({
 *   title: '定投执行成功',
 *   content: '基金 000001 买入 500 元\n订单号: ORDER123',
 *   level: 'info'
 * });
 */
@Injectable()
export class NotifyService {
  constructor(
    private telegramService: TelegramService,
    private feishuService: FeishuService,
  ) {}

  /**
   * 发送通知
   *
   * 并行发送通知到所有配置的渠道（Telegram 和飞书）。
   * 使用 Promise.all 确保所有渠道都尝试发送，即使某个渠道失败也不影响其他渠道。
   *
   * @param message 通知消息
   * @returns Promise，所有渠道发送完成后 resolve
   *
   * @example
   * // 发送普通信息
   * await notifyService.send({
   *   title: '定投执行成功',
   *   content: '基金 000001 买入 500 元',
   *   level: 'info'
   * });
   *
   * @example
   * // 发送警告信息
   * await notifyService.send({
   *   title: '止盈触发',
   *   content: '基金 000001 收益率达到 20%\n已卖出 50% 仓位',
   *   level: 'warning'
   * });
   *
   * @example
   * // 发送错误信息
   * await notifyService.send({
   *   title: '交易失败',
   *   content: '基金 000001 买入失败\n错误: 余额不足',
   *   level: 'error'
   * });
   */
  async send(message: NotifyMessage): Promise<void> {
    // 并行发送到所有渠道
    // 即使某个渠道失败，其他渠道仍会继续发送
    await Promise.all([
      this.telegramService.sendMessage(message),
      this.feishuService.sendMessage(message),
    ]);
  }
}
