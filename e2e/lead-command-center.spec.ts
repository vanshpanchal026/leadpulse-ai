import { test, expect } from '@playwright/test';

test.describe('Lead Command Center E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the dashboard with correct title and header', async ({ page }) => {
    await expect(page).toHaveTitle(/Lead Command Center/);
    await expect(page.getByText('DELHI NCR HIGH-TICKET PROSPECT PIPELINE')).toBeVisible();
    await expect(page.getByRole('button', { name: /Delhi Clinic Leads/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Outreach Approval Queue/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Autonomous Research/i })).toBeVisible();
  });

  test('should switch views between Leads, Outreach Queue, and Research', async ({ page }) => {
    // Switch to Outreach Approval Queue
    const outreachTab = page.getByRole('button', { name: /Outreach Approval Queue/i });
    await outreachTab.click();
    await expect(page.getByText('Strict Human Approval Boundary')).toBeVisible();

    // Switch to Autonomous Research
    const researchTab = page.getByRole('button', { name: /Autonomous Research/i });
    await researchTab.click();
    await expect(page.getByText('Campaign Intelligence Swarm')).toBeVisible();

    // Switch back to Leads
    const leadsTab = page.getByRole('button', { name: /Delhi Clinic Leads/i });
    await leadsTab.click();
    await expect(page.getByText('DELHI NCR HIGH-TICKET PROSPECT PIPELINE')).toBeVisible();
  });

  test('should open and close the Scraper Modal', async ({ page }) => {
    const quickScraperBtn = page.getByRole('button', { name: /Quick Scraper/i });
    await quickScraperBtn.click();

    // Verify modal appears
    const modalTitle = page.getByText('Autonomous Lead Scraper');
    await expect(modalTitle).toBeVisible();

    // Close modal
    const closeBtn = page.locator('button:has(svg.lucide-x)').first();
    await closeBtn.click();
    await expect(modalTitle).not.toBeVisible();
  });

  test('should open and close the Start Research Modal', async ({ page }) => {
    const startResearchBtn = page.getByRole('button', { name: /Start Research/i });
    await startResearchBtn.click();

    // Modal dialog should appear
    const modalHeader = page.getByText(/Launch Autonomous Research Swarm|Research Campaign/i).first();
    await expect(modalHeader).toBeVisible();

    // Close the modal
    const closeBtn = page.locator('button:has(svg.lucide-x)').first();
    await closeBtn.click();
    await expect(modalHeader).not.toBeVisible();
  });

  test('should filter leads by search query', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search clinics, areas, phone, friction points...');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('Dental');
    await expect(searchInput).toHaveValue('Dental');
  });

  test('API: /api/leads should respond with valid JSON data', async ({ request }) => {
    const response = await request.get('/api/leads');
    expect(response.status()).toBe(200);
    const data = await response.json();
    const leadsList = Array.isArray(data) ? data : data.leads;
    expect(Array.isArray(leadsList)).toBeTruthy();
    expect(leadsList.length).toBeGreaterThan(0);
  });
});
