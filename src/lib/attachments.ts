import { uid, type Attachment } from '../types/domain'

export const ASSET_KINDS = [
  { value: 'mockup', label: 'Design mockup' },
  { value: 'team-photo', label: 'Team photo' },
  { value: 'print-ready', label: 'Ready to print' },
  { value: 'artwork', label: 'Other artwork' },
] as const
export type AssetKind = typeof ASSET_KINDS[number]['value']
export const assetKindLabel = (kind?: string) => ASSET_KINDS.find(item => item.value === kind)?.label ?? 'Other artwork'

export function validateDriveUrl(value: string): string {
  let url: URL
  try { url = new URL(value.trim()) } catch { throw new Error('Paste a valid Google Drive or Google Docs sharing link.') }
  if (url.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(url.hostname) || url.username || url.password || url.port) {
    throw new Error('Use an HTTPS link from drive.google.com or docs.google.com.')
  }
  if (url.pathname === '/' || !url.pathname.slice(1)) throw new Error('Paste the sharing link for a specific file or folder.')
  return url.toString()
}

export function attachmentSource(file: Attachment): string | undefined {
  if (file.dataUrl && /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,[a-z0-9+/=]+$/i.test(file.dataUrl)) return file.dataUrl
  if (file.url) { try { return validateDriveUrl(file.url) } catch { return undefined } }
  return undefined
}

export function isImageAttachment(file: Attachment) {
  return ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) && Boolean((file.dataUrl && attachmentSource(file)?.startsWith('data:image/')) || driveImageId(file))
}

export function driveImageId(file: Attachment): string | undefined {
  return ['image/png', 'image/jpeg', 'image/webp'].includes(file.type) && /^[a-zA-Z0-9_-]{1,200}$/.test(file.driveFileId ?? '') ? file.driveFileId : undefined
}

export async function prepareImageAttachment(file: File, kind: AssetKind): Promise<Attachment> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Use a PNG, JPG or WEBP image. Keep print files in Google Drive.')
  if (file.size > 15 * 1024 * 1024) throw new Error('Choose an image under 15 MB.')
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('This image could not be read. Try another file.'))
    reader.readAsDataURL(file)
  })
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('This image is damaged or unsupported. Try another file.'))
    element.src = dataUrl
  })
  let maxDimension = 900
  let compressed = ''
  // Browser storage keeps small previews; original print-quality files belong in Drive.
  for (let attempt = 0; attempt < 5; attempt++) {
    const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * ratio)); canvas.height = Math.max(1, Math.round(image.height * ratio))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image preview is unavailable in this browser.')
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    compressed = canvas.toDataURL('image/jpeg', 0.78)
    if (compressed.length <= 100_000) break
    maxDimension = Math.round(maxDimension * 0.72)
  }
  if (compressed.length > 100_000) throw new Error('This image is too large for browser storage. Add a Google Drive link instead.')
  return { id: uid(), name: file.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', size: Math.round(compressed.split(',')[1].length * 0.75), dataUrl: compressed, kind, createdAt: new Date().toISOString() }
}
