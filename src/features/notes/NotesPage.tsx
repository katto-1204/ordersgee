import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Bold, CheckSquare, FileText, Heading, Italic, Link2, Paperclip, Pin, Plus, Search, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { useShop } from '../../stores/shop'
import { uid, type Attachment, type ShopNote } from '../../types/domain'
import { format } from 'date-fns'
import { labelTextColor } from '../../components/Chips'
import { attachmentSource, prepareImageAttachment } from '../../lib/attachments'
import { userFacingError } from '../../lib/errors'

const noteTypes: { key: ShopNote['type']; label: string }[] = [{ key: 'general', label: 'General' }, { key: 'customer', label: 'Customer' }, { key: 'production', label: 'Production' }, { key: 'daily', label: 'Daily' }, { key: 'instructions', label: 'Order Instructions' }]

export default function NotesPage() {
  const { notes, orders, labels, addNote, updateNote, removeNote } = useShop()
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState('all')
  const [selected, setSelected] = useState<ShopNote | null>(null)
  const [type, setType] = useState<ShopNote['type']>('general')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [orderId, setOrderId] = useState('')
  const [noteLabels, setNoteLabels] = useState<string[]>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [saveState, setSaveState] = useState('Saved in this browser')
  const [preview, setPreview] = useState(false)
  const [creating, setCreating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const latestDraftRef = useRef<ShopNote | null>(null)
  const filtered = useMemo(() => notes.filter(note => (activeType === 'all' || note.type === activeType) && `${note.title} ${note.content} ${note.labels.join(' ')}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)), [notes, activeType, search])

  const draft = (base: ShopNote): ShopNote => ({ ...base, title, content, type, orderId: orderId || null, labels: noteLabels, attachments, updatedAt: new Date().toISOString() })
  const flushDraft = () => { if (selected) void updateNote(draft(selected)) }
  useEffect(() => { latestDraftRef.current = selected ? draft(selected) : null }, [selected?.id, title, content, type, orderId, noteLabels, attachments])
  useEffect(() => {
    if (!selected) return
    setSaveState('Saving…')
    const timer = window.setTimeout(() => {
      void updateNote(draft(selected)).then(() => setSaveState(navigator.onLine ? 'Saved in this browser' : 'Saved offline')).catch(error => { setSaveState('Not saved · edit again to retry'); toast.error(userFacingError(error)) })
    }, 650)
    return () => window.clearTimeout(timer)
  }, [selected?.id, title, content, type, orderId, noteLabels, attachments])
  useEffect(() => {
    return () => { if (latestDraftRef.current) void updateNote(latestDraftRef.current) }
  // Flush the active draft if a user navigates away before the debounce fires.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const create = async () => {
    if (creating) return
    setCreating(true)
    try {
      flushDraft()
      const note: ShopNote = { id: uid(), title: '', content: '', type: 'general', orderId: null, labels: [], attachments: [], pinned: false, updatedAt: new Date().toISOString() }
      await addNote(note)
      setSelected(note); setTitle(''); setContent(''); setType('general'); setOrderId(''); setNoteLabels([]); setAttachments([]); setPreview(false)
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create the note') }
    finally { setCreating(false) }
  }
  const openNote = (note: ShopNote) => {
    if (selected && selected.id !== note.id) flushDraft()
    setSelected(note); setTitle(note.title); setContent(note.content); setType(note.type); setOrderId(note.orderId ?? ''); setNoteLabels(note.labels ?? []); setAttachments(note.attachments ?? []); setPreview(false)
  }
  const wrapSelection = (prefix: string, suffix = prefix) => {
    const textarea = document.getElementById('note-editor') as HTMLTextAreaElement | null
    if (!textarea) return
    const start = textarea.selectionStart, end = textarea.selectionEnd
    const value = content.slice(0, start) + prefix + content.slice(start, end) + suffix + content.slice(end)
    setContent(value)
    requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(start + prefix.length, end + prefix.length) })
  }
  const togglePin = async (note: ShopNote) => {
    const next = { ...draft(note), pinned: !note.pinned }
    setSelected(next); await updateNote(next); toast.success(next.pinned ? 'Note pinned' : 'Note unpinned')
  }
  const deleteNote = async (note: ShopNote) => {
    if (!window.confirm(`Delete “${note.title || 'Untitled note'}”?`)) return
    await removeNote(note.id); if (selected?.id === note.id) setSelected(null); toast.success('Note deleted')
  }
  const addFiles = async (files: FileList | null) => {
    if (!files) return
    const next = [...attachments]
    for (const file of Array.from(files)) {
      if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(file.type)) { toast.error(`${file.name}: use PNG, JPG, WEBP or PDF.`); continue }
      if (file.type.startsWith('image/')) {
        try { next.push(await prepareImageAttachment(file, 'artwork')) } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not read image') }
        continue
      }
      if (file.size > 1024 * 1024) { toast.error(`${file.name}: PDFs in notes must be under 1 MB. Attach original print files to tasks with a Drive link.`); continue }
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Could not read this PDF. Try another file.')); reader.readAsDataURL(file) })
      next.push({ id: uid(), name: file.name, type: file.type, size: file.size, dataUrl, createdAt: new Date().toISOString() })
    }
    setAttachments(next)
  }

  return <div className="page-stack notes-page">
    <header className="page-heading-row"><div><span className="eyebrow">SHOP MEMORY</span><h1>Notes</h1><p className="page-subtitle">Keep the details close to the work.</p></div><button className="button button-primary" onClick={() => void create()} disabled={creating}>{creating ? 'Creating…' : <><Plus size={16} /> New note</>}</button></header>
    <div className="note-workspace"><aside className="note-list-panel"><div className="toolbar-search note-search"><Search size={15} /><input aria-label="Search notes" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search notes..." /></div><p className="note-filter-guide">Swipe the categories to see every note type.</p><div className="note-type-filters"><button className={activeType === 'all' ? 'active' : ''} onClick={() => setActiveType('all')}>All notes <span>{notes.length}</span></button>{noteTypes.map(item => <button key={item.key} className={activeType === item.key ? 'active' : ''} onClick={() => setActiveType(item.key)}>{item.label}</button>)}</div><div className="note-list">{filtered.map(note => <button key={note.id} className={`note-list-item ${selected?.id === note.id ? 'selected' : ''}`} onClick={() => openNote(note)}><span className="note-list-type"><FileText size={13} />{noteTypes.find(item => item.key === note.type)?.label}{note.pinned && <Pin size={11} />}</span><strong>{note.title || 'Untitled note'}</strong><small>{note.content.slice(0, 62) || 'No content yet'}</small><time>{format(new Date(note.updatedAt), 'MMM d')}</time></button>)}{!filtered.length && <div className="note-empty-list">No notes match this view.</div>}</div></aside>
      <section className="note-editor-panel">{selected ? <><div className="note-editor-meta"><div className="note-autosave"><span className="save-dot" />{saveState}</div><div className="note-editor-actions"><button className="icon-button" aria-label={selected.pinned ? 'Unpin note' : 'Pin note'} onClick={() => void togglePin(selected)}><Pin size={15} /></button><button className="icon-button" aria-label="Delete note" onClick={() => void deleteNote(selected)}><Trash2 size={15} /></button></div></div><input className="note-title-input" value={title} onChange={event => setTitle(event.target.value)} placeholder="Untitled note" /><div className="note-type-line"><select value={type} onChange={event => setType(event.target.value as ShopNote['type'])}>{noteTypes.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select><select value={orderId} onChange={event => setOrderId(event.target.value)}><option value="">No linked order</option>{orders.filter(order => !order.archivedAt).map(order => <option key={order.id} value={order.id}>{order.customerName}</option>)}</select><span>{selected.pinned ? 'Pinned' : 'Auto-saved'}</span></div><div className="note-label-picker" aria-label="Note labels">{labels.map(label => <button type="button" key={label.id} aria-pressed={noteLabels.includes(label.name)} className={`note-label-button ${noteLabels.includes(label.name) ? 'selected' : ''}`} style={{ '--label-color': label.color, color: labelTextColor(label.color) } as React.CSSProperties} onClick={() => setNoteLabels(current => current.includes(label.name) ? current.filter(value => value !== label.name) : [...current, label.name])}>{label.name}</button>)}</div><div className="rich-toolbar"><button aria-label="Bold" title="Bold" onClick={() => wrapSelection('**')}><Bold size={15} /></button><button aria-label="Italic" title="Italic" onClick={() => wrapSelection('_')}><Italic size={15} /></button><button aria-label="Heading" title="Heading" onClick={() => wrapSelection('## ', '')}><Heading size={15} /></button><button aria-label="Checklist" title="Checklist item" onClick={() => wrapSelection('- [ ] ', '')}><CheckSquare size={15} /></button><span /><button aria-label="Insert link" title="Link" onClick={() => wrapSelection('[', '](https://)')}><Link2 size={15} /></button><button className={preview ? 'selected' : ''} onClick={() => setPreview(value => !value)}>{preview ? 'Edit' : 'Preview'}</button></div>{preview ? <div className="note-markdown-preview">{renderMarkdown(content)}</div> : <textarea id="note-editor" className="note-content-input" value={content} onChange={event => setContent(event.target.value)} placeholder="Write instructions, reminders, or the next production handoff..." />}<div className="note-attachments"><div className="fieldset-title"><Paperclip size={13} /> Attachments <button className="text-button" onClick={() => fileRef.current?.click()}><Upload size={13} /> Add files</button></div><input ref={fileRef} hidden type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" onChange={event => { void addFiles(event.target.files); event.currentTarget.value = '' }} /><div>{attachments.map(file => <span className="note-attachment" key={file.id}><a href={attachmentSource(file)} target="_blank" rel="noreferrer">{file.name}</a><button aria-label={`Remove ${file.name}`} onClick={() => setAttachments(current => current.filter(item => item.id !== file.id))}>×</button></span>)}{!attachments.length && <small className="muted-copy">No attachments yet.</small>}</div></div><div className="note-editor-footer"><span>Notes save to this browser automatically{!navigator.onLine ? ' while offline' : ''}.</span><span>{content.length} characters</span></div></> : <div className="note-welcome"><span className="note-welcome-icon"><FileText size={22} /></span><h2>A useful detail, kept handy.</h2><p>Select a note or create one to capture order instructions and shop memory.</p><button className="button button-primary" onClick={() => void create()} disabled={creating}><Plus size={15} /> {creating ? 'Creating…' : 'Create note'}</button></div>}</section></div>
  </div>
}

function renderMarkdown(source: string): ReactNode[] {
  return source.split('\n').map((line, index) => {
    if (/^##\s/.test(line)) return <h3 key={index}>{inlineMarkdown(line.replace(/^##\s/, ''))}</h3>
    if (/^- \[[ x]\] /.test(line)) return <p key={index} className="markdown-check"><span>{line.includes('[x]') ? '☑' : '□'}</span>{inlineMarkdown(line.slice(6))}</p>
    if (!line.trim()) return <div key={index} className="markdown-space" />
    return <p key={index}>{inlineMarkdown(line)}</p>
  })
}
function inlineMarkdown(source: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g
  return source.split(pattern).map((piece, index) => {
    if (piece.startsWith('**') && piece.endsWith('**')) return <strong key={index}>{piece.slice(2, -2)}</strong>
    if (piece.startsWith('_') && piece.endsWith('_')) return <em key={index}>{piece.slice(1, -1)}</em>
    const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(piece)
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>
    return piece
  })
}
