export const PRIMARY_STAGES = [
  { key: 'sizing', label: 'Sizing' },
  { key: 'printing', label: 'Printing' },
  { key: 'done-print', label: 'Done Print' },
  { key: 'to-sew', label: 'To Sew' },
  { key: 'to-deliver', label: 'To Deliver' },
  { key: 'finished', label: 'Finished' },
] as const

export const EXTRA_STAGES = [
  { key: 'layout', label: 'Layout' },
  { key: 'revision', label: 'Revision' },
  { key: 'press', label: 'Press' },
  { key: 'resize', label: 'Resize' },
  { key: 'waiting', label: 'Waiting for Approval' },
  { key: 'on-hold', label: 'On Hold' },
  { key: 'cancelled', label: 'Cancelled' },
] as const

export type StageKey = string
export type Priority = 'urgent' | 'high' | 'normal' | 'low'
export type ApprovalStatus = 'draft' | 'for-approval' | 'approved' | 'revision-requested'
export type ChecklistItem = { id: string; text: string; done: boolean }
export type Attachment = { id: string; name: string; type: string; size: number; dataUrl?: string; url?: string; kind?: 'mockup' | 'team-photo' | 'print-ready' | 'artwork'; driveFileId?: string; createdAt: string }

export interface Order {
  id: string
  customerName: string
  reference: string
  productType: string
  quantity: number | null
  sizeBreakdown: Record<string, number>
  stage: StageKey
  priority: Priority
  dueAt: string | null
  assignee: string
  labels: string[]
  notes: string
  checklist: ChecklistItem[]
  attachments: Attachment[]
  approvalStatus: ApprovalStatus
  ownerOverrideAt: string | null
  sourceText: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  archivedAt: string | null
}

export interface Task {
  id: string
  updatedAt?: string
  title: string
  description: string
  orderId: string | null
  priority: Priority
  status: 'open' | 'completed'
  dueAt: string | null
  assignee: string
  labels: string[]
  checklist: ChecklistItem[]
  comments: string[]
  attachments: Attachment[]
  createdAt: string
  completedAt: string | null
  archivedAt: string | null
  sortOrder: number
}

export type LabelCategory = 'production' | 'product' | 'priority' | 'other' | 'custom'
export interface ShopLabel { id: string; name: string; color: string; category: LabelCategory; updatedAt?: string }
export interface ShopNote {
  id: string
  title: string
  content: string
  type: 'general' | 'customer' | 'production' | 'daily' | 'instructions'
  orderId: string | null
  labels: string[]
  attachments: Attachment[]
  pinned: boolean
  updatedAt: string
}
export interface ActivityEntry { id: string; entityType: 'order' | 'task' | 'note' | 'system'; entityId: string; message: string; createdAt: string }
export interface QueueEntry { id: string; table: 'orders' | 'tasks' | 'notes' | 'labels' | 'activity'; recordId: string; operation: 'upsert' | 'delete'; payload: unknown; createdAt: string; attempts: number }
export interface ShopSettings { id: 'shop'; shopName: string; theme: 'light' | 'dark'; customStages: { key: string; label: string }[]; teamMembers?: string[]; logoDataUrl?: string; remindersEnabled?: boolean; lastReminderDate?: string; guideDismissedAt?: string; googleClientId?: string; googleSheetId?: string; googleAutoSync?: boolean; sharedSettingsUpdatedAt?: string; firstRunComplete: boolean; updatedAt: string }

export const DEFAULT_LABELS: Omit<ShopLabel, 'id'>[] = [
  { name: 'TO LAYOUT', color: '#dbeafe', category: 'production' },
  { name: 'TO REVISE', color: '#ede9fe', category: 'production' },
  { name: 'TO RESIZE', color: '#fef3c7', category: 'production' },
  { name: 'TO PRINT', color: '#fee2e2', category: 'production' },
  { name: 'PRINTING', color: '#fecaca', category: 'production' },
  { name: 'DONE PRINT', color: '#dcfce7', category: 'production' },
  { name: 'TO PRESS', color: '#ffedd5', category: 'production' },
  { name: 'TO SEW', color: '#cffafe', category: 'production' },
  { name: 'TO DELIVER', color: '#e0e7ff', category: 'production' },
  { name: 'COMPLETED', color: '#e5e7eb', category: 'production' },
  { name: 'JERSEY', color: '#dbeafe', category: 'product' },
  { name: 'FULL SUBLIMATION', color: '#fce7f3', category: 'product' },
  { name: 'T-SHIRT', color: '#ccfbf1', category: 'product' },
  { name: 'LONG SLEEVE', color: '#e0e7ff', category: 'product' },
  { name: 'POLO SHIRT', color: '#f3e8ff', category: 'product' },
  { name: 'HOODIE', color: '#f1f5f9', category: 'product' },
  { name: 'MERCH', color: '#fce7f3', category: 'product' },
  { name: 'SAMPLE', color: '#fef3c7', category: 'product' },
  { name: 'URGENT', color: '#fee2e2', category: 'priority' },
  { name: 'HIGH PRIORITY', color: '#ffedd5', category: 'priority' },
  { name: 'NORMAL', color: '#e5e7eb', category: 'priority' },
  { name: 'LOW PRIORITY', color: '#dcfce7', category: 'priority' },
  { name: 'WAITING FOR CLIENT', color: '#fef3c7', category: 'other' },
  { name: 'FOR APPROVAL', color: '#ede9fe', category: 'other' },
  { name: 'NEEDS REVISION', color: '#fae8ff', category: 'other' },
  { name: 'READY FOR PICKUP', color: '#dcfce7', category: 'other' },
  { name: 'PAID', color: '#d1fae5', category: 'other' },
  { name: 'UNPAID', color: '#fee2e2', category: 'other' },
]

export const PRIORITY_LABEL: Record<Priority, string> = { urgent: 'Urgent', high: 'High', normal: 'Normal', low: 'Low' }
export const STAGE_LABELS = [...PRIMARY_STAGES, ...EXTRA_STAGES]
export const uid = () => crypto.randomUUID()
