function errorIdentity(error: unknown) {
  if (error && typeof error === 'object') {
    const value = error as { name?: string; message?: string }
    return `${value.name ?? ''} ${value.message ?? ''}`.toLowerCase()
  }
  return String(error ?? '').toLowerCase()
}

export function userFacingError(error: unknown) {
  const identity = errorIdentity(error)
  if (identity.includes('another tab')) {
    return 'This workspace changed in another tab. Reload the current data, then try that change again.'
  }
  if (identity.includes('quota') || identity.includes('storage full') || identity.includes('disk full')) {
    return 'This browser is running low on storage. Remove large attachments or export a backup in Settings, then try again.'
  }
  if (identity.includes('constraint') || identity.includes('unique')) {
    return 'That item may already exist. Check the list before adding it again.'
  }
  if (identity.includes('invalidstate') || identity.includes('database is closed') || identity.includes('indexeddb') || identity.includes('localstorage')) {
    return 'The browser could not open this workspace storage. Check that site storage is allowed, then retry. Do not clear this site’s data.'
  }
  if (identity.includes('abort')) {
    return 'The save was interrupted before it could be confirmed. Please try again.'
  }
  return 'GEE TASKS could not confirm that change was saved. Check browser storage and try again. If this keeps happening, export any available data from Settings before clearing browser data.'
}

export function startupStorageError(error: unknown) {
  const identity = errorIdentity(error)
  if (identity.includes('quota') || identity.includes('storage full') || identity.includes('disk full')) {
    return 'This browser may be out of storage. Free space on your device, then try again. Do not clear this site’s data if you need to keep the current workspace.'
  }
  return 'Your browser could not open the saved workspace. Make sure this site is allowed to store data (private browsing may block it), then retry. We did not clear your data. Avoid clearing browser/site data while troubleshooting.'
}
