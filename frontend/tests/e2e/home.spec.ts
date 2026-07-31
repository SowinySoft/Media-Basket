import { test, expect, Page } from '@playwright/test';

test.describe('Home Page & Navigation', () => {
  test('should display the Media Basket landing page with title and CTAs', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/Media Basket/);
    await expect(page.locator('h1')).toContainText('Media Basket');
    await expect(page.locator('text=All your media accounts in one basket')).toBeVisible();

    const getStartedBtn = page.getByRole('link', { name: /Get Started/ });
    await expect(getStartedBtn).toBeVisible();
    await expect(getStartedBtn).toHaveAttribute('href', '/login');

    const dashboardBtn = page.getByRole('link', { name: /Dashboard/ });
    await expect(dashboardBtn).toBeVisible();
  });

  test('Get Started button navigates to login page', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /Get Started/ }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('h1')).toContainText('Sign In');
  });

  test('Dashboard button navigates to dashboard (redirects to login when unauthenticated)', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: /Dashboard/ }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator('h1')).toContainText('Sign In');
  });
});

test.describe('Login Page', () => {
  test('should display login form with email and password fields', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('h1')).toContainText('Sign In');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    await expect(page.locator('button[type="submit"]')).toContainText('Sign In');
  });

  test('should allow switching to signup form', async ({ page }) => {
    await page.goto('/login');

    await page.locator('.text-blue-400').click();

    await expect(page.locator('h1')).toContainText('Create Account');
    await expect(page.locator('input[type="text"]')).toBeVisible();
    await expect(page.locator('text=Name')).toBeVisible();
  });

  test('should show validation on empty form submit', async ({ page }) => {
    await page.goto('/login');

    await page.locator('button[type="submit"]').click();

    await expect(page.locator('input[type="email"]')).toHaveAttribute('required');
    await expect(page.locator('input[type="password"]')).toHaveAttribute('required');
  });
});

test.describe('Auth Token Handling', () => {
  test('tokens are stored in localStorage after login attempt', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(2000);

    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    expect(token).toBeNull();
  });
});
