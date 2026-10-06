/** Replies inbox — cards for recruiter responses with reply rate stats. */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MessageSquare, Quote, RefreshCw, X } from 'lucide-react'
import clsx from 'clsx'
import StatusBadge from '../components/StatusBadge.jsx'
import ApiErrorCard from '../components/ApiErrorCard.jsx'
import { getReplies, getStatus } from '../lib/api.js'
import {
  avatarColor,
  contactDisplayName,
  formatDate,
  timeAgo,
} from '../lib/format.js'

const LAST_SEEN_KEY = 'reachiq_last_seen_replies_count'

function replyRateLabel(rate) {
  if (rate < 5) return { text: 'Warming up', color: 'text-gray-500' }
  if (rate <= 15) return { text: 'Getting traction', color: 'text-amber-600' }
  return { text: 'Excellent!', color: 'text-emerald-600' }
}

export default function Replies() {
  const [lastSeen, setLastSeen] = useState(() => {
    const saved = localStorage.getItem(LAST_SEEN_KEY)
    return saved ? parseInt(saved, 10) : 0
  })
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const { data: repliesData, isLoading, isError, refetch } = useQuery({
    queryKey: ['replies'],
    queryFn: getReplies,
    refetchInterval: 15000,
  })

  const { data: status } = useQuery({
    queryKey: ['campaignStatus'],
    queryFn: getStatus,
    refetchInterval: 15000,
  })

  const replies = repliesData?.replies || []
  const replyCount = replies.length
  const sent = status?.sent ?? 0
  const replied = status?.replied ?? replyCount
  const replyRate = sent > 0 ? ((replied / sent) * 100).toFixed(1) : '0.0'
  const rateInfo = replyRateLabel(parseFloat(replyRate))

  const newReplyCount = Math.max(0, replyCount - lastSeen)
  const showBanner = newReplyCount > 0 && !bannerDismissed

  const markAllSeen = () => {
    localStorage.setItem(LAST_SEEN_KEY, String(replyCount))
    setLastSeen(replyCount)
    setBannerDismissed(true)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card h-48 animate-pulse bg-gray-50" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <ApiErrorCard
        message="Could not load replies — is the API running?"
        onRetry={refetch}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-serif text-2xl text-gray-900">Replies</h1>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {replyCount} responses
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <RefreshCw size={14} className="animate-spin" style={{ animationDuration: '3s' }} />
          Auto-checking every 15s
        </div>
      </div>

      {showBanner && (
        <div className="relative bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-emerald-800 font-semibold text-sm">
            🎉 You have {newReplyCount} new {newReplyCount === 1 ? 'reply' : 'replies'}!
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={markAllSeen}
              className="btn-secondary text-sm py-1.5 px-4 text-emerald-700 border-emerald-200"
            >
              Mark all seen
            </button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="text-emerald-600 hover:text-emerald-800 p-1"
              aria-label="Dismiss banner"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {replyCount === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div className="relative mb-6">
            <div className="w-32 h-32 rounded-full bg-violet-50 flex items-center justify-center">
              <MessageSquare size={64} className="text-violet-200" />
            </div>
            <span className="absolute inset-0 rounded-full bg-violet-200 animate-ping opacity-20" />
          </div>

          <h2 className="font-serif text-2xl text-gray-700">Waiting for replies...</h2>
          <p className="text-gray-400 text-sm max-w-xs mt-2 leading-relaxed">
            When recruiters respond to your emails, their replies will appear here.
            You&apos;ll also get a WhatsApp notification instantly.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
              {sent} emails sent
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
              Checking every 15s
            </span>
          </div>

          <div className="mt-6 max-w-sm bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
            💡 Pro tip: Replies usually come within 24–48 hours. Keep your campaign
            running for best results.
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {replies.map((reply) => {
              const name = contactDisplayName(reply)
              const initial = name.charAt(0).toUpperCase()

              return (
                <div
                  key={reply.id}
                  className="card border-l-4 border-violet-400 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={clsx(
                          'w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0',
                          avatarColor(name),
                        )}
                      >
                        {initial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                        <p className="text-xs text-gray-400 truncate">{reply.company || '—'}</p>
                      </div>
                    </div>
                    <time
                      className="text-xs text-gray-400 shrink-0"
                      title={formatDate(reply.replied_at)}
                    >
                      {timeAgo(reply.replied_at)}
                    </time>
                  </div>

                  <hr className="border-gray-50 my-4" />

                  <div className="relative">
                    <Quote
                      className="absolute -top-1 left-0 text-gray-300"
                      size={14}
                    />
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-3 italic pl-5">
                      {reply.reply_preview || 'No preview available'}
                    </p>
                    <a
                      href="https://mail.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand-600 underline mt-2 inline-block"
                    >
                      Read full reply in Gmail →
                    </a>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-2">
                    <StatusBadge status="replied" />
                    <span className="text-xs text-gray-400 truncate max-w-[140px]">
                      📧 {reply.email}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4 text-sm">
            <span className="text-gray-600">{sent} sent</span>
            <span className="text-gray-300">·</span>
            <span className="text-violet-600">{replied} replied</span>
            <span className="text-gray-300">·</span>
            <span className={clsx('font-medium', rateInfo.color)}>
              {replyRate}% reply rate — {rateInfo.text}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
