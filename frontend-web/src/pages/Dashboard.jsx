/** Dashboard with live campaign stats, progress, activity feed, and contacts preview. */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  Loader2,
  Send,
  MessageSquare,
  XCircle,
  Skull,
  Upload,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import StatCard from '../components/StatCard.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import ApiErrorCard from '../components/ApiErrorCard.jsx'
import { getStatus, getContacts, getReplies } from '../lib/api.js'
import {
  contactDisplayName,
  contactSortTime,
  sentAtDisplay,
  timeAgo,
} from '../lib/format.js'

const WELCOME_DISMISS_KEY = 'reachiq_welcome_dismissed'

export default function Dashboard() {
  const navigate = useNavigate()
  const [welcomeDismissed, setWelcomeDismissed] = useState(
    () => localStorage.getItem(WELCOME_DISMISS_KEY) === 'true',
  )

  const {
    data: status,
    isLoading: statusLoading,
    isError: statusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['campaignStatus'],
    queryFn: getStatus,
    refetchInterval: 8000,
  })

  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: getContacts,
    refetchInterval: 15000,
  })

  useQuery({
    queryKey: ['replies'],
    queryFn: getReplies,
    refetchInterval: 30000,
  })

  const contacts = contactsData?.contacts || []
  const total = contacts.length
  const sent = status?.sent ?? 0
  const pending = status?.pending ?? 0

  const showWelcome =
    !welcomeDismissed && !statusLoading && sent === 0 && pending === 0

  const dismissWelcome = () => {
    localStorage.setItem(WELCOME_DISMISS_KEY, 'true')
    setWelcomeDismissed(true)
  }

  const recentActivity = [...contacts]
    .sort((a, b) => contactSortTime(b) - contactSortTime(a))
    .slice(0, 5)

  const previewContacts = contacts.slice(0, 8)
  const progressPct = total > 0 ? Math.min(100, (sent / total) * 100) : 0

  const statCards = [
    { label: 'Pending', value: status?.pending, icon: Clock, color: 'gray' },
    {
      label: 'Processing',
      value: status?.processing,
      icon: Loader2,
      color: 'blue',
      spinIcon: (status?.processing ?? 0) > 0,
    },
    { label: 'Sent', value: status?.sent, icon: Send, color: 'emerald' },
    {
      label: 'Replied',
      value: status?.replied,
      icon: MessageSquare,
      color: 'violet',
      highlight: (status?.replied ?? 0) > 0,
    },
    { label: 'Failed', value: status?.failed, icon: XCircle, color: 'red' },
    { label: 'Dead', value: status?.dead, icon: Skull, color: 'gray-800' },
  ]

  return (
    <div className="space-y-6">
      {showWelcome && (
        <div className="relative rounded-2xl bg-gradient-to-r from-brand-600 to-violet-600 px-8 py-6 text-white overflow-hidden">
          <button
            type="button"
            onClick={dismissWelcome}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors duration-200"
            aria-label="Dismiss welcome banner"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-xs tracking-widest uppercase text-white/60 mb-2">
                Get Started
              </p>
              <h2 className="font-serif text-2xl mb-2">
                Ready to reach your first recruiter?
              </h2>
              <p className="text-sm text-white/80 max-w-lg">
                Upload your contacts and resume in Campaign, then hit Launch to start
                sending personalised emails.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/campaign')}
              className="shrink-0 bg-white text-brand-600 font-medium px-6 py-2.5 rounded-xl hover:bg-white/90 transition-all duration-200 active:scale-95"
            >
              Go to Campaign →
            </button>
          </div>
        </div>
      )}

      {statusError && (
        <ApiErrorCard
          message="Could not load stats — is the API running?"
          onRetry={refetchStatus}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <StatCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            color={card.color}
            loading={statusLoading}
            highlight={card.highlight}
            spinIcon={card.spinIcon}
          />
        ))}
      </div>

      {total > 0 && (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-gray-700">Campaign Progress</span>
            <span className="text-sm text-gray-500">
              {sent} of {total} sent
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-600 to-violet-500 rounded-full transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {status?.pending ?? 0} pending
            </span>
            <span
              className={clsx(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600',
                (status?.processing ?? 0) > 0 && 'animate-pulse',
              )}
            >
              {status?.processing ?? 0} sending
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700">
              {status?.replied ?? 0} replied
            </span>
            {(status?.failed ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">
                {status.failed} failed
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0 card !p-0 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-50">
            <span className="text-sm font-semibold text-gray-700">Contacts</span>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {total} total
              </span>
              <Link
                to="/contacts"
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                View all →
              </Link>
            </div>
          </div>

          {contactsLoading ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 bg-gray-100 rounded" />
              ))}
            </div>
          ) : previewContacts.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Upload className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p className="font-serif text-xl text-gray-600 mb-1">No contacts yet</p>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">
                Upload a CSV on the Campaign page to get started
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-6 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Company</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-6 py-3 font-medium">Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {previewContacts.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors duration-200"
                    >
                      <td className="px-6 py-3 font-medium text-gray-900">
                        {contactDisplayName(c)}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{c.company || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-6 py-3 text-gray-400 text-xs">
                        {sentAtDisplay(c)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > 8 && (
            <div className="px-6 py-3 border-t border-gray-50 text-center">
              <Link
                to="/contacts"
                className="text-sm text-brand-600 hover:text-brand-700 font-medium"
              >
                View all contacts →
              </Link>
            </div>
          )}
        </div>

        <div className="w-full lg:w-80 shrink-0 card">
          <p className="text-sm font-semibold text-gray-700 mb-4">Recent Activity</p>
          {contactsLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-100 rounded" />
              ))}
            </div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p className="font-serif text-xl text-gray-600 mb-1">No activity yet</p>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">
                Launch a campaign to see updates here
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {recentActivity.map((c) => (
                <div
                  key={c.id}
                  className="py-3 border-b border-gray-50 last:border-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span
                        className={clsx(
                          'w-2 h-2 rounded-full mt-1.5 shrink-0',
                          c.status === 'replied' && 'bg-violet-500',
                          c.status === 'sent' && 'bg-emerald-500',
                          c.status === 'pending' && 'bg-gray-400',
                          !['replied', 'sent', 'pending'].includes(c.status) &&
                            'bg-blue-500',
                        )}
                      />
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {contactDisplayName(c)}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusBadge status={c.status} />
                      <p className="text-xs text-gray-400 mt-1">
                        {timeAgo(c.replied_at || c.created_at)}
                      </p>
                    </div>
                  </div>
                  {c.company && (
                    <p className="text-xs text-gray-400 mt-1 pl-4">{c.company}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
