import { useEffect, useState } from 'react'
import { Cloud, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useShop } from '../../stores/shop'
import { connectGoogle, createGoogleSheet, disconnectSheets, syncGoogleSheet, useGoogleSync } from '../../lib/google-sheets'
import { parseSheetId, prepareGoogleAuth } from '../../lib/google-auth'

export default function GoogleSheetsSettings() {
  const { settings, updateSettings, load } = useShop()
  const sync = useGoogleSync()
  const [clientId, setClientId] = useState(settings?.googleClientId ?? import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '')
  const [sheetUrl, setSheetUrl] = useState(settings?.googleSheetId ?? import.meta.env.VITE_GOOGLE_SHEET_ID ?? '')
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => { if (clientId.endsWith('.apps.googleusercontent.com')) void prepareGoogleAuth().catch(() => undefined) }, [clientId])
  const action = async (operation: () => Promise<void>) => {
    setWorking(true); setMessage('')
    try { await operation() } catch (error) { const text = error instanceof Error ? error.message : 'Google connection failed. Please retry.'; setMessage(text); toast.error(text) } finally { setWorking(false) }
  }
  const save = async () => {
    if (!clientId.trim().endsWith('.apps.googleusercontent.com')) throw new Error('Enter a Google OAuth web client ID ending in .apps.googleusercontent.com.')
    const googleSheetId = sheetUrl.trim() ? parseSheetId(sheetUrl) : ''
    if (clientId.trim() !== settings?.googleClientId) disconnectSheets()
    await updateSettings({ googleClientId: clientId.trim(), googleSheetId })
    setSheetUrl(googleSheetId)
    setMessage('Connection settings saved. Connect Google, then sync your records.')
  }
  const disabled = working || sync.busy
  const saved = clientId.trim() === settings?.googleClientId && (!sheetUrl.trim() || sheetUrl.trim() === settings?.googleSheetId || sheetUrl.includes(`/d/${settings?.googleSheetId}/`))
  return <section className="settings-card google-settings" id="account">
    <div className="settings-card-title"><div className="settings-icon"><Cloud size={17} /></div><div><h2>Google Sheets database</h2><p>Keep a shared record of every team, order, task, note and asset. Work saves in localStorage first.</p></div></div>
    <div className="form-stack">
      <label className="field">Google OAuth client ID<input value={clientId} onChange={event => setClientId(event.target.value)} placeholder="…apps.googleusercontent.com" autoComplete="off" /></label>
      <label className="field">Google Sheets URL or ID<input value={sheetUrl} onChange={event => setSheetUrl(event.target.value)} placeholder="Paste your sheet link, or leave blank to create a new sheet" /></label>
      <div className="settings-button-row">
        <button className="button button-quiet" disabled={disabled} onClick={() => void action(save)}>Save Google settings</button>
        <button className="button button-primary" disabled={disabled || !saved || !settings?.googleClientId} onClick={() => void action(async () => { await connectGoogle(settings!.googleClientId!); setMessage('Google connected. Sync now to save and load records.'); toast.success('Google connected') })}>Connect Google</button>
        <button className="button button-quiet" disabled={disabled || !sync.connected || !saved} onClick={() => void action(async () => { const id = await createGoogleSheet(); setSheetUrl(id); await load(); setMessage('New sheet created. Sync now to populate its records.'); toast.success('Google Sheet created') })}>Create new Google Sheet</button>
      </div>
      <div className="settings-button-row">
        <button className="button button-primary" disabled={disabled || !sync.connected || !settings?.googleSheetId || !saved} onClick={() => void action(async () => { await syncGoogleSheet(); await load(); setMessage('Records synced with Google Sheets.'); toast.success('Google Sheets synced') })}><RefreshCw size={14} />{sync.busy ? 'Syncing…' : 'Sync now'}</button>
        <button className="button button-quiet" disabled={disabled || !sync.connected || !settings?.googleSheetId || !saved} onClick={() => void action(async () => { await syncGoogleSheet(true); await load(); setMessage('Loaded Google records. Newer local edits were preserved. Sync now to send pending changes.'); toast.success('Google records loaded') })}>Load records from Google</button>
        {sync.connected && <button className="button button-quiet" disabled={disabled} onClick={() => { disconnectSheets(); setMessage('Disconnected. Your local records and Google Sheet are kept.') }}>Disconnect Google</button>}
        {settings?.googleSheetId && <a className="button button-quiet" href={`https://docs.google.com/spreadsheets/d/${settings.googleSheetId}/edit`} target="_blank" rel="noreferrer">Open Google Sheet</a>}
      </div>
      <label className="notification-option"><input type="checkbox" checked={settings?.googleAutoSync ?? false} onChange={event => void action(async () => { await updateSettings({ googleAutoSync: event.target.checked }) })} /><span><strong>Automatically sync while this app is open</strong><small>Runs after local edits and reconnecting to the internet. Connect Google again after a reload or expired session.</small></span></label>
      <div role="status" aria-live="polite" className="sync-setup-note"><span className="sync-dot" /><div><strong>{sync.busy ? 'Syncing…' : sync.connected ? sync.pending ? 'Local changes pending' : 'Google Sheets up to date' : 'Local storage active · Google not connected'}</strong><small>{message || sync.error || (sync.lastSyncedAt ? `Last synced ${new Date(sync.lastSyncedAt).toLocaleString()}` : 'No Google sync has completed in this session.')}</small></div></div>
      {sync.error && <p role="alert">{sync.error}</p>}
      <small className="muted-copy">Sync merges records by ID and most recent edit. Deleted records are tracked so they stay deleted after sync. Local changes remain saved when Google is unavailable. Avoid editing the same record on two devices at once.</small>
      <small className="muted-copy">Photos and mockup previews upload to your private Google Drive; their links are recorded in Sheets. Share the files in Drive with staff who need access. Original print files stay in Drive.</small>
      <details><summary>Set up Google access</summary><ol><li>In Google Cloud, enable the Google Sheets API and Google Drive API.</li><li>Create an OAuth consent screen and a Web application client ID. Add this origin: <code>{window.location.origin}</code>. For a testing app, add your Google account as a test user.</li><li>Paste the client ID above, save, and connect Google. Allow Sheets and Drive access. Create a new sheet or paste one you can edit, then sync.</li></ol><a href="https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid" target="_blank" rel="noreferrer">Google setup instructions</a></details>
    </div>
  </section>
}
