import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { createE2EApp } from '../../create-e2e-app';
import { resetDatabase, seedFund } from '../../db-utils';

describe('API Smoke - Auth & Health', () => {
  vi.setConfig({ testTimeout: 30_000 });

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

  it('should return public health status', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('components');
    expect(res.body.components).toHaveProperty('database');
    expect(res.body.components).toHaveProperty('redis');
    expect(res.body.components).toHaveProperty('browser');
  });

  it('should register and login successfully', async () => {
    const username = `smoke_${Date.now()}`;
    const password = 'securePass123';

    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ username, password })
      .expect(201);

    expect(registerRes.body).toHaveProperty('access_token');
    expect(registerRes.body.user.username).toBe(username);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username, password })
      .expect(201);

    expect(loginRes.body).toHaveProperty('access_token');
    expect(loginRes.body.user.username).toBe(username);
  });

  it('should return 401 for protected endpoint without token', async () => {
    await request(app.getHttpServer()).get('/api/strategies').expect(401);
  });
});
