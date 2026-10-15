import { useState } from 'react'
import { ClipboardPaste, FileText, ListTodo, Shirt } from 'lucide-react'
import { toast } from 'sonner'
import { useShop, newId } from '../../stores/shop'
import { uid, type ShopNote, type Task } from '../../types/domain'
import DialogFrame from '../../components/DialogFrame'
import OrderForm from '../orders/OrderForm'

export default function QuickCreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [tab, setTab] = useState<'order' | 'task' | 'note'>('order')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [orderDirty, setOrderDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const { addTask, addNote } = useShop()
  const hasDraft = Boolean(title.trim() || description.trim() || dueAt)
  const confirmDiscard = () => !((tab === 'order' && orderDirty) || (tab !== 'order' && hasDraft)) || window.confirm(`Discard unsaved ${tab} changes?`)
  const clearDraft = () => { setOrderDirty(false); setTitle(''); setDescription(''); setDueAt('') }
  const close = (force = false) => { if (saving && !force) return false; if (!force && !confirmDiscard()) return false; clearDraft(); onOpenChange(false); return true }
  const requestOpenChange = (next: boolean) => { if (!next && (saving || !confirmDiscard())) return; if (!next) clearDraft(); onOpenChange(next) }
  const chooseTab = (next: 'order' | 'task' | 'note') => { if (saving || (tab !== next && !confirmDiscard())) return; if (tab !== next) clearDraft(); setTab(next) }
  const saveTask = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim() || saving) return
    const task: Task = { id: newId(), title: title.trim(), description: description.trim(), orderId: null, priority: 'normal', status: 'open', dueAt: dueAt ? new Date(dueAt).toISOString() : null, assignee: '', labels: [], checklist: [], comments: [], attachments: [], createdAt: new Date().toISOString(), completedAt: null, archivedAt: null, sortOrder: Date.now() }
    setSaving(true)
    try { await addTask(task); toast.success('Task added'); close(true) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create task') }
    finally { setSaving(false) }
  }
  const saveNote = async (event: React.FormEvent) => {
    event.preventDefault()
    if ((!title.trim() && !description.trim()) || saving) return
    const note: ShopNote = { id: uid(), title: title.trim(), content: description, type: 'general', orderId: null, labels: [], attachments: [], pinned: false, updatedAt: new Date().toISOString() }
    setSaving(true)
    try { await addNote(note); toast.success('Note saved'); close(true) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save note') }
    finally { setSaving(false) }
  }
  return <DialogFrame open={open} onOpenChange={requestOpenChange} title="Create something new" description="Capture the next handoff without slowing down.">
    <div className="quick-tabs" role="tablist" aria-label="New item type">
      <button className={tab === 'order' ? 'active' : ''} role="tab" aria-selected={tab === 'order'} onClick={() => chooseTab('order')}><Shirt size={15} /> Order</button>
      <button className={tab === 'task' ? 'active' : ''} role="tab" aria-selected={tab === 'task'} onClick={() => chooseTab('task')}><ListTodo size={15} /> Task</button>
      <button className={tab === 'note' ? 'active' : ''} role="tab" aria-selected={tab === 'note'} onClick={() => chooseTab('note')}><FileText size={15} /> Note</button>
    </div>
    {tab === 'order' && <OrderForm onDirtyChange={setOrderDirty} onSaved={() => close(true)} />}
    {tab === 'task' && <form className="form-stack" onSubmit={saveTask}><label className="field">Task title<input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="What needs to get done?" required /></label><label className="field">Description<textarea rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="Add useful context" /></label><label className="field">Due date and time<input type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} /></label><div className="dialog-footer"><button type="button" className="button button-quiet" onClick={() => close()} disabled={saving}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create task'}</button></div></form>}
    {tab === 'note' && <form className="form-stack" onSubmit={saveNote}><label className="field">Note title<input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="Give this note a name" /></label><label className="field">Note content<textarea rows={6} value={description} onChange={event => setDescription(event.target.value)} placeholder="Write down the details worth keeping..." /></label><div className="dialog-footer"><button type="button" className="button button-quiet" onClick={() => close()} disabled={saving}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save note'}</button></div></form>}
    <div className="capture-shortcut"><ClipboardPaste size={14} /> Have a list? <button type="button" onClick={() => { if (close()) window.location.href = '/orders?capture=1' }}>Import with Quick Capture</button></div>
  </DialogFrame>
}
