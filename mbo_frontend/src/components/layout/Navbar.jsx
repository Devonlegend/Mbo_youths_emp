import React from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../../hooks/useAuth'

export default function Navbar() {
  const { user, logout } = useAuth() || {}

  return (
    <nav className="p-4 bg-gray-100 flex justify-between items-center">
      <div className="flex items-center space-x-4">
        <Link to="/" className="font-semibold">MBO</Link>
        <Link to="/student/dashboard">Student</Link>
        <Link to="/admin/dashboard">Admin</Link>
      </div>
      <div>
        {user ? (
          <div className="flex items-center space-x-3">
            <span>{user.email}</span>
            <button onClick={logout} className="text-sm text-red-600">Logout</button>
          </div>
        ) : (
          <Link to="/auth/login">Login</Link>
        )}
      </div>
    </nav>
  )
}
