// src/pages/student/Profile.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { studentAPI, academicAPI } from '../../services/api'
import { StudentNav } from '../../components/layout/index'
import { Card, Input, Select, Button, Alert, Badge, Spinner } from '../../components/ui/index'

const WARDS = [
  'effiat','ewang','ebughu','uda','unyene',
  'ekim','ibiaku','mbo_central','udung_uko','enwang'
].map(w => ({ value: w, label: w.replace(/_/g,' ').replace(/\b\w/g, l => l.toUpperCase()) }))

export default function StudentProfile() {
  const queryClient = useQueryClient()
  const [addingRecord, setAddingRecord] = useState(false)
  const [recordForm, setRecordForm] = useState({
    institution_name: '', course_of_study: '',
    current_level: '', cgpa: '', admission_year: '', matric_number: ''
  })

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn:  () => studentAPI.myProfile().then(r => r.data),
  })

  const { data: academicData } = useQuery({
    queryKey: ['my-academic'],
    queryFn:  () => academicAPI.list().then(r => r.data),
  })

  const { register, handleSubmit, formState: { errors } } = useForm({ values: profile || {} })

  const updateMutation = useMutation({
    mutationFn: (data) => studentAPI.updateMyProfile(data),
    onSuccess:  () => queryClient.invalidateQueries(['my-profile']),
  })

  const addRecordMutation = useMutation({
    mutationFn: (data) => academicAPI.create(data),
    onSuccess:  () => {
      queryClient.invalidateQueries(['my-academic'])
      setAddingRecord(false)
    }
  })

  if (isLoading) return (
    <div className="min-h-screen bg-slate-50">
      <StudentNav />
      <div className="flex justify-center py-20"><Spinner size="lg" /></div>
    </div>
  )

  const records = academicData?.results || academicData || []

  return (
    <div className="min-h-screen bg-slate-50">
      <StudentNav />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-gray-800 mb-6">My Profile</h1>

        <div className={`flex items-center gap-3 rounded-xl border p-4 mb-6 ${profile?.nimc_verified ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <div className={`w-3 h-3 rounded-full shrink-0 ${profile?.nimc_verified ? 'bg-green-500' : 'bg-yellow-400'}`} />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-800">
              Identity: {profile?.nimc_verified ? 'Verified with NIMC' : 'Not yet verified'}
            </p>
            {!profile?.nimc_verified && (
              <p className="text-xs text-gray-500 mt-0.5">
                Go to <a href="/student/verify" className="text-blue-900 underline">Verify Identity</a> before applying for awards.
              </p>
            )}
          </div>
          {profile?.nimc_verified && <Badge label="NIN Verified" type="approved" />}
        </div>

        <Card title="Personal Information" className="mb-6">
          <form onSubmit={handleSubmit(d => updateMutation.mutate(d))} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Full Name" error={errors.full_name?.message}
                hint={profile?.nimc_verified ? 'Set by NIMC — read only' : ''}
                readOnly={!!profile?.nimc_verified}
                {...register('full_name')} />
              <Input label="Date of Birth" type="date"
                readOnly={!!profile?.nimc_verified}
                {...register('date_of_birth')} />
              <Select label="Ward" options={WARDS} {...register('ward')} />
              <Select label="Gender" options={[
                {value:'male',label:'Male'},{value:'female',label:'Female'},{value:'other',label:'Other'}
              ]} {...register('gender')} />
              <Input label="Home Address" className="md:col-span-2" {...register('home_address')} />
            </div>
            <div className="flex flex-col gap-3 pt-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5 rounded border-gray-300" {...register('has_disability')} />
                <div>
                  <p className="text-sm font-medium text-gray-700">I have a disability</p>
                  <p className="text-xs text-gray-400">Qualifies for 0.5 CGPA reduction in eligibility checks</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5 rounded border-gray-300" {...register('is_host_community')} />
                <div>
                  <p className="text-sm font-medium text-gray-700">I am from a host community</p>
                  <p className="text-xs text-gray-400">Effiat, Ewang, Ebughu, Uda, Unyene</p>
                </div>
              </label>
            </div>
            {updateMutation.isSuccess && <Alert type="success">Profile updated.</Alert>}
            {updateMutation.isError   && <Alert type="error">Update failed. Try again.</Alert>}
            <div className="flex justify-end">
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Academic Records">
          {records.map(rec => (
            <div key={rec.id} className="border border-gray-100 rounded-xl p-4 mb-3">
              <p className="font-medium text-gray-800">{rec.institution_name}</p>
              <p className="text-sm text-gray-500">{rec.course_of_study} &middot; {rec.current_level} Level</p>
              <div className="flex gap-4 mt-1 text-xs text-gray-400">
                {rec.cgpa           && <span>CGPA: {rec.cgpa}</span>}
                {rec.matric_number  && <span>Matric: {rec.matric_number}</span>}
                {rec.admission_year && <span>Admitted: {rec.admission_year}</span>}
              </div>
            </div>
          ))}

          {addingRecord ? (
            <div className="border border-blue-100 rounded-xl p-4 bg-blue-50 mt-2">
              <p className="text-sm font-medium text-blue-900 mb-3">Add Academic Record</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Institution Name" value={recordForm.institution_name}
                  onChange={e => setRecordForm(p => ({...p, institution_name: e.target.value}))} />
                <Input label="Course of Study" value={recordForm.course_of_study}
                  onChange={e => setRecordForm(p => ({...p, course_of_study: e.target.value}))} />
                <Select label="Current Level" value={recordForm.current_level}
                  onChange={e => setRecordForm(p => ({...p, current_level: e.target.value}))}
                  options={['100','200','300','400','500','600'].map(l => ({value:l, label:`${l} Level`}))} />
                <Input label="CGPA" type="number" step="0.01" min="0" max="5"
                  value={recordForm.cgpa}
                  onChange={e => setRecordForm(p => ({...p, cgpa: e.target.value}))} />
                <Input label="Matric Number" value={recordForm.matric_number}
                  onChange={e => setRecordForm(p => ({...p, matric_number: e.target.value}))} />
                <Input label="Admission Year" type="number" value={recordForm.admission_year}
                  onChange={e => setRecordForm(p => ({...p, admission_year: e.target.value}))} />
              </div>
              <div className="flex gap-2 mt-4">
                <Button size="sm" onClick={() => addRecordMutation.mutate(recordForm)}
                  disabled={addRecordMutation.isPending}>
                  {addRecordMutation.isPending ? 'Saving...' : 'Save Record'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setAddingRecord(false)}>Cancel</Button>
              </div>
              {addRecordMutation.isError && <Alert type="error" className="mt-3">Failed. Check all fields.</Alert>}
            </div>
          ) : (
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setAddingRecord(true)}>
              + Add Academic Record
            </Button>
          )}
        </Card>
      </div>
    </div>
  )
    }
