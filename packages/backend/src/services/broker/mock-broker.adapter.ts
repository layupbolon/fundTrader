import { Injectable } from '@nestjs/common';
import {
  BrokerAdapter,
  BrokerContext,
  BrokerOrder,
  BrokerOrderStatus,
  BrokerSession,
} from './broker-adapter';

@Injectable()
export class MockBrokerAdapter implements BrokerAdapter {
  private sessions = new Map<string, BrokerSession>();

  async login(username: string, password: string, context?: BrokerContext): Promise<BrokerSession> {
    const session = {
      cookies: [{ name: 'mock-session', value: `${username}:${password.length}` }],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    this.sessions.set(context?.userId || 'default', session);
    return session;
  }

  async buyFund(fundCode: string, amount: number, context?: BrokerContext): Promise<BrokerOrder> {
    return this.createOrder('BUY', fundCode, amount, context);
  }

  async sellFund(fundCode: string, shares: number, context?: BrokerContext): Promise<BrokerOrder> {
    return this.createOrder('SELL', fundCode, shares, context);
  }

  async getOrderStatus(orderId: string): Promise<BrokerOrderStatus> {
    if (orderId.includes('FAILED'))
      return { id: orderId, status: 'FAILED', reason: 'Mock failure' };
    if (orderId.includes('CANCELLED')) return { id: orderId, status: 'CANCELLED' };
    if (orderId.includes('PENDING')) return { id: orderId, status: 'PENDING' };
    return { id: orderId, status: 'CONFIRMED', shares: 123.4567, price: 1.2345 };
  }

  async cancelOrder(orderId: string): Promise<{ id: string; status: 'CANCELLED' }> {
    return { id: orderId, status: 'CANCELLED' };
  }

  async keepAlive(context?: BrokerContext): Promise<void> {
    const key = context?.userId || 'default';
    const session = this.sessions.get(key) || { cookies: [], expiresAt: new Date() };
    session.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    this.sessions.set(key, session);
  }

  private createOrder(
    side: 'BUY' | 'SELL',
    fundCode: string,
    amount: number,
    context?: BrokerContext,
  ): BrokerOrder {
    const mode =
      process.env.BROKER_MODE === 'paper' ? 'paper' : context?.dryRun ? 'dry-run' : 'mock';
    const suffix = context?.transactionId || Date.now().toString();
    const runId = `${mode}-${suffix}`;
    return {
      id: `${mode.toUpperCase()}_${side}_${suffix}`,
      fundCode,
      amount,
      status: 'PENDING',
      metadata: {
        mode,
        runId,
        userId: context?.userId,
        transactionId: context?.transactionId,
        createdAt: new Date().toISOString(),
      },
    };
  }
}
