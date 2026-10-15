const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file']
type TokenResponse = { access_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string }
type Identity = { accounts: { oauth2: { initTokenClient: (config: { client_id: string; scope: string; callback: (response: TokenResponse) => void; error_callback: (error: { type: string }) => void }) => { requestAccessToken: (options: { prompt: string }) => void } } } }
declare global { interface Window { google?: Identity } }

let library: Promise<void> | undefined
let accessToken = ''
let expiresAt = 0

export function prepareGoogleAuth() {
  if (window.google?.accounts.oauth2) return Promise.resolve()
  if (library) return library
  library = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    const timer = window.setTimeout(() => finish(new Error('Google sign-in timed out. Check your connection and retry.')), 15000)
    const finish = (error?: Error) => { window.clearTimeout(timer); if (error) { script.remove(); library = undefined; reject(error) } else resolve() }
    script.onload = () => window.google?.accounts.oauth2 ? finish() : finish(new Error('Google sign-in could not load.'))
    script.onerror = () => finish(new Error('Google sign-in could not load. Check your internet connection.'))
    document.head.append(script)
  })
  return library
}

export async function authorizeGoogle(clientId: string) {
  if (!clientId.endsWith('.apps.googleusercontent.com')) throw new Error('Enter a Google OAuth web client ID in Settings first.')
  await prepareGoogleAuth()
  return new Promise<void>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES.join(' '),
      callback: response => {
        if (response.error || !response.access_token) { reject(new Error(response.error_description || 'Google access was declined. Your local work is safe.')); return }
        if (!SCOPES.every(scope => response.scope?.split(' ').includes(scope))) { reject(new Error('Allow both Google Sheets and Drive access to sync records and photos.')); return }
        accessToken = response.access_token
        expiresAt = Date.now() + (Number(response.expires_in ?? 3600) - 60) * 1000
        resolve()
      },
      error_callback: error => reject(new Error(error.type === 'popup_closed' ? 'Google sign-in was closed. Connect again when ready.' : 'Google sign-in could not open. Allow pop-ups for this site and retry.')),
    })
    client.requestAccessToken({ prompt: '' })
  })
}

export function disconnectGoogle() { accessToken = ''; expiresAt = 0 }
export function hasGoogleSession() { return Boolean(accessToken && Date.now() < expiresAt) }

export async function googleDownloadBlob(fileId: string): Promise<Blob> {
  if (!hasGoogleSession()) throw new Error('Connect Google to preview this image.')
  if (!/^[a-zA-Z0-9_-]+$/.test(fileId)) throw new Error('Invalid Drive file ID.')
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000) })
  if (!response.ok) throw new Error('This Drive image is unavailable. Check its sharing permissions.')
  if (Number(response.headers.get('Content-Length')) > 15 * 1024 * 1024) throw new Error('Drive image is too large to preview.')
  const blob = await response.blob()
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) || blob.size > 15 * 1024 * 1024) throw new Error('Drive image preview is unavailable.')
  return blob
}

export async function googleRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  if (!hasGoogleSession()) throw new Error('Google session expired. Connect Google again; your local records are saved.')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  if (init.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json')
  let response: Response
  try { response = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(60000) }) }
  catch { throw new Error('Google could not be reached. Your local changes are saved; retry when online.') }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401) { disconnectGoogle(); throw new Error('Google session expired. Connect Google again.') }
    throw new Error(body.error?.message || `Google request failed (${response.status}). Retry after checking access to the sheet.`)
  }
  return body as T
}

export function parseSheetId(input: string) {
  const value = input.trim()
  if (/^[a-zA-Z0-9_-]{20,}$/.test(value)) return value
  try {
    const url = new URL(value)
    const match = url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})(?:\/|$)/)
    if (url.protocol === 'https:' && url.hostname === 'docs.google.com' && match) return match[1]
  } catch { /* The form reports invalid sheet URLs. */ }
  throw new Error('Paste a valid Google Sheets URL or spreadsheet ID.')
}
