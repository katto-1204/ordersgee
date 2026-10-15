import { useShop } from '../stores/shop'
import { STAGE_LABELS, type Priority } from '../types/domain'

export function labelTextColor(color?: string) {
  let hex = color?.replace('#', '') ?? 'e5e7eb'
  if (/^[\da-f]{3}$/i.test(hex)) hex = hex.split('').map(value => value + value).join('')
  if (!/^[\da-f]{6}$/i.test(hex)) hex = 'e5e7eb'
  const channels = [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  const luminance = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]
  const darkContrast = (luminance + .05) / (.0089 + .05)
  const lightContrast = 1.05 / (luminance + .05)
  return darkContrast >= lightContrast ? '#171717' : '#ffffff'
}

export function StageBadge({ stage }: { stage: string }) {
  const label = STAGE_LABELS.find(item => item.key === stage)?.label ?? stage.replaceAll('-', ' ')
  return <span className={`stage-badge stage-${stage}`}><i />{label}</span>
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={`priority-badge priority-${priority}`}>{priority === 'urgent' ? 'Urgent' : priority === 'high' ? 'High' : priority === 'normal' ? 'Normal' : 'Low'}</span>
}

export function LabelPills({ labels, limit = 4 }: { labels: string[]; limit?: number }) {
  const all = useShop(state => state.labels)
  const shown = labels.slice(0, limit)
  return <div className="label-row">{shown.map(name => {
    const item = all.find(label => label.name === name)
    return <span key={name} className="label-chip" style={{ '--label-color': item?.color ?? '#e5e7eb', color: labelTextColor(item?.color) } as React.CSSProperties}>{name}</span>
  })}{labels.length > limit && <span className="label-overflow">+{labels.length - limit}</span>}</div>
}
