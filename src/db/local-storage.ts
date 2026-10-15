import type { ActivityEntry, Order, ShopLabel, ShopNote, ShopSettings, Task } from '../types/domain'

export const WORKSPACE_STORAGE_KEY = 'gee-tasks-workspace-v1'
const TABLE_NAMES = ['orders', 'tasks', 'labels', 'notes', 'activity', 'settings', 'tombstones'] as const
type TrackedTable = 'orders' | 'tasks' | 'labels' | 'notes'
export interface Tombstone { id: string; table: TrackedTable; recordId: string; updatedAt: string }
export interface WorkspaceTables {
  orders: Order[]
  tasks: Task[]
  labels: ShopLabel[]
  notes: ShopNote[]
  activity: ActivityEntry[]
  settings: ShopSettings[]
  tombstones: Tombstone[]
}
type TableName = keyof WorkspaceTables
type Row = { id: string }
interface Snapshot { version: 1; tables: WorkspaceTables }
type Run = <R>(operation: (tables: WorkspaceTables) => R, write: boolean) => Promise<R>
const clone = <T>(value: T): T => structuredClone(value)
const emptyTables = (): WorkspaceTables => ({ orders: [], tasks: [], labels: [], notes: [], activity: [], settings: [], tombstones: [] })

function validateSnapshot(value: unknown): asserts value is Snapshot {
  const snapshot = value as Snapshot | null
  if (!snapshot || snapshot.version !== 1 || !snapshot.tables || TABLE_NAMES.some(name => !Array.isArray(snapshot.tables[name]) || snapshot.tables[name].some(row => !row || typeof row.id !== 'string'))) {
    throw new Error('The localStorage workspace is damaged or uses an unsupported version. Restore a JSON backup; your saved data has not been overwritten.')
  }
}

class LocalCollection<T> {
  constructor(private readonly read: () => Promise<T[]>, private readonly key: keyof T, private descending = false, private count = Infinity) {}
  reverse() { return new LocalCollection(this.read, this.key, !this.descending, this.count) }
  limit(count: number) { return new LocalCollection(this.read, this.key, this.descending, count) }
  async toArray() {
    const rows = await this.read()
    return rows.sort((a, b) => String(a[this.key]).localeCompare(String(b[this.key])) * (this.descending ? -1 : 1)).slice(0, this.count)
  }
}

export class LocalTable<T extends Row> {
  constructor(readonly name: TableName, private readonly run: Run) {}
  private rows(tables: WorkspaceTables) { return tables[this.name] as unknown as T[] }
  private upsert(tables: WorkspaceTables, row: T) {
    const rows = this.rows(tables)
    const index = rows.findIndex(item => item.id === row.id)
    const next = clone(row) as T & { updatedAt?: string }
    if (this.tracked()) {
      next.updatedAt ??= new Date().toISOString()
      tables.tombstones = tables.tombstones.filter(item => item.id !== `${this.name}:${row.id}`)
    }
    if (index < 0) rows.push(next)
    else rows[index] = next
  }
  private tracked(): this is this & { name: TrackedTable } { return ['orders', 'tasks', 'labels', 'notes'].includes(this.name) }
  toArray() { return this.run(tables => clone(this.rows(tables)), false) }
  get(id: string) { return this.run(tables => clone(this.rows(tables).find(row => row.id === id)), false) }
  put(row: T) {
    return this.run(tables => {
      this.upsert(tables, row)
      return row.id
    }, true)
  }
  bulkPut(rows: T[]) {
    return this.run(tables => {
      for (const row of rows) this.upsert(tables, row)
      return rows.at(-1)?.id
    }, true)
  }
  update(id: string, changes: Partial<T>) {
    return this.run(tables => {
      const rows = this.rows(tables)
      const index = rows.findIndex(row => row.id === id)
      if (index < 0) return 0
      rows[index] = { ...rows[index], ...clone(changes), id, ...(this.tracked() ? { updatedAt: new Date().toISOString() } : {}) }
      return 1
    }, true)
  }
  delete(id: string) {
    return this.run(tables => {
      const rows = this.rows(tables)
      const index = rows.findIndex(row => row.id === id)
      if (index >= 0) rows.splice(index, 1)
      if (this.tracked()) {
        const tombstone: Tombstone = { id: `${this.name}:${id}`, table: this.name, recordId: id, updatedAt: new Date().toISOString() }
        tables.tombstones = [...tables.tombstones.filter(item => item.id !== tombstone.id), tombstone]
      }
    }, true)
  }
  orderBy(key: keyof T) { return new LocalCollection(() => this.toArray(), key) }
}

function createTables(run: Run) {
  return {
    orders: new LocalTable<Order>('orders', run),
    tasks: new LocalTable<Task>('tasks', run),
    labels: new LocalTable<ShopLabel>('labels', run),
    notes: new LocalTable<ShopNote>('notes', run),
    activity: new LocalTable<ActivityEntry>('activity', run),
    settings: new LocalTable<ShopSettings>('settings', run),
    tombstones: new LocalTable<Tombstone>('tombstones', run),
  }
}
export type LocalTables = ReturnType<typeof createTables>

/** Read the former browser database once. Never delete it, including on failed migration. */
export async function readLegacyWorkspace(): Promise<WorkspaceTables | null> {
  if (!globalThis.indexedDB) return null
  const factory = globalThis.indexedDB
  if (factory.databases) {
    const databases = await factory.databases()
    if (!databases.some(database => database.name === 'gee-tasks-local')) return null
  }
  return new Promise((resolve, reject) => {
    const request = factory.open('gee-tasks-local')
    let absent = false
    request.onupgradeneeded = () => { absent = true; request.transaction?.abort() }
    request.onerror = () => absent ? resolve(null) : reject(request.error)
    request.onblocked = () => reject(new Error('Close other GEE TASKS tabs, then retry the localStorage migration.'))
    request.onsuccess = () => {
      const legacy = request.result
      const available = TABLE_NAMES.filter(name => legacy.objectStoreNames.contains(name))
      if (!available.length) { legacy.close(); resolve(null); return }
      const tables = emptyTables()
      const transaction = legacy.transaction(available, 'readonly')
      for (const name of available) {
        const read = transaction.objectStore(name).getAll()
        read.onsuccess = () => { (tables[name] as Row[]) = read.result }
      }
      transaction.oncomplete = () => { legacy.close(); resolve(tables) }
      transaction.onerror = () => { legacy.close(); reject(transaction.error) }
      transaction.onabort = () => { legacy.close(); reject(transaction.error ?? new Error('Legacy storage migration was interrupted.')) }
    }
  })
}

/** One setItem commits a complete workspace, so quota errors cannot leave half an import. */
export class LocalWorkspaceDatabase {
  readonly orders: LocalTables['orders']
  readonly tasks: LocalTables['tasks']
  readonly labels: LocalTables['labels']
  readonly notes: LocalTables['notes']
  readonly activity: LocalTables['activity']
  readonly settings: LocalTables['settings']
  readonly tombstones: LocalTables['tombstones']
  private opening?: Promise<void>
  private queue: Promise<unknown> = Promise.resolve()

  constructor(private readonly storage: () => Storage = () => globalThis.localStorage, private readonly migrate = readLegacyWorkspace) {
    const tables = createTables((operation, write) => this.enqueue(async () => {
      const snapshot = this.read()
      const result = operation(snapshot.tables)
      if (write) this.commit(snapshot)
      return result
    }))
    this.orders = tables.orders
    this.tasks = tables.tasks
    this.labels = tables.labels
    this.notes = tables.notes
    this.activity = tables.activity
    this.settings = tables.settings
    this.tombstones = tables.tombstones
  }

  open() {
    if (!this.opening) {
      this.opening = (async () => {
        if (this.storage().getItem(WORKSPACE_STORAGE_KEY) !== null) { this.read(); return }
        const migrated = await this.migrate()
        // Another tab may have created a workspace while the old database was read.
        if (this.storage().getItem(WORKSPACE_STORAGE_KEY) !== null) { this.read(); return }
        this.commit({ version: 1, tables: migrated ?? emptyTables() })
      })().catch(error => { this.opening = undefined; throw error })
    }
    return this.opening
  }

  private read(): Snapshot {
    return this.parse(this.storage().getItem(WORKSPACE_STORAGE_KEY))
  }

  private parse(stored: string | null): Snapshot {
    if (stored === null) throw new Error('The localStorage workspace was removed. Reload before saving any changes.')
    const value: unknown = JSON.parse(stored)
    // Older localStorage snapshots predate deletion tracking.
    if (value && typeof value === 'object' && 'tables' in value) {
      const tables = (value as Snapshot).tables
      if (tables && !Object.hasOwn(tables, 'tombstones')) tables.tombstones = []
    }
    validateSnapshot(value)
    return value
  }

  private commit(snapshot: Snapshot) {
    validateSnapshot(snapshot)
    const names = snapshot.tables.labels.map(label => label.name)
    if (new Set(names).size !== names.length) throw new DOMException('Label names must be unique.', 'ConstraintError')
    const serialized = JSON.stringify(snapshot)
    if (this.storage().getItem(WORKSPACE_STORAGE_KEY) === serialized) return
    this.storage().setItem(WORKSPACE_STORAGE_KEY, serialized)
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('gee-workspace-changed'))
  }

  private enqueue<R>(operation: () => Promise<R>): Promise<R> {
    const next = this.queue.then(async () => {
      await this.open()
      // Supported browsers serialize app writes across tabs, including async imports.
      if (typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request(WORKSPACE_STORAGE_KEY, operation)
      return operation()
    })
    this.queue = next.catch(() => undefined)
    return next
  }

  // The callback must use its scoped db argument. Its changes are committed together.
  transaction<R>(mode: 'rw', ...args: [...tables: { readonly name: TableName }[], callback: (db: LocalTables) => Promise<R>]): Promise<R> {
    void mode
    const callback = args.at(-1) as (db: LocalTables) => Promise<R>
    return this.enqueue(async () => {
      const original = this.storage().getItem(WORKSPACE_STORAGE_KEY)
      const snapshot = this.parse(original)
      const tables = createTables(async operation => operation(snapshot.tables))
      const result = await callback(tables)
      // Reject instead of overwriting another tab's edits made during an async import.
      if (this.storage().getItem(WORKSPACE_STORAGE_KEY) !== original) throw new Error('The workspace changed in another tab. Reload and try again.')
      this.commit(snapshot)
      return result
    })
  }
}
