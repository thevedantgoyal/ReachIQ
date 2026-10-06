/** Date and display helpers for dashboard and contacts pages. */

export function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export function timeAgo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function contactSortTime(contact) {
  return new Date(contact.replied_at || contact.created_at).getTime()
}

export function avatarColor(name) {
  const letter = (name || 'A').trim().charAt(0).toUpperCase()
  if ('ABCDEF'.includes(letter)) return 'bg-brand-600'
  if ('GHIJKL'.includes(letter)) return 'bg-violet-600'
  if ('MNOPQR'.includes(letter)) return 'bg-emerald-500'
  return 'bg-amber-500'
}

export function contactDisplayName(contact) {
  return contact.full_name || contact.email || 'Unknown'
}

export function sentAtDisplay(contact) {
  if (contact.status === 'sent' || contact.status === 'replied') {
    return formatDate(contact.replied_at || contact.created_at)
  }
  return '—'
}
