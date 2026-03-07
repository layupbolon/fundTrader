import { test, expect } from '@playwright/test';
import { E2E_PASSWORD, randomUsername, registerByUI } from './helpers';

test('should create strategy and show it in list @smoke', async ({ page }) => {
  const username = randomUsername('strategy');
  const strategyName = `策略_${Date.now().toString(36)}`;

  await registerByUI(page, username, E2E_PASSWORD);

  await page.getByTestId('nav-link-strategies').click();
  await expect(page).toHaveURL(/\/strategies$/);

  await page.getByTestId('new-strategy-button').click();
  await expect(page).toHaveURL(/\/strategies\/new$/);

  await page.getByTestId('strategy-name-input').fill(strategyName);
  await page.getByTestId('strategy-fund-code-input').fill('110011');
  await page.getByTestId('auto-invest-amount-input').fill('1000');

  await page.getByTestId('strategy-save-button').click();
  await page.getByTestId('strategy-confirm-save-button').click();

  await expect(page).toHaveURL(/\/strategies$/);
  await expect(page.getByText(strategyName)).toBeVisible();
});
