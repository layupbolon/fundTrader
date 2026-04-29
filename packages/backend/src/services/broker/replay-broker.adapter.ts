import { Injectable } from '@nestjs/common';
import {
  BrokerAdapter,
  BrokerContext,
  BrokerOrder,
  BrokerOrderStatus,
  BrokerSession,
} from './broker-adapter';

@Injectable()
export class ReplayBrokerAdapter implements BrokerAdapter {
  private readonly mock = new Map<string, BrokerOrderStatus>();

  async login(_username: string, _password: string): Promise<BrokerSession> {
    return { cookies: [], expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) };
  }

  async buyFund(fundCode: string, amount: number, context?: BrokerContext): Promise<BrokerOrder> {
    return this.recordOrder('REPLAY_BUY', fundCode, amount, context);
  }

  async sellFund(fundCode: string, shares: number, context?: BrokerContext): Promise<BrokerOrder> {
    return this.recordOrder('REPLAY_SELL', fundCode, shares, context);
  }

  async getOrderStatus(orderId: string): Promise<BrokerOrderStatus> {
    return this.mock.get(orderId) || { id: orderId, status: 'CONFIRMED', shares: 100, price: 1 };
  }

  async cancelOrder(orderId: string): Promise<{ id: string; status: 'CANCELLED' }> {
    this.mock.set(orderId, { id: orderId, status: 'CANCELLED' });
    return { id: orderId, status: 'CANCELLED' };
  }

  async keepAlive(): Promise<void> {}

  private recordOrder(
    prefix: string,
    fundCode: string,
    amount: number,
    context?: BrokerContext,
  ): BrokerOrder {
    const id = `${prefix}_${context?.transactionId || Date.now()}`;
    this.mock.set(id, { id, status: 'PENDING' });
    return { id, fundCode, amount, status: 'PENDING' };
  }
}
