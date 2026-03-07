import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createE2EApp } from '../../create-e2e-app';
import { registerAndLogin } from '../../auth-utils';
import { resetDatabase, seedFund, seedRiskLimit } from '../../db-utils';
import { RiskLimitType, Strategy, Transaction, TransactionType } from '../../../../src/models';

describe('API Smoke - Strategy & Transaction', () => {
  jest.setTimeout(30_000);

  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createE2EApp();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
    await seedFund(dataSource, {
      code: '110011',
      name: '易方达中小盘',
      type: '混合型',
      manager: '张三',
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should create strategy with valid config', async () => {
    const auth = await registerAndLogin(app.getHttpServer());

    const createRes = await request(app.getHttpServer())
      .post('/api/strategies')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({
        name: '每周定投测试',
        type: 'AUTO_INVEST',
        fund_code: '110011',
        enabled: true,
        config: {
          amount: 1000,
          frequency: 'WEEKLY',
          day_of_week: 1,
        },
      })
      .expect(201);

    expect(createRes.body.name).toBe('每周定投测试');
    expect(createRes.body.type).toBe('AUTO_INVEST');
    expect(createRes.body.fund_code).toBe('110011');

    const strategyRepo = dataSource.getRepository(Strategy);
    const strategy = await strategyRepo.findOne({ where: { id: createRes.body.id } });
    expect(strategy).toBeTruthy();
  });

  it('should create pending confirmation transaction when threshold exceeded', async () => {
    const auth = await registerAndLogin(app.getHttpServer());

    await seedRiskLimit(dataSource, {
      userId: auth.user.id,
      type: RiskLimitType.SINGLE_TRADE_CONFIRM_THRESHOLD,
      limitValue: 100,
      description: '大额确认阈值',
    });

    const txRes = await request(app.getHttpServer())
      .post('/api/transactions')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({
        fund_code: '110011',
        type: TransactionType.BUY,
        amount: 1000,
      })
      .expect(201);

    expect(txRes.body.requires_confirmation).toBe(true);
    expect(txRes.body.status).toBe('PENDING');

    const txRepo = dataSource.getRepository(Transaction);
    const storedTx = await txRepo.findOne({ where: { id: txRes.body.id } });
    expect(storedTx).toBeTruthy();
    expect(storedTx?.requires_confirmation).toBe(true);
    expect(storedTx?.order_id).toBeFalsy();
  });
});
