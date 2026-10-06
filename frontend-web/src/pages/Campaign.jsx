/** Campaign control page — upload contacts, resume path, launch, and live activity. */

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  CloudUpload,
  FileText,
  Clock,
  Loader2,
  Check,
  X,
  File,
  Rocket,
} from 'lucide-react'
import StatusBadge from '../components/StatusBadge.jsx'
import { useToast } from '../context/ToastContext.jsx'
import {
  getContacts,
  getGmailStatus,
  getStatus,
  pauseCampaign,
  resumeCampaign,
  startCampaign,
  uploadContacts,
} from '../lib/api.js'
import {
  contactDisplayName,
  contactSortTime,
  timeAgo,
} from '../lib/format.js'

import { loadSettings, RESUME_PATH_KEY } from '../lib/settings.js'
const BATCH_OPTIONS = [
  { value: 10, label: 'Conservative' },
  { value: 30, label: 'Balanced' },
  { value: 50, label: 'Aggressive' },
]

const STATUS_DOT = {
  pending: 'bg-gray-400',
  processing: 'bg-blue-500 animate-pulse',
  sent: 'bg-emerald-500',
  replied: 'bg-violet-500',
  failed: 'bg-red-500',
  dead: 'bg-gray-800',
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function resumeFileName(path) {
  if (!path) return 'resume.pdf'
  const parts = path.split('/')
  return parts[parts.length - 1] || 'resume.pdf'
}

function downloadSampleCsv() {
  const content = [
    'name,email,company',
    'Priya Sharma,priya@techcorp.com,TechCorp',
    'Rahul Mehta,rahul@startup.io,StartupIO',
  ].join('\n')
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'reachiq-sample.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function CampaignStatusPill({ status }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-gray-50 text-gray-500 border border-gray-100">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        Idle
      </span>
    )
  }

  if (status.processing > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        Sending emails...
      </span>
    )
  }

  if (status.pending > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        {status.pending} queued
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-gray-50 text-gray-500 border border-gray-100">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Idle
    </span>
  )
}

export default function Campaign() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const csvInputRef = useRef(null)

  const [resumePath, setResumePath] = useState(
    () => localStorage.getItem(RESUME_PATH_KEY) || '',
  )
  const [batchSize, setBatchSize] = useState(() => loadSettings().defaultBatch)
  const [paused, setPaused] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [launchError, setLaunchError] = useState('')
  const [launching, setLaunching] = useState(false)
  const [showLaunchTooltip, setShowLaunchTooltip] = useState(false)

  const [selectedCsv, setSelectedCsv] = useState(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvError, setCsvError] = useState('')
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadPreview, setUploadPreview] = useState([])
  const [dragOver, setDragOver] = useState(false)

  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ['campaignStatus'],
    queryFn: getStatus,
    refetchInterval: 8000,
  })

  const processing = status?.processing ?? 0

  const { data: contactsData } = useQuery({
    queryKey: ['contacts'],
    queryFn: getContacts,
    refetchInterval: processing > 0 ? 5000 : 15000,
  })

  const { data: gmail } = useQuery({
    queryKey: ['gmailStatus'],
    queryFn: getGmailStatus,
  })

  const pauseMutation = useMutation({
    mutationFn: pauseCampaign,
    onSuccess: () => {
      setPaused(true)
      showToast('Campaign paused', 'info')
    },
  })

  const resumeMutation = useMutation({
    mutationFn: resumeCampaign,
    onSuccess: () => {
      setPaused(false)
      showToast('Campaign resumed', 'success')
    },
  })

  const contacts = contactsData?.contacts || []
  const contactCount = contacts.length
  const pending = status?.pending ?? 0
  const sent = status?.sent ?? 0
  const sentToday = status?.sent_today ?? 0

  const resumeValid = resumePath.trim().toLowerCase().endsWith('.pdf')
  const launchDisabled = (pending === 0 && sent === 0) || !resumeValid

  const handleResumeChange = (value) => {
    setResumePath(value)
    localStorage.setItem(RESUME_PATH_KEY, value)
  }

  const processCsvFile = async (file) => {
    if (!file?.name?.toLowerCase().endsWith('.csv')) return
    setSelectedCsv(file)
    setCsvError('')
    setUploadResult(null)
    setUploadPreview([])
  }

  const handleCsvUpload = async () => {
    if (!selectedCsv) return
    setCsvUploading(true)
    setCsvError('')

    const formData = new FormData()
    formData.append('file', selectedCsv)

    try {
      const result = await uploadContacts(formData)
      setUploadResult(result)
      setSelectedCsv(null)
      const fresh = await getContacts()
      setUploadPreview((fresh.contacts || []).slice(0, 3))
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['campaignStatus'] })
    } catch (err) {
      setCsvError(
        err.response?.data?.detail ||
          'Upload failed — make sure CSV has name, email, company columns',
      )
    } finally {
      setCsvUploading(false)
    }
  }

  const resetUpload = () => {
    setUploadResult(null)
    setUploadPreview([])
    setSelectedCsv(null)
    setCsvError('')
  }

  const handleLaunch = async () => {
    setLaunching(true)
    setLaunchError('')
    try {
      const result = await startCampaign({
        resume_path: resumePath.trim(),
        batch_size: batchSize,
      })
      setModalOpen(false)
      showToast(`🚀 Campaign launched! ${result.queued} emails queued.`, 'success')
      queryClient.invalidateQueries({ queryKey: ['campaignStatus'] })
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      refetchStatus()
    } catch (err) {
      setLaunchError(
        err.response?.data?.detail || 'Failed to launch campaign. Check resume path.',
      )
    } finally {
      setLaunching(false)
    }
  }

  const activityContacts = [...contacts]
    .sort((a, b) => contactSortTime(b) - contactSortTime(a))
    .slice(0, 10)

  const estimateMinutes = Math.max(1, Math.ceil((pending * 60) / 60))
  const dailyPct = Math.min(100, (sentToday / 60) * 100)
  const dailyBarColor =
    sentToday > 55 ? 'bg-red-500' : sentToday >= 40 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <p className="text-xs text-gray-400 mb-1">ReachIQ / Campaign</p>
          <h1 className="font-serif text-2xl text-gray-900">Launch Campaign</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-lg">
            Upload contacts, attach your resume, and send personalised emails to every
            recruiter.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <CampaignStatusPill status={status} />
          {processing > 0 && !paused && (
            <button
              type="button"
              onClick={() => pauseMutation.mutate()}
              disabled={pauseMutation.isPending}
              className="btn-secondary text-sm py-2 px-4 text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              ⏸ Pause
            </button>
          )}
          {paused && (
            <button
              type="button"
              onClick={() => resumeMutation.mutate()}
              disabled={resumeMutation.isPending}
              className="btn-secondary text-sm py-2 px-4 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
            >
              ▶ Resume
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 space-y-6 min-w-0">
          {/* Card 1 — Upload Contacts */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-brand-600 text-white text-sm font-semibold flex items-center justify-center">
                  1
                </span>
                <span className="text-sm font-semibold text-gray-800">Import Contacts</span>
              </div>
              {contactCount > 0 ? (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                  ✓ {contactCount} contacts loaded
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                  No contacts
                </span>
              )}
            </div>

            {uploadResult ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                    <Check className="text-white" size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-800">
                      {uploadResult.uploaded} contacts imported
                    </p>
                    {uploadResult.skipped > 0 && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        {uploadResult.skipped} duplicates skipped
                      </p>
                    )}
                  </div>
                </div>

                {uploadPreview.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 uppercase">
                          <th className="text-left py-2 font-medium">Name</th>
                          <th className="text-left py-2 font-medium">Email</th>
                          <th className="text-left py-2 font-medium">Company</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadPreview.map((c) => (
                          <tr key={c.id} className="border-t border-gray-50">
                            <td className="py-2 text-gray-800">{c.full_name || '—'}</td>
                            <td className="py-2 text-gray-500">{c.email}</td>
                            <td className="py-2 text-gray-500">{c.company || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <button
                  type="button"
                  onClick={resetUpload}
                  className="text-sm text-brand-600 hover:underline"
                >
                  Upload different file
                </button>
              </div>
            ) : (
              <>
                {selectedCsv ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                      <File className="text-gray-400 shrink-0" size={20} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {selectedCsv.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatFileSize(selectedCsv.size)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCsv(null)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                        aria-label="Remove file"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={handleCsvUpload}
                      disabled={csvUploading}
                      className="btn-primary w-full inline-flex items-center justify-center gap-2"
                    >
                      {csvUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                      Upload Contacts →
                    </button>
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && csvInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOver(true)
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setDragOver(false)
                      const file = e.dataTransfer.files?.[0]
                      if (file) processCsvFile(file)
                    }}
                    onClick={() => csvInputRef.current?.click()}
                    className={clsx(
                      'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
                      dragOver
                        ? 'border-brand-400 bg-brand-50 scale-[1.01]'
                        : 'border-gray-200 bg-gray-50 hover:bg-brand-50 hover:border-brand-300',
                    )}
                  >
                    <CloudUpload
                      className={clsx(
                        'mx-auto mb-3 transition-colors duration-200',
                        dragOver ? 'text-brand-400' : 'text-gray-300 group-hover:text-brand-400',
                      )}
                      size={36}
                    />
                    <p className="text-sm text-gray-500">Drop your CSV here</p>
                    <p className="text-xs text-brand-600 underline mt-1">or click to browse</p>
                    <input
                      ref={csvInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) processCsvFile(file)
                      }}
                    />
                  </div>
                )}

                {csvError && (
                  <div className="mt-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3">
                    Upload failed — make sure CSV has name, email, company columns
                  </div>
                )}
              </>
            )}

            <button
              type="button"
              onClick={downloadSampleCsv}
              className="text-xs text-brand-600 hover:underline mt-4"
            >
              Need a template?
            </button>
          </div>

          {/* Card 2 — Resume */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-brand-600 text-white text-sm font-semibold flex items-center justify-center">
                2
              </span>
              <span className="text-sm font-semibold text-gray-800">Attach Resume</span>
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Full path to your resume PDF
            </label>
            <input
              type="text"
              className="input"
              placeholder="/Users/yourname/Documents/resume.pdf"
              value={resumePath}
              onChange={(e) => handleResumeChange(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">
              Right-click PDF → Get Info → copy the Where field
            </p>

            {resumePath.trim() && resumeValid && (
              <p className="text-xs text-emerald-600 mt-2">✓ Valid PDF path</p>
            )}
            {resumePath.trim() && !resumeValid && (
              <p className="text-xs text-red-500 mt-2">Must be a .pdf file</p>
            )}

            {resumeValid && (
              <div className="flex items-center gap-3 mt-4 p-3 bg-gray-50 rounded-xl">
                <FileText className="text-emerald-500 shrink-0" size={20} />
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {resumeFileName(resumePath)}
                  </p>
                  <p className="text-xs text-gray-400">Will be attached to every email</p>
                </div>
              </div>
            )}
          </div>

          {/* Card 3 — Launch Settings */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-brand-600 text-white text-sm font-semibold flex items-center justify-center">
                3
              </span>
              <span className="text-sm font-semibold text-gray-800">Configure & Launch</span>
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emails per day
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Gmail allows max 500/day. We recommend 50 max.
            </p>

            <div className="grid grid-cols-3 gap-3">
              {BATCH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setBatchSize(opt.value)}
                  className={clsx(
                    'border rounded-xl p-3 text-center cursor-pointer transition-all duration-200',
                    batchSize === opt.value
                      ? 'border-brand-500 bg-brand-50 text-brand-600'
                      : 'border-gray-200 hover:border-gray-300',
                  )}
                >
                  <p className="text-2xl font-bold font-serif">{opt.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{opt.label}</p>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-500 bg-amber-50 rounded-lg p-2 mt-3">
              <Clock size={14} className="shrink-0 text-amber-600" />
              30–90 second delay between each email
            </div>

            <hr className="my-5 border-gray-100" />

            <div
              className="relative"
              onMouseEnter={() => launchDisabled && setShowLaunchTooltip(true)}
              onMouseLeave={() => setShowLaunchTooltip(false)}
            >
              <button
                type="button"
                disabled={launchDisabled}
                onClick={() => {
                  setLaunchError('')
                  setModalOpen(true)
                }}
                className={clsx(
                  'w-full py-3 px-6 rounded-xl font-semibold text-base transition-all duration-200',
                  launchDisabled
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-brand-600 to-violet-600 text-white hover:opacity-90 shadow-lg shadow-brand-200 active:scale-95',
                )}
              >
                🚀 Launch Campaign
              </button>

              {showLaunchTooltip && launchDisabled && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-10">
                  Upload contacts and set resume path first
                </div>
              )}
            </div>

            {sent > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-100 text-amber-800 text-xs leading-relaxed">
                ⚠️ {sent} emails already sent in this campaign. Launching again will only send
                to remaining pending contacts.
              </div>
            )}
          </div>
        </div>

        {/* Right column — Live Activity */}
        <div className="w-full xl:w-96 shrink-0">
          <div className="card h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-800">Live Activity</span>
                {processing > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </div>
              <span className="text-xs text-gray-400">Auto-refreshing</span>
            </div>

            <div className="flex-1 space-y-0 overflow-y-auto min-h-[200px]">
              {processing === 0 && contacts.length === 0 ? (
                <div className="text-center py-10">
                  <Rocket className="mx-auto mb-3 text-gray-200" size={32} />
                  <p className="text-sm text-gray-400">No activity yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Launch a campaign to see live updates here
                  </p>
                </div>
              ) : activityContacts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No activity yet</p>
              ) : (
                activityContacts.map((c, i) => {
                  const name = contactDisplayName(c)
                  const statusKey = (c.status || 'pending').toLowerCase()
                  return (
                    <div
                      key={c.id}
                      className={clsx(
                        'flex items-start gap-3 py-3',
                        i < activityContacts.length - 1 && 'border-b border-gray-50',
                      )}
                    >
                      <span
                        className={clsx(
                          'w-2 h-2 rounded-full mt-1.5 shrink-0',
                          STATUS_DOT[statusKey] || STATUS_DOT.pending,
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{name}</p>
                        <p className="text-xs text-gray-400 truncate">{c.company || '—'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <StatusBadge status={c.status} />
                        <p className="text-xs text-gray-400 mt-1">
                          {timeAgo(c.replied_at || c.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Daily limit</span>
                <span className="text-xs text-gray-500">
                  {sentToday} / 60 emails today
                </span>
              </div>
              <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={clsx('h-full rounded-full transition-all duration-700', dailyBarColor)}
                  style={{ width: `${dailyPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-label="Close modal"
            onClick={() => !launching && setModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl p-8 max-w-md w-full mt-16 lg:mt-32 shadow-2xl animate-fade-up">
            <h2 className="font-serif text-xl text-gray-900">Ready to launch?</h2>

            <div className="bg-gray-50 rounded-xl p-4 my-4 space-y-2 text-sm text-gray-700">
              <p>📋 {pending} contacts will receive emails</p>
              <p>📎 Resume: {resumeFileName(resumePath)}</p>
              <p>📬 Max {batchSize} emails today</p>
              <p>⏱ ~{estimateMinutes} minutes to complete</p>
            </div>

            <p className="text-xs text-gray-500">
              Emails will be sent from {gmail?.email || 'your connected Gmail account'}
            </p>

            {launchError && (
              <div className="mt-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm px-4 py-3">
                {launchError}
              </div>
            )}

            <div className="flex gap-3 mt-6">
              <button
                type="button"
                disabled={launching}
                onClick={() => setModalOpen(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={launching}
                onClick={handleLaunch}
                className="btn-primary flex-1 inline-flex items-center justify-center gap-2"
              >
                {launching && <Loader2 className="w-4 h-4 animate-spin" />}
                Launch 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
