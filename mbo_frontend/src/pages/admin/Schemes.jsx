// src/pages/admin/Schemes.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { schemeAPI } from '../../services/api'
import { AdminNav } from '../../components/layout/index'
import { Card, Badge, Button, Input, Select, Alert, Modal, Spinner } from '../../components/ui/index'
import { useForm } from 'react-hook-form'

const PROVIDER_TYPES = [
  { value: 'lga',       label: 'LGA Council' },
  { value: 'state',     label: 'State Government' },
  { value: 'corporate', label: 'Corporate / CSR' },
  { value: 'ngo',       label: 'NGO / Foundation' },
  { value: 'federal',   label: 'Federal Government' },
]

const STACKING = [
  { value: 'exclusive',  label: 'Exclusive — no other active awards allowed' },
  { value: 'major_only', label: 'Cannot stack with other major awards (>₦50k)' },
  { value: 'open',       label: 'Open — can stack with any award' },
]

export default function AdminSchemes() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [feedback, setFeedback]   = useState({})

  const { data, isLoading } = useQuery({
    queryKey: ['admin-schemes'],
    queryFn:  () => schemeAPI.list().then(r => r.data),
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const createMutation = useMutation({
    mutationFn: (data) => schemeAPI.create(data),
    onSuccess:  () => {
      queryClient.invalidateQueries(['admin-schemes'])
      setShowModal(false)
      reset()
    }
  })

  const publishMutation = useMutation({
    mutationFn: (id) => schemeAPI.publish(id),
    onSuccess:  (_, id) => {
      queryClient.invalidateQueries(['admin-schemes'])
      setFeedback(prev => ({ ...prev, [id]: 'published' }))
    }
  })

  const closeMutation = useMutation({
    mutationFn: (id) => schemeAPI.close(id),
    onSuccess:  (_, id) => {
      queryClient.invalidateQueries(['admin-schemes'])
      setFeedback(prev => ({ ...prev, [id]: 'closed' }))
    }
  })

  const schemes = data?.results || data || []

  const schemeStatus = (scheme) => {
    if (!scheme.is_published) return { label: 'Draft',  type: 'draft' }
    if (!scheme.is_active)    return { label: 'Closed', type: 'closed' }
    return { label: 'Open', type: 'open' }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Scholarship Schemes</h1>
            <p className="text-sm text-gray-500 mt-1">Manage all award schemes — scholarships and vocational</p>
          </div>
          <Button onClick={() => setShowModal(true)} variant="gold">+ New Scheme</Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : schemes.length === 0 ? (
          <Card>
            <div className="text-center py-10">
              <p className="text-4xl mb-3">📚</p>
              <p className="text-gray-500">No schemes yet</p>
              <Button onClick={() => setShowModal(true)} className="mt-4">Create First Scheme</Button>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {schemes.map(scheme => {
              const status = schemeStatus(scheme)
              return (
                <div key={scheme.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="font-semibold text-gray-800">{scheme.name}</h3>
                        <Badge label={scheme.award_type} type={scheme.award_type} />
                        <Badge label={status.label}      type={status.type} />
                      </div>
                      <p className="text-sm text-gray-500 mb-3">{scheme.description}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        <span>💰 ₦{Number(scheme.award_amount).toLocaleString()}</span>
                        <span>🪑 {scheme.remaining_slots}/{scheme.total_slots} slots</span>
                        <span>📅 {scheme.application_open_date} → {scheme.application_close_date}</span>
                        <span>📋 Year: {scheme.academic_year}</span>
                        <span>🔒 {scheme.stacking_policy?.replace(/_/g,' ')}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      {!scheme.is_published && (
                        <Button size="sm" variant="success"
                          onClick={() => publishMutation.mutate(scheme.id)}
                          disabled={publishMutation.isPending}>
                          Publish
                        </Button>
                      )}
                      {scheme.is_published && scheme.is_active && (
                        <Button size="sm" variant="danger"
                          onClick={() => closeMutation.mutate(scheme.id)}
                          disabled={closeMutation.isPending}>
                          Close
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create scheme modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Create New Scheme"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSubmit(d => createMutation.mutate(d))}
              disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create Scheme'}
            </Button>
          </>
        }>
        <form className="flex flex-col gap-4">
          <Input label="Scheme Name" error={errors.name?.message}
            {...register('name', { required: 'Name is required' })} />
          <Select label="Award Type" options={[
            { value: 'scholarship', label: 'Scholarship (Academic)' },
            { value: 'vocational',  label: 'Vocational Training Award' },
          ]} {...register('award_type')} />
          <Input label="Academic Year (e.g. 2024/2025)"
            {...register('academic_year', { required: true })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Award Amount (₦)" type="number"
              {...register('award_amount', { required: true })} />
            <Input label="Total Slots" type="number"
              {...register('total_slots', { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Open Date" type="date" {...register('application_open_date', { required: true })} />
            <Input label="Close Date" type="date" {...register('application_close_date', { required: true })} />
          </div>
          <Select label="Stacking Policy" options={STACKING} {...register('stacking_policy')} />
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
            <textarea rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-900 outline-none"
              {...register('description')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Min CGPA (scholarships)" type="number" step="0.01"
              placeholder="2.20" {...register('min_cgpa')} />
            <Input label="Allowed Levels (comma separated)"
              placeholder="200,300,400" {...register('allowed_levels_raw')} />
          </div>
          {createMutation.isError && (
            <Alert type="error">Failed to create scheme. Check all fields and try again.</Alert>
          )}
        </form>
      </Modal>
    </div>
  )
}
