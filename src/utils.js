export const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_process', label: 'In Process' },
  { value: 'ready', label: 'Ready' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const DELIVERY_STATUSES = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const ROLES = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'florist', label: 'Florist' },
  { value: 'delivery', label: 'Delivery' },
]

export function money(value, symbol = '$') {
  const amount = Number(value || 0)
  const prefix = symbol === 'Rs' ? 'Rs ' : symbol
  return `${prefix}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function rangePreset(preset) {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  const start = new Date(now)
  if (preset === 'today') {
    return { from: to, to, label: 'Today', preset }
  }
  if (preset === 'week') {
    const day = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - day)
    return { from: start.toISOString().slice(0, 10), to, label: 'This Week', preset }
  }
  if (preset === 'year') {
    return { from: `${now.getFullYear()}-01-01`, to, label: 'This Year', preset }
  }
  start.setDate(1)
  return { from: start.toISOString().slice(0, 10), to, label: 'This Month', preset: 'month' }
}

export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'B'
}

export function classNames(...parts) {
  return parts.filter(Boolean).join(' ')
}
