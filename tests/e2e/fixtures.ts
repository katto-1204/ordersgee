import { expect, test as base } from '@playwright/test'
import { readFileSync } from 'node:fs'

export const mockupPng = readFileSync(new URL('./fixtures/team-mockup.png', import.meta.url))

export const test = base.extend<{ browserDiagnostics: void; expectedGoogleDenial: boolean }>({
  expectedGoogleDenial: [false, { option: true }],
  browserDiagnostics: [async ({ page, expectedGoogleDenial }, use, testInfo) => {
    const errors: string[] = []
    const expectedErrors: string[] = []
    const warnings: string[] = []
    const failures: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => {
      if (message.type() === 'error') {
        const deliberateDenial = expectedGoogleDenial && message.location().url.startsWith('https://sheets.googleapis.com/') && /Failed to load resource: the server responded with a status of 403/.test(message.text())
        if (deliberateDenial) expectedErrors.push(message.text())
        else errors.push(message.text())
      }
      if (message.type() === 'warning') warnings.push(message.text())
    })
    page.on('requestfailed', request => failures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText}`))
    await use()
    await testInfo.attach('browser-diagnostics', {
      body: JSON.stringify({ errors, expectedErrors, warnings, failedRequests: failures }, null, 2),
      contentType: 'application/json',
    })
    expect(errors, 'Browser runtime and console errors').toEqual([])
    expect(failures, 'Failed browser network requests').toEqual([])
    expect(warnings, 'Browser console warnings').toEqual([])
  }, { auto: true }],
})

export { expect } from '@playwright/test'
