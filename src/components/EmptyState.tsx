import type { ReactNode } from 'react'
export default function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className="empty-state">{icon && <span className="empty-icon">{icon}</span>}<h2>{title}</h2>{children && <p>{children}</p>}{action && <div>{action}</div>}</div>
}
