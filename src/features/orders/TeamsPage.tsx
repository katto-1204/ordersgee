import { useMemo, useState } from 'react'
import { Camera, Plus, Search, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useShop } from '../../stores/shop'
import { StageBadge } from '../../components/Chips'
import { isImageAttachment } from '../../lib/attachments'
import GoogleAssetImage from '../../components/GoogleAssetImage'
import DialogFrame from '../../components/DialogFrame'
import OrderForm from './OrderForm'
import '../../components/assets.css'

export default function TeamsPage() {
  const { orders, tasks } = useShop()
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [dirty, setDirty] = useState(false)
  const teams = useMemo(() => {
    const groups = new Map<string, typeof orders>()
    for (const order of orders) {
      const key = order.customerName.trim().toLocaleLowerCase()
      groups.set(key, [...(groups.get(key) ?? []), order])
    }
    return [...groups.values()].sort((a, b) => a[0].customerName.localeCompare(b[0].customerName))
  }, [orders])
  const filtered = teams.filter(group => group.some(order => `${order.customerName} ${order.reference} ${order.productType}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())))
  const changeOpen = (next: boolean) => {
    if (!next && dirty && !window.confirm('Discard unsaved team changes?')) return
    if (!next) setDirty(false)
    setOpen(next)
  }
  return <div className="page-stack">
    <header className="page-heading-row"><div><span className="eyebrow">TEAM RECORDS</span><h1>Team register</h1><p className="page-subtitle">All {teams.length} teams, including finished and archived orders. Keep each design and team photo with its own order.</p></div><button className="button button-primary" onClick={() => setOpen(true)}><Plus size={16} /> Register team</button></header>
    <div className="list-toolbar"><div className="toolbar-search"><Search size={15} /><input aria-label="Search team register" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find any team, reference or product…" /></div><span className="muted-copy">{orders.length} order records</span></div>
    {filtered.length ? <div className="team-register">{filtered.map(group => <article className="team-register-group" key={group[0].customerName.trim().toLocaleLowerCase()} aria-label={`${group[0].customerName} team record`}><h2>{group[0].customerName}</h2><p className="muted-copy">{group.length} {group.length === 1 ? 'order' : 'orders'}</p><div className="team-register-orders">{group.map(order => {
      const relatedTasks = tasks.filter(task => task.orderId === order.id)
      const files = [...order.attachments, ...relatedTasks.flatMap(task => task.attachments)]
      const mockup = files.find(file => file.kind === 'mockup' && isImageAttachment(file))
      const photo = files.find(file => file.kind === 'team-photo' && isImageAttachment(file))
      const hasPhoto = files.some(file => file.kind === 'team-photo')
      return <article className="team-record" key={order.id} aria-label={`${order.customerName} ${order.reference || order.productType} order`}><StageBadge stage={order.stage} />{order.archivedAt && <span className="meta-chip">Archived</span>}<h3>{order.reference || 'Reference not set'} · {order.productType}</h3><p>{order.quantity ?? 'Quantity not set'}{order.quantity !== null ? ' pieces' : ''} · {relatedTasks.length} linked tasks</p><div className="team-record-images">{mockup && <figure><GoogleAssetImage file={mockup} alt={`${order.customerName} design mockup for ${order.reference || order.productType}`} /><figcaption>Design mockup</figcaption></figure>}{photo && <figure><GoogleAssetImage file={photo} alt={`${order.customerName} team photo for ${order.reference || order.productType}`} /><figcaption>Team photo</figcaption></figure>}</div><p><Camera size={12} /> {hasPhoto ? 'Team photo collected' : 'Team photo still needed'} · {files.filter(file => file.kind === 'print-ready').length} print assets</p><Link className="button button-quiet" to={`/orders/${order.id}`}>Manage team assets</Link>{relatedTasks.length > 0 && <div className="team-linked-tasks"><small>Task designs & print files</small>{relatedTasks.map(task => <Link key={task.id} to={`/tasks?task=${encodeURIComponent(task.id)}`}>{task.title} ({task.attachments.length} assets)</Link>)}</div>}</article>
    })}</div></article>)}</div> : <div className="empty-state"><span className="empty-icon"><Users size={22} /></span><h2>{search ? 'No matching teams' : 'Register your first team'}</h2><p>{search ? 'Try another team name or reference.' : 'Each order records its team, production design, print files and finished team photos.'}</p></div>}
    <DialogFrame open={open} onOpenChange={changeOpen} title="Register team" description="Create an order for this team. Open its assets to add the design, print files and team photo." wide>{open && <OrderForm onDirtyChange={setDirty} onSaved={() => { setDirty(false); setOpen(false) }} />}</DialogFrame>
  </div>
}
