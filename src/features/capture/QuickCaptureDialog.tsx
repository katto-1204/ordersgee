import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, ClipboardPaste, FileText, Plus, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { parseQuickCapture, captureToOrder, type ParsedCapture } from '../../lib/quick-capture'
import { useShop } from '../../stores/shop'
import { STAGE_LABELS } from '../../types/domain'
import DialogFrame from '../../components/DialogFrame'
import { labelTextColor } from '../../components/Chips'

export default function QuickCaptureDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [source, setSource] = useState('')
  const [rows, setRows] = useState<ParsedCapture[]>([])
  const [saving, setSaving] = useState(false)
  const { orders, labels, importOrders } = useShop()
  useEffect(() => {
    const handler = (event: Event) => { const custom = event as CustomEvent<string>; setSource(custom.detail); setRows(parseQuickCapture(custom.detail, orders)) }
    window.addEventListener('gee-capture-text', handler)
    return () => window.removeEventListener('gee-capture-text', handler)
  }, [orders])
  const selected = useMemo(() => rows.filter(row => row.selected && !row.duplicate), [rows])
  const requestOpenChange = (next: boolean) => { if (!next && saving) return; onOpenChange(next) }
  const preview = () => setRows(parseQuickCapture(source, orders))
  const updateRow = (id: string, patch: Partial<ParsedCapture>) => setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row))
  const fileInput = (file?: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.txt')) { toast.error('Quick Capture accepts .txt files.'); return }
    void file.text().then(text => { setSource(text); setRows(parseQuickCapture(text, orders)) })
  }
  const save = async () => {
    if (saving || !selected.length) return
    setSaving(true)
    try {
      const count = await importOrders(selected.map(captureToOrder))
      toast.success(`${count} ${count === 1 ? 'order' : 'orders'} added to production`)
      setRows([]); setSource(''); onOpenChange(false)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not import the selected rows') }
    finally { setSaving(false) }
  }

  return <DialogFrame open={open} onOpenChange={requestOpenChange} title="Quick Capture" description="Paste the Notepad list. Review actions before anything is added." wide>
    <div className="capture-layout">
      <div className="capture-input-panel"><div className="capture-input-heading"><span><ClipboardPaste size={16} /> Paste or import</span><label className="text-button"><Upload size={14} /> Open .txt<input type="file" accept=".txt,text/plain" hidden onChange={event => { fileInput(event.target.files?.[0]); event.currentTarget.value = '' }} /></label></div><textarea aria-label="Paste production task lines" value={source} onChange={event => setSource(event.target.value)} placeholder={'BLUEPHOENIX DARYL - TO PRINT\nFUSION - TO PRINT\nSSDK YONG - TO RESIZE'} rows={8} /><div className="capture-actions"><small>One order or handoff per line · original text is kept for audit</small><button className="button button-primary" type="button" onClick={preview} disabled={!source.trim()}>Preview lines <ArrowRight size={14} /></button></div></div>
      <div className="capture-preview"><div className="preview-heading"><div><strong>Import preview</strong><small>{rows.length ? `${selected.length} selected · ${rows.filter(item => item.duplicate).length} duplicate${rows.filter(item => item.duplicate).length === 1 ? '' : 's'}` : 'Nothing parsed yet'}</small></div>{rows.length > 0 && <button className="text-button" onClick={() => setRows([])}><X size={14} /> Clear</button>}</div>
        {rows.length ? <div className="capture-row-list">{rows.map(row => <div className={`capture-row ${row.duplicate ? 'capture-duplicate' : ''}`} key={row.id}><label className="capture-select"><input type="checkbox" checked={row.selected && !row.duplicate} disabled={row.duplicate} onChange={event => updateRow(row.id, { selected: event.target.checked })} /><span className="fake-check"><Check size={12} /></span></label><div className="capture-row-fields"><input aria-label="Customer or team name" value={row.customerName} onChange={event => updateRow(row.id, { customerName: event.target.value })} /><div className="capture-row-meta"><select aria-label="Production status" value={row.stage} onChange={event => updateRow(row.id, { stage: event.target.value })}>{STAGE_LABELS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select><div className="capture-labels">{row.labels.map(name => { const label = labels.find(item => item.name === name); return <button type="button" className="label-chip capture-label" style={{ '--label-color': label?.color ?? '#e5e7eb', color: labelTextColor(label?.color) } as React.CSSProperties} key={name} aria-label={`Remove ${name} label`} onClick={() => updateRow(row.id, { labels: row.labels.filter(value => value !== name) })}>{name} ×</button> })}<select aria-label={`Add label to ${row.customerName}`} value="" onChange={event => { const value = event.target.value; if (value && !row.labels.includes(value)) updateRow(row.id, { labels: [...row.labels, value] }) }}><option value="">Add label</option>{labels.filter(label => !row.labels.includes(label.name)).map(label => <option key={label.id} value={label.name}>{label.name}</option>)}</select></div></div><small className="source-line">Source: {row.sourceText}</small>{row.duplicate && <small className="duplicate-note"><AlertTriangle size={12} /> Already in this workspace or repeated above.</small>}</div></div>)}</div> : <div className="capture-empty"><FileText size={22} /><strong>Preview is ready when you are</strong><span>Each line is parsed without sending it to an AI service.</span></div>}
        <div className="capture-footer"><span>{rows.length ? `${rows.length} lines found` : 'Keeps original source for recovery'}</span><button className="button button-primary" onClick={() => void save()} disabled={!selected.length || saving}><Plus size={15} /> {saving ? 'Saving…' : `Add ${selected.length || ''} to production`}</button></div>
      </div>
    </div>
  </DialogFrame>
}
