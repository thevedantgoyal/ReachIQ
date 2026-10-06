/** Post-onboarding layout: sidebar navigation, header, and mobile drawer. */

import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  LayoutDashboard,
  Users,
  Rocket,
  MessageSquare,
  Settings,
  Menu,
  X,
  Bell,
} from 'lucide-react'
import { getGmailStatus, getReplies, getStatus } from '../lib/api.js'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/campaign', label: 'Campaign', icon: Rocket },
  { to: '/replies', label: 'Replies', icon: MessageSquare },
  { to: '/settings', label: 'Settings', icon: Settings },
]

const ROUTE_TITLES = {
  '/dashboard': 'Dashboard · ReachIQ',
  '/contacts': 'Contacts · ReachIQ',
  '/campaign': 'Campaign · ReachIQ',
  '/replies': 'Replies · ReachIQ',
  '/settings': 'Settings · ReachIQ',
}

const PAGE_HEADINGS = {
  '/dashboard': 'Dashboard',
  '/contacts': 'Contacts',
  '/campaign': 'Campaign',
  '/replies': 'Replies',
  '/settings': 'Settings',
}

function Logo({ gmailConnected }) {
  return (
    <div className="flex items-center gap-2">
      <span className="leading-none">
        <span className="font-serif italic text-brand-600 text-2xl">Reach</span>
        <span className="font-sans font-bold text-gray-900 text-2xl">IQ</span>
      </span>
      <span
        className={clsx(
          'w-2 h-2 rounded-full shrink-0',
          gmailConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500',
        )}
        aria-hidden="true"
      />
    </div>
  )
}

function CampaignStatusPill({ status }) {
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-gray-50 text-gray-500 border border-gray-100">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        No active campaign
      </span>
    )
  }

  if (status.processing > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        Campaign running
      </span>
    )
  }

  if (status.sent > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-100">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        {status.sent} emails sent
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium bg-gray-50 text-gray-500 border border-gray-100">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      No active campaign
    </span>
  )
}

function SidebarContent({ onNavigate }) {
  const { data: gmail } = useQuery({
    queryKey: ['gmailStatus'],
    queryFn: getGmailStatus,
    refetchInterval: 30_000,
  })

  return (
    <>
      <div className="h-16 flex items-center px-6 border-b border-[#EEEBFF] shrink-0">
        <Logo gmailConnected={!!gmail?.connected} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <p className="text-[10px] font-semibold tracking-widest text-gray-400 uppercase px-4 mb-2 mt-6">
          Navigation
        </p>
        <nav className="space-y-0.5 pb-4">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={({ isActive }) =>
                clsx(
                  'mx-3 px-3 py-2.5 rounded-xl flex items-center gap-3 text-sm font-medium border-l-[3px] transition-colors duration-150',
                  isActive
                    ? 'bg-gradient-to-r from-brand-50 to-violet-50 text-brand-600 font-semibold border-brand-600'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50 border-transparent',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={clsx('shrink-0', isActive ? 'text-brand-600' : 'text-current')}
                    size={18}
                    strokeWidth={isActive ? 2.25 : 2}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-t border-[#EEEBFF] pt-4 pb-2 shrink-0">
        {gmail?.connected ? (
          <div className="mx-3 rounded-xl p-3 bg-emerald-50 border border-emerald-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-emerald-700 text-xs font-medium">Gmail Connected</span>
            </div>
            <p className="text-emerald-600 text-[11px] truncate mt-1 pl-4">{gmail.email}</p>
          </div>
        ) : (
          <div className="mx-3 rounded-xl p-3 bg-red-50 border border-red-100">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
              <span className="text-red-700 text-xs font-medium">Gmail Disconnected</span>
            </div>
            <a
              href="/api/v1/auth/gmail"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 text-[11px] hover:underline mt-1 pl-4 inline-block"
            >
              Connect →
            </a>
          </div>
        )}
        <p className="text-[11px] text-gray-300 text-center py-3">ReachIQ v1.0</p>
      </div>
    </>
  )
}

const SIDEBAR_CLASS =
  'fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-[#EEEBFF] flex flex-col z-40 shadow-[4px_0_24px_rgba(79,70,229,0.04)]'

export default function AppShell({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const title = PAGE_HEADINGS[location.pathname] || 'ReachIQ'

  useEffect(() => {
    document.title = ROUTE_TITLES[location.pathname] || 'ReachIQ'
  }, [location.pathname])

  const { data: repliesData } = useQuery({
    queryKey: ['replies'],
    queryFn: getReplies,
    refetchInterval: 60_000,
  })

  const { data: campaignStatus } = useQuery({
    queryKey: ['campaignStatus'],
    queryFn: getStatus,
    refetchInterval: 15_000,
  })

  const replyCount = repliesData?.replies?.length ?? 0
  const closeMobile = () => setMobileOpen(false)

  return (
    <div className="min-h-screen bg-[#F8F7FF]">
      <aside className={clsx('hidden lg:flex', SIDEBAR_CLASS)}>
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={closeMobile}
          />
          <aside className={clsx('relative max-w-[85vw] h-full animate-fade-in', SIDEBAR_CLASS)}>
            <button
              type="button"
              onClick={closeMobile}
              className="absolute top-4 right-4 p-2 text-gray-500 z-10"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent onNavigate={closeMobile} />
          </aside>
        </div>
      )}

      <div className="lg:ml-60 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-4 lg:px-8 bg-white/80 backdrop-blur-md border-b border-[#EEEBFF]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition-all duration-200"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-gray-700" />
            </button>
            <h1 className="font-serif text-2xl text-gray-900 truncate">{title}</h1>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <CampaignStatusPill status={campaignStatus} />

            <button
              type="button"
              onClick={() => navigate('/replies')}
              className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
              aria-label="View replies"
            >
              <Bell size={20} />
              {replyCount > 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {replyCount > 9 ? '9+' : replyCount}
                </span>
              )}
            </button>

            <div
              className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-600 to-violet-600 text-white text-sm font-bold flex items-center justify-center shadow-sm"
              aria-hidden="true"
            >
              V
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8">
          <div key={location.pathname} className="animate-fade-up">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
