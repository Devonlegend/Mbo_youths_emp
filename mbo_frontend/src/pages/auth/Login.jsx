// ============================================================
// src/pages/auth/Login.jsx
// ============================================================
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import useAuthStore from '../../store/authStore'
import { authAPI } from '../../services/api'
import { Input, Button, Alert } from '../../components/ui/index'

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema)
  })

  const onSubmit = async (data) => {
    setLoading(true); setError('')
    try {
      const res = await authAPI.login(data)
      const me  = await authAPI.me()
      login(res.data.tokens, me.data)

      const role = me.data.role
      if (role === 'student')                        navigate('/student')
      else if (['admin','superadmin'].includes(role)) navigate('/admin')
      else if (role === 'verifier')                  navigate('/verifier')
      else navigate('/login')
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-900 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-bold text-blue-900">Mbo LGA</h1>
          <p className="text-gray-500 text-sm">Universal Award Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input label="Email address" type="email" placeholder="you@example.com"
              error={errors.email?.message} {...register('email')} />
            <Input label="Password" type="password" placeholder="••••••••"
              error={errors.password?.message} {...register('password')} />

            {error && <Alert type="error">{error}</Alert>}

            <Button type="submit" disabled={loading} className="w-full mt-2" size="lg">
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            New student?{' '}
            <Link to="/register" className="text-blue-900 font-medium hover:underline">
              Create an account
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Mbo Local Government Area · Akwa Ibom State, Nigeria
        </p>
      </div>
    </div>
  )
}


