import { Component, lazy, Suspense, type ErrorInfo, type ReactNode, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useShop } from '../stores/shop'
import AppShell from './AppShell'
import { isDueToday, localDayRange } from '../lib/time'
const DashboardPage = lazy(() => import('../features/dashboard/DashboardPage'))
const OrdersPage = lazy(() => import('../features/orders/OrdersPage'))
const TeamsPage = lazy(() => import('../features/orders/TeamsPage'))
const TasksPage = lazy(() => import('../features/tasks/TasksPage'))
const ProductionPage = lazy(() => import('../features/production/ProductionPage'))
const NotesPage = lazy(() => import('../features/notes/NotesPage'))
const CalendarPage = lazy(() => import('../features/calendar/CalendarPage'))
const SettingsPage = lazy(() => import('../features/settings/SettingsPage'))
const CompletedPage = lazy(() => import('../features/completed/CompletedPage'))
import { WifiOff } from 'lucide-react'
import { toast } from 'sonner'
import { userFacingError } from '../lib/errors'
import { useGoogleSync, watchGoogleSync } from '../lib/google-sheets'

const notifiedDays = new Set<string>()

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('GEE TASKS UI error', error, info.componentStack) }
  render() {
    if (this.state.error) return <main className="fatal-error"><span className="eyebrow">GEE TASKS</span><h1>Something interrupted the workflow.</h1><p>Your local data remains saved. Reload to reopen the workspace.</p><button className="button button-primary" onClick={() => location.reload()}>Reload workspace</button></main>
    return this.props.children
  }
}

function AppStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  const sync = useGoogleSync()
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  const offline = !online
  return <div className={`sync-banner ${offline ? 'sync-offline' : ''}`} role="status">
    {offline ? <WifiOff size={13} /> : <span className="sync-dot" />}
    {offline ? 'Offline · edits save in localStorage' : sync.busy ? 'Syncing records with Google Sheets…' : sync.error ? `Saved locally · Google sync needs attention` : sync.connected ? sync.pending ? 'Saved locally · Google Sheets changes pending' : 'Saved locally · Google Sheets up to date' : 'Saved in localStorage · connect Google Sheets in Settings'}
  </div>
}

export default function App() {
  const { load, loading, loadError, settings, orders, tasks, updateSettings } = useShop()
  useEffect(() => { void load() }, [load])
  useEffect(() => watchGoogleSync(load), [load])
  useEffect(() => {
    const onRejected = (event: PromiseRejectionEvent) => {
      console.error('GEE TASKS action failed', event.reason)
      toast.error('That action did not finish.', {
        description: userFacingError(event.reason),
        duration: 10000,
        action: { label: 'Open backup settings', onClick: () => window.location.assign('/settings#data') },
      })
      event.preventDefault()
    }
    const onWindowError = (event: ErrorEvent) => {
      console.error('GEE TASKS runtime error', event.error ?? event.message)
      toast.error('Something went wrong in this view.', { description: 'Your last change may not have been saved. Try the action again. If it keeps happening, open the Guide or reload the page.' })
    }
    window.addEventListener('unhandledrejection', onRejected)
    window.addEventListener('error', onWindowError)
    return () => { window.removeEventListener('unhandledrejection', onRejected); window.removeEventListener('error', onWindowError) }
  }, [])
  useEffect(() => {
    if (loading || !settings?.remindersEnabled || !('Notification' in window) || Notification.permission !== 'granted') return
    const day = localDayRange()
    if (settings.lastReminderDate === day || notifiedDays.has(day)) return
    const activeOrders = orders.filter(order => !order.archivedAt && !['finished','cancelled'].includes(order.stage))
    const overdueOrders = activeOrders.filter(order => order.dueAt && new Date(order.dueAt) < new Date())
    const overdueTasks = tasks.filter(task => !task.archivedAt && task.status === 'open' && task.dueAt && new Date(task.dueAt) < new Date())
    const dueTodayOrders = activeOrders.filter(order => order.dueAt && isDueToday(order.dueAt))
    const dueTodayTasks = tasks.filter(task => !task.archivedAt && task.status === 'open' && task.dueAt && isDueToday(task.dueAt))
    const overdue = overdueOrders.length + overdueTasks.length
    const dueToday = dueTodayOrders.length + dueTodayTasks.length
    if (!overdue && !dueToday) return
    notifiedDays.add(day)
    const notification = new Notification('GEE TASKS · Daily reminder', { body: `${overdue ? `${overdue} overdue` : ''}${overdue && dueToday ? ' · ' : ''}${dueToday ? `${dueToday} due today` : ''}. Open your dashboard to review.` })
    notification.onclick = () => { window.focus(); window.location.assign('/') }
    void updateSettings({ lastReminderDate: day })
  }, [loading, settings?.remindersEnabled, settings?.lastReminderDate, orders, tasks, updateSettings])
  useEffect(() => {
    const update = () => document.documentElement.classList.toggle('offline', !navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    update()
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])

  if (loading) return <div className="boot-screen"><div className="boot-mark">GG</div><strong>GEE TASKS</strong><span className="skeleton skeleton-line" /></div>
  if (loadError) return <main className="fatal-error storage-recovery" role="alert"><span className="eyebrow">GEE TASKS · WORKSPACE RECOVERY</span><h1>We couldn’t open your saved work.</h1><p>{loadError}</p><div className="storage-recovery-steps"><strong>Try these steps:</strong><ol><li>Use a regular browser window (private browsing can block local storage).</li><li>Make sure this site is allowed to save data and your device has free space.</li><li>Try again. Avoid clearing browser/site data while troubleshooting.</li></ol><small>Local work stays in this browser. Only completed Google Sheets syncs are stored in Google.</small></div><button className="button button-primary" onClick={() => void load()}>Try opening the workspace again</button></main>

  return <AppErrorBoundary>
    <AppShell status={<AppStatus />}>
      <Suspense fallback={<div className="page-loading"><span className="skeleton skeleton-line" />Loading workspace view…</div>}><Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/ongoing" element={<OrdersPage ongoingOnly />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/:id" element={<OrdersPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/production" element={<ProductionPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/completed" element={<CompletedPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes></Suspense>
    </AppShell>
  </AppErrorBoundary>
}
