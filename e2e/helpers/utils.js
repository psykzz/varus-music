// @ts-check
import { expect } from '@playwright/test'

/**
 * Generate a unique username for a test run so tests never collide in the shared DB.
 * @param {string} [prefix]
 */
export function uniqueUser(prefix = 'testuser') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/** Default password used across all test accounts. */
export const TEST_PASSWORD = 'testpassword99'

/**
 * Register a brand-new user directly via the API (bypasses the UI for speed).
 * Returns { token, user }.
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} username
 */
export async function apiRegister(request, username) {
  const res = await request.post('http://localhost:3001/api/auth/register', {
    data: { username, password: TEST_PASSWORD },
  })
  if (!res.ok()) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Register failed ${res.status()}: ${JSON.stringify(body)}`)
  }
  return res.json()
}

/**
 * Seed localStorage with a valid JWT so the page loads straight into the app
 * without showing the login screen.
 * @param {import('@playwright/test').Page} page
 * @param {{ token: string, user: object }} auth
 */
export async function seedAuth(page, auth) {
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('varus_token', token)
    localStorage.setItem('varus_user', JSON.stringify(user))
  }, auth)
}

/**
 * Register via the UI (sign-up form).
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 * @param {string} [password]
 */
export async function uiRegister(page, username, password = TEST_PASSWORD) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create Account' }).click()
  await page.getByPlaceholder('Enter username').fill(username)
  await page.getByPlaceholder('Min. 8 characters').fill(password)
  await page.getByRole('button', { name: 'Create Account' }).last().click()
}

/**
 * Login via the UI (sign-in form).
 * @param {import('@playwright/test').Page} page
 * @param {string} username
 * @param {string} [password]
 */
export async function uiLogin(page, username, password = TEST_PASSWORD) {
  await page.goto('/')
  await page.getByPlaceholder('Enter username').fill(username)
  await page.getByPlaceholder('Enter password').fill(password)
  await page.getByRole('button', { name: 'Sign In' }).last().click()
}

/**
 * Skip the onboarding modal quickly (no genre / cadence selection).
 * @param {import('@playwright/test').Page} page
 */
export async function skipOnboarding(page) {
  const skipBtn = page.getByRole('button', { name: /Skip/i })
  if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBtn.click()
    // Cadence step — accept the default (weekly)
    await page.getByRole('button', { name: 'Start Discovering' }).click()
  }
}
