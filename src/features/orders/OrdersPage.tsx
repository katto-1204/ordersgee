import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowDownWideNarrow, ClipboardPaste, Filter, Plus, Search, Shirt, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useShop } from '../../stores/shop'
import type { Order } from '../../types/domain'
import OrderCard from '../../components/OrderCard'
import OrderForm from './OrderForm'
import DialogFrame from '../../components/DialogFrame'
import QuickCaptureDialog from '../capture/QuickCaptureDialog'
import OrderDetailDialog from './OrderDetailDialog'

const filters = [
  { key: 'ongoing', label: 'Ongoing Teams' },
  { key: 'all', label: 'Status' },
  { key: 'sizing', label: 'Sizing' },
  { key: 'printing', label: 'Printing' },
  { key: 'done-print', label: 'Done Print' },
  { key: 'to-sew', label: 'To Sew' },
  { key: 'to-deliver', label: 'To Deliver' },
  { key: 'finished', label: 'Finished' },
]

export default function OrdersPage({ ongoingOnly = false }: { ongoingOnly?: boolean }) {
  const { orders, labels } = useShop()
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [active, setActive] = useState(ongoingOnly ? 'ongoing' : 'all')
  const [search, setSearch] = useState('')
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [sort, setSort] = useState<'newest' | 'deadline' | 'priority'>('deadline')
  const [showFilters, setShowFilters] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [formDirty, setFormDirty] = useState(false)
  const [editOrder, setEditOrder] = useState<Order | undefined>()
  const [captureOpen, setCaptureOpen] = useState(false)
  const [menuNoteOrder, setMenuNoteOrder] = useState<Order | null>(null)

  useEffect(() => { if (params.get('capture') === '1') { setCaptureOpen(true); setParams({}, { replace: true }) } }, [params, setParams])
  const data = useMemo(() => {
    let result = orders.filter(order => !order.archivedAt && order.stage !== 'cancelled')
    if (active === 'ongoing') result = result.filter(order => order.stage !== 'finished')
    else if (active !== 'all') result = result.filter(order => order.stage === active)
    if (ongoingOnly) result = result.filter(order => order.stage !== 'finished')
    if (search.trim()) {
      const term = search.trim().toLocaleLowerCase()
      result = result.filter(order => `${order.customerName} ${order.reference} ${order.productType} ${order.notes}`.toLowerCase().includes(term))
    }
    if (selectedLabels.length) result = result.filter(order => selectedLabels.every(label => order.labels.includes(label)))
    return [...result].sort((a, b) => {
      if (sort === 'newest') return b.createdAt.localeCompare(a.createdAt)
      if (sort === 'priority') return ['urgent', 'high', 'normal', 'low'].indexOf(a.priority) - ['urgent', 'high', 'normal', 'low'].indexOf(b.priority)
      if (!a.dueAt) return 1
      if (!b.dueAt) return -1
      return a.dueAt.localeCompare(b.dueAt)
    })
  }, [orders, active, ongoingOnly, search, selectedLabels, sort])

  const createFromFile = async (file?: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.txt')) { toast.error('Choose a .txt file to preview its task lines.'); return }
    const content = await file.text()
    setCaptureOpen(true)
    window.dispatchEvent(new CustomEvent('gee-capture-text', { detail: content }))
  }
  const changeFormOpen = (open: boolean) => {
    if (!open && formDirty && !window.confirm('Discard unsaved order changes?')) return
    if (!open) setFormDirty(false)
    setFormOpen(open)
  }

  return <div className="page-stack">
    <header className="page-heading-row"><div><span className="eyebrow">PRODUCTION CONTROL</span><h1>{ongoingOnly ? 'Ongoing teams' : 'All orders'}</h1><p className="page-subtitle">Every customer handoff, in one place.</p></div><div className="heading-actions"><button className="button button-quiet" onClick={() => setCaptureOpen(true)}><ClipboardPaste size={16} /> Quick Capture</button><label className="button button-quiet file-import-button"><Upload size={15} /> Import .txt<input type="file" accept=".txt,text/plain" onChange={event => { void createFromFile(event.target.files?.[0]); event.currentTarget.value = '' }} /></label><button className="button button-primary" onClick={() => { setEditOrder(undefined); setFormOpen(true) }}><Plus size={16} /> New order</button></div></header>
    <div className="status-tabs-wrap"><div className="status-tabs" role="tablist" aria-label="Filter production orders">{filters.map(item => {
      const count = item.key === 'all' ? orders.filter(order => !order.archivedAt && order.stage !== 'cancelled').length : item.key === 'ongoing' ? orders.filter(order => !order.archivedAt && order.stage !== 'finished' && order.stage !== 'cancelled').length : orders.filter(order => !order.archivedAt && order.stage === item.key).length
      return <button key={item.key} className={`status-tab ${active === item.key ? 'active' : ''}`} role="tab" aria-selected={active === item.key} onClick={() => setActive(item.key)}>{item.label}<span>{count}</span></button>
    })}</div></div>
    <div className="list-toolbar"><div className="toolbar-search"><Search size={15} /><input aria-label="Search orders" value={search} onChange={event => setSearch(event.target.value)} placeholder="Find a team or reference..." /></div><div className="toolbar-actions"><button className={`toolbar-button ${showFilters ? 'selected' : ''}`} onClick={() => setShowFilters(!showFilters)}><Filter size={15} /> Filters {selectedLabels.length ? <span className="filter-count">{selectedLabels.length}</span> : null}</button><label className="toolbar-button toolbar-select"><ArrowDownWideNarrow size={15} /><select value={sort} onChange={event => setSort(event.target.value as typeof sort)}><option value="deadline">Deadline</option><option value="newest">Newest</option><option value="priority">Priority</option></select></label></div></div>
    {showFilters && <div className="filter-panel"><span>Filter by labels</span><div className="label-filter-list">{labels.map(label => <button key={label.id} className={`label-filter ${selectedLabels.includes(label.name) ? 'selected' : ''}`} onClick={() => setSelectedLabels(current => current.includes(label.name) ? current.filter(item => item !== label.name) : [...current, label.name])}>{label.name}</button>)}</div><button className="text-button" onClick={() => setSelectedLabels([])}>Clear filters</button></div>}
    {data.length ? <div className="orders-grid">{data.map(order => <OrderCard key={order.id} order={order} onEdit={() => { setEditOrder(order); setFormOpen(true) }} onNote={() => setMenuNoteOrder(order)} />)}</div> : <div className="empty-state"><span className="empty-icon"><Shirt size={22} /></span><h2>{search || selectedLabels.length ? 'No matching orders' : active === 'finished' ? 'No finished orders yet' : 'Your production list is clear'}</h2><p>{search || selectedLabels.length ? 'Adjust the search or filters to see more work.' : 'Add an order or paste a Notepad list to start tracking production.'}</p><div><button className="button button-quiet" onClick={() => setCaptureOpen(true)}><ClipboardPaste size={15} /> Paste a list</button><button className="button button-primary" onClick={() => setFormOpen(true)}><Plus size={15} /> Add order</button></div></div>}
    <DialogFrame open={formOpen} onOpenChange={changeFormOpen} title={editOrder ? 'Edit order' : 'New order'} description="Capture only what the shop knows—fill in the rest when it arrives." wide>{formOpen && <OrderForm order={editOrder} onDirtyChange={setFormDirty} onSaved={() => { setFormDirty(false); setFormOpen(false) }} />}</DialogFrame>
    <OrderDetailDialog order={id ? orders.find(order => order.id === id) : undefined} onClose={() => navigate(ongoingOnly ? '/ongoing' : '/orders')} onEdit={order => { navigate('/orders'); setEditOrder(order); setFormOpen(true) }} />
    <QuickCaptureDialog open={captureOpen} onOpenChange={setCaptureOpen} />
    <DialogFrame open={!!menuNoteOrder} onOpenChange={open => !open && setMenuNoteOrder(null)} title="Add a production note" description={menuNoteOrder?.customerName}><form className="form-stack" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); const addition = String(data.get('note') || '').trim(); if (menuNoteOrder && addition) { const next = `${menuNoteOrder.notes}${menuNoteOrder.notes ? '\n' : ''}${addition}`; void useShop.getState().updateOrder({ ...menuNoteOrder, notes: next }, 'Production note added').then(() => toast.success('Note added')) } setMenuNoteOrder(null) }}><label className="field">Note<textarea name="note" rows={4} autoFocus placeholder="Add a production instruction..." required /></label><div className="dialog-footer"><button type="button" className="button button-quiet" onClick={() => setMenuNoteOrder(null)}>Cancel</button><button type="submit" className="button button-primary">Save note</button></div></form></DialogFrame>
  </div>
}
