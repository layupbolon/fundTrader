import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createE2EApp } from '../../create-e2e-app';
import { registerAndLogin } from '../../auth-utils';
import { resetDatabase, seedFund } from '../../db-utils';
import { Transaction, TransactionStatus, TransactionType } from '../../../../src/models';

describe('API Full - Transactions', () => {
  jest.setTimeout(30_000);

  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createE2EApp();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
    await seedFund(dataSource);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  async function seedTransaction(options: {
    userId: string;
    status: TransactionStatus;
    orderId: string;
    amount?: number;
  }) {
    const repo = dataSource.getRepository(Transaction);
    return repo.save(
      repo.create({
        user_id: options.userId,
        fund_code: '110011',
        type: TransactionType.BUY,
        amount: options.amount ?? 1000,
        status: options.status,
        order_id: options.orderId,
        shares: 100,
        price: 1.2,
      }),
    );
  }

  it('should refresh single transaction status', async () => {
    const auth = await registerAndLogin(app.getHttpServer());
    const tx = await seedTransaction({
      userId: auth.user.id,
      status: TransactionStatus.PENDING,
      orderId: 'MOCK_ORDER_CONFIRMED',
    });

    const res = await request(app.getHttpServer())
      .post(`/api/transactions/${tx.id}/refresh-status`)
      .set('Authorization', `Bearer ${auth.token}`)
      .expect(201);

    expect(res.body.id).toBe(tx.id);
    expect(res.body.order_status).toBe('CONFIRMED');
    expect(res.body.status).toBe(TransactionStatus.CONFIRMED);

    const latest = await dataSource.getRepository(Transaction).findOne({ where: { id: tx.id } });
    expect(latest?.status).toBe(TransactionStatus.CONFIRMED);
  });

  it('should cancel single transaction', async () => {
    const auth = await registerAndLogin(app.getHttpServer());
    const tx = await seedTransaction({
      userId: auth.user.id,
      status: TransactionStatus.SUBMITTED,
      orderId: 'MOCK_ORDER_CANCEL_TARGET',
    });

    const res = await request(app.getHttpServer())
      .post(`/api/transactions/${tx.id}/cancel`)
      .set('Authorization', `Bearer ${auth.token}`)
      .expect(201);

    expect(res.body.id).toBe(tx.id);
    expect(res.body.status).toBe(TransactionStatus.CANCELLED);

    const latest = await dataSource.getRepository(Transaction).findOne({ where: { id: tx.id } });
    expect(latest?.status).toBe(TransactionStatus.CANCELLED);
  });

  it('should batch refresh transaction statuses', async () => {
    const auth = await registerAndLogin(app.getHttpServer());
    const t1 = await seedTransaction({
      userId: auth.user.id,
      status: TransactionStatus.PENDING,
      orderId: 'MOCK_ORDER_CONFIRMED_1',
    });

    const res = await request(app.getHttpServer())
      .post('/api/transactions/batch/refresh-status')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({ transaction_ids: [t1.id, '11111111-1111-4111-8111-111111111111'] })
      .expect(201);

    expect(res.body.total).toBe(2);
    expect(res.body.success_count).toBe(1);
    expect(res.body.failed_count).toBe(1);
  });

  it('should batch cancel transactions', async () => {
    const auth = await registerAndLogin(app.getHttpServer());
    const t1 = await seedTransaction({
      userId: auth.user.id,
      status: TransactionStatus.PENDING,
      orderId: 'MOCK_ORDER_PENDING_1',
    });
    const t2 = await seedTransaction({
      userId: auth.user.id,
      status: TransactionStatus.SUBMITTED,
      orderId: 'MOCK_ORDER_PENDING_2',
    });

    const res = await request(app.getHttpServer())
      .post('/api/transactions/batch/cancel')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({ transaction_ids: [t1.id, t2.id] })
      .expect(201);

    expect(res.body.total).toBe(2);
    expect(res.body.success_count).toBe(2);
    expect(res.body.failed_count).toBe(0);

    const txRepo = dataSource.getRepository(Transaction);
    const latest1 = await txRepo.findOne({ where: { id: t1.id } });
    const latest2 = await txRepo.findOne({ where: { id: t2.id } });
    expect(latest1?.status).toBe(TransactionStatus.CANCELLED);
    expect(latest2?.status).toBe(TransactionStatus.CANCELLED);
  });
});
