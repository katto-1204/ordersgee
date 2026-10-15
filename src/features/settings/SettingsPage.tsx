import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownToLine, Bell, Check, Moon, Plus, Sun, Tag, Trash2, Users, Workflow } from 'lucide-react'
import { toast } from 'sonner'
import { useShop, newId } from '../../stores/shop'
import { db } from '../../db/database'
import { labelTextColor } from '../../components/Chips'
import type { Order, ShopLabel, ShopNote, Task } from '../../types/domain'
import GoogleSheetsSettings from './GoogleSheetsSettings'

function download(name: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url)
}

export default function SettingsPage() {
  const { orders, tasks, labels, settings, setTheme, updateSettings, addLabel, load } = useShop()
  const [shopName, setShopName] = useState(settings?.shopName ?? 'Gee Graphics')
  const [stageName, setStageName] = useState('')
  const [labelName, setLabelName] = useState('')
  const [labelColor, setLabelColor] = useState('#fce7f3')
  const [memberName, setMemberName] = useState('')
  const [members, setMembers] = useState(settings?.teamMembers ?? [])
  const [busy, setBusy] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const activeOrders = orders.filter(order => !order.archivedAt).length
  const customStages = settings?.customStages ?? []
  const saveLogo = async (file?: File) => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) { toast.error('Use a PNG, JPG or WEBP logo under 1 MB.'); return }
    const dataUrl = await new Promise<string>(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file) })
    await updateSettings({ logoDataUrl: dataUrl }); toast.success('Shop logo saved on this device')
  }
  const setReminders = async (enabled: boolean) => {
    if (!enabled) { await updateSettings({ remindersEnabled: false }); return }
    if (!('Notification' in window)) { toast.error('Browser notifications are not supported here.'); return }
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
    if (permission !== 'granted') { toast.error('Allow notifications in your browser to turn reminders on.'); return }
    await updateSettings({ remindersEnabled: true }); toast.success('Daily browser reminders enabled')
  }

  const saveShop = async () => { await updateSettings({ shopName: shopName.trim() || 'Gee Graphics' }); toast.success('Shop settings saved') }
  const addStage = async (event: React.FormEvent) => { event.preventDefault(); const label = stageName.trim(); if (!label) return; const key = `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`; if (customStages.some(item => item.key === key)) { toast.error('That stage already exists'); return } await updateSettings({ customStages: [...customStages, { key, label }] }); setStageName(''); toast.success('Production stage added') }
  const removeStage = async (key: string) => { if (orders.some(order => order.stage === key)) { toast.error('Move orders off this stage before removing it.'); return }; await updateSettings({ customStages: customStages.filter(item => item.key !== key) }); toast.success('Stage removed') }
  const addCustomLabel = async (event: React.FormEvent) => { event.preventDefault(); const name = labelName.trim().toUpperCase(); if (!name) return; if (labels.some(item => item.name === name)) { toast.error('A label with that name already exists.'); return }; const label: ShopLabel = { id: newId(), name, color: labelColor, category: 'custom' }; await addLabel(label); setLabelName(''); toast.success('Custom label added') }
  const renameLabel = async (label: ShopLabel) => {
    const name = window.prompt('Rename label', label.name)?.trim().toUpperCase()
    if (!name || name === label.name) return
    if (labels.some(item => item.name === name)) { toast.error('That label name is already used.'); return }
    await db.transaction('rw', db.labels, db.orders, db.tasks, db.notes, async db => {
      await db.labels.update(label.id, { name })
      for (const order of await db.orders.toArray()) if (order.labels.includes(label.name)) await db.orders.update(order.id, { labels: order.labels.map(value => value === label.name ? name : value) })
      for (const task of await db.tasks.toArray()) if (task.labels.includes(label.name)) await db.tasks.update(task.id, { labels: task.labels.map(value => value === label.name ? name : value) })
      for (const note of await db.notes.toArray()) if (note.labels.includes(label.name)) await db.notes.update(note.id, { labels: note.labels.map(value => value === label.name ? name : value) })
    })
    await load(); toast.success('Label renamed')
  }
  const removeLabel = async (label: ShopLabel) => { if (!window.confirm(`Remove “${label.name}” from the label set? It will also be unassigned from orders, tasks and notes.`)) return; await db.transaction('rw', db.labels, db.orders, db.tasks, db.notes, async db => { await db.labels.delete(label.id); for (const order of await db.orders.toArray()) if (order.labels.includes(label.name)) await db.orders.update(order.id, { labels: order.labels.filter(value => value !== label.name) }); for (const task of await db.tasks.toArray()) if (task.labels.includes(label.name)) await db.tasks.update(task.id, { labels: task.labels.filter(value => value !== label.name) }); for (const note of await db.notes.toArray()) if (note.labels.includes(label.name)) await db.notes.update(note.id, { labels: note.labels.filter(value => value !== label.name) }) }); await load(); toast.success('Label removed') }
  const exportJson = async () => { const [allOrders, allTasks, notes, allLabels] = await Promise.all([db.orders.toArray(), db.tasks.toArray(), db.notes.toArray(), db.labels.toArray()]); download(`gee-tasks-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), orders: allOrders, tasks: allTasks, notes, labels: allLabels, settings }, null, 2), 'application/json'); toast.success('JSON backup downloaded') }
  const exportCsv = () => { const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`; const csv = [['Customer / Team', 'Reference', 'Product', 'Stage', 'Priority', 'Quantity', 'Due date', 'Assignee', 'Labels', 'Notes'].map(escape).join(','), ...orders.map(order => [order.customerName, order.reference, order.productType, order.stage, order.priority, order.quantity, order.dueAt, order.assignee, order.labels.join('; '), order.notes].map(escape).join(','))].join('\n'); download('gee-tasks-orders.csv', csv, 'text/csv;charset=utf-8'); toast.success('Orders CSV downloaded') }
  const importJson = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try {
      const parsed = JSON.parse(await file.text()) as { orders?: Partial<Order>[]; tasks?: Partial<Task>[]; notes?: Partial<ShopNote>[]; labels?: Partial<ShopLabel>[]; settings?: Record<string, unknown> }
      const groups = [parsed.orders, parsed.tasks, parsed.notes, parsed.labels]
      if (!groups.some(Array.isArray)) throw new Error('The file does not look like a GEE TASKS JSON backup.')
      const now = new Date().toISOString()
      const importedOrders: Order[] = []
      const importedTasks: Task[] = []
      const importedNotes: ShopNote[] = []
      const importedLabels: ShopLabel[] = []
      const orderIds = new Map<string, string>()
      const sourceKeys = new Set(orders.map(order => (order.sourceText || `${order.customerName} - ${order.stage}`).trim().replace(/\s+/g, ' ').toLowerCase()))
      for (const item of parsed.orders ?? []) {
        if (!item.customerName || !item.stage) continue
        const source = (item.sourceText || `${item.customerName} - ${item.stage}`).trim().replace(/\s+/g, ' ').toLowerCase()
        const duplicate = orders.find(order => order.customerName.trim().toLowerCase() === item.customerName!.trim().toLowerCase() && (!!item.reference && order.reference === item.reference || order.sourceText && sourceKeys.has(source)))
        if (duplicate) { if (item.id) orderIds.set(item.id, duplicate.id); continue }
        if (sourceKeys.has(source)) continue
        const id = newId(); if (item.id) orderIds.set(item.id, id); sourceKeys.add(source)
        importedOrders.push({ id, customerName: item.customerName, reference: item.reference ?? '', productType: item.productType ?? 'Jersey', quantity: item.quantity ?? null, sizeBreakdown: item.sizeBreakdown ?? {}, stage: item.stage, priority: item.priority ?? 'normal', dueAt: item.dueAt ?? null, assignee: item.assignee ?? '', labels: item.labels ?? [], notes: item.notes ?? '', checklist: item.checklist ?? [], attachments: item.attachments ?? [], approvalStatus: item.approvalStatus ?? 'draft', ownerOverrideAt: item.ownerOverrideAt ?? null, sourceText: item.sourceText ?? '', createdAt: item.createdAt ?? now, updatedAt: now, completedAt: item.completedAt ?? null, archivedAt: item.archivedAt ?? null })
      }
      const taskTitles = new Set(tasks.map(task => task.title.trim().toLowerCase()))
      for (const item of parsed.tasks ?? []) {
        if (!item.title || taskTitles.has(item.title.trim().toLowerCase())) continue
        taskTitles.add(item.title.trim().toLowerCase())
        importedTasks.push({ id: newId(), title: item.title, description: item.description ?? '', orderId: item.orderId ? orderIds.get(item.orderId) ?? orders.find(order => order.id === item.orderId)?.id ?? null : null, priority: item.priority ?? 'normal', status: item.status ?? 'open', dueAt: item.dueAt ?? null, assignee: item.assignee ?? '', labels: item.labels ?? [], checklist: item.checklist ?? [], comments: item.comments ?? [], attachments: item.attachments ?? [], createdAt: item.createdAt ?? now, completedAt: item.completedAt ?? null, archivedAt: item.archivedAt ?? null, sortOrder: item.sortOrder ?? Date.now() + importedTasks.length })
      }
      const noteKeys = new Set((await db.notes.toArray()).map(note => `${note.title.trim().toLowerCase()}|${note.content.trim().toLowerCase()}`))
      for (const item of parsed.notes ?? []) {
        if (!item.title && !item.content) continue
        const key = `${(item.title ?? '').trim().toLowerCase()}|${(item.content ?? '').trim().toLowerCase()}`
        if (noteKeys.has(key)) continue
        noteKeys.add(key)
        importedNotes.push({ id: newId(), title: item.title ?? '', content: item.content ?? '', type: item.type ?? 'general', orderId: item.orderId ? orderIds.get(item.orderId) ?? orders.find(order => order.id === item.orderId)?.id ?? null : null, labels: item.labels ?? [], attachments: item.attachments ?? [], pinned: item.pinned ?? false, updatedAt: now })
      }
      const existingLabelNames = new Set(labels.map(label => label.name.toLowerCase()))
      for (const item of parsed.labels ?? []) {
        if (!item.name || existingLabelNames.has(item.name.toLowerCase())) continue
        existingLabelNames.add(item.name.toLowerCase())
        importedLabels.push({ id: newId(), name: item.name.toUpperCase(), color: item.color ?? '#e5e7eb', category: item.category ?? 'custom' })
      }
      await db.transaction('rw', db.orders, db.tasks, db.notes, db.labels, db.settings, async db => {
        if (importedOrders.length) await db.orders.bulkPut(importedOrders)
        if (importedTasks.length) await db.tasks.bulkPut(importedTasks)
        if (importedNotes.length) await db.notes.bulkPut(importedNotes)
        if (importedLabels.length) await db.labels.bulkPut(importedLabels)
        if (parsed.settings && typeof parsed.settings.shopName === 'string') await db.settings.update('shop', { shopName: parsed.settings.shopName.slice(0, 120), sharedSettingsUpdatedAt: now, updatedAt: now })
      })
      const added = importedOrders.length + importedTasks.length + importedNotes.length + importedLabels.length
      await load(); toast.success(`${added} record${added === 1 ? '' : 's'} imported`)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not read backup') } finally { setBusy(false) }
  }
  const addMember = async (event: React.FormEvent) => { event.preventDefault(); const name = memberName.trim(); if (!name) return; if (members.some(person => person.toLowerCase() === name.toLowerCase())) { toast.error('That team member is already listed.'); return }; const next = [...members, name]; setMembers(next); await updateSettings({ teamMembers: next }); setMemberName('') }
  const removeMember = async (name: string) => { const next = members.filter(item => item !== name); setMembers(next); await updateSettings({ teamMembers: next }) }

  return <div className="page-stack settings-page">
    <header className="page-heading-row"><div><span className="eyebrow">WORKSPACE CONTROL</span><h1>Settings</h1><p className="page-subtitle">Make the workflow fit the way Gee Graphics works.</p></div><span className="settings-version">GEE TASKS · v1.0.0</span></header>
    <div className="settings-layout"><nav className="settings-toc"><a href="#shop">Shop profile</a><a href="#appearance">Appearance</a><a href="#workflow">Workflow</a><a href="#labels">Labels</a><a href="#team">Team</a><a href="#notifications">Notifications</a><a href="#data">Data & backup</a><a href="#account">Google Sheets</a></nav>
      <div className="settings-content">
        <section className="settings-card" id="shop"><div className="settings-card-title"><div className="settings-icon"><ShirtIcon /></div><div><h2>Shop profile</h2><p>Workspace name and shop identity.</p></div></div><div className="settings-inline-form"><label className="field">Shop name<input value={shopName} onChange={event => setShopName(event.target.value)} /></label><button className="button button-primary" onClick={() => void saveShop()}><Check size={14} /> Save</button></div><div className="shop-logo-row">{settings?.logoDataUrl ? <img src={settings.logoDataUrl} alt={`${shopName} logo`} /> : <span className="shop-logo-placeholder">GG</span>}<span><strong>Shop logo</strong><small>Stored in localStorage. PNG, JPG or WEBP · max 1 MB</small></span><button className="button button-quiet" onClick={() => logoRef.current?.click()}><Plus size={14} /> Choose logo</button><input ref={logoRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={event => { void saveLogo(event.target.files?.[0]); event.currentTarget.value = '' }} /></div></section>
        <section className="settings-card" id="appearance"><div className="settings-card-title"><div className="settings-icon"><Sun size={17} /></div><div><h2>Appearance</h2><p>Choose a theme for the production floor.</p></div></div><div className="theme-choice-row"><button className={`theme-choice ${settings?.theme === 'light' ? 'selected' : ''}`} onClick={() => void setTheme('light')}><Sun size={17} /><span><strong>Light</strong><small>Bright and clear</small></span>{settings?.theme === 'light' && <Check size={15} />}</button><button className={`theme-choice ${settings?.theme === 'dark' ? 'selected' : ''}`} onClick={() => void setTheme('dark')}><Moon size={17} /><span><strong>Dark</strong><small>Reduced glare</small></span>{settings?.theme === 'dark' && <Check size={15} />}</button></div></section>
        <section className="settings-card" id="workflow"><div className="settings-card-title"><div className="settings-icon"><Workflow size={17} /></div><div><h2>Custom production stages</h2><p>Extend the default stages without editing source code.</p></div></div><form className="settings-inline-form" onSubmit={event => void addStage(event)}><label className="field">Stage name<input value={stageName} onChange={event => setStageName(event.target.value)} placeholder="Quality check, packing..." /></label><button className="button button-quiet" type="submit"><Plus size={14} /> Add stage</button></form><div className="settings-chip-list">{customStages.map(stage => <span className="setting-chip" key={stage.key}>{stage.label}<button aria-label={`Remove ${stage.label}`} onClick={() => void removeStage(stage.key)}><Trash2 size={12} /></button></span>)}{!customStages.length && <small className="muted-copy">No custom stages yet.</small>}</div></section>
        <section className="settings-card" id="labels"><div className="settings-card-title"><div className="settings-icon"><Tag size={17} /></div><div><h2>Labels</h2><p>Create, rename, recolor and remove reusable shop labels.</p></div></div><form className="settings-inline-form label-create-form" onSubmit={event => void addCustomLabel(event)}><label className="field">New label<input value={labelName} onChange={event => setLabelName(event.target.value)} placeholder="e.g. CLIENT PICKUP" /></label><label className="field color-field">Color<input type="color" value={labelColor} onChange={event => setLabelColor(event.target.value)} /></label><button className="button button-quiet" type="submit"><Plus size={14} /> Add label</button></form><div className="managed-labels">{labels.map(label => <div className="managed-label" key={label.id}><span className="label-chip" style={{ '--label-color': label.color, color: labelTextColor(label.color) } as React.CSSProperties}>{label.name}</span><small>{label.category}</small><input type="color" aria-label={`Change color for ${label.name}`} value={label.color} onChange={event => void db.labels.update(label.id, { color: event.target.value }).then(load)} /><button className="micro-action" aria-label={`Rename ${label.name}`} onClick={() => void renameLabel(label)}><span className="sr-only">Rename</span>↗</button><button className="micro-action" aria-label={`Remove ${label.name}`} onClick={() => void removeLabel(label)}><Trash2 size={13} /></button></div>)}</div></section>
        <section className="settings-card" id="team"><div className="settings-card-title"><div className="settings-icon"><Users size={17} /></div><div><h2>Team members</h2><p>Maintain an assignment list for shop work.</p></div></div><form className="settings-inline-form" onSubmit={event => void addMember(event)}><label className="field">Add team member<input value={memberName} onChange={event => setMemberName(event.target.value)} placeholder="Name" /></label><button className="button button-quiet" type="submit"><Plus size={14} /> Add person</button></form><div className="settings-chip-list">{members.map(name => <span className="setting-chip" key={name}>{name}<button aria-label={`Remove ${name}`} onClick={() => void removeMember(name)}><Trash2 size={12} /></button></span>)}{!members.length && <small className="muted-copy">No team members listed. Orders can still use free-text assignees.</small>}</div></section>
        <section className="settings-card" id="notifications"><div className="settings-card-title"><div className="settings-icon"><Bell size={17} /></div><div><h2>Notifications</h2><p>Optional browser reminders while the app is open.</p></div></div><label className="notification-option"><input type="checkbox" checked={settings?.remindersEnabled ?? false} onChange={event => void setReminders(event.target.checked)} /><span><strong>Daily production reminder</strong><small>Show a browser notification when tasks or orders are overdue or due today. Notifications are delivered by this open browser; this is not a push-service guarantee.</small></span></label></section>
        <section className="settings-card" id="data"><div className="settings-card-title"><div className="settings-icon"><ArrowDownToLine size={17} /></div><div><h2>Data & backup</h2><p>{activeOrders} active orders · {tasks.length} tasks · saved in this browser.</p></div></div><div className="settings-button-row"><button className="button button-quiet" onClick={() => void exportCsv()}><ArrowDownToLine size={14} /> Export orders CSV</button><button className="button button-quiet" onClick={() => void exportJson()}><ArrowDownToLine size={14} /> Export full JSON</button><button className="button button-quiet" disabled={busy} onClick={() => importRef.current?.click()}><Plus size={14} /> Import JSON</button><Link className="button button-quiet" to="/completed"><Trash2 size={14} /> Manage archive</Link><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={event => { void importJson(event.target.files?.[0]); event.currentTarget.value = '' }} /></div><small className="muted-copy">Import adds records and skips matching orders, tasks, notes and labels. JSON is for GEE TASKS backup files; exports include orders, tasks, notes, labels and settings.</small></section>
        <GoogleSheetsSettings />
      </div>
    </div>
  </div>
}

function ShirtIcon() { return <span className="shirt-setting-mark">GG</span> }
