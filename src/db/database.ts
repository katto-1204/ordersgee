import type { ActivityEntry, Order, ShopLabel, ShopNote, ShopSettings, Task } from '../types/domain'
import { uid } from '../types/domain'
import { createSeedLabels, createSeedOrders } from './seed'
import { LocalWorkspaceDatabase } from './local-storage'

export const db = new LocalWorkspaceDatabase()

export async function initializeDemoWorkspace() {
  await db.open()
  const settings = await db.settings.get('shop')
  if (settings?.firstRunComplete) return
  await db.transaction('rw', db.settings, db.labels, db.orders, async db => {
    if ((await db.settings.get('shop'))?.firstRunComplete) return
    await db.labels.bulkPut(createSeedLabels())
    await db.orders.bulkPut(createSeedOrders())
    await db.settings.put({ id: 'shop', shopName: 'Gee Graphics', theme: 'light', customStages: [], firstRunComplete: true, sharedSettingsUpdatedAt: '1970-01-01T00:00:00.000Z', updatedAt: new Date().toISOString() })
  })
}

export async function logActivity(entityType: ActivityEntry['entityType'], entityId: string, message: string) {
  const item: ActivityEntry = { id: uid(), entityType, entityId, message, createdAt: new Date().toISOString() }
  await db.activity.put(item)
  return item
}

export async function saveOrder(order: Order, message = 'Order updated') {
  const now = new Date().toISOString()
  const next = { ...order, updatedAt: now }
  await db.transaction('rw', db.orders, db.activity, async db => {
    await db.orders.put(next)
    await db.activity.put({ id: uid(), entityType: 'order', entityId: next.id, message, createdAt: now })
  })
  return next
}

export async function saveTask(task: Task, message = 'Task updated') {
  const next = { ...task, updatedAt: new Date().toISOString() }
  await db.transaction('rw', db.tasks, db.activity, async db => {
    await db.tasks.put(next)
    await db.activity.put({ id: uid(), entityType: 'task', entityId: next.id, message, createdAt: new Date().toISOString() })
  })
  return next
}

export async function saveNote(note: ShopNote) {
  const next = { ...note, updatedAt: new Date().toISOString() }
  await db.notes.put(next)
  return next
}

export async function saveLabel(label: ShopLabel) {
  await db.labels.put({ ...label, updatedAt: new Date().toISOString() })
}

export async function saveShopSettings(patch: Partial<ShopSettings>) {
  return db.transaction('rw', db.settings, async db => {
    const current = await db.settings.get('shop')
    const now = new Date().toISOString()
    const sharedChanged = ['shopName', 'customStages', 'teamMembers'].some(key => Object.hasOwn(patch, key))
    const next: ShopSettings = { id: 'shop', shopName: 'Gee Graphics', theme: 'light', customStages: [], firstRunComplete: true, ...current, ...patch, sharedSettingsUpdatedAt: sharedChanged ? now : current?.sharedSettingsUpdatedAt ?? current?.updatedAt ?? '1970-01-01T00:00:00.000Z', updatedAt: now }
    await db.settings.put(next)
    return next
  })
}
