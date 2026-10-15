import { create } from 'zustand'
import { db, initializeDemoWorkspace, logActivity, saveLabel, saveNote, saveOrder, saveShopSettings, saveTask } from '../db/database'
import { uid, type ActivityEntry, type Order, type ShopLabel, type ShopNote, type ShopSettings, type Task } from '../types/domain'
import { confirmInApp } from '../lib/confirm'
import { startupStorageError } from '../lib/errors'

interface ShopState {
  orders: Order[]
  tasks: Task[]
  labels: ShopLabel[]
  notes: ShopNote[]
  activity: ActivityEntry[]
  settings: ShopSettings | null
  loading: boolean
  loadError: string | null
  load: () => Promise<void>
  addOrder: (order: Order) => Promise<void>
  updateOrder: (order: Order, message?: string) => Promise<void>
  updateStage: (id: string, stage: string) => Promise<boolean>
  archiveOrder: (id: string) => Promise<void>
  removeOrder: (id: string) => Promise<void>
  addTask: (task: Task) => Promise<void>
  updateTask: (task: Task, message?: string) => Promise<void>
  completeTask: (id: string, done?: boolean) => Promise<void>
  archiveTask: (id: string) => Promise<void>
  reorderTask: (id: string, direction: -1 | 1) => Promise<void>
  moveTaskTo: (id: string, targetId: string) => Promise<void>
  addNote: (note: ShopNote) => Promise<void>
  updateNote: (note: ShopNote) => Promise<void>
  removeNote: (id: string) => Promise<void>
  addLabel: (label: ShopLabel) => Promise<void>
  removeLabel: (id: string) => Promise<void>
  updateSettings: (patch: Partial<ShopSettings>) => Promise<void>
  setTheme: (theme: 'light' | 'dark') => Promise<void>
  importOrders: (orders: Order[]) => Promise<number>
}

export const useShop = create<ShopState>((set, get) => ({
  orders: [], tasks: [], labels: [], notes: [], activity: [], settings: null, loading: true, loadError: null,
  load: async () => {
    set({ loading: get().settings === null, loadError: null })
    try {
      await initializeDemoWorkspace()
      const [orders, tasks, labels, notes, activity, settings] = await Promise.all([
        db.orders.toArray(), db.tasks.toArray(), db.labels.toArray(), db.notes.toArray(), db.activity.orderBy('createdAt').reverse().limit(40).toArray(), db.settings.get('shop'),
      ])
      if (settings?.theme) document.documentElement.dataset.theme = settings.theme
      set({ orders, tasks, labels, notes, activity, settings: settings ?? null, loading: false, loadError: null })
    } catch (error) {
      console.error('GEE TASKS could not open local workspace storage', error)
      set({ loading: false, loadError: startupStorageError(error) })
    }
  },
  addOrder: async order => {
    const duplicate = get().orders.find(item => item.archivedAt === null && item.customerName.trim().toLowerCase() === order.customerName.trim().toLowerCase() && order.reference && item.reference.trim().toLowerCase() === order.reference.trim().toLowerCase())
    if (duplicate) throw new Error(`An active order for ${duplicate.customerName} with that reference already exists.`)
    await saveOrder(order, 'Order created')
    await get().load()
  },
  updateOrder: async (order, message = 'Order updated') => { await saveOrder(order, message); await get().load() },
  updateStage: async (id, stage) => {
    const order = await db.orders.get(id)
    if (!order || order.stage === stage) return false
    const productionStages = new Set(['printing', 'done-print', 'to-sew', 'to-deliver', 'press', 'finished'])
    let ownerOverrideAt = order.ownerOverrideAt
    if (productionStages.has(stage) && order.approvalStatus !== 'approved' && !ownerOverrideAt) {
      const accepted = await confirmInApp({
        title: `Artwork for ${order.customerName} needs approval`,
        description: 'This order is not marked approved. Only start production if the customer has already approved the artwork. If you continue, this decision will be recorded on the order’s Activity. Otherwise, keep the order here and update its approval status first.',
        confirmLabel: 'Continue and log override',
        cancelLabel: 'Keep order here',
        tone: 'primary',
      })
      if (!accepted) return false
      ownerOverrideAt = new Date().toISOString()
    }
    const done = stage === 'finished'
    const message = ownerOverrideAt && !order.ownerOverrideAt ? `Owner override recorded; stage changed to ${stage}` : `Stage changed to ${stage}`
    await saveOrder({ ...order, stage, ownerOverrideAt, completedAt: done ? new Date().toISOString() : null, labels: done ? [...new Set([...order.labels, 'COMPLETED'])] : order.labels }, message)
    await get().load()
    return true
  },
  archiveOrder: async id => {
    const order = await db.orders.get(id)
    if (!order) return
    await saveOrder({ ...order, archivedAt: new Date().toISOString() }, 'Order archived')
    await get().load()
  },
  removeOrder: async id => {
    const order = await db.orders.get(id)
    if (!order) return
    await db.orders.delete(id)
    await logActivity('order', id, `Order “${order.customerName}” deleted`)
    await get().load()
  },
  addTask: async task => { await saveTask(task, 'Task created'); await get().load() },
  updateTask: async (task, message = 'Task updated') => { await saveTask(task, message); await get().load() },
  completeTask: async (id, done = true) => {
    const task = await db.tasks.get(id)
    if (!task) return
    await saveTask({ ...task, status: done ? 'completed' : 'open', completedAt: done ? new Date().toISOString() : null }, done ? 'Task completed' : 'Task reopened')
    await get().load()
  },
  archiveTask: async id => {
    const task = await db.tasks.get(id)
    if (!task) return
    await saveTask({ ...task, archivedAt: new Date().toISOString() }, 'Task archived')
    await get().load()
  },
  reorderTask: async (id, direction) => {
    const openTasks = get().tasks.filter(task => !task.archivedAt && task.status === 'open').sort((a, b) => a.sortOrder - b.sortOrder)
    const index = openTasks.findIndex(task => task.id === id)
    const neighbor = openTasks[index + direction]
    if (index < 0 || !neighbor) return
    const current = openTasks[index]
    const orderA = current.sortOrder
    await db.tasks.update(current.id, { sortOrder: neighbor.sortOrder })
    await db.tasks.update(neighbor.id, { sortOrder: orderA })
    await get().load()
  },
  moveTaskTo: async (id, targetId) => {
    const openTasks = get().tasks.filter(task => !task.archivedAt && task.status === 'open').sort((a, b) => a.sortOrder - b.sortOrder)
    const from = openTasks.findIndex(task => task.id === id)
    const to = openTasks.findIndex(task => task.id === targetId)
    if (from < 0 || to < 0 || from === to) return
    const [moved] = openTasks.splice(from, 1)
    openTasks.splice(to, 0, moved)
    await db.transaction('rw', db.tasks, async db => {
      for (const [index, task] of openTasks.entries()) await db.tasks.update(task.id, { sortOrder: index + 1 })
    })
    await get().load()
  },
  addNote: async note => { await saveNote(note); await logActivity('note', note.id, 'Note created'); await get().load() },
  updateNote: async note => { await saveNote(note); await get().load() },
  removeNote: async id => { await db.notes.delete(id); await logActivity('note', id, 'Note deleted'); await get().load() },
  addLabel: async label => { await saveLabel(label); await get().load() },
  removeLabel: async id => {
    const label = get().labels.find(item => item.id === id)
    if (!label) return
    await db.transaction('rw', db.labels, db.orders, db.tasks, db.notes, async db => {
      await db.labels.delete(id)
      for (const order of await db.orders.toArray()) if (order.labels.includes(label.name)) await db.orders.update(order.id, { labels: order.labels.filter(name => name !== label.name) })
      for (const task of await db.tasks.toArray()) if (task.labels.includes(label.name)) await db.tasks.update(task.id, { labels: task.labels.filter(name => name !== label.name) })
      for (const note of await db.notes.toArray()) if (note.labels.includes(label.name)) await db.notes.update(note.id, { labels: note.labels.filter(name => name !== label.name) })
    })
    await get().load()
  },
  updateSettings: async patch => { await saveShopSettings(patch); await get().load() },
  setTheme: async theme => {
    document.documentElement.dataset.theme = theme
    await saveShopSettings({ theme })
    await get().load()
  },
  importOrders: async orders => {
    const seen = new Set(get().orders.filter(order => !order.archivedAt).map(order => order.sourceText.trim().replace(/\s+/g, ' ').toLowerCase()))
    const fresh = orders.filter(order => {
      const key = order.sourceText.trim().replace(/\s+/g, ' ').toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    if (fresh.length) {
      await db.orders.bulkPut(fresh)
      await Promise.all(fresh.map(order => logActivity('order', order.id, 'Order imported from Quick Capture')))
    }
    await get().load()
    return fresh.length
  },
}))

export function newId() { return uid() }
