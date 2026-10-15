// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { LocalWorkspaceDatabase, readLegacyWorkspace, WORKSPACE_STORAGE_KEY, type WorkspaceTables } from './local-storage'
import type { ShopLabel } from '../types/domain'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  failWrites = false
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException('Storage quota exceeded', 'QuotaExceededError')
    this.values.set(key, value)
  }
}
const label = (id = 'label-1', name = 'JERSEY'): ShopLabel & { updatedAt: string } => ({ id, name, color: '#ffffff', category: 'product', updatedAt: '2026-01-01T00:00:00.000Z' })
const empty = (): WorkspaceTables => ({ orders: [], tasks: [], labels: [], notes: [], activity: [], settings: [], tombstones: [] })
const setup = () => {
  const storage = new MemoryStorage()
  const migrate = vi.fn(async () => null)
  return { storage, migrate, db: new LocalWorkspaceDatabase(() => storage, migrate) }
}

describe('localStorage workspace', () => {
  it('can start with localStorage when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', undefined)
    try {
      expect(await readLegacyWorkspace()).toBeNull()
      const storage = new MemoryStorage()
      const db = new LocalWorkspaceDatabase(() => storage)
      await db.labels.put(label())
      expect(await db.labels.toArray()).toEqual([label()])
    } finally { vi.unstubAllGlobals() }
  })

  it('persists to actual localStorage JSON and restores on a new instance without re-migrating', async () => {
    const { storage, db, migrate } = setup()
    const original = label()
    await db.labels.put(original)
    original.name = 'changed outside storage'
    const loaded = new LocalWorkspaceDatabase(() => storage, migrate)
    expect(await loaded.labels.get('label-1')).toEqual(label())
    const result = await loaded.labels.get('label-1')
    result!.name = 'changed outside storage again'
    expect((await loaded.labels.get('label-1'))?.name).toBe('JERSEY')
    expect(JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY)!).tables.labels).toEqual([label()])
    expect(migrate).toHaveBeenCalledTimes(1)
  })

  it('rolls back every table if an async transaction fails', async () => {
    const { db, storage } = setup()
    await db.labels.put(label())
    const before = storage.getItem(WORKSPACE_STORAGE_KEY)
    await expect(db.transaction('rw', db.labels, db.activity, async tx => {
      await tx.labels.delete('label-1')
      await tx.activity.put({ id: 'event', entityId: 'label-1', entityType: 'system', message: 'test', createdAt: '2026-01-01' })
      throw new Error('Import failed')
    })).rejects.toThrow('Import failed')
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(before)
    expect(await db.activity.toArray()).toEqual([])
  })

  it('keeps the durable snapshot unchanged on quota errors and can save after space is freed', async () => {
    const { db, storage } = setup()
    await db.labels.put(label())
    const before = storage.getItem(WORKSPACE_STORAGE_KEY)
    storage.failWrites = true
    await expect(db.transaction('rw', db.labels, async tx => {
      await tx.labels.update('label-1', { name: 'Updated' })
      await tx.labels.put(label('label-2', 'Other'))
    })).rejects.toThrow('Storage quota')
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(before)
    expect(await db.labels.toArray()).toEqual([label()])
    storage.failWrites = false
    await db.labels.update('label-1', { name: 'Saved later' })
    expect((await db.labels.get('label-1'))?.name).toBe('Saved later')
  })

  it('serializes concurrent transactions and standalone edits without mixing their snapshots', async () => {
    const { db } = setup()
    await db.labels.put(label())
    const operations = [1, 2, 3].map(number => db.transaction('rw', db.labels, async tx => {
      const current = await tx.labels.get('label-1')
      await Promise.resolve()
      await tx.labels.update('label-1', { name: `${current!.name}-${number}` })
    }))
    operations.push(db.labels.put(label('label-2', 'Added while transaction pending')).then(() => undefined))
    await Promise.all(operations)
    expect((await db.labels.get('label-1'))?.name).toBe('JERSEY-1-2-3')
    expect(await db.labels.toArray()).toHaveLength(2)
  })

  it('never replaces malformed or unsupported existing localStorage with demo data', async () => {
    for (const broken of ['{broken json', JSON.stringify({ version: 2, tables: empty() }), JSON.stringify({ version: 1, tables: { ...empty(), labels: [{ name: 'Missing id' }] } })]) {
      const { storage, db, migrate } = setup()
      storage.setItem(WORKSPACE_STORAGE_KEY, broken)
      await expect(db.open()).rejects.toThrow()
      expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(broken)
      expect(migrate).not.toHaveBeenCalled()
    }
  })

  it('migrates all old tables once and preserves attachment metadata and settings', async () => {
    const storage = new MemoryStorage()
    const legacy: WorkspaceTables = {
      ...empty(), labels: [label()],
      settings: [{ id: 'shop', shopName: 'Real shop', theme: 'dark', customStages: [], firstRunComplete: true, updatedAt: '2026-01-01' }],
      notes: [{ id: 'note', title: 'Artwork', content: '', type: 'general', orderId: null, labels: [], pinned: true, updatedAt: '2026-01-01', attachments: [{ id: 'image', name: 'team.jpg', type: 'image/jpeg', size: 10, dataUrl: 'data:image/jpeg;base64,abc', createdAt: '2026-01-01' }] }],
    }
    const migrate = vi.fn(async () => legacy)
    const db = new LocalWorkspaceDatabase(() => storage, migrate)
    await db.open()
    expect(JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY)!).tables).toEqual(legacy)
    expect(await db.notes.get('note')).toEqual(legacy.notes[0])
    await db.open()
    expect(migrate).toHaveBeenCalledTimes(1)
    expect(legacy.notes[0].attachments[0].dataUrl).toContain('base64,abc')
  })

  it('allows safe retry after migration or initial quota failure without recording a blank workspace', async () => {
    const storage = new MemoryStorage()
    const legacy = { ...empty(), labels: [label()] }
    const migrate = vi.fn().mockRejectedValueOnce(new Error('Legacy read failed')).mockResolvedValue(legacy)
    const db = new LocalWorkspaceDatabase(() => storage, migrate)
    await expect(db.open()).rejects.toThrow('Legacy read failed')
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull()
    storage.failWrites = true
    await expect(db.open()).rejects.toThrow('Storage quota')
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull()
    storage.failWrites = false
    await db.open()
    expect(await db.labels.toArray()).toEqual([label()])
    expect(migrate).toHaveBeenCalledTimes(3)
  })

  it('rejects conflicting async writes from another tab without overwriting either durable data', async () => {
    const { storage, db } = setup()
    await db.labels.put(label())
    let continueTransaction!: () => void
    let notifyStarted!: () => void
    const started = new Promise<void>(resolve => { notifyStarted = resolve })
    const paused = new Promise<void>(resolve => { continueTransaction = resolve })
    const transaction = db.transaction('rw', db.labels, async tx => {
      await tx.labels.update('label-1', { name: 'First tab' })
      notifyStarted()
      await paused
    })
    await started
    // A legacy tab can bypass the app's Web Lock and write localStorage directly.
    const external = JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY)!)
    external.tables.labels[0].name = 'Other tab'
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(external))
    continueTransaction()
    await expect(transaction).rejects.toThrow('another tab')
    expect((await db.labels.get('label-1'))?.name).toBe('Other tab')
  })

  it.runIf(typeof navigator !== 'undefined' && !!navigator.locks)('uses Web Locks to serialize async transactions across app instances', async () => {
    const { db, storage } = setup()
    await db.labels.put(label())
    let continueTransaction!: () => void
    let notifyStarted!: () => void
    const started = new Promise<void>(resolve => { notifyStarted = resolve })
    const paused = new Promise<void>(resolve => { continueTransaction = resolve })
    const first = db.transaction('rw', db.labels, async tx => {
      await tx.labels.update('label-1', { name: 'First tab' })
      notifyStarted()
      await paused
    })
    await started
    const otherTab = new LocalWorkspaceDatabase(() => storage, async () => null)
    const second = otherTab.labels.update('label-1', { name: 'Second tab' })
    continueTransaction()
    await Promise.all([first, second])
    expect((await db.labels.get('label-1'))?.name).toBe('Second tab')
  })

  it('enforces unique label names atomically and retains activity sorting and limits', async () => {
    const { db } = setup()
    await db.labels.put(label())
    await expect(db.labels.bulkPut([label('other'), label('third', 'New')])).rejects.toThrow('unique')
    expect(await db.labels.toArray()).toEqual([label()])
    await db.activity.bulkPut(['2026-01-02', '2026-01-03', '2026-01-01'].map((createdAt, index) => ({ id: String(index), entityType: 'system', entityId: '', message: '', createdAt })))
    expect((await db.activity.orderBy('createdAt').reverse().limit(2).toArray()).map(row => row.createdAt)).toEqual(['2026-01-03', '2026-01-02'])
  })

  it('tracks deletions atomically for Sheets and clears tombstones when an item is restored', async () => {
    const { db } = setup()
    await db.labels.put(label())
    await db.labels.delete('label-1')
    expect(await db.labels.toArray()).toEqual([])
    expect(await db.tombstones.get('labels:label-1')).toMatchObject({ id: 'labels:label-1', table: 'labels', recordId: 'label-1' })
    expect((await db.tombstones.get('labels:label-1'))?.updatedAt).toMatch(/^\d{4}-/)
    await db.labels.put(label())
    expect(await db.tombstones.toArray()).toEqual([])
    expect(await db.labels.toArray()).toEqual([label()])
  })

  it('preserves incoming remote timestamps on put and timestamps local updates', async () => {
    const { db } = setup()
    await db.labels.put(label())
    expect((await db.labels.get('label-1'))?.updatedAt).toBe('2026-01-01T00:00:00.000Z')
    await db.labels.update('label-1', { name: 'Local change' })
    expect((await db.labels.get('label-1'))?.updatedAt).not.toBe('2026-01-01T00:00:00.000Z')
    const incoming = { ...label(), name: 'Remote change', updatedAt: '2026-02-02T00:00:00.000Z' }
    await db.labels.put(incoming)
    expect((await db.labels.get('label-1'))?.updatedAt).toBe(incoming.updatedAt)
  })
})
