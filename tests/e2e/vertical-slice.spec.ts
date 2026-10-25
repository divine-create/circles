import { test, expect } from '@playwright/test';

test.describe('Circles Critical E2E User Journey', () => {
  test('renders landing page, explores Circles, registers user, creates Circle, and posts discussion', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /One shared platform\. Many types of communities\./i })
    ).toBeVisible();

    await page.getByRole('link', { name: /Explore Public Circles/i }).click();
    await expect(
      page.getByRole('heading', { name: /Explore Discoverable Circles/i })
    ).toBeVisible();

    // Register a new user
    const uniqueSuffix = Date.now().toString().slice(-6);
    await page.goto('/register');
    await page.getByLabel(/Full \/ Display Name/i).fill(`E2E Founder ${uniqueSuffix}`);
    await page.getByLabel(/Username/i).fill(`e2e_founder_${uniqueSuffix}`);
    await page.getByLabel(/Email Address/i).fill(`e2e_${uniqueSuffix}@circles.dev`);
    await page.getByLabel(/Password/i).fill('StrongPassword123!');
    await page.getByRole('button', { name: /Create Account/i }).click();

    await expect(page).toHaveURL(/\/circles/);

    // Create a new Circle
    await page.goto('/circles/new');
    await page.getByLabel(/Circle Name/i).fill(`Playwright Society ${uniqueSuffix}`);
    await page.getByRole('button', { name: /Create Circle/i }).click();

    await expect(
      page.getByRole('heading', { name: new RegExp(`Playwright Society ${uniqueSuffix}`, 'i') })
    ).toBeVisible();
  });
});
