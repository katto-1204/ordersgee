import { expect, mockupPng, test } from './fixtures'
import type { Order, ShopSettings } from '../../src/types/domain'

test('migrates real legacy IndexedDB teams and photos without deleting the source database', async ({ page }) => {
  const now = new Date().toISOString()
  const order: Order = {
    id: 'legacy-team', customerName: 'Legacy team with photo', reference: 'LEGACY-001', productType: 'Jersey',
    quantity: 12, sizeBreakdown: { M: 12 }, stage: 'finished', priority: 'normal', dueAt: null, assignee: '',
    labels: [], notes: 'Existing shop history', checklist: [], approvalStatus: 'approved', ownerOverrideAt: null,
    sourceText: '', createdAt: now, updatedAt: now, completedAt: now, archivedAt: null,
    attachments: [{ id: 'legacy-photo', name: 'legacy-team.png', type: 'image/png', size: mockupPng.length, kind: 'team-photo',
      dataUrl: `data:image/png;base64,${mockupPng.toString('base64')}`, createdAt: now }],
  }
  const settings: ShopSettings = { id: 'shop', shopName: 'Legacy shop', theme: 'light', customStages: [], firstRunComplete: true, updatedAt: now }
  await page.route('**/__e2e_storage_setup', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Storage setup</body></html>' }))
  await page.goto('/__e2e_storage_setup')
  await page.evaluate(async ({ order, settings }) => {
    localStorage.clear()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('gee-tasks-local', 1)
      request.onupgradeneeded = () => {
        for (const name of ['orders', 'tasks', 'notes', 'activity', 'labels', 'settings']) request.result.createObjectStore(name, { keyPath: 'id' })
      }
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const transaction = db.transaction(['orders', 'settings'], 'readwrite')
        transaction.objectStore('orders').put(order)
        transaction.objectStore('settings').put(settings)
        transaction.onerror = () => reject(transaction.error)
        transaction.oncomplete = () => { db.close(); resolve() }
      }
    })
  }, { order, settings })
  await page.goto('/teams')
  const record = page.getByRole('article', { name: 'Legacy team with photo team record' })
  await expect(record).toBeVisible()
  await expect(record.getByRole('img', { name: 'Legacy team with photo team photo for LEGACY-001' })).toBeVisible()
  await expect.poll(() => record.getByRole('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true)
  const persisted = await page.evaluate(async () => {
    const local = JSON.parse(localStorage.getItem('gee-tasks-workspace-v1')!)
    const legacy = await new Promise<unknown[]>((resolve, reject) => {
      const request = indexedDB.open('gee-tasks-local')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const read = db.transaction('orders', 'readonly').objectStore('orders').getAll()
        read.onerror = () => reject(read.error)
        read.onsuccess = () => { db.close(); resolve(read.result) }
      }
    })
    return { localOrder: local.tables.orders[0], legacy }
  })
  expect(persisted.localOrder).toEqual(order)
  expect(persisted.legacy).toEqual([order])
  await page.reload()
  await expect(record).toBeVisible()
})
