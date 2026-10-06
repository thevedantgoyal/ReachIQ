/** Settings page — Gmail, WhatsApp, campaign defaults, and system info. */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  Mail,
  MessageSquare,
  Sliders,
  Info,
  Phone,
  Check,
  X,
} from 'lucide-react'
import { useToast } from '../context/ToastContext.jsx'
import { getGmailStatus } from '../lib/api.js'
import { loadSettings, saveSettings } from '../lib/settings.js'

const BATCH_OPTIONS = [
  { value: 10, label: 'Conservative' },
  { value: 30, label: 'Balanced' },
  { value: 50, label: 'Aggressive' },
]

const WHATSAPP_MASKED = '+91 ••••••3142'

const NOTIFICATION_TYPES = [
  'When a recruiter replies to your email',
  'When a campaign finishes sending',
  'When an email job permanently fails',
  'Daily morning summary (sent/replied/pending)',
]

const SYSTEM_INFO = [
  { label: 'Version', value: 'ReachIQ v1.0' },
  { label: 'Backend', value: 'FastAPI + PostgreSQL' },
  { label: 'AI Model', value: 'Gemini 2.0 Flash' },
  { label: 'Email', value: 'Gmail API' },
  { label: 'Queue', value: 'Celery + Redis' },
  { label: 'Notifications', value: 'Twilio WhatsApp' },
]

const WHATSAPP_TEST_CODE = `python3 -c "from backend.services.twilio_service import notify_reply; notify_reply('Test', 'Co', 'Hi!')"`

function CardHeader({ icon: Icon, title, pill }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <Icon className="text-brand-600 shrink-0" size={18} />
        <span className="text-sm font-semibold text-gray-800">{title}</span>
      </div>
      {pill}
    </div>
  )
}

function StatusPill({ connected }) {
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Connected
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
      Disconnected
    </span>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [prefs, setPrefs] = useState(() => loadSettings())
  const [testingGmail, setTestingGmail] = useState(false)
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false)

  const { data: gmail, isLoading: gmailLoading, refetch: refetchGmail } = useQuery({
    queryKey: ['gmailStatus'],
    queryFn: getGmailStatus,
    refetchInterval: 30_000,
  })

  const connected = !!gmail?.connected
  const email = gmail?.email || 'thevedantgoyal@gmail.com'
  const gmailInitial = (email.charAt(0) || 'G').toUpperCase()

  const openGmailAuth = () => {
    window.open('/api/v1/auth/gmail', '_blank', 'noopener,noreferrer')
  }

  const testGmailConnection = async () => {
    setTestingGmail(true)
    try {
      const { data } = await refetchGmail()
      if (data?.connected) {
        showToast('✅ Gmail is working perfectly', 'success')
      } else {
        showToast('❌ Gmail connection failed — please reconnect', 'error')
      }
    } catch {
      showToast('❌ Gmail connection failed — please reconnect', 'error')
    } finally {
      setTestingGmail(false)
    }
  }

  const handleSave = () => {
    saveSettings(prefs)
    showToast('✅ Preferences saved', 'success')
  }

  const handleReset = () => {
    if (
      window.confirm(
        'Reset onboarding? This clears all localStorage and returns you to the landing page.',
      )
    ) {
      localStorage.clear()
      navigate('/')
    }
  }

  const handleWhatsappTest = () => {
    setWhatsappModalOpen(true)
    showToast('💡 Run the command below in your terminal to test WhatsApp', 'info')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <p className="text-xs text-gray-400 mb-1">ReachIQ / Settings</p>
        <h1 className="font-serif text-2xl text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your connections, preferences, and campaign defaults.
        </p>
      </div>

      {/* Gmail */}
      <div className="card">
        <CardHeader icon={Mail} title="Gmail" pill={<StatusPill connected={connected} />} />

        {gmailLoading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-12 bg-gray-100 rounded-xl" />
            <div className="h-10 bg-gray-100 rounded-xl w-2/3" />
          </div>
        ) : connected ? (
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {gmailInitial}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{email}</p>
                <p className="text-xs text-gray-400">Connected · Gmail API</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <button
                type="button"
                onClick={openGmailAuth}
                className="btn-secondary text-sm py-2 px-4"
              >
                Reconnect Gmail
              </button>
              <button
                type="button"
                onClick={testGmailConnection}
                disabled={testingGmail}
                className="btn-secondary text-sm py-2 px-4"
              >
                Test connection
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mt-4">
              <p className="text-xs text-blue-700 leading-relaxed">
                ℹ️ ReachIQ only uses Gmail to send emails and check for replies. We never
                read other emails.
              </p>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <Mail className="mx-auto mb-3 text-gray-200" size={48} />
            <p className="text-sm font-medium text-gray-600 mb-4">Gmail not connected</p>
            <button type="button" onClick={openGmailAuth} className="btn-primary">
              Connect Gmail →
            </button>
          </div>
        )}
      </div>

      {/* WhatsApp */}
      <div className="card">
        <CardHeader
          icon={MessageSquare}
          title="WhatsApp Notifications"
          pill={
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Active
            </span>
          }
        />

        <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
          <Phone size={16} className="text-gray-400 shrink-0" />
          Notifications sent to {WHATSAPP_MASKED}
        </div>

        <ul className="space-y-2">
          {NOTIFICATION_TYPES.map((text) => (
            <li key={text} className="flex items-start gap-2 text-sm text-gray-600">
              <Check className="text-emerald-500 shrink-0 mt-0.5" size={16} />
              {text}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={handleWhatsappTest}
          className="btn-secondary text-sm py-2 px-4 mt-4"
        >
          Send test notification
        </button>
      </div>

      {/* Campaign Defaults */}
      <div className="card">
        <CardHeader icon={Sliders} title="Campaign Defaults" />

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Emails per day
            </label>
            <p className="text-xs text-gray-400 mb-3">
              How many emails to send per campaign run
            </p>
            <div className="grid grid-cols-3 gap-3">
              {BATCH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPrefs((p) => ({ ...p, defaultBatch: opt.value }))}
                  className={clsx(
                    'border rounded-xl p-3 text-center cursor-pointer transition-all duration-200',
                    prefs.defaultBatch === opt.value
                      ? 'border-brand-500 bg-brand-50 text-brand-600'
                      : 'border-gray-200 hover:border-gray-300',
                  )}
                >
                  <p className="text-2xl font-bold font-serif">{opt.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{opt.label}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delay between emails
            </label>
            <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700">
              30–90 seconds (randomised)
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Randomised delays prevent Gmail spam detection. Configured in your backend
              .env file.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Your name
            </label>
            <input
              type="text"
              className="input"
              value={prefs.candidateName}
              onChange={(e) =>
                setPrefs((p) => ({ ...p, candidateName: e.target.value }))
              }
              placeholder="Vedant Goyal"
            />
            <p className="text-xs text-gray-400 mt-1">
              Used in email signatures and subject lines
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Your role
            </label>
            <input
              type="text"
              className="input"
              value={prefs.role}
              onChange={(e) => setPrefs((p) => ({ ...p, role: e.target.value }))}
            />
            <p className="text-xs text-gray-400 mt-1">
              Shown in AI-generated email content
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Default resume path
            </label>
            <input
              type="text"
              className="input"
              value={prefs.resumePath}
              onChange={(e) => setPrefs((p) => ({ ...p, resumePath: e.target.value }))}
              placeholder="/Users/yourname/Documents/resume.pdf"
            />
            <p className="text-xs text-gray-400 mt-1">
              Pre-fills the Campaign page automatically
            </p>
          </div>
        </div>

        <button type="button" onClick={handleSave} className="btn-primary w-full mt-6">
          Save preferences
        </button>
      </div>

      {/* System */}
      <div className="card">
        <CardHeader icon={Info} title="System" />

        <div className="grid grid-cols-2 gap-4">
          {SYSTEM_INFO.map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-sm text-gray-700 font-medium">{value}</p>
            </div>
          ))}
        </div>

        <hr className="my-5 border-gray-100" />

        <div className="flex flex-wrap gap-4">
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-600 underline cursor-pointer"
          >
            API Docs →
          </a>
          <a
            href="http://localhost:5050"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-600 underline cursor-pointer"
          >
            pgAdmin →
          </a>
          <a
            href="http://localhost:8000/health"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-600 underline cursor-pointer"
          >
            Health check →
          </a>
        </div>

        <hr className="my-5 border-gray-100" />

        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700 mb-3">Danger Zone</p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs text-red-600 font-medium">Reset onboarding</p>
              <p className="text-xs text-red-500 mt-0.5">
                Clears all localStorage and redirects to landing page
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="border border-red-200 text-red-600 text-xs rounded-lg px-3 py-1.5 hover:bg-red-100 transition-colors duration-150 shrink-0 self-start"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* WhatsApp test modal */}
      {whatsappModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            aria-label="Close modal"
            onClick={() => setWhatsappModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl p-6 max-w-lg w-full mt-20 shadow-2xl animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg text-gray-900">Test WhatsApp</h2>
              <button
                type="button"
                onClick={() => setWhatsappModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Run this command from your project root to send a test notification:
            </p>
            <pre className="bg-gray-900 text-gray-100 text-xs rounded-xl p-4 overflow-x-auto leading-relaxed">
              {WHATSAPP_TEST_CODE}
            </pre>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(WHATSAPP_TEST_CODE)
                showToast('Command copied to clipboard', 'success')
              }}
              className="btn-secondary text-sm mt-4 w-full"
            >
              Copy command
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
