/** Contacts page with search, filters, pagination, and bulk delete. */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  CloudUpload,
  ArrowRight,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'
import StatusBadge from '../components/StatusBadge.jsx'
import ApiErrorCard from '../components/ApiErrorCard.jsx'
import { deleteContact, getContacts } from '../lib/api.js'
import {
  avatarColor,
  contactDisplayName,
  sentAtDisplay,
} from '../lib/format.js'

const PAGE_SIZE = 20
const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'sent', label: 'Sent' },
  { value: 'replied', label: 'Replied' },
  { value: 'failed', label: 'Failed' },
  { value: 'dead', label: 'Dead' },
]

const STATUS_PILL_COLORS = {
  pending: 'text-gray-600',
  processing: 'text-blue-600',
  sent: 'text-emerald-600',
  replied: 'text-violet-600',
  failed: 'text-red-600',
  dead: 'text-gray-800',
}

const STATUS_DOTS = {
  pending: 'bg-gray-400',
  processing: 'bg-blue-500',
  sent: 'bg-emerald-500',
  replied: 'bg-violet-500',
  failed: 'bg-red-500',
  dead: 'bg-gray-800',
}

function downloadCsv(contacts) {
  const header = 'name,email,company,status,created_at'
  const rows = contacts.map((c) =>
    [
      `"${(c.full_name || '').replace(/"/g, '""')}"`,
      c.email,
      `"${(c.company || '').replace(/"/g, '""')}"`,
      c.status,
      c.created_at,
    ].join(','),
  )
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'reachiq-contacts.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function Contacts() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [page, setPage] = useState(1)
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['contacts'],
    queryFn: getContacts,
    refetchInterval: 20000,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteContact,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['campaignStatus'] })
    },
  })

  const contacts = data?.contacts || []

  const statusCounts = useMemo(() => {
    const counts = { pending: 0, processing: 0, sent: 0, replied: 0, failed: 0, dead: 0 }
    contacts.forEach((c) => {
      const key = (c.status || 'pending').toLowerCase()
      if (key in counts) counts[key] += 1
    })
    return counts
  }, [contacts])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return contacts.filter((c) => {
      const matchStatus =
        statusFilter === 'all' || (c.status || '').toLowerCase() === statusFilter
      if (!matchStatus) return false
      if (!q) return true
      return (
        (c.full_name || '').toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q)
      )
    })
  }, [contacts, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    const pageIds = paginated.map((c) => c.id)
    const allSelected = pageIds.every((id) => selected.has(id))
    setSelected((prev) => {
      const next = new Set(prev)
      pageIds.forEach((id) => {
        if (allSelected) next.delete(id)
        else next.add(id)
      })
      return next
    })
  }

  const handleDelete = async (id) => {
    await deleteMutation.mutateAsync(id)
    setConfirmDeleteId(null)
    setMenuOpenId(null)
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  const handleBulkDelete = async () => {
    for (const id of selected) {
      await deleteMutation.mutateAsync(id)
    }
    setSelected(new Set())
  }

  const copyEmail = (email) => {
    navigator.clipboard.writeText(email)
    setMenuOpenId(null)
  }

  const activeFilterLabel =
    STATUS_FILTERS.find((f) => f.value === statusFilter)?.label || 'All'

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <span className="inline-flex w-fit items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          {contacts.length} contacts
        </span>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={16}
            />
            <input
              type="text"
              className="input pl-9 w-full sm:w-64"
              placeholder="Search name, email, company..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>

          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              className="btn-secondary text-sm py-2 px-4 whitespace-nowrap"
            >
              Filter by status ↓
            </button>
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-brand-50 text-brand-600">
                {activeFilterLabel}
              </span>
            )}
            {filterOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10"
                  aria-label="Close filter menu"
                  onClick={() => setFilterOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl border border-gray-100 shadow-lg py-1 min-w-[160px]">
                  {STATUS_FILTERS.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => {
                        setStatusFilter(f.value)
                        setFilterOpen(false)
                        setPage(1)
                      }}
                      className={clsx(
                        'w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors duration-200',
                        statusFilter === f.value && 'text-brand-600 font-medium',
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => downloadCsv(filtered)}
            className="btn-secondary text-sm py-2 px-4 whitespace-nowrap"
          >
            Download CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs font-medium">
        {['pending', 'processing', 'sent', 'replied', 'failed'].map((key) => (
          <span key={key} className={clsx('inline-flex items-center gap-1.5', STATUS_PILL_COLORS[key])}>
            <span className={clsx('w-1.5 h-1.5 rounded-full', STATUS_DOTS[key])} />
            {statusCounts[key]} {key}
          </span>
        ))}
      </div>

      {isError && (
        <ApiErrorCard
          message="Could not load contacts — is the API running?"
          onRetry={refetch}
        />
      )}

      {selected.size > 0 && (
        <div className="card !py-3 !px-4 flex items-center justify-between animate-fade-up">
          <span className="text-sm font-medium text-gray-700">
            {selected.size} selected
          </span>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={deleteMutation.isPending}
            className="text-sm font-medium text-red-600 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-all duration-200"
          >
            Delete selected
          </button>
        </div>
      )}

      <div className="card !p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-6">
            {statusFilter !== 'all' || search ? (
              <>
                <p className="text-gray-500 text-sm mb-3">
                  No contacts match &apos;{search || activeFilterLabel}&apos;
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('')
                    setStatusFilter('all')
                    setPage(1)
                  }}
                  className="text-brand-600 text-sm hover:underline"
                >
                  Clear filter
                </button>
              </>
            ) : (
              <>
                <CloudUpload className="w-12 h-12 mx-auto mb-4 text-brand-200" />
                <h2 className="font-serif text-xl text-gray-900 mb-2">No contacts yet</h2>
                <p className="text-gray-500 text-sm mb-6">
                  Upload your CSV in the Campaign page to get started
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/campaign')}
                  className="btn-primary inline-flex items-center gap-2"
                >
                  Go to Campaign
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        paginated.length > 0 &&
                        paginated.every((c) => selected.has(c.id))
                      }
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="text-left px-4 py-3 font-medium">Contact</th>
                  <th className="text-left px-4 py-3 font-medium">Company</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Sent At</th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody>
                {paginated.map((c) => {
                  const name = contactDisplayName(c)
                  const initial = name.charAt(0).toUpperCase()
                  const isSelected = selected.has(c.id)

                  return (
                    <tr
                      key={c.id}
                      className={clsx(
                        'border-b border-gray-50 hover:bg-gray-50 transition-colors duration-200 group',
                        isSelected && 'bg-brand-50',
                      )}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(c.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={clsx(
                              'w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0',
                              avatarColor(name),
                            )}
                          >
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 truncate">{name}</p>
                            <p className="text-xs text-gray-400 truncate">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{c.company || '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {sentAtDisplay(c)}
                      </td>
                      <td className="px-4 py-3 relative">
                        <button
                          type="button"
                          onClick={() =>
                            setMenuOpenId(menuOpenId === c.id ? null : c.id)
                          }
                          className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all duration-200 text-gray-400"
                          aria-label="Actions"
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {menuOpenId === c.id && (
                          <>
                            <button
                              type="button"
                              className="fixed inset-0 z-10"
                              aria-label="Close menu"
                              onClick={() => {
                                setMenuOpenId(null)
                                setConfirmDeleteId(null)
                              }}
                            />
                            <div className="absolute right-4 top-full mt-1 z-20 bg-white rounded-xl border border-gray-100 shadow-lg py-1 min-w-[140px]">
                              <button
                                type="button"
                                onClick={() => copyEmail(c.email)}
                                className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                              >
                                Copy email
                              </button>
                              {confirmDeleteId === c.id ? (
                                <div className="px-4 py-2 border-t border-gray-50">
                                  <p className="text-xs text-gray-500 mb-2">Delete?</p>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(c.id)}
                                      className="text-xs text-red-600 font-medium"
                                    >
                                      Yes
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="text-xs text-gray-500"
                                    >
                                      No
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(c.id)}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                  Delete contact
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-50">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50 inline-flex items-center gap-1"
            >
              <ChevronLeft size={16} />
              Prev
            </button>
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="btn-secondary text-sm py-1.5 px-3 disabled:opacity-50 inline-flex items-center gap-1"
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
