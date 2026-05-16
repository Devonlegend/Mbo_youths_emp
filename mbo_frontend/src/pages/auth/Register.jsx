import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import useAuthStore from '../../store/authStore'
import { authAPI } from '../../services/api'
import { Input, Button, Alert, Select } from '../../components/ui/index'

const schema = z.object({
  email:        z.string().email('Enter a valid email address'),
  phone_number: z.string().min(10, 'Enter a valid phone number').max(14),
  password:     z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirm:      z.string(),
}).refine(d => d.password === d.confirm, {
  message: 'Passwords do not match', path: ['confirm']
})

export default function Register() {
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
      const res = await authAPI.register({
        email: data.email,
        phone_number: data.phone_number,
        password: data.password,
        role: 'student',
      })
      const me = await authAPI.me()
      login(res.data.tokens, me.data)
      navigate('/student')
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-900 rounded-2xl mb-4">
            <span className="text-white text-2xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-bold text-blue-900">Mbo LGA Award Portal</h1>
          <p className="text-gray-500 text-sm">Create your student account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Student registration</h2>
          <p className="text-sm text-gray-500 mb-6">
            After registering, verify your NIN to complete your identity setup.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input label="Email address" type="email" placeholder="you@example.com"
              error={errors.email?.message} {...register('email')} />
            <Input label="Phone number" type="tel" placeholder="08012345678"
              hint="Use your registered Nigerian number"
              error={errors.phone_number?.message} {...register('phone_number')} />
            <Input label="Password" type="password" placeholder="Min 8 characters"
              hint="Must include uppercase and a number"
              error={errors.password?.message} {...register('password')} />
            <Input label="Confirm password" type="password" placeholder="Re-enter password"
              error={errors.confirm?.message} {...register('confirm')} />

            {error && <Alert type="error">{error}</Alert>}

            <Button type="submit" disabled={loading} className="w-full mt-2" size="lg">
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-900 font-medium hover:underline">Sign in</Link>
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-4 text-sm text-blue-800">
          <p className="font-medium mb-1">Your data is protected</p>
          <p className="text-xs text-blue-600">
            Your NIN and BVN are never stored directly — only encrypted hashes are kept,
            in compliance with the Nigeria Data Protection Act 2023.
          </p>
        </div>
      </div>
    </div>
  )
}