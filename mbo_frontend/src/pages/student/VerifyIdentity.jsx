// src/pages/student/VerifyIdentity.jsx
import { useState } from 'react'
import { StudentNav } from '../../components/layout/index'
import { Card, Input, Button, Alert } from '../../components/ui/index'
import { verificationAPI } from '../../services/api'

export default function VerifyIdentity() {
  const [nin, setNin]         = useState('')
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleVerify = async (e) => {
    e.preventDefault()
    if (nin.length !== 11 || !/^\d+$/.test(nin)) {
      setError('NIN must be exactly 11 digits'); return
    }
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await verificationAPI.verifyNIN({ nin })
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <StudentNav />
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-gray-800 mb-2">Verify Your Identity</h1>
        <p className="text-gray-500 text-sm mb-6">
          Enter your NIN to verify your identity against the NIMC database.
          This is required before you can apply for any award.
        </p>

        <Card className="mb-4">
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <Input
              label="National Identification Number (NIN)"
              value={nin}
              onChange={e => setNin(e.target.value.replace(/\D/g, '').slice(0, 11))}
              placeholder="12345678901"
              maxLength={11}
              hint="The 11-digit number on your National ID card or slip"
            />
            {error && <Alert type="error">{error}</Alert>}
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">{nin.length}/11 digits</p>
              <Button type="submit" disabled={loading || nin.length !== 11}>
                {loading ? 'Verifying with NIMC...' : 'Verify NIN'}
              </Button>
            </div>
          </form>

          {result && (
            <div className="mt-6">
              <Alert
                type={result.lga_eligible ? 'success' : 'warning'}
                title={result.lga_eligible ? '✓ Identity Verified' : '⚠ Verified — LGA mismatch'}>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div><p className="text-gray-400">Full Name</p><p className="font-medium">{result.identity?.full_name}</p></div>
                  <div><p className="text-gray-400">Date of Birth</p><p className="font-medium">{result.identity?.date_of_birth}</p></div>
                  <div><p className="text-gray-400">LGA of Origin</p><p className="font-medium">{result.identity?.lga_of_origin}</p></div>
                  <div><p className="text-gray-400">State</p><p className="font-medium">{result.identity?.state_of_origin}</p></div>
                </div>
                {result.warning && (
                  <p className="mt-3 text-xs border-t border-current border-opacity-20 pt-2">{result.warning}</p>
                )}
              </Alert>
            </div>
          )}
        </Card>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 leading-relaxed">
          <p className="font-semibold mb-1">🔒 Privacy notice</p>
          Your NIN is verified in real-time and immediately converted to a cryptographic hash (SHA-256).
          The raw NIN is never written to any database, log file, or storage system,
          in compliance with the Nigeria Data Protection Act 2023.
        </div>
      </div>
    </div>
  )
}