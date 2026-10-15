import { useEffect, useState } from 'react'
import { Activity, Check, MessageSquare, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import DialogFrame from '../../components/DialogFrame'
import ChecklistEditor from '../../components/ChecklistEditor'
import AssetAttachments from '../../components/AssetAttachments'
import { useShop } from '../../stores/shop'
import { type Attachment, type ChecklistItem, type Task } from '../../types/domain'

export default function TaskDetailDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { orders, labels, updateTask } = useShop()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Task['priority']>('normal')
  const [dueAt, setDueAt] = useState('')
  const [assignee, setAssignee] = useState('')
  const [orderId, setOrderId] = useState('')
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [comments, setComments] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!task) return
    setTitle(task.title); setDescription(task.description); setPriority(task.priority); setDueAt(task.dueAt ? toDateTimeInput(task.dueAt) : '')
    setAssignee(task.assignee); setOrderId(task.orderId ?? ''); setSelectedLabels(task.labels); setChecklist(task.checklist); setAttachments(task.attachments); setComments(task.comments)
  }, [task?.id])
  if (!task) return <DialogFrame open={false} onOpenChange={onClose} title="Task details"><div /></DialogFrame>
  const dirty = title !== task.title || description !== task.description || priority !== task.priority || dueAt !== (task.dueAt ? toDateTimeInput(task.dueAt) : '') || assignee !== task.assignee || orderId !== (task.orderId ?? '') || JSON.stringify(selectedLabels) !== JSON.stringify(task.labels) || JSON.stringify(checklist) !== JSON.stringify(task.checklist) || JSON.stringify(attachments) !== JSON.stringify(task.attachments) || JSON.stringify(comments) !== JSON.stringify(task.comments)
  const requestClose = () => { if (dirty && !window.confirm('Discard unsaved task changes?')) return; onClose() }
  const save = async (next: Partial<Task> = {}) => {
    if (!title.trim()) { toast.error('Add a task title before saving.'); return }
    setSaving(true)
    try {
      await updateTask({ ...task, title: title.trim(), description: description.trim(), priority, dueAt: dueAt ? new Date(dueAt).toISOString() : null, assignee: assignee.trim(), orderId: orderId || null, labels: selectedLabels, checklist, attachments, comments, ...next }, 'Task details updated')
      toast.success('Task saved')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save task') } finally { setSaving(false) }
  }
  const addComment = async (event: React.FormEvent) => {
    event.preventDefault(); if (!comment.trim()) return
    const next = [...comments, `${new Date().toISOString()} · ${comment.trim()}`]
    setComments(next); setComment(''); await save({ comments: next })
  }
  return <DialogFrame open onOpenChange={open => !open && requestClose()} title="Task details" description={task.orderId ? `Linked to ${orders.find(order => order.id === task.orderId)?.customerName ?? 'an order'}` : 'Standalone task'} wide>
    <div className="form-stack task-detail-form"><label className="field">Title<input autoFocus required aria-label="Task title" value={title} onChange={event => setTitle(event.target.value)} /></label><label className="field">Description<textarea rows={3} value={description} onChange={event => setDescription(event.target.value)} /></label><div className="form-grid"><label className="field">Priority<select value={priority} onChange={event => setPriority(event.target.value as Task['priority'])}><option value="urgent">Urgent</option><option value="high">High priority</option><option value="normal">Normal</option><option value="low">Low priority</option></select></label><label className="field">Assigned person<input value={assignee} onChange={event => setAssignee(event.target.value)} /></label><label className="field">Due date and time<input type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} /></label><label className="field">Linked order<select value={orderId} onChange={event => setOrderId(event.target.value)}><option value="">Standalone task</option>{orders.filter(order => !order.archivedAt || order.id === orderId).map(order => <option key={order.id} value={order.id}>{order.customerName} · {order.reference || order.productType}{order.archivedAt ? " (archived)" : ""}</option>)}</select></label></div><fieldset className="form-fieldset"><legend>Labels</legend><div className="label-picker">{labels.map(label => <label key={label.id} className={`label-choice ${selectedLabels.includes(label.name) ? 'selected' : ''}`}><input type="checkbox" checked={selectedLabels.includes(label.name)} onChange={event => setSelectedLabels(current => event.target.checked ? [...current, label.name] : current.filter(name => name !== label.name))} /><span className="label-chip" style={{ '--label-color': label.color } as React.CSSProperties}>{label.name}</span></label>)}</div></fieldset><div className="form-fieldset"><div className="fieldset-title">Checklist</div><ChecklistEditor items={checklist} onChange={setChecklist} /></div><div className="form-fieldset"><AssetAttachments label="Task designs & files" attachments={attachments} onChange={setAttachments} /><p className="asset-help">Save the task to keep attachment changes.</p></div><div className="form-fieldset"><div className="fieldset-title"><MessageSquare size={13} /> Comments</div><div className="task-comments">{comments.map((entry, index) => { const [date, text] = entry.split(' · ', 2); return <div key={`${index}-${date}`}><small>{Number.isNaN(Date.parse(date)) ? 'Comment' : format(new Date(date), 'MMM d · h:mm a')}</small><p>{text ?? entry}</p></div> })}{!comments.length && <small className="muted-copy">No comments yet.</small>}</div><form className="comment-entry" onSubmit={event => void addComment(event)}><input aria-label="Write a comment" value={comment} onChange={event => setComment(event.target.value)} placeholder="Add a comment..." /><button className="icon-button" aria-label="Add comment"><Plus size={16} /></button></form></div><div className="dialog-footer"><button className="button button-quiet" onClick={requestClose}>Close</button><button className="button button-primary" disabled={saving} onClick={() => void save()}><Check size={14} />{saving ? 'Saving…' : 'Save task'}</button></div><div className="task-record-meta"><Activity size={12} /> Created {format(new Date(task.createdAt), 'MMM d, yyyy')}{task.completedAt && ` · Completed ${format(new Date(task.completedAt), 'MMM d, yyyy')}`}</div></div>
  </DialogFrame>
}

function toDateTimeInput(value: string) { const date = new Date(value); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16) }
