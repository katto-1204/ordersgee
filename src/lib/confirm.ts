export type ConfirmationOptions = {
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  tone?: 'primary' | 'danger'
}

export type ActiveConfirmation = ConfirmationOptions & { id: number }
type PendingConfirmation = ActiveConfirmation & { resolve: (confirmed: boolean) => void }
type Listener = (request: ActiveConfirmation | null) => void

const queue: PendingConfirmation[] = []
const listeners = new Set<Listener>()
let nextId = 1

function publish() {
  const active = queue[0] ?? null
  for (const listener of listeners) listener(active)
}

export function subscribeToConfirmations(listener: Listener) {
  listeners.add(listener)
  listener(queue[0] ?? null)
  return () => listeners.delete(listener)
}

/** Ask for a clear in-app decision. If the dialog host is unavailable, fail closed. */
export function confirmInApp(options: ConfirmationOptions): Promise<boolean> {
  if (listeners.size === 0) return Promise.resolve(false)
  return new Promise(resolve => {
    queue.push({ ...options, id: nextId++, resolve })
    publish()
  })
}

export function answerConfirmation(id: number, confirmed: boolean) {
  const active = queue[0]
  if (!active || active.id !== id) return
  queue.shift()
  active.resolve(confirmed)
  publish()
}
