import { create } from 'zustand'
import { db } from '../db/database'
import type { LocalTables, WorkspaceTables } from '../db/local-storage'
import type { Attachment, Order, Task, ShopNote, ShopLabel, ActivityEntry } from '../types/domain'
import { authorizeGoogle, disconnectGoogle, googleRequest, hasGoogleSession, parseSheetId } from './google-auth'
import { buildSheetViews, mergeSheetRecords, parseSheetRecords, SYNC_TABLES, toSheetRecords, type SheetRecord } from './sheet-records'

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'
type Metadata = { sheets?: { properties: { sheetId: number; title: string; gridProperties?: { rowCount: number; columnCount: number } } }[] }
export const useGoogleSync = create<{ connected: boolean; busy: boolean; pending: boolean; error: string | null; lastSyncedAt: string | null }>(() => ({ connected: false, busy: false, pending: true, error: null, lastSyncedAt: null }))
let internalWrites = 0
let syncing: Promise<void> | undefined
const internal = async <T>(operation: () => Promise<T>) => { internalWrites++; try { return await operation() } finally { internalWrites-- } }

export async function connectGoogle(clientId: string) {
  await authorizeGoogle(clientId)
  useGoogleSync.setState({ connected: true, error: null })
}
export function disconnectSheets() { disconnectGoogle(); useGoogleSync.setState({ connected: false, error: null }) }

export async function createGoogleSheet() {
  const result = await googleRequest<{ spreadsheetId: string }>(SHEETS, { method: 'POST', body: JSON.stringify({ properties: { title: 'Gee Graphics — Teams & Production' } }) })
  await internal(async () => { await db.settings.update('shop', { googleSheetId: result.spreadsheetId }) })
  return result.spreadsheetId
}

async function snapshot(): Promise<WorkspaceTables> {
  const tables = {} as WorkspaceTables
  for (const table of SYNC_TABLES) Object.assign(tables, { [table]: await db[table].toArray() })
  return tables
}

async function uploadAttachment(file: Attachment) {
  if (!file.dataUrl || file.driveFileId || file.url) return file
  const query = `trashed = false and appProperties has { key='geeAttachmentId' and value='${file.id.replace(/['\\]/g, '')}' }`
  const existing = await googleRequest<{ files: { id: string }[] }>(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)&pageSize=1`)
  let id = existing.files[0]?.id
  if (!id) {
    const blob = await fetch(file.dataUrl).then(response => response.blob())
    const boundary = `gee_${crypto.randomUUID()}`
    const metadata = { name: file.name, mimeType: file.type, appProperties: { geeAttachmentId: file.id } }
    const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`, blob, `\r\n--${boundary}--`], { type: `multipart/related; boundary=${boundary}` })
    const result = await googleRequest<{ id: string }>('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': body.type }, body })
    id = result.id
  }
  return { ...file, driveFileId: id, url: `https://drive.google.com/file/d/${id}/view` }
}

async function uploadMedia() {
  for (const table of ['orders', 'tasks', 'notes'] as const) {
    for (const record of await db[table].toArray()) {
      for (const file of record.attachments) {
        const uploaded = await uploadAttachment(file)
        if (uploaded === file) continue
        await internal(() => db.transaction('rw', db[table], async tx => {
          const current = await tx[table].get(record.id)
          if (!current) return
          // Keep edits made while an upload was in flight, including removed attachments.
          const attachments = current.attachments.map(item => item.id === file.id ? { ...item, url: uploaded.url, driveFileId: uploaded.driveFileId } : item)
          await putRecord(tx, table, { ...current, attachments })
        }))
      }
    }
  }
}

async function remoteRecords(sheetId: string) {
  const metadata = await googleRequest<Metadata>(`${SHEETS}/${sheetId}?fields=sheets.properties`)
  if (!metadata.sheets?.some(sheet => sheet.properties.title === 'GEE Records')) return { metadata, records: [] as SheetRecord[] }
  const response = await googleRequest<{ values?: unknown[][] }>(`${SHEETS}/${sheetId}/values/${encodeURIComponent("'GEE Records'!A:D")}`)
  return { metadata, records: parseSheetRecords(response.values ?? []) }
}

async function writeSheet(sheetId: string, metadata: Metadata, records: SheetRecord[]) {
  const views = buildSheetViews(records)
  const requests: unknown[] = []
  const usedIds = new Set(metadata.sheets?.map(sheet => sheet.properties.sheetId) ?? [])
  for (const view of views) {
    const existing = metadata.sheets?.find(sheet => sheet.properties.title === view.title)?.properties
    let sheetId = existing?.sheetId ?? 0
    if (!existing) {
      while (usedIds.has(sheetId)) sheetId++
      usedIds.add(sheetId)
      requests.push({ addSheet: { properties: { sheetId, title: view.title, gridProperties: { rowCount: Math.max(100, view.rows.length), columnCount: Math.max(10, view.rows[0].length), frozenRowCount: 1 } } } })
    } else if ((existing.gridProperties?.rowCount ?? 0) < view.rows.length || (existing.gridProperties?.columnCount ?? 0) < view.rows[0].length) {
      requests.push({ updateSheetProperties: { properties: { sheetId, gridProperties: { rowCount: Math.max(existing.gridProperties?.rowCount ?? 100, view.rows.length), columnCount: Math.max(existing.gridProperties?.columnCount ?? 10, view.rows[0].length) } }, fields: 'gridProperties.rowCount,gridProperties.columnCount' } })
    }
    const rows = view.rows.map(row => ({ values: row.map(value => {
      const stringValue = String(value ?? '')
      if (stringValue.length > 49000) throw new Error('A record is too large for a Google Sheets cell. Shorten its notes/comments or split the order before syncing.')
      return { userEnteredValue: typeof value === 'number' ? { numberValue: value } : { stringValue } }
    }) }))
    // A full-range update clears stale rows after deletions, in the same atomic batch.
    requests.push({ updateCells: { range: { sheetId }, rows, fields: 'userEnteredValue' } })
    requests.push({ repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: { red: 0.1, green: 0.14, blue: 0.22 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } }, fields: 'userEnteredFormat' } })
  }
  await googleRequest(`${SHEETS}/${sheetId}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests }) })
}

async function putRecord(tx: LocalTables, table: SheetRecord['table'], value: unknown) {
  switch (table) {
    case 'orders': await tx.orders.put(value as Order); break
    case 'tasks': await tx.tasks.put(value as Task); break
    case 'notes': await tx.notes.put(value as ShopNote); break
    case 'labels': await tx.labels.put(value as ShopLabel); break
    case 'activity': await tx.activity.put(value as ActivityEntry); break
    case 'tombstones': await tx.tombstones.put(value as WorkspaceTables['tombstones'][number]); break
    case 'settings': {
      const local = await tx.settings.get('shop')
      const shared = value as { shopName: string; customStages: { key: string; label: string }[]; teamMembers?: string[]; updatedAt: string }
      if (local) await tx.settings.put({ ...local, shopName: shared.shopName, customStages: shared.customStages, teamMembers: shared.teamMembers, sharedSettingsUpdatedAt: shared.updatedAt })
      break
    }
  }
}

async function applyRecords(records: SheetRecord[]) {
  await internal(() => db.transaction('rw', db.orders, db.tasks, db.notes, db.labels, db.settings, db.activity, db.tombstones, async tx => {
    // Merge again with current local state so in-flight edits cannot be overwritten.
    const tables = {} as WorkspaceTables
    for (const table of SYNC_TABLES) Object.assign(tables, { [table]: await tx[table].toArray() })
    const merged = mergeSheetRecords(toSheetRecords(tables), records)
    for (const item of merged.filter(item => item.table === 'tombstones')) {
      const tombstone = item.record as unknown as WorkspaceTables['tombstones'][number]
      await tx[tombstone.table].delete(tombstone.recordId)
      await tx.tombstones.put(tombstone)
    }
    for (const item of merged.filter(item => item.table !== 'tombstones')) {
      let next = item.record
      if (['orders', 'tasks', 'notes'].includes(item.table)) {
        const local = (tables[item.table] as Array<{ id: string; attachments?: Attachment[] }>).find(record => record.id === item.id)
        next = { ...next, attachments: (next.attachments as Attachment[]).map(file => ({ ...file, dataUrl: local?.attachments?.find(old => old.id === file.id)?.dataUrl })) }
      }
      await putRecord(tx, item.table, next)
    }
  }))
}

async function performSync(pullOnly: boolean) {
  useGoogleSync.setState({ busy: true, error: null })
  try {
    const settings = await db.settings.get('shop')
    const sheetId = parseSheetId(settings?.googleSheetId ?? '')
    if (!navigator.onLine) throw new Error('You are offline. Local changes are saved. Retry sync when online.')
    const remote = await remoteRecords(sheetId)
    if (pullOnly) {
      await applyRecords(remote.records)
      useGoogleSync.setState({ pending: true })
    } else {
      await uploadMedia()
      const local = toSheetRecords(await snapshot())
      const merged = mergeSheetRecords(local, remote.records)
      await writeSheet(sheetId, remote.metadata, merged)
      await applyRecords(merged)
      const pending = JSON.stringify(toSheetRecords(await snapshot()).sort(byKey)) !== JSON.stringify(merged.sort(byKey))
      useGoogleSync.setState({ pending, lastSyncedAt: new Date().toISOString() })
    }
  } catch (error) {
    useGoogleSync.setState({ pending: true, error: error instanceof Error ? error.message : 'Google sync failed. Retry when online.', connected: hasGoogleSession() })
    throw error
  } finally { useGoogleSync.setState({ busy: false }) }
}
const byKey = (a: SheetRecord, b: SheetRecord) => `${a.table}:${a.id}`.localeCompare(`${b.table}:${b.id}`)

export function syncGoogleSheet(pullOnly = false) {
  if (syncing) return syncing
  syncing = performSync(pullOnly).finally(() => { syncing = undefined })
  return syncing
}

export function watchGoogleSync(reload: () => Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  const changed = () => {
    if (internalWrites) return
    useGoogleSync.setState({ pending: true })
    clearTimeout(timer)
    timer = setTimeout(() => { void maybeSync() }, 2500)
  }
  const maybeSync = async () => {
    const settings = await db.settings.get('shop').catch(() => null)
    if (!settings?.googleAutoSync || !settings.googleSheetId || !hasGoogleSession() || !navigator.onLine || !useGoogleSync.getState().pending) return
    if (syncing) { timer = setTimeout(() => { void maybeSync() }, 2500); return }
    try { await syncGoogleSheet(); await reload() } catch { /* The persistent status and retry button report the failure. */ }
  }
  const unsubscribe = useGoogleSync.subscribe((state, previous) => {
    if (previous.busy && !state.busy && state.pending && !state.error) {
      clearTimeout(timer)
      timer = setTimeout(() => { void maybeSync() }, 2500)
    }
  })
  const storage = () => { void reload(); changed() }
  window.addEventListener('gee-workspace-changed', changed)
  window.addEventListener('online', changed)
  window.addEventListener('storage', storage)
  return () => { clearTimeout(timer); unsubscribe(); window.removeEventListener('gee-workspace-changed', changed); window.removeEventListener('online', changed); window.removeEventListener('storage', storage) }
}
