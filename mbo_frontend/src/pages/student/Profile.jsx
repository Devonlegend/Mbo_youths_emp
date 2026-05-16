// ============================================================
// src/pages/student/Profile.jsx
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { studentAPI, academicAPI } from '../../services/api'
import { StudentNav } from '../../components/layout/index'
import { Card, Input, Select, Button, Alert, Badge, Spinner } from '../../components/ui/index'

const WARDS = [
  'effiat','ewang','ebughu','uda','unyene',
  'ekim','ibiaku','mbo_central','udung_uko','enwang'
].map(w => ({ value: w, label: w.replace('_',' ').replace(/\b\w/g,l=>l.toUpperCase()) }))

const LEVELS = ['100','200','300','400','500','600'].map(l => ({ value: l, label: `${l} Level` }))

export default function StudentProfile() {
  const queryClient = useQueryClient()

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn:  () => studentAPI.myProfile().then(r => r.data),
  })

  const { data: academic } = useQuery({
    queryKey: ['my-academic'],
    queryFn:  () => academicAPI.list().then(r => r.data),
  })

  const { register, handleSubmit, formState: { errors } } = useForm({
    values: profile || {}
  })

  const updateMutation = useMutation({
    mutationFn: (data) => studentAPI.updateMyProfile(data),
    onSuccess:  () => queryClient.invalidateQueries(['my-profile']),
  })

  if (isLoading) return (
    <div className="min-h-screen bg-slate-50"><StudentNav />
      <div className="flex justify-center py-20"><Spinner size="lg" /></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <StudentNav />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-gray-800 mb-6">My Profile</h1>

        {/* Verification status */}
        <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-4 mb-6">
          <div className={`w-3 h-3 rounded-full ${profile?.nimc_verified ? 'bg-green-500' : 'bg-red-400'}`} />
          <div>
            <p className="text-sm font-medium text-gray-800">
              Identity: {profile?.nimc_verified ? 'Verified ✓' : 'Not verified'}
            </p>
            {!profile?.nimc_verified && (
              <p className="text-xs text-gray-500">
                Go to <a href="/student/verify" className="text-blue-900 underline">Verify Identity</a> to complete NIN verification
              </p>
            )}
          </div>
          {profile?.nimc_verified && <Badge label="NIN Verified" type="approved" />}
        </div>

        {/* Profile form */}
        <Card title="Personal Information" className="mb-6">
          <form onSubmit={handleSubmit(d => updateMutation.mutate(d))} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Full Name" error={errors.full_name?.message}
                {...register('full_name')} readOnly={profile?.nimc_verified}
                hint={profile?.nimc_verified ? 'Populated from NIMC — read only' : ''} />
              <Input label="Date of Birth" type="date" {...register('date_of_birth')}
                readOnly={profile?.nimc_verified} />
              <Select label="Ward" options={WARDS} {...register('ward')} />
              <Select label="Gender" options={[
                {value:'male',label:'Male'},{value:'female',label:'Female'},{value:'other',label:'Other'}
              ]} {...register('gender')} />
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="disability" {...register('has_disability')}
                className="rounded border-gray-300" />
              <label htmlFor="disability" className="text-sm text-gray-700">
                I have a disability (may qualify for relaxed eligibility requirements)
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="host" {...register('is_host_community')}
                className="rounded border-gray-300" />
              <label htmlFor="host" className="text-sm text-gray-700">
                I am from a host community (Effiat, Ewang, Ebughu, Uda, or Unyene)
              </label>
            </div>

            {updateMutation.isSuccess && <Alert type="success">Profile updated successfully</Alert>}
            {updateMutation.isError   && <Alert type="error">Failed to update — try again</Alert>}

            <Button type="submit" disabled={updateMutation.isPending} className="self-start">
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </Card>

        {/* Academic records */}
        <Card title="Academic Records">
          {(academic?.results || academic || []).map(rec => (
            <div key={rec.id} className="border border-gray-100 rounded-lg p-4 mb-3">
              <p className="font-medium text-gray-800">{rec.institution_name}</p>
              <p className="text-sm text-gray-500">{rec.course_of_study} · {rec.current_level} Level</p>
              {rec.cgpa && <p className="text-sm text-gray-500">CGPA: {rec.cgpa}</p>}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => {}}>+ Add Academic Record</Button>
        </Card>
      </div>
    </div>
  )
}


// ============================================================
// src/pages/student/VerifyIdentity.jsx
// ============================================================
export function VerifyIdentity() {
  const [result, setResult]   = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [nin, setNin]         = useState('')
  const { verificationAPI }   = require('../../services/api')

  const handleVerify = async (e) => {
    e.preventDefault()
    if (nin.length !== 11 || !/^\d+$/.test(nin)) {
      setError('NIN must be exactly 11 digits'); return
    }
    setLoading(true); setError('')
    try {
      const res = await verificationAPI.verifyNIN({ nin })
      setResult(res.data)
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed')
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
          Your NIN is verified against the NIMC database. It is never stored — only an encrypted hash is kept.
        </p>

        <Card>
          <form onSubmit={handleVerify} className="flex flex-col gap-4">
            <Input label="National Identification Number (NIN)" value={nin}
              onChange={e => setNin(e.target.value.replace(/\D/,''))}
              placeholder="12345678901" maxLength={11}
              hint="11-digit number on your national ID card"
              error={error} />
            <Button type="submit" disabled={loading || nin.length !== 11}>
              {loading ? 'Verifying with NIMC...' : 'Verify NIN'}
            </Button>
          </form>

          {result && !result.error && (
            <div className="mt-6">
              <Alert type={result.lga_eligible ? 'success' : 'warning'}
                title={result.lga_eligible ? 'Identity verified' : 'Identity verified — LGA mismatch'}>
                <div className="flex flex-col gap-1 mt-2 text-xs">
                  <p><strong>Name:</strong> {result.identity?.full_name}</p>
                  <p><strong>Date of Birth:</strong> {result.identity?.date_of_birth}</p>
                  <p><strong>LGA of Origin:</strong> {result.identity?.lga_of_origin}</p>
                  <p><strong>State:</strong> {result.identity?.state_of_origin}</p>
                </div>
                {result.warning && <p className="mt-3 text-xs">{result.warning}</p>}
              </Alert>
            </div>
          )}
        </Card>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mt-4 text-xs text-blue-700">
          <strong>Privacy notice:</strong> Your NIN is processed in real-time and immediately converted
          to a cryptographic hash. The raw NIN is never written to any database or log file.
        </div>
      </div>
    </div>
  )
}
