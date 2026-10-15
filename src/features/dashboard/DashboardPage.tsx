import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowRight, CalendarClock, Check, Clock3, PackageCheck, Shirt, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { useShop } from '../../stores/shop'
import { isDueToday, localDayRange, philippinesDateLabel, philippinesTimeLabel } from '../../lib/time'
import { STAGE_LABELS } from '../../types/domain'
import { toast } from 'sonner'
import { DashboardGettingStarted } from '../../components/GettingStarted'

function SectionTitle({ title, count, to, action }: { title: string; count?: number; to?: string; action?: string }) {
  return <div className="section-title"><div><h2>{title}</h2>{typeof count === 'number' && <span className="section-count">{count}</span>}</div>{to && <Link to={to}>{action ?? 'View all'} <ArrowRight size={14} /></Link>}</div>
}

export default function DashboardPage() {
  const { orders, tasks, updateStage } = useShop()
  const [now, setNow] = useState(new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer) }, [])
  const active = orders.filter(order => !order.archivedAt && order.stage !== 'finished' && order.stage !== 'cancelled')
  const dueToday = [...orders.filter(order => !order.archivedAt && isDueToday(order.dueAt, now)), ...tasks.filter(task => !task.archivedAt && task.status === 'open' && isDueToday(task.dueAt, now))]
  const overdueOrders = orders.filter(order => !order.archivedAt && order.dueAt && new Date(order.dueAt) < now && order.stage !== 'finished' && order.stage !== 'cancelled')
  const overdueTasks = tasks.filter(task => !task.archivedAt && task.status === 'open' && task.dueAt && new Date(task.dueAt) < now)
  const ready = orders.filter(order => !order.archivedAt && order.stage === 'to-deliver')
  const completedToday = orders.filter(order => order.completedAt && localDayRange(new Date(order.completedAt)) === localDayRange(now)).length + tasks.filter(task => task.completedAt && localDayRange(new Date(task.completedAt)) === localDayRange(now)).length
  const urgent = [
    ...orders.filter(order => !order.archivedAt && !['finished', 'cancelled'].includes(order.stage) && (order.priority === 'urgent' || order.priority === 'high' || Boolean(order.dueAt && new Date(order.dueAt) < now))).map(order => ({ id: order.id, kind: 'order' as const, name: order.customerName, dueAt: order.dueAt, priority: order.priority, stage: order.stage })),
    ...tasks.filter(task => !task.archivedAt && task.status === 'open' && (task.priority === 'urgent' || task.priority === 'high' || Boolean(task.dueAt && new Date(task.dueAt) < now))).map(task => ({ id: task.id, kind: 'task' as const, name: task.title, dueAt: task.dueAt, priority: task.priority })),
  ].sort((a, b) => Number(Boolean(b.dueAt && new Date(b.dueAt) < now)) - Number(Boolean(a.dueAt && new Date(a.dueAt) < now)) || ['urgent', 'high', 'normal', 'low'].indexOf(a.priority) - ['urgent', 'high', 'normal', 'low'].indexOf(b.priority) || (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999')).slice(0, 4)
  const waiting = orders.filter(order => {
    if (order.archivedAt || ['finished', 'cancelled'].includes(order.stage)) return false
    const sizeCount = Object.values(order.sizeBreakdown).reduce((sum, amount) => sum + amount, 0)
    const missingSizes = order.quantity !== null && sizeCount < order.quantity
    const stuck = now.getTime() - new Date(order.updatedAt).getTime() > 7 * 24 * 60 * 60 * 1000
    return ['waiting', 'on-hold'].includes(order.stage) || ['for-approval', 'revision-requested'].includes(order.approvalStatus) || ['WAITING FOR CLIENT', 'FOR APPROVAL', 'NEEDS REVISION', 'WAITING FOR MATERIALS'].some(label => order.labels.includes(label)) || missingSizes || stuck
  }).slice(0, 4)
  const recentlyCompleted = [...orders.filter(order => order.stage === 'finished'), ...tasks.filter(task => task.status === 'completed')].sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, 4)
  const grouped = STAGE_LABELS.filter(item => item.key !== 'cancelled' && item.key !== 'on-hold').map(stage => ({ ...stage, orders: active.filter(order => order.stage === stage.key) })).filter(group => group.orders.length)

  return <div className="page-stack dashboard-page">
    <DashboardGettingStarted />
    <div className="dashboard-hero"><div><span className="eyebrow">{philippinesDateLabel(now).toUpperCase()}</span><h1>Good morning, Boss.</h1><p>Here's what needs attention today.</p></div><div className="hero-time"><span className="time-orbit"><Clock3 size={18} /></span><div><strong>{philippinesTimeLabel(now)}</strong><small>Philippine Standard Time</small></div></div></div>
    <div className="metrics-strip">
      <Metric icon={<Shirt size={17} />} label="Active Orders" value={active.length} tone="red" detail="in production" />
      <Metric icon={<CalendarClock size={17} />} label="Due Today" value={dueToday.length} tone="amber" detail="orders & tasks" />
      <Metric icon={<AlertTriangle size={17} />} label="Overdue" value={overdueOrders.length + overdueTasks.length} tone="red" detail="needs a look" />
      <Metric icon={<PackageCheck size={17} />} label="Ready to Deliver" value={ready.length} tone="green" detail="next handoff" />
      <Metric icon={<Check size={17} />} label="Completed Today" value={completedToday} tone="neutral" detail="finished work" />
    </div>
    <div className="dashboard-columns">
      <div className="dashboard-main-col">
        <section className="dashboard-section"><SectionTitle title="TO DO TODAY" count={dueToday.length} to="/tasks" /><div className="attention-list">{dueToday.slice(0, 5).map(item => <div key={item.id} className="attention-row"><span className="attention-check"><Check size={12} /></span><div><strong>{'title' in item ? item.title : item.customerName}</strong><small>{'title' in item ? 'Task' : `Order · ${item.reference || 'No reference'}`}</small></div><time>{item.dueAt ? format(new Date(item.dueAt), 'h:mm a') : 'Today'}</time></div>)}{!dueToday.length && <div className="quiet-empty"><span className="empty-icon small"><Check size={16} /></span><div><strong>Clear for today</strong><small>Nothing is due today. Keep the line moving.</small></div></div>}</div></section>
        <section className="dashboard-section"><SectionTitle title="ONGOING PRODUCTION" count={active.length} to="/production" action="Open board" />{grouped.length ? <div className="stage-groups">{grouped.slice(0, 4).map(group => <div className="stage-group" key={group.key}><div className="stage-group-heading"><span className={`stage-marker marker-${group.key}`} /><strong>{group.label}</strong><span>{group.orders.length}</span></div><div className="stage-group-orders">{group.orders.slice(0, 3).map(order => <Link key={order.id} to={`/orders/${order.id}`} className="mini-order"><span className="mini-order-avatar">{order.customerName.slice(0, 1)}</span><div><strong>{order.customerName}</strong><small>{order.reference || 'Reference not set'}</small></div><span className="mini-order-tag">{order.labels[0] ?? group.label.toUpperCase()}</span></Link>)}</div></div>)}</div> : <div className="quiet-empty"><div><strong>No active production yet</strong><small>Add an order to start a handoff.</small></div><Link to="/orders" className="text-button">Add an order <ArrowRight size={13} /></Link></div>}</section>
      </div>
      <div className="dashboard-side-col">
        <section className="dashboard-section urgent-section"><SectionTitle title="URGENT" count={urgent.length} to="/orders" /><div className="urgent-stack">{urgent.map(item => <div className="urgent-row" key={`${item.kind}-${item.id}`}><div className="urgent-icon"><Zap size={15} /></div><div><Link to={item.kind === 'order' ? `/orders/${item.id}` : '/tasks'}><strong>{item.name}</strong></Link><small>{item.dueAt && new Date(item.dueAt) < now ? 'Past due' : `${item.priority === 'urgent' ? 'Urgent' : 'High priority'}${item.kind === 'order' ? ` · ${STAGE_LABELS.find(stage => stage.key === item.stage)?.label ?? item.stage}` : ' · Task'}`}</small></div><button aria-label={item.kind === 'order' ? `Mark ${item.name} finished` : `Complete ${item.name}`} className="icon-button" onClick={async () => { if (item.kind === 'order') { if (await updateStage(item.id, 'finished')) toast.success('Order marked finished') } else { await useShop.getState().completeTask(item.id, true); toast.success('Task completed') } }}><Check size={15} /></button></div>)}{!urgent.length && <div className="quiet-empty compact"><strong>Nothing urgent</strong><small>Priority work will surface here.</small></div>}</div></section>
        <section className="dashboard-section waiting-section"><SectionTitle title="WAITING FOR ACTION" count={waiting.length} to="/orders" /><div className="waiting-stack">{waiting.map(order => <Link className="waiting-row" key={order.id} to={`/orders/${order.id}`}><span className="waiting-dot" /><div><strong>{order.customerName}</strong><small>{waitingReason(order, now)}</small></div><ArrowRight size={14} /></Link>)}{!waiting.length && <div className="quiet-empty compact"><strong>No blockers showing</strong><small>Approvals, holds, missing sizes and stuck stages appear here.</small></div>}</div></section>
        <section className="dashboard-section completed-section"><SectionTitle title="RECENTLY COMPLETED" count={recentlyCompleted.length} to="/completed" /><div className="recent-list">{recentlyCompleted.map(item => <div key={item.id} className="recent-row"><span className="recent-check"><Check size={12} /></span><div><strong>{'customerName' in item ? item.customerName : item.title}</strong><small>{item.completedAt ? format(new Date(item.completedAt), 'MMM d · h:mm a') : 'Completed'}</small></div></div>)}{!recentlyCompleted.length && <div className="quiet-empty compact"><strong>Finished work lands here</strong><small>Completed orders and tasks appear here.</small></div>}</div></section>
      </div>
    </div>
  </div>
}

function Metric({ icon, label, value, tone, detail }: { icon: React.ReactNode; label: string; value: number; tone: string; detail: string }) {
  return <div className={`metric-card metric-${tone}`}><div className="metric-top"><span className="metric-icon">{icon}</span><small>{label}</small></div><strong className="metric-number">{value}</strong><span className="metric-detail">{detail}</span></div>
}

function waitingReason(order: import('../../types/domain').Order, now: Date) {
  if (order.stage === 'on-hold') return 'On hold'
  if (order.approvalStatus === 'for-approval' || order.labels.includes('FOR APPROVAL')) return 'Client approval needed'
  if (order.approvalStatus === 'revision-requested' || order.labels.includes('NEEDS REVISION')) return 'Revision requested'
  if (order.labels.includes('WAITING FOR CLIENT')) return 'Waiting for client'
  if (order.labels.includes('WAITING FOR MATERIALS')) return 'Waiting for materials'
  if (order.quantity !== null && Object.values(order.sizeBreakdown).reduce((sum, amount) => sum + amount, 0) < order.quantity) return 'Size breakdown incomplete'
  if (now.getTime() - new Date(order.updatedAt).getTime() > 7 * 24 * 60 * 60 * 1000) return 'Stuck in stage for over 7 days'
  return STAGE_LABELS.find(item => item.key === order.stage)?.label ?? 'Needs attention'
}
