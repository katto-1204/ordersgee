import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Archive, Check, ChevronRight, Clock3, MoreHorizontal, PackageCheck, Pencil, StickyNote, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useShop } from '../stores/shop'
import { PRIMARY_STAGES, type Order } from '../types/domain'
import { LabelPills, PriorityBadge, StageBadge } from './Chips'
import { isImageAttachment } from '../lib/attachments'
import GoogleAssetImage from './GoogleAssetImage'
import './assets.css'

export default function OrderCard({ order, compact = false, onEdit, onNote }: { order: Order; compact?: boolean; onEdit?: () => void; onNote?: () => void }) {
  const { updateStage, archiveOrder, removeOrder, updateOrder } = useShop()
  const stageList = PRIMARY_STAGES
  const currentIndex = stageList.findIndex(stage => stage.key === order.stage)
  const nextStage = currentIndex >= 0 ? stageList[currentIndex + 1] : undefined
  const due = order.dueAt ? new Date(order.dueAt) : null
  const isLate = due && due < new Date() && order.stage !== 'finished'
  const checklistDone = order.checklist.filter(item => item.done).length
  const mockup = order.attachments.find(file => file.kind === 'mockup' && isImageAttachment(file))

  return <article className={`order-card ${compact ? 'order-card-compact' : ''} ${isLate ? 'is-late' : ''}`}>
    <div className="card-topline"><StageBadge stage={order.stage} /><DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="card-menu" aria-label={`More actions for ${order.customerName}`}><MoreHorizontal size={17} /></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content side="bottom" align="end" className="order-action-menu"><DropdownMenu.Item className="order-menu-item" onSelect={onEdit}><Pencil size={13} /> Edit order</DropdownMenu.Item><DropdownMenu.Item className="order-menu-item" onSelect={onNote}><StickyNote size={13} /> Add production note</DropdownMenu.Item><DropdownMenu.Item className="order-menu-item" onSelect={() => void updateOrder({ ...order, id: crypto.randomUUID(), customerName: `${order.customerName} (copy)`, reference: '', sourceText: `${order.customerName} (copy)`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), completedAt: null, archivedAt: null }, 'Order duplicated').then(() => toast.success('Order duplicated'))}><PackageCheck size={13} /> Duplicate order</DropdownMenu.Item><DropdownMenu.Separator className="order-menu-separator" /><DropdownMenu.Item className="order-menu-item" onSelect={() => { void archiveOrder(order.id).then(() => toast.success('Order archived')) }}><Archive size={13} /> Archive</DropdownMenu.Item><DropdownMenu.Item className="order-menu-item destructive" onSelect={() => { if (window.confirm(`Permanently delete ${order.customerName}? This cannot be undone.`)) void removeOrder(order.id).then(() => toast.success('Order deleted')) }}><Trash2 size={13} /> Delete</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></div>
    <Link className="order-main-link" to={`/orders/${order.id}`}><div className="order-name-row"><h3>{order.customerName}</h3>{order.priority !== 'normal' && <PriorityBadge priority={order.priority} />}</div><p className="order-reference">{order.reference || 'Reference not set'} <span>·</span> {order.productType}</p></Link>
    {!compact && mockup && <Link to={`/orders/${order.id}`} aria-label={`View design for ${order.customerName}`}><GoogleAssetImage className="order-design-thumb" file={mockup} alt={`${order.customerName} design mockup`} /></Link>}
    {order.attachments.length > 0 && <p className="order-assets-summary">{order.attachments.filter(file => file.kind === 'mockup').length} mockups · {order.attachments.filter(file => file.kind === 'print-ready').length} print assets · {order.attachments.filter(file => file.kind === 'team-photo').length} team photos</p>}
    <LabelPills labels={order.labels} />
    {!compact && order.notes && <p className="order-note-preview">{order.notes}</p>}
    <div className="order-meta-row">{due ? <span className={`meta-chip ${isLate ? 'meta-late' : ''}`}><Clock3 size={13} />{isLate ? 'Overdue' : format(due, 'MMM d')}</span> : <span className="meta-chip meta-quiet">No due date</span>}{order.quantity ? <span className="meta-chip"><PackageCheck size={13} />{order.quantity} pcs</span> : <span className="meta-chip meta-quiet"><PackageCheck size={13} />Qty not set</span>}{!!order.checklist.length && <span className="meta-chip"><Check size={13} />{checklistDone}/{order.checklist.length}</span>}{order.assignee && <span className="meta-chip meta-person">{order.assignee}</span>}</div>
    <div className="card-actions"><button className="small-action" onClick={onEdit}><Pencil size={14} /> Edit</button><button className="small-action" onClick={onNote}><StickyNote size={14} /> Note</button>{nextStage && <button className="advance-action" onClick={async () => { try { const changed = await updateStage(order.id, nextStage.key); if (changed) toast.success(`Moved to ${nextStage.label}`) } catch (error) { toast.error('The order did not move forward.', { description: error instanceof Error ? error.message : 'Please try again.' }) } }}>Move forward <ChevronRight size={14} /></button>}{order.stage === 'finished' && <span className="finished-label"><Check size={14} /> Finished</span>}</div>
    {currentIndex > 0 && order.stage !== 'finished' && <div className="stage-progress"><div style={{ width: `${Math.max(10, ((currentIndex + 1) / stageList.length) * 100)}%` }} /></div>}
  </article>
}
