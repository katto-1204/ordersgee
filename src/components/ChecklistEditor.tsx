import { Check, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { uid, type ChecklistItem } from '../types/domain'

export default function ChecklistEditor({ items, onChange }: { items: ChecklistItem[]; onChange: (items: ChecklistItem[]) => void }) {
  const [value, setValue] = useState('')
  const add = () => {
    const text = value.trim()
    if (!text) return
    onChange([...items, { id: uid(), text, done: false }])
    setValue('')
  }
  return <div className="checklist-editor">{items.map(item => <div className="checklist-line" key={item.id}><button type="button" className={`check-button ${item.done ? 'checked' : ''}`} aria-label={`${item.done ? 'Reopen' : 'Complete'} ${item.text}`} onClick={() => onChange(items.map(entry => entry.id === item.id ? { ...entry, done: !entry.done } : entry))}>{item.done && <Check size={12} />}</button><span className={item.done ? 'check-done' : ''}>{item.text}</span><button type="button" className="micro-action" aria-label={`Remove ${item.text}`} onClick={() => onChange(items.filter(entry => entry.id !== item.id))}><X size={13} /></button></div>)}<div className="checklist-add"><input value={value} onChange={event => setValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add() } }} placeholder="Add a checklist item" /><button type="button" onClick={add} aria-label="Add checklist item"><Plus size={14} /></button></div></div>
}
