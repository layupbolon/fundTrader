import { MockBrokerAdapter } from '../mock-broker.adapter';

describe('MockBrokerAdapter paper trading records', () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should attach paper trading run metadata to paper orders', async () => {
    process.env = { ...originalEnv, BROKER_MODE: 'paper' };

    const adapter = new MockBrokerAdapter();
    const order = await adapter.buyFund('000001', 1000, {
      userId: 'user1',
      transactionId: 'tx-paper-1',
    });

    expect(order.id).toBe('PAPER_BUY_tx-paper-1');
    expect(order.metadata).toEqual(
      expect.objectContaining({
        mode: 'paper',
        runId: 'paper-tx-paper-1',
        userId: 'user1',
        transactionId: 'tx-paper-1',
      }),
    );
  });
});
