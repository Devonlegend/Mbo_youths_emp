import { Link, useLocation, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
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