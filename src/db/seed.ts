import { DEFAULT_LABELS, type Order, type ShopLabel } from '../types/domain'

const suppliedRows: { name: string; action: string; stage: string; labels: string[]; sourceText?: string }[] = [
  { name: 'ASNEX', action: 'SEW', stage: 'to-sew', labels: ['TO SEW'] },
  { name: 'ACD', action: 'SEW', stage: 'to-sew', labels: ['TO SEW'] },
  { name: 'HOLYCHILD', action: 'SEW', stage: 'to-sew', labels: ['TO SEW'] },
  { name: 'SJP GUARD', action: 'PRESS', stage: 'press', labels: ['TO PRESS'] },
  { name: 'WE SLAY DANCE TROUPE', action: 'PRESS', stage: 'press', labels: ['TO PRESS'] },
  { name: 'SMILE SAMAL', action: 'PRESS', stage: 'press', labels: ['TO PRESS'] },
  { name: 'BIG DINK', action: 'PRESS', stage: 'press', labels: ['TO PRESS'] },
  { name: 'RAS GADGET', action: 'PRESS', stage: 'press', labels: ['TO PRESS'] },
  { name: 'CBA ALUMNI', action: 'PRESS', stage: 'press', labels: ['TO PRESS'] },
  { name: 'AG', action: 'PRESS', stage: 'press', labels: ['TO PRESS'] },
  { name: 'MAC T', action: 'PRESS', stage: 'press', labels: ['TO PRESS'] },
  { name: 'CHIVALRY', action: 'PRESS', stage: 'press', labels: ['TO PRESS'] },
  { name: 'RUSSEL AND BYUTS MERCH', action: 'PRESS', stage: 'press', labels: ['TO PRESS', 'MERCH'] },
  ...['BLUEPHOENIX DARYL', 'FUSION', 'SOLAROO', 'S01 MERCH YELLOW AND BLUE', 'CHEDL', 'GUDC RED', 'GUDC GREEN']
    .map(name => ({ name, action: 'TO PRINT', stage: 'printing', labels: ['TO PRINT'] })),
  ...['BOSSING MERCH', 'SSDK YONG', 'MAAM KATYA', 'CBA DEPARTMENTAL', 'CBA FACULTY', 'CBA SPORTS']
    .map(name => ({ name, action: 'TO RESIZE', stage: 'resize', labels: ['TO RESIZE'] })),
  { name: 'SEND DETAILS DAMOSA', action: 'MGA NA PRINT', stage: 'done-print', labels: ['DONE PRINT'], sourceText: 'SEND DETAILS DAMOSA MGA NA PRINT' },
  { name: 'SSDK YONG', action: 'TO RESIZE SAMPLE PRINT 1', stage: 'resize', labels: ['TO RESIZE', 'SAMPLE'] },
  { name: 'BOSSING MERCH', action: 'TO RESIZE PRINT 1', stage: 'resize', labels: ['TO RESIZE', 'SAMPLE'] },
  { name: 'GEE GRAPHICS MERCH', action: 'TO RESIZE PRINT 1', stage: 'resize', labels: ['TO RESIZE', 'SAMPLE', 'MERCH'] },
  { name: 'INTRAMS SPONSOR GEE GRAPHICS MERCH', action: 'TO LAYOUT', stage: 'layout', labels: ['TO LAYOUT', 'MERCH'] },
  { name: 'JOHNPAUL DEPARTMENTAL MERCH SELL', action: 'TO LAYOUT', stage: 'layout', labels: ['TO LAYOUT', 'MERCH'] },
]

export function createSeedLabels(): ShopLabel[] {
  return DEFAULT_LABELS.map((label, index) => ({ ...label, id: `seed-label-${index}`, updatedAt: '1970-01-01T00:00:00.000Z' }))
}

export function createSeedOrders(now = new Date().toISOString()): Order[] {
  return suppliedRows.map((row, index) => ({
    id: `seed-order-${index}`,
    customerName: row.name,
    reference: '',
    productType: row.labels.includes('MERCH') ? 'Merch' : 'Jersey',
    quantity: null,
    sizeBreakdown: {},
    stage: row.stage,
    priority: 'normal',
    dueAt: null,
    assignee: '',
    labels: row.labels,
    notes: '',
    checklist: [],
    attachments: [],
    approvalStatus: 'draft',
    ownerOverrideAt: null,
    sourceText: row.sourceText ?? `${row.name} - ${row.action}`,
    createdAt: now,
    updatedAt: '1970-01-01T00:00:00.000Z',
    completedAt: null,
    archivedAt: null,
  }))
}
