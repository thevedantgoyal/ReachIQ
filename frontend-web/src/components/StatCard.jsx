/** Metric card for dashboard stats with loading skeleton and value animation. */

import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'

const COLOR_STYLES = {
  gray: { icon: 'bg-gray-100 text-gray-500' },
  blue: { icon: 'bg-blue-50 text-blue-500' },
  emerald: { icon: 'bg-emerald-50 text-emerald-500' },
  violet: { icon: 'bg-violet-50 text-violet-500' },
  red: { icon: 'bg-red-50 text-red-500' },
  'gray-800': { icon: 'bg-gray-200 text-gray-700' },
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  color = 'gray',
  loading = false,
  highlight = false,
  spinIcon = false,
}) {
  const [bump, setBump] = useState(false)
  const prevValue = useRef(value)

  useEffect(() => {
    if (!loading && prevValue.current !== value) {
      setBump(true)
      const t = setTimeout(() => setBump(false), 300)
      prevValue.current = value
      return () => clearTimeout(t)
    }
    prevValue.current = value
    return undefined
  }, [value, loading])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-6 animate-pulse">
        <div className="flex justify-between mb-4">
          <div className="w-10 h-10 bg-gray-100 rounded-xl" />
        </div>
        <div className="h-9 w-16 bg-gray-100 rounded mb-2" />
        <div className="h-4 w-20 bg-gray-50 rounded" />
      </div>
    )
  }

  const styles = COLOR_STYLES[color] || COLOR_STYLES.gray

  return (
    <div
      className={clsx(
        'bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.06)]',
        'p-6 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200',
        highlight && 'border-l-4 border-l-violet-400',
      )}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={clsx('rounded-xl p-2.5', styles.icon)}>
          <Icon size={20} className={clsx(spinIcon && 'animate-spin')} />
        </div>
      </div>
      <p
        className={clsx(
          'font-serif text-4xl font-bold text-gray-900 transition-transform duration-300',
          bump && 'scale-110',
        )}
      >
        {value ?? 0}
      </p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}
