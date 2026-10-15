import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownWideNarrow, ArrowDown, ArrowUp, Check, Circle, Copy, Filter, GripVertical, Info, Plus, Search, Trash2, Undo2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import DialogFrame from '../../components/DialogFrame'
import ChecklistEditor from '../../components/ChecklistEditor'
import TaskDetailDialog from './TaskDetailDialog'
import AssetAttachments from '../../components/AssetAttachments'
import { useShop, newId } from '../../stores/shop'
import { uid, type Attachment, type ChecklistItem, type Task } from '../../types/domain'
import { isDueToday } from '../../lib/time'
import { LabelPills, labelTextColor } from '../../components/Chips'

export default function TasksPage() {
  const { tasks, orders, labels, completeTask, archiveTask, addTask, updateTask, reorderTask, moveTaskTo } = useShop()
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('all')
  const [assignee, setAssignee] = useState('all')
  const [dueFilter, setDueFilter] = useState('all')
  const [labelFilter, setLabelFilter] = useState('all')
  const [sort, setSort] = useState('deadline')
  const [selected, setSelected] = useState<string[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  useEffect(() => { if (params.get('task')) setDetailTaskId(params.get('task')) }, [params])
  const closeDetail = () => { setDetailTaskId(null); if (params.has('task')) setParams({}, { replace: true }) }
  const [editing, setEditing] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const assignees = [...new Set(tasks.map(task => task.assignee).filter(Boolean))]
  const filtered = useMemo(() => {
    let rows = tasks.filter(task => !task.archivedAt)
    if (search.trim()) rows = rows.filter(task => `${task.title} ${task.description}`.toLowerCase().includes(search.toLowerCase()))
    if (priority !== 'all') rows = rows.filter(task => task.priority === priority)
    if (assignee !== 'all') rows = rows.filter(task => task.assignee === assignee)
    if (labelFilter !== 'all') rows = rows.filter(task => task.labels.includes(labelFilter))
    if (dueFilter === 'today') rows = rows.filter(task => isDueToday(task.dueAt))
    if (dueFilter === 'overdue') rows = rows.filter(task => task.status === 'open' && task.dueAt && new Date(task.dueAt) < new Date())
    rows.sort((a, b) => sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : sort === 'priority' ? ['urgent', 'high', 'normal', 'low'].indexOf(a.priority) - ['urgent', 'high', 'normal', 'low'].indexOf(b.priority) : (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'))
    return rows
  }, [tasks, search, priority, assignee, dueFilter, labelFilter, sort])
  const openTasks = filtered.filter(task => task.status === 'open')
  const doneTasks = filtered.filter(task => task.status === 'completed')
  const detailTask = tasks.find(task => task.id === detailTaskId) ?? null

  const toggleComplete = async (task: Task) => {
    const done = task.status !== 'completed'; await completeTask(task.id, done)
    if (done) toast('Task completed', { description: task.title, action: { label: 'Undo', onClick: () => void completeTask(task.id, false) } })
    else toast.success('Task reopened')
  }
  const bulkComplete = async () => { const count = selected.length; await Promise.all(selected.map(id => completeTask(id, true))); setSelected([]); toast.success(`${count} tasks completed`) }
  const bulkArchive = async () => { const count = selected.length; await Promise.all(selected.map(id => archiveTask(id))); setSelected([]); toast.success(`${count} tasks archived`) }
  const duplicateTask = async (task: Task) => { await addTask({ ...task, id: newId(), title: `${task.title} (copy)`, status: 'open', completedAt: null, archivedAt: null, createdAt: new Date().toISOString(), sortOrder: Date.now() }); toast.success('Task duplicated') }
  const saveInline = async (task: Task) => { if (editTitle.trim() && editTitle !== task.title) await updateTask({ ...task, title: editTitle.trim() }, 'Task title updated'); setEditing(null) }
  return <div className="page-stack">
    <header className="page-heading-row"><div><span className="eyebrow">DAILY EXECUTION</span><h1>My tasks</h1><p className="page-subtitle">Small handoffs, clearly owned.</p></div><div className="heading-actions"><button className="button button-primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> New task</button></div></header>
    <div className="list-toolbar"><div className="toolbar-search"><Search size={15} /><input aria-label="Search tasks" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tasks and descriptions..." /></div><div className="toolbar-actions"><label className="toolbar-button toolbar-select"><Filter size={14} /><select aria-label="Filter priority" value={priority} onChange={event => setPriority(event.target.value)}><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label><label className="toolbar-button toolbar-select"><select aria-label="Filter due date" value={dueFilter} onChange={event => setDueFilter(event.target.value)}><option value="all">Any date</option><option value="today">Due today</option><option value="overdue">Overdue</option></select></label><label className="toolbar-button toolbar-select"><select aria-label="Filter employee" value={assignee} onChange={event => setAssignee(event.target.value)}><option value="all">All people</option>{assignees.map(person => <option key={person}>{person}</option>)}</select></label><label className="toolbar-button toolbar-select"><select aria-label="Filter label" value={labelFilter} onChange={event => setLabelFilter(event.target.value)}><option value="all">All labels</option>{labels.map(label => <option key={label.id}>{label.name}</option>)}</select></label><label className="toolbar-button toolbar-select"><ArrowDownWideNarrow size={14} /><select aria-label="Sort tasks" value={sort} onChange={event => setSort(event.target.value)}><option value="deadline">Deadline</option><option value="newest">Newest</option><option value="priority">Priority</option></select></label></div></div>
    {selected.length > 0 && <div className="bulk-bar"><span>{selected.length} selected</span><button className="text-button" onClick={() => void bulkComplete()}><Check size={14} /> Complete</button><button className="text-button" onClick={() => void bulkArchive()}><Trash2 size={14} /> Archive</button><button className="text-button" onClick={() => setSelected([])}>Clear</button></div>}
    <div className="task-board-list"><section className="task-list-section"><div className="task-list-heading"><h2>OPEN</h2><span>{openTasks.length}</span><button className="text-button" onClick={() => setCreateOpen(true)}><Plus size={14} /> Add task</button></div>{openTasks.map((task, index) => <div className="task-row" key={task.id} draggable onDragStart={event => { event.dataTransfer.setData('text/plain', task.id); event.dataTransfer.effectAllowed = 'move' }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const draggedId = event.dataTransfer.getData('text/plain'); if (draggedId && draggedId !== task.id) void moveTaskTo(draggedId, task.id) }}><span className="task-drag-handle" aria-hidden="true"><GripVertical size={14} /></span><input aria-label={`Select ${task.title}`} type="checkbox" checked={selected.includes(task.id)} onChange={event => setSelected(value => event.target.checked ? [...value, task.id] : value.filter(id => id !== task.id))} /><button className="task-done-button" aria-label={`Complete ${task.title}`} onClick={() => void toggleComplete(task)}><Circle size={17} /></button><div className="task-copy">{editing === task.id ? <input autoFocus value={editTitle} onChange={event => setEditTitle(event.target.value)} onBlur={() => void saveInline(task)} onKeyDown={event => { if (event.key === 'Enter') void saveInline(task); if (event.key === 'Escape') setEditing(null) }} /> : <button className="task-title-button" onClick={() => { setEditing(task.id); setEditTitle(task.title) }}>{task.title}</button>}<small>{task.description || (task.orderId ? `Order · ${orders.find(order => order.id === task.orderId)?.customerName ?? 'Linked order'}` : 'Standalone task')}</small>{task.labels.length > 0 && <LabelPills labels={task.labels} />}</div><div className="task-row-meta">{task.priority !== 'normal' && <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>}{task.dueAt && <time className={new Date(task.dueAt) < new Date() ? 'task-late' : ''}>{format(new Date(task.dueAt), 'MMM d')}</time>}{task.assignee && <span className="assignee-pill">{task.assignee}</span>}</div><div className="task-row-actions"><button aria-label={`Details for ${task.title}`} className="micro-action" onClick={() => setDetailTaskId(task.id)}><Info size={13} /></button><button aria-label="Move task up" className="micro-action" onClick={() => void reorderTask(task.id, -1)} disabled={index === 0}><ArrowUp size={13} /></button><button aria-label="Move task down" className="micro-action" onClick={() => void reorderTask(task.id, 1)} disabled={index === openTasks.length - 1}><ArrowDown size={13} /></button><button aria-label={`Duplicate ${task.title}`} className="micro-action" onClick={() => void duplicateTask(task)}><Copy size={13} /></button><button aria-label={`Archive ${task.title}`} className="micro-action" onClick={() => { void archiveTask(task.id); toast('Task archived', { action: { label: 'Undo', onClick: () => void updateTask({ ...task, archivedAt: null }, 'Task restored') } }) }}><Trash2 size={13} /></button></div></div>)}{!openTasks.length && <div className="task-empty">{filtered.length ? 'All matching tasks are complete.' : 'No open tasks. Add a task or link one to an order.'}</div>}</section>
      {doneTasks.length > 0 && <section className="task-list-section"><div className="task-list-heading"><h2>COMPLETED</h2><span>{doneTasks.length}</span></div>{doneTasks.map(task => <div className="task-row task-row-done" key={task.id}><button className="task-done-button completed" aria-label={`Reopen ${task.title}`} onClick={() => void toggleComplete(task)}><Check size={13} /></button><div className="task-copy"><button className="task-title-button" onClick={() => void toggleComplete(task)}>{task.title}</button><small>Completed {task.completedAt ? format(new Date(task.completedAt), 'MMM d') : ''}</small></div><button className="text-button" aria-label={`Details for ${task.title}`} onClick={() => setDetailTaskId(task.id)}><Info size={13} /> Details</button><button className="text-button" onClick={() => void toggleComplete(task)}><Undo2 size={13} /> Reopen</button></div>)}</section>}
    </div>
    <TaskCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    <TaskDetailDialog task={detailTask} onClose={closeDetail} />
  </div>
}

function TaskCreateDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { addTask, orders, labels } = useShop()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Task['priority']>('normal')
  const [dueAt, setDueAt] = useState('')
  const [orderId, setOrderId] = useState('')
  const [assignee, setAssignee] = useState('')
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [saving, setSaving] = useState(false)
  const reset = () => { setTitle(''); setDescription(''); setPriority('normal'); setDueAt(''); setOrderId(''); setAssignee(''); setSelectedLabels([]); setChecklist([]); setAttachments([]) }
  const hasDraft = Boolean(title.trim() || description.trim() || dueAt || orderId || assignee.trim() || selectedLabels.length || checklist.length || attachments.length || priority !== 'normal')
  const requestClose = (next: boolean) => { if (!next && saving) return; if (!next && hasDraft && !window.confirm('Discard this unsaved task?')) return; if (!next) reset(); onOpenChange(next) }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!title.trim() || saving) return
    const task: Task = { id: uid(), title: title.trim(), description: description.trim(), orderId: orderId || null, priority, status: 'open', dueAt: dueAt ? new Date(dueAt).toISOString() : null, assignee: assignee.trim(), labels: selectedLabels, checklist, comments: [], attachments, createdAt: new Date().toISOString(), completedAt: null, archivedAt: null, sortOrder: Date.now() }
    setSaving(true)
    try { await addTask(task); toast.success('Task created'); onOpenChange(false); reset() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create task') }
    finally { setSaving(false) }
  }
  return <DialogFrame open={open} onOpenChange={requestClose} title="New task" description="A standalone task or a handoff attached to an order."><form className="form-stack" onSubmit={event => void submit(event)}><label className="field">Task title<input autoFocus value={title} onChange={event => setTitle(event.target.value)} required placeholder="What needs to get done?" /></label><label className="field">Description<textarea rows={3} value={description} onChange={event => setDescription(event.target.value)} placeholder="Context, materials, or next step" /></label><div className="form-grid"><label className="field">Priority<select value={priority} onChange={event => setPriority(event.target.value as Task['priority'])}><option value="urgent">Urgent</option><option value="high">High priority</option><option value="normal">Normal</option><option value="low">Low priority</option></select></label><label className="field">Assigned person<input value={assignee} onChange={event => setAssignee(event.target.value)} placeholder="Not assigned" /></label><label className="field">Due date and time<input type="datetime-local" value={dueAt} onChange={event => setDueAt(event.target.value)} /></label><label className="field">Linked order<select value={orderId} onChange={event => setOrderId(event.target.value)}><option value="">Standalone task</option>{orders.filter(order => !order.archivedAt).map(order => <option key={order.id} value={order.id}>{order.customerName} · {order.reference || order.productType}{order.archivedAt ? " (archived)" : ""}</option>)}</select></label></div><fieldset className="form-fieldset"><legend>Labels</legend><div className="label-picker">{labels.map(label => <label key={label.id} className={`label-choice ${selectedLabels.includes(label.name) ? 'selected' : ''}`}><input type="checkbox" checked={selectedLabels.includes(label.name)} onChange={event => setSelectedLabels(current => event.target.checked ? [...current, label.name] : current.filter(name => name !== label.name))} /><span className="label-chip" style={{ '--label-color': label.color, color: labelTextColor(label.color) } as React.CSSProperties}>{label.name}</span></label>)}</div></fieldset><fieldset className="form-fieldset"><legend>Checklist</legend><ChecklistEditor items={checklist} onChange={setChecklist} /></fieldset><div className="form-fieldset"><AssetAttachments label="Task designs & files" attachments={attachments} onChange={setAttachments} /></div><div className="dialog-footer"><button type="button" className="button button-quiet" onClick={() => requestClose(false)} disabled={saving}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Create task'}</button></div></form></DialogFrame>
}
