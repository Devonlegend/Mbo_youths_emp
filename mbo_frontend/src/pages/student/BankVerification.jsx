import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { StudentNav } from '../../components/layout/index'
import { Card, Input, Select, Button, Alert, Spinner } from '../../components/ui/index'
import { verificationAPI, bankAPI } from '../../services/api'

export default function BankVerification() {
  const [accountNumber, setAccountNumber] = useState('')
  const [bankCode, setBankCode]           = useState('')
  const [result, setResult]               = useState(null)
  const [saving, setSaving]               = useState(false)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState('')
  const [saved, setSaved]                 = useState(false)

  const { data: banksData, isLoading: banksLoading } = useQuery({
    queryKey: ['banks'],
    queryFn:  () => verificationAPI.getBanks().then(r => r.data),
  })

  const banks = banksData?.banks || []
  const bankOptions = banks.map(b => ({ value: b.code, label: b.name }))

  const handleResolve = async (e) => {
    e.preventDefault()
    if (accountNumber.length !== 10) { setError('Account number must be exactly 10 digits'); return }
    if (!bankCode) { setError('Please select a bank'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await verificationAPI.resolveBank({ account_number: accountNumber, bank_code: bankCode })
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not resolve account. Check the number and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await bankAPI.save({
        account_number: accountNumber,
        bank_code: bankCode,
        bank_name: banks.find(b => b.code === bankCode)?.name || '',
        account_name: result.account_name,
      })
      setSaved(true)
    } catch {
      setError('Failed to save bank details. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <StudentNav />
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-gray-800 mb-2">Bank Account Details</h1>
        <p className="text-gray-500 text-sm mb-6">
          Add your bank account for award disbursement. Your account name must match your verified identity.
        </p>

        <Card className="mb-4">
          <form onSubmit={handleResolve} className="flex flex-col gap-4">
            {banksLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Spinner size="sm" /> Loading banks...
              </div>
            ) : (
              <Select
                label="Select Bank"
                options={bankOptions}
                value={bankCode}
                onChange={e => { setBankCode(e.target.value); setResult(null) }}
              />
            )}

            <Input
              label="Account Number"
              value={accountNumber}
              onChange={e => { setAccountNumber(e.target.value.replace(/\D/g,'').slice(0,10)); setResult(null) }}
              placeholder="0123456789"
              maxLength={10}
              hint="10-digit NUBAN account number"
            />

            {error && <Alert type="error">{error}</Alert>}

            <Button type="submit" disabled={loading || accountNumber.length !== 10 || !bankCode}>
              {loading ? 'Verifying account...' : 'Verify Account'}
            </Button>
          </form>

          {/* Resolution result */}
          {result && (
            <div className="mt-6 space-y-4">
              <Alert
                type={result.name_match?.passed ? 'success' : 'warning'}
                title={result.name_match?.passed ? '✓ Account verified' : '⚠ Account found — name mismatch'}>
                <div className="text-xs mt-2 space-y-1">
                  <p><strong>Account Name:</strong> {result.account_name}</p>
                  <p><strong>Account Number:</strong> {result.account_number}</p>
                  <p><strong>Name Match Score:</strong> {Math.round((result.name_match?.score || 0) * 100)}%</p>
                  <p className="text-gray-500 mt-1">{result.name_match?.detail}</p>
                </div>
                {result.warning && (
                  <p className="mt-2 text-xs border-t border-current border-opacity-20 pt-2">{result.warning}</p>
                )}
              </Alert>

              {saved ? (
                <Alert type="success">Bank details saved successfully.</Alert>
              ) : (
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  variant={result.name_match?.passed ? 'primary' : 'outline'}
                  className="w-full">
                  {saving ? 'Saving...' :
                   result.name_match?.passed ? 'Save Bank Details' : 'Save Anyway (Admin Review Required)'}
                </Button>
              )}
            </div>
          )}
        </Card>

        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 text-xs text-yellow-800 leading-relaxed">
          <p className="font-semibold mb-1">⚠ Important</p>
          Award payments are sent directly to this account. Ensure it is in your own name.
          Providing a third-party account is a violation of the award terms and may result in disqualification.
        </div>
      </div>
    </div>
  )
}