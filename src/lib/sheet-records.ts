import { z } from 'zod'
import type { WorkspaceTables } from '../db/local-storage'

export const SYNC_TABLES = ['orders', 'tasks', 'notes', 'labels', 'activity', 'settings', 'tombstones'] as const
export type SyncTable = typeof SYNC_TABLES[number]
export type SheetRecord = { table: SyncTable; id: string; updatedAt: string; record: Record<string, unknown> }
const text = z.string()
const date = text.refine(value => !Number.isNaN(Date.parse(value)), 'Invalid date')
const nullableDate = date.nullable()
const checklist = z.array(z.object({ id: text, text, done: z.boolean() }))
const attachment = z.object({ id: text, name: text, type: text, size: z.number().nonnegative(), createdAt: date, kind: z.enum(['mockup', 'team-photo', 'print-ready', 'artwork']).optional(), driveFileId: text.optional(), url: text.refine(value => { try { const url = new URL(value); return url.protocol === 'https:' && ['drive.google.com', 'docs.google.com'].includes(url.hostname) } catch { return false } }, 'Invalid Drive URL').optional() })
const priority = z.enum(['urgent', 'high', 'normal', 'low'])
const shared = { id: text.min(1), labels: z.array(text), attachments: z.array(attachment) }
const schemas = {
  orders: z.object({ ...shared, customerName: text.min(1), reference: text, productType: text, quantity: z.number().nullable(), sizeBreakdown: z.record(text, z.number()), stage: text.min(1), priority, dueAt: nullableDate, assignee: text, notes: text, checklist, approvalStatus: z.enum(['draft', 'for-approval', 'approved', 'revision-requested']), ownerOverrideAt: nullableDate, sourceText: text, createdAt: date, updatedAt: date, completedAt: nullableDate, archivedAt: nullableDate }),
  tasks: z.object({ ...shared, title: text.min(1), description: text, orderId: text.nullable(), priority, status: z.enum(['open', 'completed']), dueAt: nullableDate, assignee: text, checklist, comments: z.array(text), createdAt: date, updatedAt: date.optional(), completedAt: nullableDate, archivedAt: nullableDate, sortOrder: z.number() }),
  notes: z.object({ ...shared, title: text, content: text, type: z.enum(['general', 'customer', 'production', 'daily', 'instructions']), orderId: text.nullable(), pinned: z.boolean(), updatedAt: date }),
  labels: z.object({ id: text.min(1), name: text.min(1), color: text, category: z.enum(['production', 'product', 'priority', 'other', 'custom']), updatedAt: date.optional() }),
  activity: z.object({ id: text.min(1), entityType: z.enum(['order', 'task', 'note', 'system']), entityId: text, message: text, createdAt: date }),
  settings: z.object({ id: z.literal('shop'), shopName: text, customStages: z.array(z.object({ key: text, label: text })), teamMembers: z.array(text).optional(), updatedAt: date }),
  tombstones: z.object({ id: text.min(1), table: z.enum(['orders', 'tasks', 'notes', 'labels']), recordId: text.min(1), updatedAt: date }),
}

export function toSheetRecords(tables: WorkspaceTables): SheetRecord[] {
  return SYNC_TABLES.flatMap(table => tables[table].map(item => {
    const record = schemas[table].parse(item) as Record<string, unknown>
    if (table === 'settings') record.updatedAt = tables.settings.find(settings => settings.id === item.id)?.sharedSettingsUpdatedAt ?? record.updatedAt
    if (['orders', 'tasks', 'notes', 'labels'].includes(table)) record.updatedAt ??= record.createdAt ?? '1970-01-01T00:00:00.000Z'
    return { table, id: item.id, updatedAt: String(record.updatedAt ?? record.createdAt ?? '1970-01-01T00:00:00.000Z'), record }
  }))
}

export function parseSheetRecords(rows: unknown[][]): SheetRecord[] {
  if (!rows.length) return []
  if (rows[0].join('|') !== 'Table|Record ID|Updated at|Record JSON') throw new Error('The GEE Records tab has an unexpected format. No local data was changed.')
  const seen = new Set<string>()
  return rows.slice(1).filter(row => row.some(value => value !== '')).map((row, index) => {
    const table = row[0] as SyncTable
    if (!SYNC_TABLES.includes(table)) throw new Error(`Unknown record table in sheet row ${index + 2}.`)
    let record: Record<string, unknown>
    try { record = schemas[table].parse(JSON.parse(String(row[3]))) as Record<string, unknown> } catch { throw new Error(`Invalid ${table} data in sheet row ${index + 2}. No local data was changed.`) }
    if (record.id !== row[1] || !date.safeParse(row[2]).success || String(record.updatedAt ?? record.createdAt ?? '1970-01-01T00:00:00.000Z') !== row[2]) throw new Error(`Invalid record ID or timestamp in sheet row ${index + 2}.`)
    const key = `${table}:${record.id}`
    if (seen.has(key)) throw new Error(`Duplicate record ID in sheet row ${index + 2}.`)
    seen.add(key)
    return { table, id: String(record.id), updatedAt: String(row[2]), record }
  })
}

export function mergeSheetRecords(local: SheetRecord[], remote: SheetRecord[]) {
  const merged = new Map<string, SheetRecord>()
  for (const item of [...remote, ...local]) {
    const key = `${item.table}:${item.id}`
    const previous = merged.get(key)
    if (!previous || Date.parse(item.updatedAt) >= Date.parse(previous.updatedAt)) merged.set(key, item)
  }
  for (const item of merged.values()) {
    if (item.table !== 'tombstones') continue
    const key = `${item.record.table}:${item.record.recordId}`
    const existing = merged.get(key)
    if (existing && Date.parse(existing.updatedAt) > Date.parse(item.updatedAt)) merged.delete(`tombstones:${item.id}`)
    else merged.delete(key)
  }
  // Labels are referenced by name throughout orders/tasks/notes. Older devices can
  // assign different IDs to the same label; keep one stable ID and the latest content.
  const labelsByName = new Map<string, SheetRecord[]>()
  for (const item of merged.values()) {
    if (item.table !== 'labels') continue
    const name = String(item.record.name)
    labelsByName.set(name, [...labelsByName.get(name) ?? [], item])
  }
  for (const labels of labelsByName.values()) {
    if (labels.length < 2) continue
    labels.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    const canonical = labels[0]
    const newest = labels.reduce((latest, item) => Date.parse(item.updatedAt) > Date.parse(latest.updatedAt) ? item : latest, canonical)
    merged.set(`labels:${canonical.id}`, { ...newest, id: canonical.id, record: { ...newest.record, id: canonical.id } })
    for (const alias of labels.slice(1)) {
      merged.delete(`labels:${alias.id}`)
      const id = `labels:${alias.id}`
      merged.set(`tombstones:${id}`, { table: 'tombstones', id, updatedAt: newest.updatedAt, record: { id, table: 'labels', recordId: alias.id, updatedAt: newest.updatedAt } })
    }
  }
  return [...merged.values()]
}

export function buildSheetViews(records: SheetRecord[]) {
  const orders = records.filter(item => item.table === 'orders').map(item => item.record)
  const tasks = records.filter(item => item.table === 'tasks').map(item => item.record)
  const assets = records.flatMap(item => ((item.record.attachments ?? []) as Array<Record<string, unknown>>).map(file => {
    const order = item.table === 'orders' ? item.record : orders.find(order => order.id === item.record.orderId)
    return [item.table, item.id, order?.customerName ?? '', order?.id ?? '', item.record.title ?? '', file.kind ?? 'artwork', file.name, file.url ?? '', file.id]
  }))
  const teamNames = [...new Set(orders.map(order => String(order.customerName).trim().toLocaleLowerCase()))]
  return [
    { title: 'GEE Records', rows: [['Table', 'Record ID', 'Updated at', 'Record JSON'], ...records.map(item => [item.table, item.id, item.updatedAt, JSON.stringify(item.record)])] },
    { title: 'GEE Teams', rows: [['Team', 'Order count', 'Active orders', 'Team photos', 'Design mockups'], ...teamNames.map(name => { const items = orders.filter(order => String(order.customerName).trim().toLocaleLowerCase() === name); const related = [...items, ...tasks.filter(task => items.some(order => order.id === task.orderId))]; const files = related.flatMap(record => record.attachments as Array<Record<string, unknown>>); return [items[0].customerName, items.length, items.filter(order => !order.archivedAt && !['finished', 'cancelled'].includes(String(order.stage))).length, files.filter(file => file.kind === 'team-photo').map(file => file.url).join('\n'), files.filter(file => file.kind === 'mockup').map(file => file.url).join('\n')] })] },
    { title: 'GEE Orders', rows: [['ID', 'Team', 'Reference', 'Product', 'Stage', 'Priority', 'Quantity', 'Due', 'Assignee', 'Approval', 'Notes', 'Completed', 'Archived'], ...orders.map(order => [order.id, order.customerName, order.reference, order.productType, order.stage, order.priority, order.quantity, order.dueAt, order.assignee, order.approvalStatus, order.notes, order.completedAt, order.archivedAt])] },
    { title: 'GEE Tasks', rows: [['ID', 'Task', 'Team', 'Order ID', 'Status', 'Priority', 'Due', 'Assignee', 'Description', 'Completed', 'Archived'], ...tasks.map(task => [task.id, task.title, orders.find(order => order.id === task.orderId)?.customerName ?? '', task.orderId, task.status, task.priority, task.dueAt, task.assignee, task.description, task.completedAt, task.archivedAt])] },
    { title: 'GEE Assets', rows: [['Record type', 'Record ID', 'Team', 'Order ID', 'Task / Note', 'Asset type', 'File name', 'Google Drive link', 'Attachment ID'], ...assets] },
    { title: 'GEE Notes', rows: [['ID', 'Title', 'Content', 'Order ID', 'Type', 'Updated'], ...records.filter(item => item.table === 'notes').map(({ record }) => [record.id, record.title, record.content, record.orderId, record.type, record.updatedAt])] },
  ]
}
