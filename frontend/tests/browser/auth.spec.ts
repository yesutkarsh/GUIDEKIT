import { test, expect } from '@playwright/test'

test('device entry hydrates and preserves its request through Google sign-in', async ({ page }) => {
  const failedScripts: string[] = []
  const runtimeErrors: string[] = []
  page.on('response', response => {
    if (response.url().includes('/_next/static/') && response.status() >= 400) failedScripts.push(response.url())
  })
  page.on('pageerror', error => runtimeErrors.push(error.message))
  await page.goto('/device?code=HZ8R-CF7S')
  await expect(page).toHaveURL(/\/login\?return_to=%2Fdevice%3Fcode%3DHZ8R-CF7S/, { timeout: 25000 })
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
  expect(failedScripts).toEqual([])
  expect(runtimeErrors).toEqual([])

  await page.getByRole('button', { name: 'Continue with Google' }).click()
  await expect(page).toHaveURL(/^https:\/\/accounts\.google\.com\//, { timeout: 20000 })
})
