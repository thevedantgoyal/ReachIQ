/** Root router with onboarding guards and app shell for dashboard routes. */

import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AppShell from './components/AppShell.jsx'
import Landing from './pages/Landing.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Contacts from './pages/Contacts.jsx'
import Campaign from './pages/Campaign.jsx'
import Replies from './pages/Replies.jsx'
import Settings from './pages/Settings.jsx'

const ONBOARDED_KEY = 'reachiq_onboarded'

function isOnboarded() {
  return localStorage.getItem(ONBOARDED_KEY) === 'true'
}

function OnboardingGuard({ children }) {
  const location = useLocation()
  const onboarded = isOnboarded()
  const path = location.pathname

  if (!onboarded && path !== '/' && path !== '/onboarding') {
    return <Navigate to="/" replace />
  }

  if (onboarded && path === '/') {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function ShellRoute({ children }) {
  return <AppShell>{children}</AppShell>
}

export default function App() {
  return (
    <OnboardingGuard>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route
          path="/dashboard"
          element={
            <ShellRoute>
              <Dashboard />
            </ShellRoute>
          }
        />
        <Route
          path="/contacts"
          element={
            <ShellRoute>
              <Contacts />
            </ShellRoute>
          }
        />
        <Route
          path="/campaign"
          element={
            <ShellRoute>
              <Campaign />
            </ShellRoute>
          }
        />
        <Route
          path="/replies"
          element={
            <ShellRoute>
              <Replies />
            </ShellRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ShellRoute>
              <Settings />
            </ShellRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </OnboardingGuard>
  )
}
