import type { Order } from '../types/domain'
import { uid } from '../types/domain'

export interface ParsedCapture {
  id: string
  customerName: string
  action: string
  stage: string
  labels: string[]
  sourceText: string
  duplicate: boolean
  selected: boolean
}

function classify(action: string): { stage: string; labels: string[] } {
  const text = action.toUpperCase()
  if (/TO\s+RESIZE/.test(text) || /RESIZE/.test(text)) return { stage: 'resize', labels: ['TO RESIZE'] }
  if (/TO\s+LAYOUT/.test(text) || /LAYOUT/.test(text)) return { stage: 'layout', labels: ['TO LAYOUT'] }
  if (/TO\s+REVISE|REVISION|REVISE/.test(text)) return { stage: 'revision', labels: ['TO REVISE', 'NEEDS REVISION'] }
  if (/WAITING\s+FOR\s+APPROVAL|FOR\s+APPROVAL/.test(text)) return { stage: 'waiting', labels: ['FOR APPROVAL'] }
  if (/TO\s+DELIVER|DELIVER/.test(text)) return { stage: 'to-deliver', labels: ['TO DELIVER'] }
  if (/MGA\s+NA\s+PRINT|DONE\s+PRINT|PRINTED/.test(text)) return { stage: 'done-print', labels: ['DONE PRINT'] }
  if (/\bPRESS\b/.test(text)) return { stage: 'press', labels: ['TO PRESS'] }
  if (/\bSEW\b/.test(text)) return { stage: 'to-sew', labels: ['TO SEW'] }
  if (/ON\s+HOLD|HOLD/.test(text)) return { stage: 'on-hold', labels: [] }
  if (/\bPRINT\b/.test(text)) return { stage: 'printing', labels: ['TO PRINT'] }
  return { stage: 'sizing', labels: [] }
}

export function captureFingerprint(text: string) {
  return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

function splitCaptureLine(sourceText: string) {
  const separator = sourceText.lastIndexOf(' - ')
  if (separator >= 0) return { customerName: sourceText.slice(0, separator).trim(), action: sourceText.slice(separator + 3).trim() }
  const match = /\b(?:MGA\s+NA\s+PRINT|TO\s+(?:RESIZE|LAYOUT|REVISE|PRINT|SEW|DELIVER)|(?:DONE\s+PRINT|PRESS|SEW|ON\s+HOLD|WAITING\s+FOR\s+APPROVAL|FOR\s+APPROVAL))(?:\s+(?:SAMPLE|PRINT)\s*\d*)?\s*$/i.exec(sourceText)
  if (match && match.index > 0) return { customerName: sourceText.slice(0, match.index).trim(), action: match[0].trim() }
  return { customerName: sourceText.trim(), action: '' }
}

export function parseQuickCapture(text: string, existing: Order[] = []): ParsedCapture[] {
  const seen = new Set(existing.map(order => captureFingerprint(order.sourceText || `${order.customerName} - ${order.stage}`)))
  const batch = new Set<string>()
  return text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(sourceText => {
    const { customerName, action } = splitCaptureLine(sourceText)
    const normalized = captureFingerprint(sourceText)
    const duplicate = seen.has(normalized) || batch.has(normalized)
    batch.add(normalized)
    const classification = classify(action || sourceText)
    const labels = [...classification.labels]
    if (/\bSAMPLE\b|PRINT\s+\d+/i.test(sourceText)) labels.push('SAMPLE')
    if (/\bMERCH\b/i.test(customerName)) labels.push('MERCH')
    return { id: uid(), customerName, action, stage: classification.stage, labels: [...new Set(labels)], sourceText, duplicate, selected: !duplicate }
  })
}

export function captureToOrder(row: ParsedCapture): Order {
  const now = new Date().toISOString()
  return {
    id: uid(), customerName: row.customerName, reference: '', productType: row.labels.includes('MERCH') ? 'Merch' : 'Jersey',
    quantity: null, sizeBreakdown: {}, stage: row.stage, priority: 'normal', dueAt: null, assignee: '', labels: row.labels,
    notes: row.action, checklist: [], attachments: [], approvalStatus: 'draft', ownerOverrideAt: null, sourceText: row.sourceText,
    createdAt: now, updatedAt: now, completedAt: null, archivedAt: null,
  }
}
