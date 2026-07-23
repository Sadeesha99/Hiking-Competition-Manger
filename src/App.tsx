import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/auth'
import { DataProvider } from './data/DataContext'
import { FullPageLoader, ToastProvider } from './components/ui'
import type { JSX } from 'react'

import PublicLayout from './pages/public/PublicLayout'
import PublicLeaderboard from './pages/public/PublicLeaderboard'

import Login from './pages/admin/Login'
import AdminLayout from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import Teams from './pages/admin/Teams'
import Events from './pages/admin/Events'
import ScoreEntry from './pages/admin/ScoreEntry'
import Adjustments from './pages/admin/Adjustments'
import AuditLog from './pages/admin/AuditLog'
import Settings from './pages/admin/Settings'

import PrintEvent from './pages/print/PrintEvent'
import PrintAll from './pages/print/PrintAll'
import PrintTeam from './pages/print/PrintTeam'

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (!user) return <Navigate to="/admin/login" replace />
  return children
}

export default function App() {
  return (
    <ToastProvider>
      {/* Faint logo watermark behind every screen (see .app-watermark in index.css) */}
      <div className="app-watermark" aria-hidden="true" />
      <DataProvider>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<PublicLeaderboard />} />
            </Route>

            {/* Admin auth */}
            <Route path="/admin/login" element={<Login />} />

            {/* Admin (protected) */}
            <Route
              path="/admin"
              element={
                <RequireAuth>
                  <AdminLayout />
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="teams" element={<Teams />} />
              <Route path="events" element={<Events />} />
              <Route path="score" element={<ScoreEntry />} />
              <Route path="score/:eventId" element={<ScoreEntry />} />
              <Route path="adjustments" element={<Adjustments />} />
              <Route path="audit" element={<AuditLog />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            {/* Print views (protected, no admin chrome) */}
            <Route
              path="/admin/print/event/:id"
              element={
                <RequireAuth>
                  <PrintEvent />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/print/all"
              element={
                <RequireAuth>
                  <PrintAll />
                </RequireAuth>
              }
            />
            <Route
              path="/admin/print/team/:id"
              element={
                <RequireAuth>
                  <PrintTeam />
                </RequireAuth>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </DataProvider>
    </ToastProvider>
  )
}
