// src/components/layout/ProtectedRoute.jsx
import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import { Spinner } from '../ui/index'

export function ProtectedRoute({ allowedRoles, children }) {
  const { user, isReady } = useAuthStore()

  if (!isReady) return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="text-center">
        <Spinner size="lg" className="mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading portal...</p>
      </div>
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/login" replace />
  return children ? children : <Outlet />;
}

// src/components/layout/StudentNav.jsx
import { Link, useLocation, useNavigate } from 'react-router-dom'
//import useAuthStore from '../../store/authStore'
import { authAPI } from '../../services/api'

export function StudentNav() {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const navigate  = useNavigate()

  const links = [
    { to: '/student',            label: 'Dashboard' },
    { to: '/student/schemes',    label: 'Browse Awards' },
    { to: '/student/profile',    label: 'My Profile' },
    { to: '/student/verify',     label: 'Verify Identity' },
    { to: '/student/bank',       label: 'Bank Details' },
  ]

  const handleLogout = async () => {
    try {
      const refresh = localStorage.getItem('refresh_token')
      await authAPI.logout({ refresh })
    } catch {}
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-blue-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <p className="font-bold text-sm">Mbo LGA Award Portal</p>
            <p className="text-xs text-blue-300">Student Portal</p>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {links.map(l => (
              <Link key={l.to} to={l.to}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${
                  location.pathname === l.to
                    ? 'bg-blue-700 text-white'
                    : 'text-blue-200 hover:bg-blue-800'
                }`}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-blue-300 hidden sm:block">{user?.email}</span>
          <button onClick={handleLogout}
            className="text-xs bg-blue-800 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition">
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}

// src/components/layout/AdminNav.jsx
export function AdminNav() {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const navigate  = useNavigate()

  const links = [
    { to: '/admin',                  label: 'Dashboard' },
    { to: '/admin/students',         label: 'Students' },
    { to: '/admin/schemes',          label: 'Schemes' },
    { to: '/admin/applications',     label: 'Applications' },
    { to: '/admin/disbursements',    label: 'Disbursements' },
    { to: '/admin/audit',            label: 'Audit Log' },
  ]

  const handleLogout = async () => {
    try { await authAPI.logout({ refresh: localStorage.getItem('refresh_token') }) } catch {}
    logout(); navigate('/login')
  }

  return (
    <nav className="bg-blue-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <p className="font-bold text-sm">Mbo LGA Award Portal</p>
            <p className="text-xs text-blue-300">Admin Panel</p>
          </div>
          <div className="hidden lg:flex items-center gap-1">
            {links.map(l => (
              <Link key={l.to} to={l.to}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  location.pathname.startsWith(l.to) && (l.to !== '/admin' || location.pathname === '/admin')
                    ? 'bg-blue-700 text-white'
                    : 'text-blue-200 hover:bg-blue-800'
                }`}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-blue-300 hidden sm:block">{user?.email}</span>
          <span className="text-xs bg-yellow-500 text-blue-900 px-2 py-0.5 rounded-full font-bold">{user?.role}</span>
          <button onClick={handleLogout}
            className="text-xs bg-blue-800 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition">
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}