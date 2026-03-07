import { test, expect } from '@playwright/test';
import { E2E_PASSWORD, createTransactionViaApi, randomUsername, registerByUI } from './helpers';

test('should filter transactions and run batch operations', async ({ page, request }) => {
  const username = randomUsername('tx');

  await registerByUI(page, username, E2E_PASSWORD);

  await createTransactionViaApi(request, page, {
    fund_code: '110011',
    type: 'BUY',
    amount: 200,
  });
  await createTransactionViaApi(request, page, {
    fund_code: '110011',
    type: 'BUY',
    amount: 300,
  });

  await page.getByTestId('nav-link-transactions').click();
  await expect(page).toHaveURL(/\/transactions$/);

  await page.getByTestId('transactions-fund-filter-input').fill('110011');
  await page.getByTestId('transactions-query-button').click();

  await page.getByTestId('transactions-select-all-checkbox').check();
  await page.getByTestId('transactions-batch-cancel-button').click();
  await page.getByTestId('transactions-confirm-cancel-button').click();
  await expect(page.getByText(/批量撤单完成/)).toBeVisible();

  await createTransactionViaApi(request, page, {
    fund_code: '110011',
    type: 'BUY',
    amount: 260,
  });
  await createTransactionViaApi(request, page, {
    fund_code: '110011',
    type: 'BUY',
    amount: 360,
  });

  await page.getByTestId('transactions-query-button').click();
  await page.getByTestId('transactions-select-all-checkbox').check();
  await page.getByTestId('transactions-batch-refresh-button').click();
  await expect(page.getByText(/批量刷新完成/)).toBeVisible();
});
