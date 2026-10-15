import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import GoogleAssetImage from './GoogleAssetImage'
import { googleDownloadBlob } from '../lib/google-auth'
import type { Attachment } from '../types/domain'

const connection = vi.hoisted(() => ({ connected: true }))
vi.mock('../lib/google-sheets', () => ({ useGoogleSync: (select: (value: { connected: boolean }) => unknown) => select(connection) }))
vi.mock('../lib/google-auth', () => ({ googleDownloadBlob: vi.fn() }))

const remote: Attachment = { id: 'asset', name: 'Team mockup', type: 'image/jpeg', size: 20, createdAt: '', kind: 'mockup', driveFileId: 'safe-file-id', url: 'https://drive.google.com/file/d/safe-file-id/view' }
const createObjectURL = vi.fn(() => 'blob:private-preview')
const revokeObjectURL = vi.fn()

beforeEach(() => {
  connection.connected = true
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
  vi.mocked(googleDownloadBlob).mockResolvedValue(new Blob(['image'], { type: 'image/jpeg' }))
})
afterEach(() => { cleanup(); vi.clearAllMocks(); delete (URL as unknown as Record<string, unknown>).createObjectURL; delete (URL as unknown as Record<string, unknown>).revokeObjectURL })

describe('private Drive image previews', () => {
  it('prefers the local image without making a Drive request', () => {
    render(<GoogleAssetImage file={{ ...remote, dataUrl: 'data:image/jpeg;base64,AAAA' }} alt="Local design" />)
    expect(screen.getByAltText('Local design').getAttribute('src')).toBe('data:image/jpeg;base64,AAAA')
    expect(googleDownloadBlob).not.toHaveBeenCalled()
  })
  it('loads an authenticated image and revokes it when disconnected', async () => {
    const { rerender } = render(<GoogleAssetImage file={remote} alt="Remote design" />)
    await waitFor(() => expect(screen.getByAltText('Remote design').getAttribute('src')).toBe('blob:private-preview'))
    expect(googleDownloadBlob).toHaveBeenCalledWith('safe-file-id')
    connection.connected = false
    rerender(<GoogleAssetImage file={remote} alt="Remote design" />)
    expect(screen.queryByAltText('Remote design')).toBeNull()
    expect(screen.getByText('Connect Google to preview this image.')).toBeTruthy()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:private-preview')
  })
  it('revokes a private image when unmounted', async () => {
    const { unmount } = render(<GoogleAssetImage file={remote} alt="Remote design" />)
    await screen.findByAltText('Remote design')
    unmount()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:private-preview')
  })
  it('does not fetch Drive images while disconnected', () => {
    connection.connected = false
    render(<GoogleAssetImage file={remote} alt="Remote design" />)
    expect(googleDownloadBlob).not.toHaveBeenCalled()
  })
  it('discards an image response when disconnected before it arrives', async () => {
    let finish: (blob: Blob) => void = () => {}
    vi.mocked(googleDownloadBlob).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const { rerender } = render(<GoogleAssetImage file={remote} alt="Remote design" />)
    connection.connected = false
    rerender(<GoogleAssetImage file={remote} alt="Remote design" />)
    finish(new Blob(['image'], { type: 'image/jpeg' }))
    await Promise.resolve()
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(screen.queryByAltText('Remote design')).toBeNull()
  })
  it('rejects non-image bodies without creating object URLs', async () => {
    vi.mocked(googleDownloadBlob).mockResolvedValue(new Blob(['html'], { type: 'text/html' }))
    render(<GoogleAssetImage file={remote} alt="Remote design" />)
    await screen.findByText('Preview unavailable. Open in Drive to check access.')
    expect(createObjectURL).not.toHaveBeenCalled()
  })
  it('handles permission failure without rendering a broken image', async () => {
    vi.mocked(googleDownloadBlob).mockRejectedValue(new Error('Permission denied'))
    render(<GoogleAssetImage file={remote} alt="Remote design" />)
    await screen.findByText('Preview unavailable. Open in Drive to check access.')
    expect(screen.queryByAltText('Remote design')).toBeNull()
  })
})
