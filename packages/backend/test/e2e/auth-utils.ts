import request from 'supertest';

export interface AuthUser {
  id: string;
  username: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
  username: string;
  password: string;
}

export async function registerAndLogin(
  httpServer: any,
  options?: { username?: string; password?: string },
): Promise<AuthResult> {
  const suffix = Date.now().toString(36);
  const username = options?.username ?? `e2e_user_${suffix}`;
  const password = options?.password ?? 'securePass123';

  const registerRes = await request(httpServer)
    .post('/api/auth/register')
    .send({ username, password })
    .expect(201);

  const loginRes = await request(httpServer)
    .post('/api/auth/login')
    .send({ username, password })
    .expect(201);

  return {
    token: loginRes.body.access_token,
    user: registerRes.body.user,
    username,
    password,
  };
}
