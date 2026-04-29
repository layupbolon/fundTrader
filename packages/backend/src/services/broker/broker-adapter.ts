export const BROKER_ADAPTER = Symbol('BROKER_ADAPTER');

export interface BrokerContext {
  userId?: string;
  transactionId?: string;
  dryRun?: boolean;
}

export interface BrokerSession {
  cookies: any[];
  expiresAt: Date;
}

export interface BrokerOrder {
  id: string;
  fundCode: string;
  amount: number;
  status: string;
}

export interface BrokerOrderStatus {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';
  shares?: number;
  price?: number;
  reason?: string;
}

export interface BrokerAdapter {
  login(username: string, password: string, context?: BrokerContext): Promise<BrokerSession>;
  buyFund(fundCode: string, amount: number, context?: BrokerContext): Promise<BrokerOrder>;
  sellFund(fundCode: string, shares: number, context?: BrokerContext): Promise<BrokerOrder>;
  getOrderStatus(orderId: string, context?: BrokerContext): Promise<BrokerOrderStatus>;
  cancelOrder(
    orderId: string,
    context?: BrokerContext,
  ): Promise<{ id: string; status: 'CANCELLED' }>;
  keepAlive(context?: BrokerContext): Promise<void>;
}
