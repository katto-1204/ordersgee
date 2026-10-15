import { describe, expect, it } from 'vitest'
import { createSeedLabels, createSeedOrders } from '../db/seed'
import type { WorkspaceTables } from '../db/local-storage'
import { buildSheetViews, mergeSheetRecords, parseSheetRecords, toSheetRecords, type SheetRecord } from './sheet-records'
import { parseSheetId } from './google-auth'

const tables = (): WorkspaceTables => ({ orders: createSeedOrders('2026-10-15T01:00:00.000Z').slice(0, 1), labels: createSeedLabels(), tasks: [], notes: [], activity: [], tombstones: [], settings: [{ id: 'shop', shopName: 'Gee Graphics', theme: 'light', customStages: [], firstRunComplete: true, updatedAt: '2026-10-15T01:00:00.000Z', googleClientId: 'private-config', googleSheetId: 'do-not-copy' }] })
const record = (date: string, title = 'Task'): SheetRecord => ({ table: 'tasks', id: 'task-1', updatedAt: date, record: { id: 'task-1', title } })

describe('Google Sheets records', () => {
  it('accepts only valid Google Sheets locations', () => {
    expect(parseSheetId('https://docs.google.com/spreadsheets/d/abcdefghijklmnopqrstuv/edit')).toBe('abcdefghijklmnopqrstuv')
    expect(() => parseSheetId('https://evil.test/spreadsheets/d/abcdefghijklmnopqrstuv/edit')).toThrow()
    expect(() => parseSheetId('')).toThrow()
  })
  it('round trips canonical records without exposing browser credentials or image bytes', () => {
    const input = tables()
    input.orders[0].attachments.push({ id: 'photo', name: 'team.jpg', type: 'image/jpeg', size: 4, kind: 'team-photo', createdAt: '2026-10-15T01:00:00.000Z', dataUrl: 'data:image/jpeg;base64,AAAA', url: 'https://drive.google.com/file/d/photo/view' })
    const records = toSheetRecords(input)
    const rows = buildSheetViews(records)[0].rows
    expect(parseSheetRecords(rows)).toEqual(records)
    expect(JSON.stringify(records)).not.toContain('private-config')
    expect(JSON.stringify(records)).not.toContain('do-not-copy')
    expect(JSON.stringify(records)).not.toContain('base64')
  })
  it('merges by stable ID and newer edit, keeping unrelated records', () => {
    const local = record('2026-10-15T01:00:00.000Z', 'Old')
    const remote = record('2026-10-15T02:00:00.000Z', 'New')
    expect(mergeSheetRecords([local], [remote])).toEqual([remote])
    expect(mergeSheetRecords([remote], [local])).toEqual([remote])
    expect(mergeSheetRecords([local], [{ ...remote, id: 'another' }])).toHaveLength(2)
  })
  it('compares actual instants rather than timezone spellings for edits and deletions', () => {
    const newer = record('2026-10-15T02:00:00.000Z', 'Newer local edit')
    const older = record('2026-10-15T09:30:00+08:00', 'Older remote edit')
    expect(mergeSheetRecords([newer], [older])).toEqual([newer])
    const tombstone: SheetRecord = { table: 'tombstones', id: 'tasks:task-1', updatedAt: older.updatedAt, record: { id: 'tasks:task-1', table: 'tasks', recordId: 'task-1', updatedAt: older.updatedAt } }
    expect(mergeSheetRecords([newer], [tombstone])).toEqual([newer])
    const laterDelete = { ...tombstone, updatedAt: '2026-10-15T10:30:00+08:00', record: { ...tombstone.record, updatedAt: '2026-10-15T10:30:00+08:00' } }
    expect(mergeSheetRecords([newer], [laterDelete])).toEqual([laterDelete])
  })
  it('consolidates legacy label IDs by name, preserving newest content and tombstoning aliases', () => {
    const makeLabel = (id: string, updatedAt: string, color: string): SheetRecord => ({ table: 'labels', id, updatedAt, record: { id, name: 'JERSEY', color, category: 'product', updatedAt } })
    const canonical = makeLabel('aaa-legacy', '2026-10-15T01:00:00.000Z', '#ffffff')
    const newest = makeLabel('seed-label-1', '2026-10-15T10:00:00+08:00', '#000000')
    const expected = { ...newest, id: canonical.id, record: { ...newest.record, id: canonical.id } }
    const merged = mergeSheetRecords([canonical], [newest])
    expect(merged.filter(item => item.table === 'labels')).toEqual([expected])
    expect(merged.find(item => item.table === 'tombstones')).toEqual({ table: 'tombstones', id: `labels:${newest.id}`, updatedAt: newest.updatedAt, record: { id: `labels:${newest.id}`, table: 'labels', recordId: newest.id, updatedAt: newest.updatedAt } })
    expect(mergeSheetRecords([newest], [canonical]).sort((a, b) => a.id.localeCompare(b.id))).toEqual([...merged].sort((a, b) => a.id.localeCompare(b.id)))
    expect(mergeSheetRecords(merged, [newest])).toEqual(merged)
  })
  it('does not resurrect a deleted record, but permits an explicit newer recreation', () => {
    const deleted: SheetRecord = { table: 'tombstones', id: 'tasks:task-1', updatedAt: '2026-10-15T02:00:00.000Z', record: { id: 'tasks:task-1', table: 'tasks', recordId: 'task-1', updatedAt: '2026-10-15T02:00:00.000Z' } }
    expect(mergeSheetRecords([deleted], [record('2026-10-15T01:00:00.000Z')])).toEqual([deleted])
    expect(mergeSheetRecords([deleted], [record('2026-10-15T02:00:00.000Z')])).toEqual([deleted])
    expect(mergeSheetRecords([record('2026-10-15T03:00:00.000Z')], [deleted])).toEqual([record('2026-10-15T03:00:00.000Z')])
  })
  it('rejects malformed and duplicate remote rows before any local change', () => {
    const rows = buildSheetViews(toSheetRecords(tables()))[0].rows
    expect(() => parseSheetRecords([rows[0], rows[1], rows[1]])).toThrow('Duplicate')
    expect(() => parseSheetRecords([rows[0], ['orders', 'bad', '2026-10-15', '{}']])).toThrow('Invalid orders')
    expect(() => parseSheetRecords([['unexpected']])).toThrow('unexpected format')
  })
  it('keeps finished and archived teams and asset associations in tracking views', () => {
    const input = tables()
    input.orders[0].stage = 'finished'
    input.orders[0].archivedAt = '2026-10-15T01:00:00.000Z'
    input.orders[0].attachments = [{ id: 'asset', name: '=not a formula', type: 'image/jpeg', size: 5, kind: 'team-photo', url: 'https://drive.google.com/file/d/asset/view', createdAt: '2026-10-15T01:00:00.000Z' }]
    const views = buildSheetViews(toSheetRecords(input))
    expect(views.find(view => view.title === 'GEE Teams')!.rows[1].slice(0, 3)).toEqual(['ASNEX', 1, 0])
    expect(views.find(view => view.title === 'GEE Assets')!.rows[1]).toEqual(['orders', 'seed-order-0', 'ASNEX', 'seed-order-0', '', 'team-photo', '=not a formula', 'https://drive.google.com/file/d/asset/view', 'asset'])
  })
  it('uses the same starter IDs across devices so sync does not duplicate teams', () => {
    expect(createSeedOrders().map(item => item.id)).toEqual(createSeedOrders().map(item => item.id))
    expect(createSeedLabels().map(item => item.id)).toEqual(createSeedLabels().map(item => item.id))
  })
  it('does not let a newer local theme/Google connection overwrite shared shop settings', () => {
    const input = tables()
    input.settings[0].updatedAt = '2026-10-15T05:00:00.000Z'
    input.settings[0].sharedSettingsUpdatedAt = '2026-10-15T01:00:00.000Z'
    const local = toSheetRecords(input).find(item => item.table === 'settings')!
    const remote = { ...local, updatedAt: '2026-10-15T03:00:00.000Z', record: { ...local.record, shopName: 'Updated shop', updatedAt: '2026-10-15T03:00:00.000Z' } }
    expect(mergeSheetRecords([local], [remote])[0].record.shopName).toBe('Updated shop')
  })
  it('keeps a real edit to a starter order when a fresh browser syncs newer demo data', () => {
    const edited = tables()
    edited.orders[0] = { ...edited.orders[0], notes: 'Customer approved the real final layout', updatedAt: '2026-10-14T01:00:00.000Z' }
    const fresh = tables()
    fresh.orders = createSeedOrders('2026-10-15T01:00:00.000Z').slice(0, 1)
    const merged = mergeSheetRecords(toSheetRecords(edited), toSheetRecords(fresh))
    expect(merged.find(item => item.table === 'orders')?.record.notes).toBe('Customer approved the real final layout')
  })
})
