/** Reusable dismissible hint card with optional arrow and action button. */

import { useEffect, useState } from 'react'
import clsx from 'clsx'

const ARROW_CLASSES = {
  top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-white',
  bottom:
    'top-[-6px] left-1/2 -translate-x-1/2 border-l-[6px] border-r-[6px] border-b-[6px] border-l-transparent border-r-transparent border-b-white',
  right:
    'left-[-6px] top-1/2 -translate-y-1/2 border-t-[6px] border-b-[6px] border-r-[6px] border-t-transparent border-b-transparent border-r-white',
}

export default function Tooltip({
  message,
  dismissKey,
  position = 'bottom',
  className = '',
  actionLabel = null,
}) {
  const storageKey = `reachiq_dismissed_${dismissKey}`
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(localStorage.getItem(storageKey) !== 'true')
  }, [storageKey])

  const dismiss = () => {
    localStorage.setItem(storageKey, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className={clsx('relative z-10', className)}>
      <div
        className="animate-fade-scale bg-white rounded-xl shadow-lg border border-gray-100 border-l-[3px] border-l-brand-600 px-4 py-3 max-w-[280px]"
        role="note"
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 text-lg leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
        <p className="text-sm text-gray-600 leading-relaxed pr-5">{message}</p>
        {actionLabel && (
          <button
            type="button"
            onClick={dismiss}
            className="mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors duration-200"
          >
            {actionLabel}
          </button>
        )}
      </div>
      <div
        className={clsx('absolute w-0 h-0 drop-shadow-sm', ARROW_CLASSES[position])}
        aria-hidden="true"
      />
    </div>
  )
}
