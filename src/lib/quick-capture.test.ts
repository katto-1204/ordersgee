import { describe, expect, it } from 'vitest'
import { captureFingerprint, captureToOrder, parseQuickCapture } from './quick-capture'
import { createSeedOrders } from '../db/seed'
import { isDueToday, localDayRange, philippinesDateLabel } from './time'

describe('Quick Capture', () => {
  it('maps common shop-floor actions to statuses and labels', () => {
    const rows = parseQuickCapture('SJP GUARD - PRESS\nBLUEPHOENIX DARYL - TO PRINT\nSSDK YONG - TO RESIZE SAMPLE PRINT 1\nACD - SEW')
    expect(rows.map(row => [row.customerName, row.stage])).toEqual([
      ['SJP GUARD', 'press'], ['BLUEPHOENIX DARYL', 'printing'], ['SSDK YONG', 'resize'], ['ACD', 'to-sew'],
    ])
    expect(rows[0].labels).toContain('TO PRESS')
    expect(rows[2].labels).toContain('SAMPLE')
  })

  it('splits the supplied Damossa action even when its source line has no dash', () => {
    const [row] = parseQuickCapture('SEND DETAILS DAMOSA MGA NA PRINT')
    expect(row.customerName).toBe('SEND DETAILS DAMOSA')
    expect(row.action).toBe('MGA NA PRINT')
    expect(row.stage).toBe('done-print')
    expect(row.sourceText).toBe('SEND DETAILS DAMOSA MGA NA PRINT')
  })

  it('marks duplicates already present or repeated in the same paste', () => {
    const row = createSeedOrders()[0]
    const rows = parseQuickCapture(`${row.sourceText}\nCUSTOM TEAM - PRESS\nCUSTOM TEAM - PRESS`, [row])
    expect(rows.map(item => item.duplicate)).toEqual([true, false, true])
    expect(captureFingerprint('  A   -  B  ')).toBe('a - b')
  })

  it('keeps unknown facts blank and preserves the exact source text in created orders', () => {
    const [row] = parseQuickCapture('NEW TEAM - TO PRINT')
    const order = captureToOrder(row)
    expect(order.reference).toBe('')
    expect(order.quantity).toBeNull()
    expect(order.dueAt).toBeNull()
    expect(order.sourceText).toBe('NEW TEAM - TO PRINT')
  })
})

describe('demo seed and Asia/Manila date helpers', () => {
  it('seeds only the supplied 32 team/order names without invented reference, quantity or due date', () => {
    const orders = createSeedOrders('2026-01-01T00:00:00.000Z')
    expect(orders).toHaveLength(32)
    expect(orders.every(order => order.reference === '' && order.quantity === null && order.dueAt === null)).toBe(true)
    expect(orders.map(order => order.customerName)).toContain('BLUEPHOENIX DARYL')
    expect(orders.find(order => order.customerName === 'SEND DETAILS DAMOSA')?.sourceText).toBe('SEND DETAILS DAMOSA MGA NA PRINT')
  })

  it('treats the instant spanning UTC midnight according to the Philippine calendar day', () => {
    const nearMidnight = new Date('2026-10-12T16:30:00.000Z')
    expect(localDayRange(nearMidnight)).toBe('2026-10-13')
    expect(isDueToday('2026-10-12T17:00:00.000Z', nearMidnight)).toBe(true)
    expect(philippinesDateLabel(nearMidnight)).toContain('October 13, 2026')
  })
})
