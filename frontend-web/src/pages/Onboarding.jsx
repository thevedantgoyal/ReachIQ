/** Three-step onboarding wizard: Gmail, resume path, and CSV contact import. */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  CloudUpload,
  FileText,
  Loader2,
  Mail,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react'
import clsx from 'clsx'
import {
  getContacts,
  getGmailStatus,
  uploadContacts,
  uploadResume,
} from '../lib/api.js'

const STEP_LABELS = ['Connect Gmail', 'Your Resume', 'Import Contacts']
const STORAGE_STEP = 'reachiq_onboarding_step'
const STORAGE_RESUME = 'reachiq_resume_path'
const STORAGE_ONBOARDED = 'reachiq_onboarded'

function ProgressBar({ step }) {
  return (
    <div className="max-w-lg mx-auto mb-12">
      <div className="flex items-center justify-between">
        {[1, 2, 3].map((n, i) => (
          <div key={n} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={clsx(
                  'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200',
                  step > n && 'bg-emerald-500 text-white',
                  step === n && 'bg-brand-600 text-white',
                  step < n && 'bg-gray-200 text-gray-500',
                )}
              >
                {step > n ? <Check className="w-5 h-5" /> : n}
              </div>
              <span
                className={clsx(
                  'text-xs mt-2 hidden sm:block',
                  step === n ? 'text-brand-600 font-medium' : 'text-gray-400',
                )}
              >
                {STEP_LABELS[i]}
              </span>
            </div>
            {i < 2 && (
              <div
                className={clsx(
                  'flex-1 h-0.5 mx-2 transition-all duration-200',
                  step > n ? 'bg-emerald-500' : 'bg-gray-200',
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function Tooltip({ children, show }) {
  if (!show) return null
  return (
    <div className="relative mt-3 animate-fade-in">
      <div className="absolute -top-1 left-6 w-3 h-3 bg-gray-900 rotate-45" />
      <div className="bg-gray-900 text-white text-sm rounded-xl px-4 py-3 shadow-lg">
        {children}
      </div>
    </div>
  )
}

export default function Onboarding() {
  const navigate = useNavigate()
  const resumeFileInputRef = useRef(null)
  const csvFileInputRef = useRef(null)

  const [step, setStep] = useState(() => {
    const saved = localStorage.getItem(STORAGE_STEP)
    const n = saved ? parseInt(saved, 10) : 1
    return n >= 1 && n <= 3 ? n : 1
  })

  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState('')
  const [showGmailTooltip, setShowGmailTooltip] = useState(false)

  const [resumePath, setResumePath] = useState(
    () => localStorage.getItem(STORAGE_RESUME) || '',
  )
  const [resumeFileName, setResumeFileName] = useState(() => {
    const saved = localStorage.getItem(STORAGE_RESUME)
    if (!saved) return ''
    const parts = saved.split('/')
    return parts[parts.length - 1] || ''
  })
  const [resumeUploaded, setResumeUploaded] = useState(
    () => !!localStorage.getItem(STORAGE_RESUME),
  )
  const [resumeUploading, setResumeUploading] = useState(false)
  const [resumeUploadError, setResumeUploadError] = useState('')
  const [showResumeTooltip, setShowResumeTooltip] = useState(false)

  const [csvUploading, setCsvUploading] = useState(false)
  const [csvUploadError, setCsvUploadError] = useState('')
  const [uploadResult, setUploadResult] = useState(null)
  const [previewContacts, setPreviewContacts] = useState([])
  const [selectedCsvFile, setSelectedCsvFile] = useState(null)
  const [showCsvTooltip, setShowCsvTooltip] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_STEP, String(step))
  }, [step])

  useEffect(() => {
    const t = setTimeout(() => setShowGmailTooltip(true), 2000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (step === 2) {
      const t = setTimeout(() => setShowResumeTooltip(true), 500)
      return () => clearTimeout(t)
    }
    setShowResumeTooltip(false)
    return undefined
  }, [step])

  useEffect(() => {
    if (step === 3) {
      const t = setTimeout(() => setShowCsvTooltip(true), 500)
      return () => clearTimeout(t)
    }
    setShowCsvTooltip(false)
    return undefined
  }, [step])

  const pollGmail = useCallback(async () => {
    try {
      const data = await getGmailStatus()
      if (data.connected) {
        setGmailConnected(true)
        setGmailEmail(data.email || '')
      }
    } catch {
      /* backend may be offline during setup */
    }
  }, [])

  useEffect(() => {
    pollGmail()
    const id = setInterval(pollGmail, 3000)
    return () => clearInterval(id)
  }, [pollGmail])

  const processResumeFile = async (file) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setResumeUploadError('Please upload a PDF file.')
      return
    }
    setResumeFileName(file.name)
    setResumeUploadError('')
    setResumeUploading(true)
    setResumeUploaded(false)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const result = await uploadResume(formData)
      setResumePath(result.resume_path)
      setResumeFileName(result.filename || file.name)
      setResumeUploaded(true)
      localStorage.setItem(STORAGE_RESUME, result.resume_path)
    } catch (err) {
      setResumeUploadError(
        err.response?.data?.detail || 'Resume upload failed. Please try again.',
      )
    } finally {
      setResumeUploading(false)
    }
  }

  const processCsvFile = async (file) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvUploadError('Please upload a .csv file.')
      return
    }
    setSelectedCsvFile(file)
    setCsvUploadError('')
    setCsvUploading(true)
    setUploadResult(null)
    setPreviewContacts([])

    const formData = new FormData()
    formData.append('file', file)

    try {
      const result = await uploadContacts(formData)
      setUploadResult(result)
      const contactsData = await getContacts()
      setPreviewContacts((contactsData.contacts || []).slice(0, 3))
    } catch (err) {
      setCsvUploadError(
        err.response?.data?.detail || 'Upload failed. Check your CSV format.',
      )
    } finally {
      setCsvUploading(false)
    }
  }

  const onCsvDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) processCsvFile(file)
  }

  const downloadSampleCsv = () => {
    const content =
      'name,email,company\nJane Doe,jane@acme.com,Acme Corp\nJohn Smith,john@startup.io,StartupIO'
    const blob = new Blob([content], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'reachiq-sample.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const canContinue =
    (step === 1 && gmailConnected) ||
    (step === 2 && resumeUploaded && resumePath) ||
    (step === 3 && uploadResult && uploadResult.uploaded > 0)

  const handleContinue = () => {
    if (step < 3) {
      setStep(step + 1)
      return
    }
    localStorage.setItem(STORAGE_ONBOARDED, 'true')
    localStorage.removeItem(STORAGE_STEP)
    navigate('/dashboard')
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const connectGmail = () => {
    window.open('/api/v1/auth/gmail', '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-12 px-6">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8 animate-fade-in">
          <span className="font-serif text-3xl">
            <span className="text-brand-600">Reach</span>
            <span className="text-gray-400">IQ</span>
          </span>
          <p className="text-gray-500 text-sm mt-2">Setup takes less than 2 minutes</p>
        </div>

        <ProgressBar step={step} />

        <div className="card animate-fade-up">
          {step === 1 && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500 to-yellow-500 flex items-center justify-center">
                <Mail className="w-10 h-10 text-white" />
              </div>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">Connect your Gmail</h2>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed">
                ReachIQ sends emails directly from your Gmail account. We only request send
                and read permissions.
              </p>

              {gmailConnected ? (
                <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm animate-fade-in">
                  ✅ Gmail connected! {gmailEmail}
                </div>
              ) : (
                <div className="relative">
                  <button type="button" onClick={connectGmail} className="btn-primary w-full sm:w-auto">
                    Connect Gmail
                    <ArrowRight className="inline w-4 h-4 ml-1" />
                  </button>
                  <Tooltip show={showGmailTooltip && !gmailConnected}>
                    💡 This opens Google&apos;s sign-in page — it&apos;s safe and takes 30 seconds
                  </Tooltip>
                </div>
              )}

              {!gmailConnected && (
                <p className="text-xs text-gray-400 mt-6">
                  After connecting, come back and click Continue
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">Upload your resume</h2>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Select your resume PDF from your device. It will be saved securely and
                attached to every outreach email automatically.
              </p>

              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && resumeFileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files?.[0]
                  if (file) processResumeFile(file)
                }}
                onClick={() => resumeFileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-all duration-200"
              >
                <FileText className="w-10 h-10 text-brand-600 mx-auto mb-4" />
                <p className="text-gray-500 mb-1">Drop your resume PDF here</p>
                <p className="text-brand-600 text-sm underline">or click to browse</p>
                <input
                  ref={resumeFileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) processResumeFile(f)
                  }}
                />
              </div>

              <Tooltip show={showResumeTooltip}>
                📎 Your PDF will be attached to every outreach email
              </Tooltip>

              {resumeFileName && (
                <p className="text-sm text-gray-600 mt-4">{resumeFileName}</p>
              )}

              {resumeUploading && (
                <div className="flex items-center gap-2 mt-4 text-brand-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading resume…
                </div>
              )}

              {resumeUploadError && (
                <p className="mt-4 text-sm text-red-600">{resumeUploadError}</p>
              )}

              {resumeUploaded && resumePath && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm animate-fade-in">
                  ✅ Resume uploaded successfully!
                  <span className="block text-emerald-700 text-xs mt-1 truncate">
                    {resumeFileName}
                  </span>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="font-serif text-2xl text-gray-900 mb-3">Import your contacts</h2>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Upload a CSV with columns: name, email, company. ReachIQ will send one
                personalised email per contact.
              </p>

              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && csvFileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onCsvDrop}
                onClick={() => csvFileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center cursor-pointer hover:border-brand-400 hover:bg-brand-50/30 transition-all duration-200"
              >
                <CloudUpload className="w-10 h-10 text-brand-600 mx-auto mb-4" />
                <p className="text-gray-500 mb-1">Drop your CSV here</p>
                <p className="text-brand-600 text-sm underline">or click to browse</p>
                <input
                  ref={csvFileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) processCsvFile(f)
                  }}
                />
              </div>

              <Tooltip show={showCsvTooltip}>
                📋 Your CSV needs 3 columns: name, email, company
              </Tooltip>

              <button
                type="button"
                onClick={downloadSampleCsv}
                className="text-sm text-brand-600 hover:underline mt-4"
              >
                Download sample CSV
              </button>

              {selectedCsvFile && (
                <p className="text-sm text-gray-600 mt-4">
                  {selectedCsvFile.name} ({(selectedCsvFile.size / 1024).toFixed(1)} KB)
                </p>
              )}

              {csvUploading && (
                <div className="flex items-center gap-2 mt-4 text-brand-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading contacts…
                </div>
              )}

              {csvUploadError && (
                <p className="mt-4 text-sm text-red-600">{csvUploadError}</p>
              )}

              {uploadResult && uploadResult.uploaded > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm animate-fade-in">
                  ✅ {uploadResult.uploaded} contacts imported successfully!
                  {uploadResult.skipped > 0 && (
                    <span className="block text-emerald-700 mt-1">
                      ({uploadResult.skipped} duplicates skipped)
                    </span>
                  )}
                </div>
              )}

              {previewContacts.length > 0 && (
                <div className="mt-6 overflow-hidden rounded-xl border border-gray-100">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">Name</th>
                        <th className="px-4 py-2 font-medium">Email</th>
                        <th className="px-4 py-2 font-medium">Company</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewContacts.map((c) => (
                        <tr key={c.id} className="border-t border-gray-100">
                          <td className="px-4 py-2">{c.full_name || '—'}</td>
                          <td className="px-4 py-2">{c.email}</td>
                          <td className="px-4 py-2">{c.company || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between mt-10 pt-6 border-t border-gray-100">
            {step > 1 ? (
              <button type="button" onClick={handleBack} className="btn-secondary">
                <ArrowLeft className="w-4 h-4 inline mr-1" />
                Back
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
              <ArrowRight className="w-4 h-4 inline ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
