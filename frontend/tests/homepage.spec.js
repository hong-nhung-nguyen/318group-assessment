import { test, expect } from '@playwright/test';

const liveCatalogue = route => {
  const path = new URL(route.request().url()).pathname;
  const data = path.endsWith('/availability') ? { availableCapacity: 2 }
    : path.endsWith('/departures') ? [{ departureId: 10, startDate: '2030-05-01', endDate: '2030-05-08', price: 1400, capacity: 20, status: 'AVAILABLE' }]
    : [{ packageId: 1, name: 'Live Tokyo Escape', destination: 'Tokyo, Japan', description: 'A live catalogue trip.' }];
  return route.fulfill({ json: data });
};

test('offline catalogue shows labelled samples, functional search and accessible details', async ({ page }) => {
  await page.route('**/catalogue-api/**', route => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Featured Packages' })).toBeVisible();
  await expect(page.locator('article')).toHaveCount(3);
  await expect(page.getByText('Showing sample trips')).toBeVisible();
  await page.getByPlaceholder('Where to?').fill('tokyo');
  await page.getByRole('button', { name: 'Search Trips' }).click();
  await expect(page.locator('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'View Details' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('This is a sample itinerary')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Departure date', { exact: true }).fill('2030-05-01');
  await page.getByRole('button', { name: 'Search Trips' }).click();
  await expect(page.getByText('A different adventure awaits')).toBeVisible();
});

test('live filters use departure price and remaining capacity and AI sends form preferences', async ({ page }) => {
  await page.route('**/catalogue-api/**', liveCatalogue);
  await page.route('**/assistant-api/**', async route => {
    expect(route.request().postDataJSON().message).toContain('food');
    await route.fulfill({ json: { response: '**Consider the Live Tokyo Escape.** It matches your food interests.', recommendations: [{ packageId: 1, name: 'Live Tokyo Escape', destination: 'Tokyo, Japan', reason: 'Ten days of markets and sushi classes suit your love of food.' }, { packageId: 99, reason: 'Not in the catalogue.' }] } });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Live Tokyo Escape' })).toBeVisible();
  await page.getByRole('combobox', { name: 'Travellers', exact: true }).selectOption('3');
  await page.getByRole('button', { name: 'Search Trips' }).click();
  await expect(page.locator('article')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Travellers', exact: true }).selectOption('2');
  await page.getByLabel('Departure date', { exact: true }).fill('2030-05-01');
  await page.getByRole('combobox', { name: 'Budget per person' }).selectOption('1500');
  await page.getByRole('button', { name: 'Search Trips' }).click();
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.locator('article')).toContainText('1,400');
  await page.getByLabel('Interests for your AI request').fill('food');
  await page.getByRole('button', { name: 'Ask AI Instead' }).click();
  const composer = page.getByRole('textbox', { name: 'Message your travel concierge' });
  await expect(composer).toHaveValue(/My interests: food/);
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.locator('.msg.bot .bubble').last()).toContainText('Consider the Live Tokyo Escape. It matches your food interests.');
  await expect(page.getByText('Top Match')).toBeVisible();
  await expect(page.locator('.trip-card')).toContainText('1,400');
  await expect(page.locator('.trip-card')).toHaveCount(1);
  await expect(page.locator('.why p')).toHaveText('Ten days of markets and sushi classes suit your love of food.');
  await page.getByRole('button', { name: 'Select This Trip' }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Live Tokyo Escape' })).toBeVisible();
});

test('concierge chat shows greeting, suggestion chips, typing state and recovers from errors', async ({ page }) => {
  await page.route('**/catalogue-api/**', liveCatalogue);
  let calls = 0;
  await page.route('**/assistant-api/**', async route => {
    calls += 1;
    if (calls === 1) return route.abort();
    expect(route.request().postDataJSON().message).toBe('Inspire me for a weekend getaway');
    await new Promise(resolve => setTimeout(resolve, 400));
    await route.fulfill({ json: { response: 'No suitable package is currently available for a weekend getaway.' } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'AI Assistant' }).click();
  await expect(page.getByText('Voyage travel concierge')).toBeVisible();
  await expect(page.getByText(/TODAY, \d{1,2}:\d{2} [AP]M/)).toBeVisible();
  await page.getByRole('button', { name: 'Inspire me for a weekend getaway' }).click();
  await expect(page.locator('.msg.user')).toContainText('Inspire me for a weekend getaway');
  await expect(page.getByRole('alert')).toContainText('unavailable right now');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('status', { name: 'Your concierge is thinking' })).toBeVisible();
  await expect(page.getByText('No suitable package is currently available')).toBeVisible();
  await expect(page.locator('.trip-card')).toHaveCount(0);
  await expect(page.locator('.msg.user')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Send message' })).toBeDisabled();
  await page.getByRole('button', { name: 'Explore' }).click();
  await expect(page.getByRole('heading', { name: 'Featured Packages' })).toBeVisible();
});

test('desktop and mobile layouts have no horizontal overflow', async ({ page }) => {
  await page.route('**/catalogue-api/**', route => route.fulfill({ json: [] }));
  await page.route('**/assistant-api/**', route => route.fulfill({ json: { response: 'The Bali Wellness Escape suits you. Tokyo Food & Culture is a great alternative.' } }));
  for (const width of [1440, 768, 375]) {
    await page.setViewportSize({ width, height: 1050 });
    await page.goto('/');
    await expect(page.locator('article')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/voyage-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'AI Assistant' }).click();
    await page.getByRole('textbox', { name: 'Message your travel concierge' }).fill('Somewhere warm for two');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.locator('.trip-card')).toHaveCount(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/voyage-assistant-${width}.png`, fullPage: true });
  }
});
