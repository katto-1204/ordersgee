import { useEffect, useState } from 'react'
import { FileImage } from 'lucide-react'
import type { Attachment } from '../types/domain'
import { attachmentSource, driveImageId } from '../lib/attachments'
import { googleDownloadBlob } from '../lib/google-auth'
import { useGoogleSync } from '../lib/google-sheets'

export function useAttachmentImage(file: Attachment) {
  const connected = useGoogleSync(state => state.connected)
  const source = attachmentSource(file)
  const local = source?.startsWith('data:image/') ? source : undefined
  const fileId = driveImageId(file)
  const [remote, setRemote] = useState<{ id: string; url?: string; failed?: boolean }>()
  useEffect(() => {
    if (local || !fileId || !connected) { setRemote(undefined); return }
    let active = true
    let objectUrl: string | undefined
    setRemote({ id: fileId })
    void googleDownloadBlob(fileId).then(blob => {
      if (!active) return
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(blob.type) || blob.size > 15 * 1024 * 1024) throw new Error('Unsupported image preview')
      objectUrl = URL.createObjectURL(blob)
      setRemote({ id: fileId, url: objectUrl })
    }).catch(() => { if (active) setRemote({ id: fileId, failed: true }) })
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [local, fileId, connected])
  return {
    src: local || (connected && remote && remote.id === fileId ? remote.url : undefined),
    message: !connected ? 'Connect Google to preview this image.' : remote && remote.id === fileId && remote.failed ? 'Preview unavailable. Open in Drive to check access.' : 'Loading image preview…',
  }
}

export default function GoogleAssetImage({ file, alt, className = '' }: { file: Attachment; alt: string; className?: string }) {
  const { src, message } = useAttachmentImage(file)
  const [failedSource, setFailedSource] = useState<string>()
  if (src && src !== failedSource) return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailedSource(src)} />
  return <span className={`asset-image-placeholder ${className}`}><FileImage size={23} /><span>{src ? 'Preview unavailable. Open in Drive to check access.' : message}</span></span>
}
