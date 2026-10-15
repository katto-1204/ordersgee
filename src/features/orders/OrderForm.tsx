import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { toast } from 'sonner'
import { useShop } from '../../stores/shop'
import { EXTRA_STAGES, PRIMARY_STAGES, uid, type Order } from '../../types/domain'
import ChecklistEditor from '../../components/ChecklistEditor'
import { labelTextColor } from '../../components/Chips'

const schema = z.object({
  customerName: z.string().trim().min(2, 'Add a customer or team name.'),
  reference: z.string().trim().max(40, 'Keep the reference under 40 characters.'),
  productType: z.string().min(1),
  quantity: z.string().refine(value => value === '' || (Number(value) >= 0 && Number.isFinite(Number(value))), 'Quantity must be zero or more.'),
  stage: z.string().min(1),
  priority: z.enum(['urgent', 'high', 'normal', 'low']),
  dueAt: z.string(),
  assignee: z.string(),
  approvalStatus: z.enum(['draft', 'for-approval', 'approved', 'revision-requested']),
  notes: z.string(),
})
type FormValues = z.infer<typeof schema>

export default function OrderForm({ order, onSaved, onDirtyChange }: { order?: Order; onSaved: () => void; onDirtyChange?: (dirty: boolean) => void }) {
  const { labels, addOrder, updateOrder, orders, settings } = useShop()
  const labelOptions = useMemo(() => labels, [labels])
  const stages = [...PRIMARY_STAGES, ...EXTRA_STAGES, ...(settings?.customStages ?? [])]
  const defaults: FormValues = order ? {
    customerName: order.customerName, reference: order.reference, productType: order.productType, quantity: order.quantity?.toString() ?? '', stage: order.stage,
    priority: order.priority, dueAt: order.dueAt ? toDateTimeInput(order.dueAt) : '', assignee: order.assignee, approvalStatus: order.approvalStatus, notes: order.notes,
  } : { customerName: '', reference: '', productType: 'Jersey', quantity: '', stage: 'sizing', priority: 'normal', dueAt: '', assignee: '', approvalStatus: 'draft', notes: '' }
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults })
  const [selectedLabels, setSelectedLabels] = useState<string[]>(order?.labels ?? [])
  const [checklist, setChecklist] = useState<Order['checklist']>(order?.checklist ?? [])
  const [sizeBreakdown, setSizeBreakdown] = useState<Record<string, number>>(order?.sizeBreakdown ?? {})
  const initialStaged = useRef({ labels: JSON.stringify(order?.labels ?? []), checklist: JSON.stringify(order?.checklist ?? []), sizes: JSON.stringify(order?.sizeBreakdown ?? {}) })
  useEffect(() => {
    form.reset(defaults)
    setSelectedLabels(order?.labels ?? [])
    setChecklist(order?.checklist ?? [])
    setSizeBreakdown(order?.sizeBreakdown ?? {})
    initialStaged.current = { labels: JSON.stringify(order?.labels ?? []), checklist: JSON.stringify(order?.checklist ?? []), sizes: JSON.stringify(order?.sizeBreakdown ?? {}) }
  // Defaults intentionally re-initialize only when switching between create/edit targets.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id])
  const customDirty = JSON.stringify(selectedLabels) !== initialStaged.current.labels || JSON.stringify(checklist) !== initialStaged.current.checklist || JSON.stringify(sizeBreakdown) !== initialStaged.current.sizes
  const dirty = form.formState.isDirty || customDirty
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])
  const cancel = () => { if (dirty && !window.confirm('Discard unsaved order changes?')) return; onSaved() }

  const onSubmit = form.handleSubmit(async values => {
    const duplicate = orders.find(item => !item.archivedAt && item.id !== order?.id && item.customerName.trim().toLowerCase() === values.customerName.trim().toLowerCase() && values.reference && item.reference.trim().toLowerCase() === values.reference.trim().toLowerCase())
    if (duplicate) { form.setError('reference', { message: `This matches ${duplicate.customerName} (${duplicate.reference}).` }); return }
    const now = new Date().toISOString()
    const next: Order = {
      ...(order ?? { id: uid(), createdAt: now, completedAt: null, archivedAt: null, attachments: [], ownerOverrideAt: null, sourceText: '' }),
      customerName: values.customerName.trim(), reference: values.reference.trim(), productType: values.productType,
      quantity: values.quantity ? Number(values.quantity) : null, sizeBreakdown,
      stage: values.stage, priority: values.priority,
      dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : null,
      assignee: values.assignee.trim(), approvalStatus: values.approvalStatus, notes: values.notes.trim(), labels: selectedLabels, checklist,
      updatedAt: now, sourceText: order?.sourceText || `${values.customerName.trim()} - ${values.stage}`,
    }
    try {
      if (order) await updateOrder(next, 'Order details updated')
      else await addOrder(next)
      toast.success(order ? 'Order updated' : 'Order created')
      onSaved()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save order') }
  })

  return <form className="form-stack" onSubmit={onSubmit}>
    <div className="form-grid"><label className="field field-wide">Customer / team name<input {...form.register('customerName')} placeholder="e.g. BLUEPHOENIX DARYL" autoFocus />{form.formState.errors.customerName && <small className="field-error">{form.formState.errors.customerName.message}</small>}</label>
      <label className="field">Order reference<input {...form.register('reference')} placeholder="Enter if known" />{form.formState.errors.reference && <small className="field-error">{form.formState.errors.reference.message}</small>}</label>
      <label className="field">Product type<select {...form.register('productType')}><option>Jersey</option><option>Full Sublimation</option><option>T-Shirt</option><option>Long Sleeve</option><option>Polo Shirt</option><option>Hoodie</option><option>Merch</option><option>Sample</option></select></label>
      <label className="field">Current stage<select {...form.register('stage')}>{stages.map(stage => <option key={stage.key} value={stage.key}>{stage.label}</option>)}</select></label>
      <label className="field">Quantity<input type="number" min="0" {...form.register('quantity')} placeholder="Not set" />{form.formState.errors.quantity && <small className="field-error">{form.formState.errors.quantity.message}</small>}</label>
      <label className="field">Due date and time<input type="datetime-local" {...form.register('dueAt')} /></label>
      <label className="field">Assigned person<input {...form.register('assignee')} list="team-members" placeholder="Not assigned" /><datalist id="team-members">{settings?.teamMembers?.map(name => <option key={name}>{name}</option>)}</datalist></label>
      <label className="field">Priority<select {...form.register('priority')}><option value="urgent">Urgent</option><option value="high">High priority</option><option value="normal">Normal</option><option value="low">Low priority</option></select></label>
      <label className="field">Artwork approval<select {...form.register('approvalStatus')}><option value="draft">Draft</option><option value="for-approval">For Client Approval</option><option value="approved">Approved</option><option value="revision-requested">Revision Requested</option></select></label>
    </div>
    <fieldset className="form-fieldset"><legend>Jersey size quantities</legend><div className="size-grid">{['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', 'Custom'].map(size => <label key={size} className="size-field"><span>{size}</span><input type="number" min="0" value={sizeBreakdown[size] ?? ''} onChange={event => { const value = event.target.value; setSizeBreakdown(current => { const next = { ...current }; if (value === '') delete next[size]; else next[size] = Number(value); return next }) }} placeholder="—" /></label>)}</div><small>Leave blank where a breakdown is not available yet.</small></fieldset>
    <fieldset className="form-fieldset"><legend>Labels</legend><div className="label-picker">{labelOptions.map(label => <label key={label.id} className={`label-choice ${selectedLabels.includes(label.name) ? 'selected' : ''}`}><input type="checkbox" checked={selectedLabels.includes(label.name)} onChange={event => setSelectedLabels(current => event.target.checked ? [...current, label.name] : current.filter(name => name !== label.name))} /><span className="label-chip" style={{ '--label-color': label.color, color: labelTextColor(label.color) } as React.CSSProperties}>{label.name}</span></label>)}</div></fieldset>
    <label className="field">Order notes<textarea {...form.register('notes')} rows={3} placeholder="Production notes, material checks, client instructions..." /></label>
    <div className="form-fieldset"><div className="fieldset-title">Checklist <small>{checklist.filter(item => item.done).length}/{checklist.length}</small></div><ChecklistEditor items={checklist} onChange={setChecklist} /></div>
    <div className="dialog-footer"><button type="button" className="button button-quiet" onClick={cancel}>Cancel</button><button className="button button-primary" type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Saving…' : order ? 'Save order' : 'Create order'}</button></div>
  </form>
}
function toDateTimeInput(value: string) { const date = new Date(value); const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16) }
