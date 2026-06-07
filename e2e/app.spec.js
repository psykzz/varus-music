// @ts-check
import { test, expect } from '@playwright/test'
import { uniqueUser, TEST_PASSWORD, seedAuth, apiRegister } from './helpers/utils.js'

/**
 * Register a user, complete onboarding (via API), and seed localStorage
 * so the page loads directly into the main app.
 */
async function setupLoggedInUser(page, request) {
  const username = uniqueUser('app')
  const auth = await apiRegister(request, username)
  // Complete onboarding via API so we skip the modal
  await request.post('http://localhost:3001/api/onboarding/seed', {
    headers: { Authorization: `Bearer ${auth.token}` },
    data: { genres: [], cadence: 'weekly' },
  })
  auth.user.onboardingComplete = true
  await seedAuth(page, auth)
  return auth
}

test.describe('Profile menu', () => {
  test('profile button opens the user menu', async ({ page, request }) => {
    await setupLoggedInUser(page, request)
    await page.goto('/')
    await expect(page.getByText('Varus Music').first()).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /Open user menu/i }).click()
    await expect(page.getByText('Cadence')).toBeVisible()
    await expect(page.getByText('Force Cycle')).toBeVisible()
    await expect(page.getByText('Download Music')).toBeVisible()
    await expect(page.getByText('Sign Out')).toBeVisible()
  })

  test('profile menu appears above page content (z-index)', async ({ page, request }) => {
    await setupLoggedInUser(page, request)
    await page.goto('/')
    await expect(page.getByText('Varus Music').first()).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /Open user menu/i }).click()
    const menu = page.locator('text=Sign Out').first()
    await expect(menu).toBeVisible()

    // Verify the menu element is actually interactable (not hidden behind other layers)
    await expect(menu).toBeInViewport()
    await expect(page.getByText('Sign Out')).toBeEnabled()
  })

  test('sign out returns to login screen', async ({ page, request }) => {
    await setupLoggedInUser(page, request)
    await page.goto('/')
    await expect(page.getByText('Varus Music').first()).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /Open user menu/i }).click()
    await page.getByText('Sign Out').click()

    // Should be back on login screen
    await expect(page.getByPlaceholder('Enter password')).toBeVisible({ timeout: 5000 })
  })

  test('menu closes when clicking outside', async ({ page, request }) => {
    await setupLoggedInUser(page, request)
    await page.goto('/')
    await expect(page.getByText('Varus Music').first()).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /Open user menu/i }).click()
    await expect(page.getByText('Sign Out')).toBeVisible()

    // Click elsewhere
    await page.mouse.click(10, 10)
    await expect(page.getByText('Sign Out')).not.toBeVisible({ timeout: 3000 })
  })
})

test.describe('Debug page', () => {
  test('debug page opens and has a background', async ({ page, request }) => {
    await setupLoggedInUser(page, request)
    await page.goto('/')
    await expect(page.getByText('Varus Music').first()).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /Open user menu/i }).click()
    await page.getByText('Debug Info').click()

    const debugOverlay = page.locator('text=Playlist Debug').first()
    await expect(debugOverlay).toBeVisible({ timeout: 5000 })

    // Verify the overlay has a non-transparent background
    const bg = await page.locator('.fixed.inset-0').filter({ hasText: 'Playlist Debug' }).evaluate(
      (el) => window.getComputedStyle(el).backgroundImage
    )
    expect(bg).not.toBe('none')
    expect(bg).toContain('gradient')
  })

  test('debug page can be closed', async ({ page, request }) => {
    await setupLoggedInUser(page, request)
    await page.goto('/')
    await expect(page.getByText('Varus Music').first()).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /Open user menu/i }).click()
    await page.getByText('Debug Info').click()
    await expect(page.getByText('Playlist Debug')).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: /close|✕/i }).first().click()
    await expect(page.getByText('Playlist Debug')).not.toBeVisible({ timeout: 3000 })
  })
})

test.describe('Download panel', () => {
  test('download panel opens from user menu', async ({ page, request }) => {
    await setupLoggedInUser(page, request)
    await page.goto('/')
    await expect(page.getByText('Varus Music').first()).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /Open user menu/i }).click()
    await page.getByText('Download Music').click()
    await expect(page.getByPlaceholder(/Search for a song/i)).toBeVisible({ timeout: 5000 })
  })

  test('download panel closes when clicking backdrop', async ({ page, request }) => {
    await setupLoggedInUser(page, request)
    await page.goto('/')
    await expect(page.getByText('Varus Music').first()).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /Open user menu/i }).click()
    await page.getByText('Download Music').click()
    await expect(page.getByPlaceholder(/Search for a song/i)).toBeVisible({ timeout: 5000 })

    // Click the semi-transparent backdrop (outside the panel)
    await page.mouse.click(5, 5)
    await expect(page.getByPlaceholder(/Search for a song/i)).not.toBeVisible({ timeout: 3000 })
  })
})

test.describe('Player', () => {
  test('player bar is hidden when library is empty', async ({ page, request }) => {
    await setupLoggedInUser(page, request)
    await page.goto('/')
    await expect(page.getByText('Your library is empty')).toBeVisible({ timeout: 8000 })
    // No audio element / player bar should be visible
    await expect(page.locator('audio')).not.toBeAttached()
  })
})
