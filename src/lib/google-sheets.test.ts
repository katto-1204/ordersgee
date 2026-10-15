import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Task } from '../types/domain'

vi.mock('../db/database', async () => {
  const { LocalWorkspaceDatabase } = await import('../db/local-storage')
  return { db: new LocalWorkspaceDatabase(() => localStorage, async () => null) }
})
vi.mock('./google-auth', () => ({ authorizeGoogle: vi.fn(), disconnectGoogle: vi.fn(), googleRequest: vi.fn(), hasGoogleSession: () => true, parseSheetId: (value: string) => value }))

import { db } from '../db/database'
import { WORKSPACE_STORAGE_KEY } from '../db/local-storage'
import { googleRequest } from './google-auth'
import { syncGoogleSheet, useGoogleSync, watchGoogleSync } from './google-sheets'

let cleanup: (() => void) | undefined
beforeEach(async () => {
  localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ version: 1, tables: { orders: [], tasks: [], notes: [], labels: [], activity: [], settings: [], tombstones: [] } }))
  await db.settings.put({ id: 'shop', shopName: 'Gee Graphics', theme: 'light', customStages: [], firstRunComplete: true, updatedAt: '2026-10-15T01:00:00.000Z', googleSheetId: 'test-sheet', googleAutoSync: true })
  useGoogleSync.setState({ connected: true, busy: false, pending: false, error: null, lastSyncedAt: null })
})
afterEach(() => { cleanup?.(); cleanup = undefined; vi.useRealTimers(); vi.clearAllMocks() })

it('syncs again when an edit occurs during an in-flight sync and preserves that edit', async () => {
  vi.useFakeTimers()
  const task: Task = { id: 'task', title: 'First title', description: '', orderId: null, priority: 'normal', status: 'open', dueAt: null, assignee: '', labels: [], checklist: [], comments: [], attachments: [], createdAt: '2026-10-15T01:00:00.000Z', updatedAt: '2026-10-15T01:00:00.000Z', completedAt: null, archivedAt: null, sortOrder: 1 }
  await db.tasks.put(task)
  let enter!: () => void
  let release!: (value: unknown) => void
  const entered = new Promise<void>(resolve => { enter = resolve })
  const blocked = new Promise(resolve => { release = resolve })
  let writes = 0
  vi.mocked(googleRequest).mockImplementation(async url => {
    if (url.endsWith(':batchUpdate')) { writes++; if (writes === 1) { enter(); return blocked } return {} }
    return { sheets: [] }
  })
  cleanup = watchGoogleSync(vi.fn().mockResolvedValue(undefined))
  const running = syncGoogleSheet()
  await entered
  await db.tasks.put({ ...task, title: 'Edited during sync', updatedAt: '2026-10-15T02:00:00.000Z' })
  await vi.advanceTimersByTimeAsync(2500)
  expect(writes).toBe(1)
  release({})
  await running
  expect((await db.tasks.get('task'))?.title).toBe('Edited during sync')
  expect(useGoogleSync.getState().pending).toBe(true)
  await vi.advanceTimersByTimeAsync(3000)
  expect(writes).toBe(2)
  expect(useGoogleSync.getState().pending).toBe(false)
})

it('applies remote label alias deletions before inserting the canonical label', async () => {
  await db.labels.put({ id: 'z-local', name: 'SAME LABEL', color: '#fff', category: 'custom', updatedAt: '2026-10-15T01:00:00.000Z' })
  const remote = { id: 'a-remote', name: 'SAME LABEL', color: '#000', category: 'custom', updatedAt: '2026-10-15T02:00:00.000Z' }
  vi.mocked(googleRequest).mockImplementation(async url => url.includes('/values/') ? { values: [['Table', 'Record ID', 'Updated at', 'Record JSON'], ['labels', remote.id, remote.updatedAt, JSON.stringify(remote)]] } : { sheets: [{ properties: { sheetId: 1, title: 'GEE Records' } }] })
  await syncGoogleSheet(true)
  expect(await db.labels.toArray()).toEqual([remote])
  expect((await db.tombstones.toArray()).map(item => item.recordId)).toContain('z-local')
})
