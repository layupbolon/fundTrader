import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createE2EApp } from '../../create-e2e-app';
import { registerAndLogin } from '../../auth-utils';
import { resetDatabase, seedFund, seedFundNavSeries } from '../../db-utils';
import { User } from '../../../../src/models';

describe('API Full - Backtest, User, Logs', () => {
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
    await seedFundNavSeries(dataSource, {
      fundCode: '110011',
      startDate: '2025-01-01',
      days: 60,
      baseNav: 1.0,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should run backtest and persist result', async () => {
    const auth = await registerAndLogin(app.getHttpServer());

    const runRes = await request(app.getHttpServer())
      .post('/api/backtest')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({
        fund_code: '110011',
        start_date: '2025-01-01',
        end_date: '2025-02-15',
        initial_capital: 10000,
        strategy_config: {
          type: 'AUTO_INVEST',
          amount: 500,
          frequency: 'WEEKLY',
          day_of_week: 1,
        },
      })
      .expect(201);

    expect(runRes.body).toHaveProperty('final_value');
    expect(runRes.body).toHaveProperty('total_return');

    const listRes = await request(app.getHttpServer())
      .get('/api/backtest?page=1&limit=10')
      .set('Authorization', `Bearer ${auth.token}`)
      .expect(200);

    expect(listRes.body.total).toBeGreaterThan(0);
    expect(listRes.body.data.length).toBeGreaterThan(0);

    const detailRes = await request(app.getHttpServer())
      .get(`/api/backtest/${listRes.body.data[0].id}`)
      .set('Authorization', `Bearer ${auth.token}`)
      .expect(200);

    expect(detailRes.body.fund_code).toBe('110011');
  });

  it('should update profile and broker credentials', async () => {
    const auth = await registerAndLogin(app.getHttpServer());

    const profileRes = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Authorization', `Bearer ${auth.token}`)
      .expect(200);

    expect(profileRes.body.username).toBe(auth.username);

    const updatedName = `updated_${Date.now().toString(36)}`;
    const updateProfileRes = await request(app.getHttpServer())
      .put('/api/users/me')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({ username: updatedName })
      .expect(200);

    expect(updateProfileRes.body.username).toBe(updatedName);

    const credentialRes = await request(app.getHttpServer())
      .put('/api/users/me/broker-credentials')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({
        platform: 'tiantian',
        username: 'broker_user',
        password: 'broker_password',
      })
      .expect(200);

    expect(credentialRes.body.has_broker_credentials).toBe(true);

    const userRepo = dataSource.getRepository(User);
    const storedUser = await userRepo.findOne({ where: { id: auth.user.id } });
    expect(storedUser?.encrypted_credentials).toBeTruthy();
    expect(JSON.stringify(storedUser?.encrypted_credentials)).not.toContain('broker_password');
  });

  it('should create and query logs with pagination and stats', async () => {
    const auth = await registerAndLogin(app.getHttpServer());

    await request(app.getHttpServer())
      .post('/api/logs')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({
        userId: auth.user.id,
        type: 'MANUAL_OPERATION',
        module: 'e2e',
        description: 'create log #1',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/logs')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({
        userId: auth.user.id,
        type: 'MANUAL_OPERATION',
        module: 'e2e',
        description: 'create log #2',
      })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/api/logs?page=1&limit=10')
      .set('Authorization', `Bearer ${auth.token}`)
      .expect(200);

    expect(listRes.body.total).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(listRes.body.data)).toBe(true);

    const now = new Date();
    const start = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const statsRes = await request(app.getHttpServer())
      .get(`/api/logs/stats/range?startTime=${encodeURIComponent(start)}&endTime=${encodeURIComponent(end)}`)
      .set('Authorization', `Bearer ${auth.token}`)
      .expect(200);

    expect(statsRes.body).toHaveProperty('total');
    expect(statsRes.body).toHaveProperty('byType');
    expect(statsRes.body).toHaveProperty('byModule');
  });
});
