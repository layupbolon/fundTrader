import { test, expect } from '@playwright/test';
import { E2E_PASSWORD, loginByUI, randomUsername, registerByUI } from './helpers';

test('should redirect unauthenticated user to login @smoke', async ({ page }) => {
  await page.goto('/strategies');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId('login-form')).toBeVisible();
});

test('should register, logout, and login successfully @smoke', async ({ page }) => {
  const username = randomUsername('auth');

  await registerByUI(page, username, E2E_PASSWORD);
  await expect(page.getByTestId('nav-link-dashboard')).toBeVisible();

  await page.getByTestId('logout-button').click();
  await expect(page).toHaveURL(/\/login$/);

  await loginByUI(page, username, E2E_PASSWORD);
  await expect(page.getByTestId('nav-link-dashboard')).toBeVisible();
});
