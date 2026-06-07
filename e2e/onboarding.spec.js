// @ts-check
import { test, expect } from '@playwright/test'
import { uniqueUser, TEST_PASSWORD, uiRegister } from './helpers/utils.js'

test.describe('Onboarding', () => {
  test('onboarding modal appears for new user', async ({ page }) => {
    await uiRegister(page, uniqueUser('ob'))
    await expect(page.getByText('Welcome to Varus Music')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Pick a few genres')).toBeVisible()
  })

  test('can select genres and advance to cadence step', async ({ page }) => {
    await uiRegister(page, uniqueUser('ob_genre'))
    await expect(page.getByText('Welcome to Varus Music')).toBeVisible({ timeout: 8000 })

    // Pick two genres
    await page.getByRole('button', { name: /rock/i }).click()
    await page.getByRole('button', { name: /pop/i }).click()

    // Advance to cadence step
    await page.getByRole('button', { name: /Start with 2 genres/i }).click()
    await expect(page.getByText('How often do you want fresh music')).toBeVisible({ timeout: 5000 })
  })

  test('cadence step shows daily / weekly / monthly options', async ({ page }) => {
    await uiRegister(page, uniqueUser('ob_cadence'))
    await expect(page.getByText('Welcome to Varus Music')).toBeVisible({ timeout: 8000 })

    // Skip genre selection
    await page.getByRole('button', { name: /Skip/i }).click()
    await expect(page.getByText('How often do you want fresh music')).toBeVisible({ timeout: 5000 })

    await expect(page.getByRole('button', { name: /Daily/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Weekly/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Monthly/i })).toBeVisible()
  })

  test('can navigate back from cadence to genre step', async ({ page }) => {
    await uiRegister(page, uniqueUser('ob_back'))
    await expect(page.getByText('Welcome to Varus Music')).toBeVisible({ timeout: 8000 })

    await page.getByRole('button', { name: /Skip/i }).click()
    await expect(page.getByText('How often do you want fresh music')).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: /← Back/i }).click()
    await expect(page.getByText('Welcome to Varus Music')).toBeVisible({ timeout: 3000 })
  })

  test('completing onboarding seeds the library', async ({ page }) => {
    await uiRegister(page, uniqueUser('ob_complete'))
    await expect(page.getByText('Welcome to Varus Music')).toBeVisible({ timeout: 8000 })

    // Pick a genre, advance, pick daily cadence, submit
    await page.getByRole('button', { name: /indie/i }).click()
    await page.getByRole('button', { name: /Start with 1 genre/i }).click()
    await expect(page.getByText('How often do you want fresh music')).toBeVisible({ timeout: 5000 })

    await page.getByRole('button', { name: /Daily/i }).click()
    await page.getByRole('button', { name: 'Start Discovering' }).click()

    // Should show seeding spinner or building screen
    await expect(
      page.getByText(/Building your library|queuing popular tracks/i).first()
    ).toBeVisible({ timeout: 8000 })
  })
})
