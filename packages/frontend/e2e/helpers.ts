import { APIRequestContext, expect, Page } from '@playwright/test';

export const E2E_PASSWORD = 'securePass123';

export function randomUsername(prefix: string = 'web'): string {
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}_${suffix}`;
}

export async function registerByUI(page: Page, username: string, password: string = E2E_PASSWORD) {
  await page.goto('/register');
  await page.getByTestId('register-username-input').fill(username);
  await page.getByTestId('register-password-input').fill(password);
  await page.getByTestId('register-confirm-password-input').fill(password);
  await page.getByTestId('register-submit-button').click();
  await expect(page).toHaveURL(/\/$/);
}

export async function loginByUI(page: Page, username: string, password: string = E2E_PASSWORD) {
  await page.goto('/login');
  await page.getByTestId('login-username-input').fill(username);
  await page.getByTestId('login-password-input').fill(password);
  await page.getByTestId('login-submit-button').click();
  await expect(page).toHaveURL(/\/$/);
}

export async function getAuthToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('fundtrader_token'));
  if (!token) {
    throw new Error('Missing auth token in localStorage');
  }
  return token;
}

export async function createTransactionViaApi(
  request: APIRequestContext,
  page: Page,
  payload: { fund_code: string; type: 'BUY' | 'SELL'; amount: number },
): Promise<void> {
  const token = await getAuthToken(page);
  const response = await request.post('http://127.0.0.1:3000/api/transactions', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data: payload,
  });

  expect(response.ok()).toBeTruthy();
}
