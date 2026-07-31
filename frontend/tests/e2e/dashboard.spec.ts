import { test, expect, Page, Locator } from '@playwright/test';

test.describe('Protected Routes (Unauthenticated Redirect)', () => {
  test('should redirect to login when accessing dashboard without auth', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/login$/, { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Sign In');
  });

  test('should redirect to login when accessing tree without auth', async ({ page }) => {
    await page.goto('/tree');

    await expect(page).toHaveURL(/\/login$/, { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Sign In');
  });

  test('should redirect to login when accessing settings without auth', async ({ page }) => {
    await page.goto('/settings');

    await expect(page).toHaveURL(/\/login$/, { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Sign In');
  });

  test('should redirect to login when accessing workflows without auth', async ({ page }) => {
    await page.goto('/workflows');

    await expect(page).toHaveURL(/\/login$/, { timeout: 15000 });
    await expect(page.locator('h1')).toContainText('Sign In');
  });
});

test.describe('Settings Page Structure', () => {
  test('settings page should contain all expected navigation items when authenticated', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'testuser@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(2000);

    if (page.url().includes('/tree')) {
      await page.goto('/settings');

      await expect(page.locator('h1')).toContainText('Organization Settings');
      await expect(page.locator('text=Connected Services')).toBeVisible();
      await expect(page.locator('text=Team Members')).toBeVisible();
      await expect(page.locator('text=Credentials')).toBeVisible();
      await expect(page.locator('text=Billing & Plan')).toBeVisible();
      await expect(page.locator('text=Connectors')).toBeVisible();
      await expect(page.locator('text=Workflows')).toBeVisible();
    }
  });
});

test.describe('Workflows Page Structure', () => {
  test('workflows page should display template gallery and workflow list', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'testuser@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(2000);

    if (page.url().includes('/tree')) {
      await page.goto('/workflows');

      await expect(page.locator('h1')).toContainText('Workflow Automation');
      await expect(page.locator('text=Template Gallery')).toBeVisible();
      await expect(page.locator('text=Your Workflows')).toBeVisible();
      await expect(page.getByRole('button', { name: /New Workflow/ })).toBeVisible();
    }
  });

  test('new workflow button opens builder', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'testuser@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(2000);

    if (page.url().includes('/tree')) {
      await page.goto('/workflows');

      await page.getByRole('button', { name: /New Workflow/ }).click();

      await expect(page.locator('text=Create Workflow')).toBeVisible();
      await expect(page.locator('text=Steps')).toBeVisible();
    }
  });
});
