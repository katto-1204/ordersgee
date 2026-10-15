import { useMemo, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { ArrowLeft, ArrowRight, CalendarDays, Circle, Shirt } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useShop } from '../../stores/shop'

export default function CalendarPage() {
  const { orders, tasks } = useShop()
  const [month, setMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const days = eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) })
  const events = useMemo(() => [
    ...orders.filter(order => order.dueAt && !order.archivedAt).map(order => ({ id: order.id, title: order.customerName, date: new Date(order.dueAt!), kind: 'order' as const, meta: order.reference || 'Order', href: `/orders/${order.id}`, stage: order.stage })),
    ...tasks.filter(task => task.dueAt && !task.archivedAt && task.status === 'open').map(task => ({ id: task.id, title: task.title, date: new Date(task.dueAt!), kind: 'task' as const, meta: task.assignee || 'Task', href: '/tasks', stage: task.priority })),
  ], [orders, tasks])
  const selectedEvents = events.filter(event => isSameDay(event.date, selectedDate)).sort((a, b) => a.date.getTime() - b.date.getTime())
  const monthEvents = events.filter(event => isSameMonth(event.date, month))
  return <div className="page-stack">
    <header className="page-heading-row"><div><span className="eyebrow">DEADLINES & HANDOFFS</span><h1>Calendar</h1><p className="page-subtitle">Due dates shown in your shop's local time.</p></div><div className="calendar-month-nav"><button className="icon-button" aria-label="Previous month" onClick={() => setMonth(current => subMonths(current, 1))}><ArrowLeft size={16} /></button><strong>{format(month, 'MMMM yyyy')}</strong><button className="icon-button" aria-label="Next month" onClick={() => setMonth(current => addMonths(current, 1))}><ArrowRight size={16} /></button></div></header>
    <div className="calendar-layout"><section className="calendar-panel"><div className="calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{days.map(day => {
      const dayEvents = events.filter(event => isSameDay(event.date, day))
      const overdue = day < new Date() && dayEvents.length > 0
      return <button key={day.toISOString()} className={`calendar-day ${!isSameMonth(day, month) ? 'outside' : ''} ${isSameDay(day, selectedDate) ? 'selected' : ''} ${isSameDay(day, new Date()) ? 'today' : ''} ${overdue ? 'day-overdue' : ''}`} onClick={() => setSelectedDate(day)}><span className="calendar-day-number">{format(day, 'd')}</span><span className="calendar-day-dots">{dayEvents.slice(0, 3).map(event => <i key={event.id} className={event.kind} />)}{dayEvents.length > 3 && <small>+{dayEvents.length - 3}</small>}</span><span className="calendar-day-count">{dayEvents.length ? `${dayEvents.length} item${dayEvents.length > 1 ? 's' : ''}` : ''}</span></button>
    })}</div><footer className="calendar-legend"><span><i className="order-dot" />Orders</span><span><i className="task-dot" />Tasks</span><span><i className="overdue-dot" />Past date</span><small>{monthEvents.length} scheduled this month</small></footer></section>
      <aside className="calendar-agenda"><div className="agenda-heading"><div><span className="eyebrow">AGENDA</span><h2>{format(selectedDate, 'EEEE, MMMM d')}</h2></div><CalendarDays size={19} /></div>{selectedEvents.length ? <div className="agenda-events">{selectedEvents.map(event => <Link to={event.href} key={`${event.kind}-${event.id}`} className="agenda-event"><div className="agenda-event-time">{format(event.date, 'h:mm a')}</div><div className={`agenda-event-line ${event.kind}`} /><div className="agenda-event-copy"><strong>{event.title}</strong><small>{event.kind === 'order' ? 'Production order' : 'Task'} · {event.meta}</small></div>{event.kind === 'order' ? <Shirt size={15} /> : <Circle size={14} />}</Link>)}</div> : <div className="agenda-empty"><CalendarDays size={21} /><strong>Nothing scheduled</strong><small>Deadlines you add to orders and tasks appear here.</small></div>}</aside></div>
  </div>
}
