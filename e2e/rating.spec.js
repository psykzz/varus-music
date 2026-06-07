// @ts-check
import { test, expect } from '@playwright/test'

// Block the service worker so Playwright's page.route() can intercept API calls.
// The SW's network-first handler for /api/ would otherwise bypass our mocks.
test.use({ serviceWorkers: 'block' })

const MOCK_TRACKS = [
  {
    id: 'track-1',
    title: 'First Track',
    artist: 'Artist One',
    album: 'Album A',
    filename: 'first-track.mp3',
    duration: 200,
    score: 0,
    position: 0,
  },
  {
    id: 'track-2',
    title: 'Second Track',
    artist: 'Artist Two',
    album: 'Album B',
    filename: 'second-track.mp3',
    duration: 180,
    score: 0,
    position: 1,
  },
]

async function setupMockedApp(page) {
  // Seed localStorage to bypass auth and onboarding
  await page.addInitScript(() => {
    localStorage.setItem('varus_token', 'mock-token')
    localStorage.setItem(
      'varus_user',
      JSON.stringify({ id: 'user-1', username: 'testuser', onboardingComplete: true })
    )
  })

  // Mock playlist API
  await page.route('**/api/playlist/current', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'cycle-1',
        startedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        tracks: MOCK_TRACKS,
      }),
    })
  )

  // Mock ratings API — use regex to reliably match /api/ratings/:trackId
  await page.route(/\/api\/ratings\//, (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'rating-1', value: -1 }),
    })
  )

  // Prevent audio 404s from causing unhandled errors
  await page.route('**/files/**', (route) =>
    route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.from('') })
  )
}

test.describe('Rating', () => {
  test('dislike clears when advancing to the next track', async ({ page }) => {
    await setupMockedApp(page)
    await page.goto('/')

    // Wait for the player to appear with the first track
    await expect(page.getByText('First Track').first()).toBeVisible({ timeout: 8000 })

    // Click Dislike in the player bar (footer) — button should become active
    const playerBar = page.locator('footer')
    const dislikeButton = playerBar.getByRole('button', { name: 'Dislike' })
    await dislikeButton.click()

    // Confirm dislike is highlighted (active state adds bg-red-500/10 which is only present when rated)
    await expect(dislikeButton).toHaveClass(/bg-red-500/, { timeout: 3000 })

    // Advance to the next track
    await playerBar.getByRole('button', { name: 'Next' }).click()

    // Second track should now be active in the player
    await expect(page.getByRole('heading', { name: 'Second Track' })).toBeVisible({ timeout: 3000 })

    // Dislike should NOT be highlighted for the new track
    await expect(playerBar.getByRole('button', { name: 'Dislike' })).not.toHaveClass(/bg-red-500/)
  })
})
