import { Navigate, Outlet } from 'react-router-dom'
import useAuthStore from '../../store/authStore'

export default function ProtectedRoute({ allowedRoles }) {
  const { user, isReady } = useAuthStore()

  // Wait until we've checked login state
  if (!isReady) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  // Not logged in
  if (!user) return <Navigate to="/login" replace />

  // Wrong role
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/login" replace />
  }

  // All good — render the child routes
  return <Outlet />
}