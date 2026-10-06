/** Status pill badge for contact and email job states. */

import clsx from 'clsx'

const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    dot: 'bg-gray-400',
    pulse: false,
  },
  processing: {
    label: 'Sending...',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    dot: 'bg-blue-500',
    pulse: true,
  },
  sent: {
    label: 'Sent',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    pulse: false,
  },
  replied: {
    label: 'Replied',
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    dot: 'bg-violet-500',
    pulse: false,
  },
  failed: {
    label: 'Failed',
    bg: 'bg-red-50',
    text: 'text-red-600',
    dot: 'bg-red-500',
    pulse: false,
  },
  dead: {
    label: 'Dead',
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    dot: 'bg-gray-800',
    pulse: false,
  },
}

export default function StatusBadge({ status }) {
  const key = (status || 'pending').toLowerCase()
  const config = STATUS_CONFIG[key] || STATUS_CONFIG.pending

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        config.bg,
        config.text,
      )}
    >
      <span
        className={clsx(
          'w-1.5 h-1.5 rounded-full shrink-0',
          config.dot,
          config.pulse && 'animate-pulse',
        )}
      />
      {config.label}
    </span>
  )
}
