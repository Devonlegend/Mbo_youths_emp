// src/pages/verifier/VerifyStudent.jsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { studentAPI } from '../../services/api'
import api from '../../services/api'
import { AdminNav } from '../../components/layout/index'
import { Card, Badge, Button, Alert, Spinner } from '../../components/ui/index'

export default function VerifyStudent() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [rejectionReason, setRejectionReason] = useState('')
  const [showReject, setShowReject]           = useState(false)

  const { data: student, isLoading } = useQuery({
    queryKey: ['verifier-student', id],
    queryFn:  () => studentAPI.detail(id).then(r => r.data),
  })

  const verifyMutation = useMutation({
    mutationFn: () => api.post(`/students/${id}/physical-verify/`),
    onSuccess:  () => { queryClient.invalidateQueries(['pending-verification']); navigate('/verifier') }
  })

  const rejectMutation = useMutation({
    mutationFn: () => api.post(`/students/${id}/reject-verification/`, { reason: rejectionReason }),
    onSuccess:  () => { queryClient.invalidateQueries(['pending-verification']); navigate('/verifier') }
  })

  if (isLoading) return (
    <div className="min-h-screen bg-slate-50"><AdminNav />
      <div className="flex justify-center py-20"><Spinner size="lg" /></div>
    </div>
  )
  if (!student) return null

  const fieldRow = (label, value) => (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value || '—'}</span>
    </div>
  )

  const docs = [
    { label: 'Admission Letter',       url: student.academic_records?.[0]?.admission_letter_url },
    { label: 'School ID Card',         url: student.academic_records?.[0]?.school_id_url },
    { label: 'Residency Certificate',  url: student.residency_certificate_url },
    { label: 'Disability Certificate', url: student.disability_certificate_url },
  ].filter(d => d.url)

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="max-w-3xl mx-auto px-4 py-8">

        <button onClick={() => navigate('/verifier')}
          className="text-sm text-blue-900 hover:underline mb-4 inline-block">
          ← Back to queue
        </button>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800">{student.full_name}</h1>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge label={student.ward?.replace(/_/g,' ')} type="draft" />
            <Badge label={student.nimc_verified ? 'NIN Verified' : 'NIN Pending'}
              type={student.nimc_verified ? 'approved' : 'rejected'} />
            {student.has_disability    && <Badge label="Disability"     type="vocational" />}
            {student.is_host_community && <Badge label="Host Community" type="scholarship" />}
          </div>
        </div>

        <Card title="Identity (from NIMC)" className="mb-4">
          {fieldRow('Full Name',     student.full_name)}
          {fieldRow('Date of Birth', student.date_of_birth)}
          {fieldRow('Gender',        student.gender)}
          {fieldRow('LGA',           student.lga_of_origin)}
          {fieldRow('State',         student.state_of_origin)}
        </Card>

        <Card title="Academic" className="mb-4">
          {fieldRow('Institution', student.academic_records?.[0]?.institution_name)}
          {fieldRow('Course',      student.academic_records?.[0]?.course_of_study)}
          {fieldRow('Level',       student.level ? `${student.level} Level` : null)}
          {fieldRow('CGPA',        student.cgpa)}
          {fieldRow('Matric No.', student.academic_records?.[0]?.matric_number)}
        </Card>

        {docs.length > 0 && (
          <Card title="Documents" className="mb-6">
            {docs.map(doc => (
              <div key={doc.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-700">{doc.label}</span>
                <a href={doc.url} target="_blank" rel="noreferrer">
                  <Button size="sm" variant="outline">Open</Button>
                </a>
              </div>
            ))}
          </Card>
        )}

        <Card title="Verification Decision">
          <p className="text-sm text-gray-500 mb-4">
            Compare documents against identity details. Confirm student was present for physical verification.
          </p>
          {!showReject ? (
            <div className="flex gap-3">
              <Button variant="success" className="flex-1"
                onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
                {verifyMutation.isPending ? 'Saving...' : '✓ Verify Student'}
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => setShowReject(true)}>
                ✗ Reject
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <textarea rows={3} value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection (required)..."
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-blue-900" />
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setShowReject(false)}>Back</Button>
                <Button variant="danger" className="flex-1"
                  disabled={!rejectionReason || rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate()}>
                  {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                </Button>
              </div>
            </div>
          )}
          {(verifyMutation.isError || rejectMutation.isError) && (
            <Alert type="error" className="mt-3">Action failed. Try again.</Alert>
          )}
        </Card>
      </div>
    </div>
  )
      }
