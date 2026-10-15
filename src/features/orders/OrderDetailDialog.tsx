import { Activity, AlertTriangle, Check, Clock3, ShieldCheck, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import DialogFrame from '../../components/DialogFrame'
import AssetAttachments from '../../components/AssetAttachments'
import { LabelPills, PriorityBadge, StageBadge } from '../../components/Chips'
import { useShop } from '../../stores/shop'
import { confirmInApp } from '../../lib/confirm'
import { PRIMARY_STAGES, EXTRA_STAGES, type Order } from '../../types/domain'

export default function OrderDetailDialog({ order, onClose, onEdit }: { order?: Order; onClose: () => void; onEdit: (order: Order) => void }) {
  const { activity, updateOrder, updateStage, archiveOrder, removeOrder } = useShop()
  const show = Boolean(order)
  if (!order) return <DialogFrame open={false} onOpenChange={onClose} title="Order details"><div /></DialogFrame>
  const warnings = [
    order.quantity && Object.keys(order.sizeBreakdown).length === 0 ? 'Size breakdown is not filled in.' : '',
    order.approvalStatus !== 'approved' ? 'Artwork is not marked approved.' : '',
    !order.dueAt ? 'No due date is set.' : '',
  ].filter(Boolean)
  const changeStage = async (newStage: string) => {
    try {
      const changed = await updateStage(order.id, newStage)
      if (changed) toast.success(`Stage changed to ${[...PRIMARY_STAGES, ...EXTRA_STAGES].find(item => item.key === newStage)?.label ?? newStage}`)
    } catch (error) { toast.error('The stage was not changed.', { description: error instanceof Error ? error.message : 'Please try again.' }) }
  }
  const events = activity.filter(item => item.entityId === order.id)

  return <DialogFrame open={show} onOpenChange={open => !open && onClose()} title={order.customerName} description={`${order.reference || 'Reference not set'} · ${order.productType}`} wide>
    <div className="detail-layout">
      <div className="detail-main">
        <div className="detail-status-row"><StageBadge stage={order.stage} /><PriorityBadge priority={order.priority} /><span className="approval-status"><ShieldCheck size={14} />{order.approvalStatus.replaceAll('-', ' ')}</span></div>
        <div className="detail-field-grid"><div><small>Product</small><strong>{order.productType}</strong></div><div><small>Quantity</small><strong>{order.quantity ?? 'Not set'}</strong></div><div><small>Due date</small><strong>{order.dueAt ? format(new Date(order.dueAt), 'MMM d, yyyy · h:mm a') : 'Not set'}</strong></div><div><small>Assigned to</small><strong>{order.assignee || 'Not assigned'}</strong></div></div>
        <div className="detail-section"><h3>Production stage</h3><select value={order.stage} onChange={event => void changeStage(event.target.value)}>{[...PRIMARY_STAGES, ...EXTRA_STAGES].map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></div>
        <div className="detail-section"><h3>Labels</h3><LabelPills labels={order.labels} limit={20} /></div>
        {warnings.length > 0 && <div className="warning-stack">{warnings.map(warning => <div className="warning-callout" key={warning}><AlertTriangle size={15} /><span>{warning}</span></div>)}</div>}
        {order.notes && <div className="detail-section"><h3>Production notes</h3><p className="detail-notes">{order.notes}</p></div>}
        <div className="detail-section"><div className="section-heading-row"><h3>Sizes breakdown</h3><button className="text-button" onClick={() => onEdit(order)}>Edit sizes</button></div><div className="size-summary">{['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Custom'].map(size => <span key={size}><small>{size}</small><strong>{order.sizeBreakdown[size] ?? '—'}</strong></span>)}</div></div>
        <div className="detail-section"><AssetAttachments attachments={order.attachments} onChange={attachments => updateOrder({ ...order, attachments }, 'Team assets updated')} /></div>
        <div className="detail-section"><h3>Checklist</h3>{order.checklist.length ? <ul className="detail-checklist">{order.checklist.map(item => <li key={item.id} className={item.done ? 'done' : ''}><span>{item.done && <Check size={12} />}</span>{item.text}</li>)}</ul> : <p className="muted-copy">No checklist items yet.</p>}</div>
      </div>
      <aside className="detail-aside"><div className="detail-section"><h3><Activity size={15} /> Activity</h3>{events.length ? <div className="activity-timeline">{events.slice(0, 12).map(item => <div className="timeline-item" key={item.id}><i /><div><strong>{item.message}</strong><small>{format(new Date(item.createdAt), 'MMM d · h:mm a')}</small></div></div>)}</div> : <p className="muted-copy">Stage and order updates will show here.</p>}</div><div className="detail-section"><h3>Order record</h3><div className="record-meta"><span><Clock3 size={13} /> Created {format(new Date(order.createdAt), 'MMM d, yyyy')}</span><span>Updated {format(new Date(order.updatedAt), 'MMM d, yyyy')}</span>{order.ownerOverrideAt && <span className="override-record"><ShieldCheck size={13} /> Owner override logged</span>}</div></div></aside>
    </div>
    <div className="dialog-footer detail-footer"><button className="button button-quiet" onClick={() => onEdit(order)}>Edit order</button><button className="button button-quiet" onClick={() => void (async () => { if (!await confirmInApp({ title: `Archive ${order.customerName}?`, description: 'Archived orders stay available in Completed and can be restored later.', confirmLabel: 'Archive order', cancelLabel: 'Keep order' })) return; try { await archiveOrder(order.id); toast.success('Order archived. You can restore it from Completed.'); onClose() } catch { toast.error('Could not archive this order. Please try again.') } })()}>Archive</button><button className="button button-danger" onClick={() => void (async () => { if (!await confirmInApp({ title: `Delete ${order.customerName}?`, description: 'This permanently removes the order from this browser. Archive it instead if you may need it later.', confirmLabel: 'Delete permanently', cancelLabel: 'Keep order', tone: 'danger' })) return; try { await removeOrder(order.id); toast.success('Order deleted'); onClose() } catch { toast.error('Could not delete this order. Please try again.') } })()}><Trash2 size={14} /> Delete</button></div>
  </DialogFrame>
}
