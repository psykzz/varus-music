// @ts-check
import { test, expect } from '@playwright/test'
import { uniqueUser, TEST_PASSWORD, uiRegister, uiLogin } from './helpers/utils.js'

test.describe('Authentication', () => {
  test('shows login screen by default', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Varus Music' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign In' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Account' }).first()).toBeVisible()
  })

  test('can register a new account', async ({ page }) => {
    const username = uniqueUser('reg')
    await uiRegister(page, username)
    // After registration a new user sees the onboarding modal
    await expect(page.getByText('Welcome to Varus Music')).toBeVisible({ timeout: 8000 })
  })

  test('shows error for short password', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Create Account' }).click()
    await page.getByPlaceholder('Enter username').fill(uniqueUser('short'))
    await page.getByPlaceholder('Min. 8 characters').fill('abc')
    await page.getByRole('button', { name: 'Create Account' }).last().click()
    // Browser native validation prevents submit; password input should be focused/invalid
    await expect(page.getByPlaceholder('Min. 8 characters')).toBeFocused()
  })

  test('shows error for duplicate username', async ({ page, request }) => {
    const username = uniqueUser('dup')
    // Register once via UI
    await uiRegister(page, username)
    await expect(page.getByText('Welcome to Varus Music')).toBeVisible({ timeout: 8000 })

    // Clear storage and try to register the same username again
    await page.evaluate(() => localStorage.clear())
    await page.goto('/')
    await page.getByRole('button', { name: 'Create Account' }).click()
    await page.getByPlaceholder('Enter username').fill(username)
    await page.getByPlaceholder('Min. 8 characters').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: 'Create Account' }).last().click()
    await expect(page.getByText(/Username already taken/i)).toBeVisible({ timeout: 5000 })
  })

  test('can login with valid credentials', async ({ page, request }) => {
    const username = uniqueUser('login')
    // Register first (API — fast)
    const res = await request.post('http://localhost:3001/api/auth/register', {
      data: { username, password: TEST_PASSWORD },
    })
    expect(res.ok()).toBeTruthy()
    // Mark onboarding complete so we land on the main app
    const { token } = await res.json()
    await request.post('http://localhost:3001/api/onboarding/seed', {
      headers: { Authorization: `Bearer ${token}` },
      data: { genres: [], cadence: 'weekly' },
    })

    await uiLogin(page, username)
    await expect(page.getByText('Varus Music').first()).toBeVisible({ timeout: 8000 })
    // Should NOT see the login form any more
    await expect(page.getByPlaceholder('Enter password')).not.toBeVisible()
  })

  test('shows error for wrong password', async ({ page, request }) => {
    const username = uniqueUser('wrongpw')
    await request.post('http://localhost:3001/api/auth/register', {
      data: { username, password: TEST_PASSWORD },
    })

    await page.goto('/')
    await page.getByPlaceholder('Enter username').fill(username)
    await page.getByPlaceholder('Enter password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).last().click()
    await expect(page.getByText(/Invalid credentials/i)).toBeVisible({ timeout: 5000 })
  })
})
