import { useState } from 'react'
import { ArchiveRestore, Check, Clock3, RotateCcw, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useShop } from '../../stores/shop'
import { StageBadge } from '../../components/Chips'

export default function CompletedPage() {
  const { orders, tasks, updateOrder, updateTask, completeTask, removeOrder } = useShop()
  const [view, setView] = useState<'completed' | 'archived'>('completed')
  const rows = view === 'completed'
    ? orders.filter(order => order.stage === 'finished' && !order.archivedAt)
    : orders.filter(order => Boolean(order.archivedAt))
  const taskRows = view === 'completed' ? tasks.filter(task => task.status === 'completed' && !task.archivedAt) : tasks.filter(task => Boolean(task.archivedAt))
  const restoreOrder = async (id: string) => { const order = orders.find(item => item.id === id); if (!order) return; await updateOrder({ ...order, archivedAt: null, stage: order.stage === 'finished' ? 'to-deliver' : order.stage, completedAt: null }, 'Order restored'); toast.success('Order restored to production') }
  const restoreTask = async (id: string) => { const task = tasks.find(item => item.id === id); if (!task) return; await updateTask({ ...task, archivedAt: null, status: task.status === 'completed' ? 'open' : task.status, completedAt: null }, 'Task restored'); toast.success('Task restored') }
  return <div className="page-stack">
    <header className="page-heading-row"><div><span className="eyebrow">WORK HISTORY</span><h1>Completed</h1><p className="page-subtitle">Finished work, with an easy path back when plans change.</p></div><div className="tab-switch"><button className={view === 'completed' ? 'active' : ''} onClick={() => setView('completed')}><Check size={13} /> Completed</button><button className={view === 'archived' ? 'active' : ''} onClick={() => setView('archived')}><ArchiveRestore size={13} /> Archive</button></div></header>
    <section className="task-list-section"><div className="task-list-heading"><h2>{view === 'completed' ? 'FINISHED ORDERS' : 'ARCHIVED ORDERS'}</h2><span>{rows.length}</span></div>{rows.map(order => <div className="completed-row" key={order.id}><span className="completed-marker"><Check size={13} /></span><div><strong>{order.customerName}</strong><small>{order.reference || 'Reference not set'} · {order.productType}</small></div><StageBadge stage={order.stage} />{order.completedAt && <time><Clock3 size={12} />{format(new Date(order.completedAt), 'MMM d, yyyy')}</time>}{view === 'archived' && <button className="text-button" onClick={() => void restoreOrder(order.id)}><RotateCcw size={13} /> Restore</button>}{view === 'completed' && <button className="text-button" onClick={() => void updateOrder({ ...order, stage: 'to-deliver', completedAt: null }, 'Order reopened')}><RotateCcw size={13} /> Reopen</button>}{view === 'archived' && <button className="micro-action" aria-label={`Permanently delete ${order.customerName}`} onClick={() => { if (window.confirm(`Permanently delete ${order.customerName}?`)) { void removeOrder(order.id); toast.success('Order deleted') } }}><Trash2 size={14} /></button>}</div>)}{!rows.length && <div className="task-empty">{view === 'completed' ? 'Finished orders will collect here.' : 'Archived orders will appear here until restored.'}</div>}</section>
    <section className="task-list-section"><div className="task-list-heading"><h2>{view === 'completed' ? 'COMPLETED TASKS' : 'ARCHIVED TASKS'}</h2><span>{taskRows.length}</span></div>{taskRows.map(task => <div className="completed-row" key={task.id}><span className="completed-marker"><Check size={13} /></span><div><strong>{task.title}</strong><small>{task.description || 'Task'}</small></div>{task.completedAt && <time><Clock3 size={12} />{format(new Date(task.completedAt), 'MMM d, yyyy')}</time>}{view === 'archived' ? <button className="text-button" onClick={() => void restoreTask(task.id)}><RotateCcw size={13} /> Restore</button> : <button className="text-button" onClick={() => void completeTask(task.id, false)}><RotateCcw size={13} /> Reopen</button>}</div>)}{!taskRows.length && <div className="task-empty">{view === 'completed' ? 'Completed tasks will collect here.' : 'Archived tasks can be restored here.'}</div>}</section>
  </div>
}
