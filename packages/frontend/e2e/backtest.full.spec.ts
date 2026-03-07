import { test, expect } from '@playwright/test';
import { E2E_PASSWORD, randomUsername, registerByUI } from './helpers';

test('should submit backtest form and display result', async ({ page }) => {
  const username = randomUsername('backtest');

  await registerByUI(page, username, E2E_PASSWORD);

  await page.getByTestId('nav-link-backtest').click();
  await expect(page).toHaveURL(/\/backtest$/);

  await page.getByTestId('backtest-fund-code-input').fill('110011');
  await page.getByTestId('backtest-start-date-input').fill('2025-01-01');
  await page.getByTestId('backtest-end-date-input').fill('2025-02-15');
  await page.getByTestId('backtest-initial-capital-input').fill('10000');
  await page.getByTestId('auto-invest-amount-input').fill('500');
  await page.getByTestId('backtest-submit-button').click();

  await expect(page.getByText('历史回测结果')).toBeVisible();
  await expect(page.getByText('总收益率')).toBeVisible();
});
