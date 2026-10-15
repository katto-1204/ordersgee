export function philippinesDateLabel(date = new Date()) {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date)
}

export function philippinesTimeLabel(date = new Date()) {
  return new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true }).format(date)
}

export function localDayRange(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function isDueToday(value: string | null, now = new Date()) {
  if (!value) return false
  return localDayRange(new Date(value)) === localDayRange(now)
}
