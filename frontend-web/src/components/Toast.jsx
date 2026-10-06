/** Toast notification stack — slides in from top-right, auto-dismisses. */

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import clsx from 'clsx'

const TYPE_STYLES = {
  success: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    icon: CheckCircle,
    iconColor: 'text-emerald-500',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: XCircle,
    iconColor: 'text-red-500',
  },
  info: {
    bg: 'bg-brand-50',
    border: 'border-brand-200',
    icon: Info,
    iconColor: 'text-brand-500',
  },
}

function ToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false)
  const style = TYPE_STYLES[toast.type] || TYPE_STYLES.info
  const Icon = style.icon

  useEffect(() => {
    const enterTimer = requestAnimationFrame(() => setVisible(true))
    const dismissTimer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(toast.id), 200)
    }, 4000)
    return () => {
      cancelAnimationFrame(enterTimer)
      clearTimeout(dismissTimer)
    }
  }, [toast.id, onDismiss])

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-3 min-w-72 max-w-80 rounded-xl shadow-lg border transition-transform duration-200',
        style.bg,
        style.border,
        visible ? 'translate-x-0' : 'translate-x-full',
      )}
    >
      <Icon className={clsx('shrink-0', style.iconColor)} size={20} />
      <p className="text-sm text-gray-800 flex-1">{toast.message}</p>
      <button
        type="button"
        onClick={() => {
          setVisible(false)
          setTimeout(() => onDismiss(toast.id), 200)
        }}
        className="text-gray-400 hover:text-gray-600 shrink-0"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  )
}

export default function ToastStack({ toasts, onDismiss }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
