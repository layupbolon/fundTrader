import { test, expect } from '@playwright/test';
import { E2E_PASSWORD, randomUsername, registerByUI } from './helpers';

test('should toggle, edit, and delete strategy', async ({ page }) => {
  const username = randomUsername('lifecycle');
  const strategyName = `生命周期_${Date.now().toString(36)}`;
  const updatedName = `${strategyName}_updated`;

  await registerByUI(page, username, E2E_PASSWORD);

  await page.getByTestId('nav-link-strategies').click();
  await page.getByTestId('new-strategy-button').click();

  await page.getByTestId('strategy-name-input').fill(strategyName);
  await page.getByTestId('strategy-fund-code-input').fill('110011');
  await page.getByTestId('auto-invest-amount-input').fill('800');
  await page.getByTestId('strategy-save-button').click();
  await page.getByTestId('strategy-confirm-save-button').click();
  await expect(page).toHaveURL(/\/strategies$/);

  const card = page
    .locator('[data-testid^="strategy-card-"]')
    .filter({ hasText: strategyName })
    .first();
  await expect(card).toBeVisible();

  await card.locator('[role="switch"]').click();
  await expect(card.getByText('已暂停')).toBeVisible();

  await card.locator('[data-testid^="strategy-edit-"]').click();
  await expect(page).toHaveURL(/\/strategies\/.+\/edit$/);
  await page.getByTestId('strategy-name-input').fill(updatedName);
  await page.getByTestId('strategy-save-button').click();
  await page.getByTestId('strategy-confirm-save-button').click();
  await expect(page).toHaveURL(/\/strategies$/);
  await expect(page.getByText(updatedName)).toBeVisible();

  const updatedCard = page
    .locator('[data-testid^="strategy-card-"]')
    .filter({ hasText: updatedName })
    .first();
  await updatedCard.locator('[data-testid^="strategy-delete-"]').click();
  await updatedCard.getByRole('button', { name: '确认' }).click();

  await expect(page.getByText(updatedName)).not.toBeVisible();
});
