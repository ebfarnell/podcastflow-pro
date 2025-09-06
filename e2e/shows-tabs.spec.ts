import { test, expect } from '@playwright/test'

test.describe('Show Page Tabs', () => {
  // Use a test show ID that exists in the database
  const showId = '123' // Replace with actual show ID from your data
  const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000'

  test.beforeEach(async ({ page }) => {
    // Login as admin to see all tabs
    await page.goto(`${baseUrl}/login`)
    await page.fill('input[name="email"]', 'admin@podcastflow.pro')
    await page.fill('input[name="password"]', 'admin123')
    await page.click('button[type="submit"]')
    
    // Wait for redirect to dashboard
    await page.waitForURL(/dashboard|shows/)
    
    // Navigate to show detail page
    await page.goto(`${baseUrl}/shows/${showId}`)
  })

  test('should display all tabs for admin user', async ({ page }) => {
    // Check all tabs are visible
    await expect(page.getByRole('tab', { name: 'Episodes' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Campaigns' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Revenue Projections' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Rate History' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Category Exclusivity' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Rate Analytics' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Settings' })).toBeVisible()
  })

  test('should navigate between tabs and update URL', async ({ page }) => {
    // Click on Rate History tab
    await page.getByRole('tab', { name: 'Rate History' }).click()
    
    // Check URL updated
    await expect(page).toHaveURL(new RegExp(`\\?tab=rateHistory`))
    
    // Check Rate History content is visible
    await expect(page.getByRole('tabpanel', { name: /rate history/i })).toBeVisible()
    
    // Click on Settings tab
    await page.getByRole('tab', { name: 'Settings' }).click()
    
    // Check URL updated
    await expect(page).toHaveURL(new RegExp(`\\?tab=settings`))
    
    // Check Settings content is visible
    await expect(page.getByLabel('Show Name')).toBeVisible()
  })

  test('should persist tab selection on page refresh', async ({ page }) => {
    // Navigate to Category Exclusivity tab
    await page.getByRole('tab', { name: 'Category Exclusivity' }).click()
    await expect(page).toHaveURL(new RegExp(`\\?tab=exclusivity`))
    
    // Refresh the page
    await page.reload()
    
    // Check that Category Exclusivity tab is still selected
    await expect(page).toHaveURL(new RegExp(`\\?tab=exclusivity`))
    await expect(page.getByRole('tabpanel', { name: /category exclusivity/i })).toBeVisible()
  })

  test('should handle direct URL navigation to specific tab', async ({ page }) => {
    // Navigate directly to Rate Analytics tab via URL
    await page.goto(`${baseUrl}/shows/${showId}?tab=rateAnalytics`)
    
    // Check that Rate Analytics tab is selected and content is visible
    await expect(page.getByRole('tabpanel', { name: /rate analytics/i })).toBeVisible()
  })

  test('Settings tab should show correct form fields', async ({ page }) => {
    // Click on Settings tab
    await page.getByRole('tab', { name: 'Settings' }).click()
    
    // Check for Settings-specific form fields
    await expect(page.getByLabel('Show Name')).toBeVisible()
    await expect(page.getByLabel('Description')).toBeVisible()
    await expect(page.getByLabel('Host')).toBeVisible()
    await expect(page.getByLabel('Category')).toBeVisible()
    await expect(page.getByLabel('Website')).toBeVisible()
    await expect(page.getByLabel('Twitter')).toBeVisible()
    await expect(page.getByLabel('Instagram')).toBeVisible()
    await expect(page.getByLabel('Facebook')).toBeVisible()
    
    // Check for action buttons
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible()
  })

  test('should handle browser back/forward navigation', async ({ page }) => {
    // Navigate through multiple tabs
    await page.getByRole('tab', { name: 'Campaigns' }).click()
    await page.waitForTimeout(100)
    
    await page.getByRole('tab', { name: 'Rate History' }).click()
    await page.waitForTimeout(100)
    
    await page.getByRole('tab', { name: 'Settings' }).click()
    await page.waitForTimeout(100)
    
    // Use browser back button
    await page.goBack()
    await expect(page).toHaveURL(new RegExp(`\\?tab=rateHistory`))
    
    await page.goBack()
    await expect(page).toHaveURL(new RegExp(`\\?tab=campaigns`))
    
    // Use browser forward button
    await page.goForward()
    await expect(page).toHaveURL(new RegExp(`\\?tab=rateHistory`))
  })
})

test.describe('Show Page Tabs - Non-Admin User', () => {
  const showId = '123'
  const baseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000'

  test('should hide restricted tabs for client user', async ({ page }) => {
    // Login as client user
    await page.goto(`${baseUrl}/login`)
    await page.fill('input[name="email"]', 'client@podcastflow.pro')
    await page.fill('input[name="password"]', 'client123')
    await page.click('button[type="submit"]')
    
    await page.waitForURL(/dashboard|shows/)
    await page.goto(`${baseUrl}/shows/${showId}`)
    
    // Check visible tabs
    await expect(page.getByRole('tab', { name: 'Episodes' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Campaigns' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Revenue Projections' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Settings' })).toBeVisible()
    
    // Check restricted tabs are hidden
    await expect(page.getByRole('tab', { name: 'Rate History' })).not.toBeVisible()
    await expect(page.getByRole('tab', { name: 'Category Exclusivity' })).not.toBeVisible()
    await expect(page.getByRole('tab', { name: 'Rate Analytics' })).not.toBeVisible()
  })
})