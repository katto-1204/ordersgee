import { useEffect, useMemo, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { Check, GripVertical, Layers3, List, LayoutGrid, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useShop } from '../../stores/shop'
import { EXTRA_STAGES, PRIMARY_STAGES, type Order } from '../../types/domain'
import { StageBadge } from '../../components/Chips'
import DialogFrame from '../../components/DialogFrame'

const BOARD_STAGES = [...PRIMARY_STAGES, ...EXTRA_STAGES.filter(stage => stage.key !== 'cancelled')]

export default function ProductionPage() {
  const { orders, updateStage, updateOrder, settings, updateSettings } = useShop()
  const [view, setView] = useState<'board' | 'list'>('board')
  const [addStage, setAddStage] = useState(false)
  const [stageLabel, setStageLabel] = useState('')
  const [search, setSearch] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }), useSensor(KeyboardSensor))
  const stages = [...BOARD_STAGES, ...(settings?.customStages ?? []).filter(stage => !BOARD_STAGES.some(item => item.key === stage.key))]
  const boardOrders = useMemo(() => orders.filter(order => !order.archivedAt && order.stage !== 'cancelled' && `${order.customerName} ${order.reference}`.toLowerCase().includes(search.toLowerCase())), [orders, search])
  const activeCount = boardOrders.filter(order => order.stage !== 'finished').length
  const move = async (event: DragEndEvent) => {
    const order = orders.find(item => item.id === String(event.active.id))
    const stage = stages.find(item => item.key === String(event.over?.id))
    if (!order || !stage || order.stage === stage.key) return
    if (stage.key === 'printing' && order.approvalStatus !== 'approved') {
      if (!window.confirm(`“${order.customerName}” is not marked approved. Start production and log an owner override?`)) return
      await updateOrder({ ...order, ownerOverrideAt: new Date().toISOString() }, 'Owner override recorded for unapproved artwork')
    }
    const changed = await updateStage(order.id, stage.key)
    if (changed) toast.success(`${order.customerName} moved to ${stage.label}`)
  }
  const addCustomStage = async (event: React.FormEvent) => {
    event.preventDefault()
    const label = stageLabel.trim()
    if (!label) return
    const key = `custom-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    if (stages.some(stage => stage.key === key)) { toast.error('That stage already exists.'); return }
    await updateSettings({ customStages: [...(settings?.customStages ?? []), { key, label }] })
    setStageLabel(''); setAddStage(false); toast.success('Production stage added')
  }
  const moveFromSelector = async (order: Order, nextStage: string) => {
    const changed = await updateStage(order.id, nextStage)
    if (changed) toast.success(`${order.customerName} moved to ${stages.find(stage => stage.key === nextStage)?.label ?? nextStage}`)
    return changed
  }
  return <div className="page-stack">
    <header className="page-heading-row"><div><span className="eyebrow">SHOP FLOOR</span><h1>Production board</h1><p className="page-subtitle">Move each order to its next handoff.</p></div><div className="heading-actions"><div className="tab-switch"><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><LayoutGrid size={14} /> Board</button><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={14} /> List</button></div><button className="button button-quiet" onClick={() => setAddStage(true)}><Plus size={15} /> Add stage</button></div></header>
    <div className="list-toolbar"><div className="toolbar-search"><Layers3 size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find an order..." aria-label="Find an order" /></div><span className="board-count">{activeCount} active orders · {boardOrders.length - activeCount} finished</span></div>
    {view === 'board' && <p className="board-gesture-hint">On a phone, swipe sideways to see each stage. Drag cards or use the “Move to” selector.</p>}
    {view === 'board' ? <DndContext sensors={sensors} onDragEnd={event => void move(event)}><div className="kanban-board">{stages.map(stage => <BoardColumn key={stage.key} stage={stage} stages={stages} items={boardOrders.filter(order => order.stage === stage.key)} onMove={moveFromSelector} />)}</div></DndContext> : <div className="stage-list-view">{stages.map(stage => {
      const group = boardOrders.filter(order => order.stage === stage.key)
      if (!group.length) return null
      return <section className="task-list-section" key={stage.key}><div className="task-list-heading"><h2>{stage.label.toUpperCase()}</h2><span>{group.length}</span></div>{group.map(order => <div className="task-row" key={order.id}><span className="stage-marker marker-printing" /><div className="task-copy"><Link className="task-title-button" to={`/orders/${order.id}`}>{order.customerName}</Link><small>{order.reference || 'Reference not set'} · {order.productType}</small></div><StageBadge stage={order.stage} /><label className="stage-select-inline"><span>Move to</span><select value={order.stage} aria-label={`Move ${order.customerName} to stage`} onChange={event => { const select = event.currentTarget; void moveFromSelector(order, select.value).then(changed => { if (!changed) select.value = order.stage }) }}>{stages.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label></div>)}</section>
    })}</div>}
    <DialogFrame open={addStage} onOpenChange={setAddStage} title="Add production stage" description="Custom stages are saved to this shop's settings."><form className="form-stack" onSubmit={event => void addCustomStage(event)}><label className="field">Stage name<input autoFocus value={stageLabel} onChange={event => setStageLabel(event.target.value)} placeholder="e.g. Quality check" /></label><div className="dialog-footer"><button type="button" className="button button-quiet" onClick={() => setAddStage(false)}>Cancel</button><button className="button button-primary" type="submit">Add stage</button></div></form></DialogFrame>
  </div>
}

function BoardColumn({ stage, stages, items, onMove }: { stage: { key: string; label: string }; stages: { key: string; label: string }[]; items: Order[]; onMove: (order: Order, next: string) => Promise<boolean> }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.key })
  return <section className={`kanban-column ${isOver ? 'column-over' : ''}`} ref={setNodeRef} aria-label={`${stage.label} column`}><header><div><span className={`stage-marker marker-${stage.key}`} /><h2>{stage.label}</h2></div><span>{items.length}</span></header><div className="kanban-cards">{items.map(order => <BoardCard key={order.id} order={order} stages={stages} onMove={onMove} />)}{!items.length && <div className="column-empty">Drop an order here</div>}</div></section>
}

function BoardCard({ order, stages, onMove }: { order: Order; stages: { key: string; label: string }[]; onMove: (order: Order, next: string) => Promise<boolean> }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: order.id })
  const [selectedStage, setSelectedStage] = useState(order.stage)
  useEffect(() => setSelectedStage(order.stage), [order.stage])
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  return <article className={`kanban-card ${isDragging ? 'dragging' : ''}`} ref={setNodeRef} style={style}>
    <div className="kanban-card-top"><span {...listeners} {...attributes} className="drag-handle" aria-label={`Drag ${order.customerName}`} role="button" tabIndex={0}><GripVertical size={14} /></span><StageBadge stage={order.stage} /><Link to={`/orders/${order.id}`} className="kanban-open">Open</Link></div>
    <Link to={`/orders/${order.id}`} className="kanban-name">{order.customerName}</Link><span className="kanban-reference">{order.reference || 'Reference not set'}</span>
    <div className="label-row">{order.labels.slice(0, 2).map(label => <span className="label-chip" key={label}>{label}</span>)}</div>
    <label className="stage-select-inline"><span>Move to</span><select aria-label={`Move ${order.customerName} using button alternative`} value={selectedStage} onChange={event => { const next = event.target.value; setSelectedStage(next); void onMove(order, next).then(changed => { if (!changed) setSelectedStage(order.stage) }) }}>{stages.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
    {order.stage === 'finished' && <span className="finished-label"><Check size={13} /> Finished</span>}
  </article>
}
