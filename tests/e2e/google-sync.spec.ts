import { expect, mockupPng, test } from './fixtures'
import type { Page } from '@playwright/test'

test.use({ expectedGoogleDenial: true })

async function navigate(page: Page, name: RegExp) {
  const menu = page.getByRole('button', { name: 'Open menu', exact: true })
  if (await menu.isVisible()) await menu.click()
  await page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('link', { name }).click()
}

test('mocked Google OAuth sync uploads media, merges remote tasks, retries a denial and applies remote deletions', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  const sheetId = 'test_spreadsheet_1234567890'
  const now = new Date().toISOString()
  const remoteTask = { id: 'remote-task', title: 'Google team packing', description: 'Added on another device', orderId: null, priority: 'normal', status: 'open', dueAt: null, assignee: '', labels: [], checklist: [], comments: [], attachments: [{ id: 'remote-photo', name: 'remote-design.png', type: 'image/png', size: mockupPng.length, kind: 'mockup', driveFileId: 'remote-design-id', url: 'https://drive.google.com/file/d/remote-design-id/view', createdAt: now }], createdAt: now, updatedAt: now, completedAt: null, archivedAt: null, sortOrder: 1 }
  const header = ['Table', 'Record ID', 'Updated at', 'Record JSON']
  let remoteRows: unknown[][] = [header, ['tasks', remoteTask.id, now, JSON.stringify(remoteTask)]]
  let denyNextRead = true
  let uploads = 0
  let downloads = 0
  const batches: Record<string, unknown>[] = []
  const authorizations: string[] = []
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' }
  const titles = ['GEE Records', 'GEE Teams', 'GEE Orders', 'GEE Tasks', 'GEE Assets', 'GEE Notes']
  await page.addInitScript(() => {
    window.google = { accounts: { oauth2: { initTokenClient: config => ({ requestAccessToken: () => config.callback({ access_token: 'mock-access-token', expires_in: 3600, scope: config.scope }) }) } } }
  })
  await page.route('https://sheets.googleapis.com/**', async route => {
    const request = route.request()
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    authorizations.push(request.headers().authorization ?? '')
    const url = new URL(request.url())
    const json = (body: unknown, status = 200) => route.fulfill({ status, headers: cors, contentType: 'application/json', body: JSON.stringify(body) })
    if (request.method() === 'POST' && url.pathname === '/v4/spreadsheets') return json({ spreadsheetId: sheetId })
    if (url.pathname.endsWith(':batchUpdate')) {
      const body = request.postDataJSON()
      batches.push(body)
      const records = body.requests.find((item: { updateCells?: { range: { sheetId: number } } }) => item.updateCells?.range.sheetId === 1)?.updateCells
      if (records) remoteRows = records.rows.map((row: { values: { userEnteredValue: { stringValue?: string; numberValue?: number } }[] }) => row.values.map(cell => cell.userEnteredValue.stringValue ?? cell.userEnteredValue.numberValue ?? ''))
      return json({ replies: [] })
    }
    if (url.pathname.includes('/values/')) return json({ values: remoteRows })
    if (denyNextRead) { denyNextRead = false; return json({ error: { message: 'Test sheet access denied. Retry after granting access.' } }, 403) }
    return json({ sheets: titles.map((title, index) => ({ properties: { sheetId: index + 1, title, gridProperties: { rowCount: 1000, columnCount: 20 } } })) })
  })
  await page.route('https://www.googleapis.com/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    authorizations.push(route.request().headers().authorization ?? '')
    if (route.request().url().includes('/drive/v3/files/remote-design-id?alt=media')) {
      downloads++
      return route.fulfill({ headers: cors, contentType: 'image/png', body: mockupPng })
    }
    if (route.request().url().includes('/upload/drive/')) {
      uploads++
      expect(route.request().headers()['content-type']).toContain('multipart/related')
      expect(route.request().postDataBuffer()!.toString()).toContain('local-design.jpg')
      return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ id: 'uploaded-mockup-id' }) })
    }
    return route.fulfill({ headers: cors, contentType: 'application/json', body: JSON.stringify({ files: [] }) })
  })
  await page.goto('/tasks')
  await page.getByRole('button', { name: 'New task' }).click()
  await page.getByLabel('Task title').fill('Local print mockup')
  await page.getByLabel('Task designs & files upload').setInputFiles({ name: 'local-design.png', mimeType: 'image/png', buffer: mockupPng })
  await expect(page.getByRole('button', { name: 'Preview local-design.jpg' })).toBeVisible()
  await page.getByRole('button', { name: 'Create task' }).click()
  await navigate(page, /^Settings$/)
  const settings = page.locator('.google-settings')
  await settings.getByLabel('Google OAuth client ID').fill('test-client.apps.googleusercontent.com')
  await settings.getByRole('button', { name: 'Save Google settings' }).click()
  await settings.getByRole('button', { name: 'Connect Google', exact: true }).click()
  await settings.getByRole('button', { name: 'Create new Google Sheet' }).click()
  await expect(settings.getByRole('link', { name: 'Open Google Sheet' })).toHaveAttribute('href', `https://docs.google.com/spreadsheets/d/${sheetId}/edit`)
  await settings.getByRole('button', { name: 'Sync now', exact: true }).click()
  await expect(settings.getByRole('alert')).toContainText('Test sheet access denied')
  expect(await page.evaluate(() => localStorage.getItem('gee-tasks-workspace-v1'))).toContain('Local print mockup')
  await settings.getByRole('button', { name: 'Sync now', exact: true }).click()
  await expect(settings.getByRole('status')).toContainText('Google Sheets up to date')
  expect(uploads).toBe(1)
  expect(batches).toHaveLength(1)
  expect(authorizations.every(value => value === 'Bearer mock-access-token')).toBe(true)
  expect(JSON.stringify(remoteRows)).toContain('https://drive.google.com/file/d/uploaded-mockup-id/view')
  expect(JSON.stringify(remoteRows)).not.toContain('data:image/')
  await page.screenshot({ path: testInfo.outputPath('google-sync-mocked.png'), fullPage: true })
  await navigate(page, /^My Tasks/)
  await expect(page.getByText('Google team packing', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Details for Google team packing' }).click()
  await page.getByRole('button', { name: 'Preview remote-design.png' }).click()
  const remotePreview = page.getByRole('dialog', { name: 'Image preview: remote-design.png', exact: true })
  await expect.poll(() => remotePreview.getByRole('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  expect(downloads).toBeGreaterThan(0)
  await remotePreview.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('dialog', { name: 'Task details', exact: true }).getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: 'Details for Local print mockup' }).click()
  await expect(page.getByRole('link', { name: 'Open in Drive' })).toHaveAttribute('href', 'https://drive.google.com/file/d/uploaded-mockup-id/view')
  await page.getByRole('dialog', { name: 'Task details', exact: true }).getByRole('button', { name: 'Close dialog' }).click()
  const localRow = remoteRows.find(row => row[0] === 'tasks' && String(row[3]).includes('Local print mockup'))!
  const deletedAt = new Date(Date.now() + 60_000).toISOString()
  const tombstone = { id: `tasks:${localRow[1]}`, table: 'tasks', recordId: localRow[1], updatedAt: deletedAt }
  remoteRows = [...remoteRows.filter(row => row !== localRow), ['tombstones', tombstone.id, deletedAt, JSON.stringify(tombstone)]]
  await navigate(page, /^Settings$/)
  await settings.getByRole('button', { name: 'Load records from Google' }).click()
  await expect(settings.getByRole('status')).toContainText('Local changes pending')
  await navigate(page, /^My Tasks/)
  await expect(page.getByText('Local print mockup', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Google team packing', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText('Google team packing', { exact: true })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('gee-tasks-workspace-v1'))).not.toContain('mock-access-token')
  await page.getByRole('button', { name: 'Details for Google team packing' }).click()
  await expect(page.getByText('Connect Google to preview this image.', { exact: true })).toBeVisible()
  await page.getByRole('dialog', { name: 'Task details', exact: true }).getByRole('button', { name: 'Close dialog' }).click()
  await navigate(page, /^Settings$/)
  await expect(settings.getByRole('status')).toContainText('Google not connected')
})
