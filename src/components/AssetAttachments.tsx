import { useRef, useState } from 'react'
import { Download, ExternalLink, FileImage, Link2, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { uid, type Attachment } from '../types/domain'
import { ASSET_KINDS, assetKindLabel, attachmentSource, isImageAttachment, prepareImageAttachment, validateDriveUrl, type AssetKind } from '../lib/attachments'
import './assets.css'
import DialogFrame from './DialogFrame'
import GoogleAssetImage from './GoogleAssetImage'

export default function AssetAttachments({ attachments, onChange, label = 'Team designs & files', defaultKind = 'mockup' }: {
  attachments: Attachment[]; onChange: (files: Attachment[]) => void | Promise<void>; label?: string; defaultKind?: AssetKind
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<AssetKind>(defaultKind)
  const [link, setLink] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Attachment | null>(null)
  const fail = (value: unknown) => { const message = value instanceof Error ? value.message : 'Could not save this attachment.'; setError(message); toast.error(message) }
  const addImages = async (files: File[]) => {
    if (!files.length) return
    setBusy(true); setError('')
    try {
      if (kind === 'print-ready') throw new Error('Attach the original Google Drive file for ready-to-print assets. Image uploads are compressed previews.')
      const next = [...attachments]
      for (const file of files) next.push(await prepareImageAttachment(file, kind))
      await onChange(next)
      toast.success(`${files.length === 1 ? 'Image' : 'Images'} added`)
    } catch (value) { fail(value) } finally { setBusy(false) }
  }
  const addLink = async () => {
    setBusy(true); setError('')
    try {
      const url = validateDriveUrl(link)
      if (attachments.some(file => file.url === url && file.kind === kind)) throw new Error('This link is already attached in this category.')
      await onChange([...attachments, { id: uid(), name: name.trim() || `${assetKindLabel(kind)} · Google Drive`, kind, url, type: 'application/x-google-drive', size: 0, createdAt: new Date().toISOString() }])
      setLink(''); setName(''); toast.success('Google Drive file attached')
    } catch (value) { fail(value) } finally { setBusy(false) }
  }
  const remove = async (file: Attachment) => {
    setBusy(true); setError('')
    try { await onChange(attachments.filter(item => item.id !== file.id)); toast.success('Attachment removed') }
    catch (value) { fail(value) } finally { setBusy(false) }
  }
  return <section className="asset-manager" aria-label={label}>
    <div className="section-heading-row"><h3>{label}</h3><span className="muted-copy">{attachments.length} attached</span></div>
    <div className="asset-controls"><label className="field">Asset category<select aria-label={`${label} category`} value={kind} disabled={busy} onChange={event => setKind(event.target.value as AssetKind)}>{ASSET_KINDS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button type="button" className="button button-quiet" disabled={busy || kind === 'print-ready'} onClick={() => fileInput.current?.click()}><Upload size={14} />{busy ? 'Working…' : kind === 'print-ready' ? 'Use original Drive file below' : 'Upload image'}</button><input ref={fileInput} aria-label={`${label} upload`} type="file" multiple hidden accept="image/png,image/jpeg,image/webp" onChange={event => { const files = Array.from(event.target.files ?? []); event.currentTarget.value = ''; void addImages(files) }} /></div>
    <p className="asset-help">Upload design mockups or team photos (PNG, JPG, WEBP; up to 15 MB). Images are saved as small previews, up to 900 px, to fit browser storage. Keep original ready-to-print assets in Google Drive and attach their sharing link below.</p>
    <div className="asset-link-fields"><label className="field">File name<input value={name} disabled={busy} onChange={event => setName(event.target.value)} placeholder="e.g. Eagles final jersey print" /></label><label className="field">Google Drive file link<input type="url" value={link} disabled={busy} onChange={event => setLink(event.target.value)} placeholder="https://drive.google.com/file/d/..." /></label><button type="button" className="button button-quiet" disabled={busy || !link.trim()} onClick={() => void addLink()}><Link2 size={14} /> Attach Drive file</button></div>
    <p className="asset-help">Choose the category before uploading or attaching. Drive sharing permissions still apply; grant your print team access in Google Drive.</p>
    {error && <p className="field-error" role="alert">{error}</p>}
    {attachments.length ? <div className="asset-grid">{attachments.map(file => {
      const source = attachmentSource(file)
      let driveUrl: string | undefined
      try { driveUrl = file.url ? validateDriveUrl(file.url) : undefined } catch { /* Invalid imported links stay unavailable. */ }
      const image = isImageAttachment(file)
      return <article className="asset-card" key={file.id}>
        {image ? <button type="button" className="asset-preview" aria-label={`Preview ${file.name}`} onClick={() => setPreview(file)}><GoogleAssetImage file={file} alt={`${assetKindLabel(file.kind)}: ${file.name}`} /></button> : <div className="asset-document"><FileImage size={28} /><span>{file.url ? 'GOOGLE DRIVE' : 'FILE'}</span></div>}
        <div className="asset-card-copy"><small>{assetKindLabel(file.kind)}</small><strong title={file.name}>{file.name}</strong><div className="asset-actions">{driveUrl && <a href={driveUrl} target="_blank" rel="noreferrer" className="text-button"><ExternalLink size={13} /> Open in Drive</a>}{source?.startsWith('data:') && <a href={source} download={file.name} className="text-button"><Download size={13} /> Download</a>}<button type="button" className="text-button asset-remove" disabled={busy} aria-label={`Remove ${file.name}`} onClick={() => void remove(file)}><Trash2 size={13} /> Remove</button></div>{!source && <small className="field-error">Original file unavailable. Attach it again.</small>}</div>
      </article>
    })}</div> : <p className="muted-copy">No assets yet. Add a mockup, ready-to-print Drive file, or team photo.</p>}
    {preview && <DialogFrame open onOpenChange={open => !open && setPreview(null)} title={`Image preview: ${preview.name}`} description={assetKindLabel(preview.kind)} wide><GoogleAssetImage className="asset-full-image" file={preview} alt={preview.name} /></DialogFrame>}
  </section>
}
