import { describe, expect, it } from 'vitest'
import { attachmentSource, driveImageId, isImageAttachment, validateDriveUrl } from './attachments'

describe('Google Drive attachments', () => {
  it('accepts shared Drive and Docs links', () => {
    expect(validateDriveUrl(' https://drive.google.com/file/d/abc/view?usp=sharing ')).toBe('https://drive.google.com/file/d/abc/view?usp=sharing')
    expect(validateDriveUrl('https://docs.google.com/document/d/abc/edit')).toContain('docs.google.com')
  })
  it.each(['javascript:alert(1)', 'http://drive.google.com/file/d/abc', 'https://drive.google.com.evil.com/file', 'https://example.com/file', 'https://user:pass@drive.google.com/file', 'https://drive.google.com/'])('rejects unsafe or incomplete links: %s', value => {
    expect(() => validateDriveUrl(value)).toThrow()
  })
  it('does not open unsafe imported attachments', () => {
    const base = { id: 'a', name: 'file', type: 'image/jpeg', size: 1, createdAt: '' }
    expect(attachmentSource({ ...base, url: 'javascript:alert(1)' })).toBeUndefined()
    expect(attachmentSource({ ...base, dataUrl: 'data:text/html;base64,AAAA' })).toBeUndefined()
    expect(attachmentSource({ ...base, dataUrl: 'data:image/jpeg;base64,AAAA' })).toBe('data:image/jpeg;base64,AAAA')
  })
  it('only previews remote images with a safe Drive file ID', () => {
    const base = { id: 'a', name: 'file', type: 'image/jpeg', size: 1, createdAt: '' }
    expect(isImageAttachment({ ...base, driveFileId: 'safe-file_123' })).toBe(true)
    expect(driveImageId({ ...base, driveFileId: '../another/path?query=1' })).toBeUndefined()
    expect(driveImageId({ ...base, type: 'text/html', driveFileId: 'safe-file_123' })).toBeUndefined()
  })
})
