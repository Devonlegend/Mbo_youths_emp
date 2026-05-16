// src/pages/admin/ApplicationDetail.jsx
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { applicationAPI } from '../../services/api'
import { AdminNav } from '../../components/layout/index'
import { Card, Badge, Button, Alert, Spinner, CheckResult, Modal, Select } from '../../components/ui/index'

const CHECK_LABELS = {
  cgpa:           'CGPA requirement',
  level:          'Study level eligibility',
  ward:           'Ward eligibility',
  host_community: 'Host community requirement',
  prior_awards:   'Prior award limit',
  double_dip:     'No active award conflict (CBR)',
  slots:          'Slots available',
  window:         'Application window open',
  age:            'Age requirement',
  trade:          'Trade / skill match',
}

export default function AdminApplicationDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const [showReview, setShowReview] = useState(false)
  const [decision, setDecision]     = useState('approved')
  const [notes, setNotes]           = useState('')

  const { data: app, isLoading } = useQuery({
    queryKey: ['admin-application', id],
    queryFn:  () => applicationAPI.detail(id).then(r => r.data),
  })

  const { data: history } = useQuery({
    queryKey: ['admin-application-history', id],
    queryFn:  () => applicationAPI.history(id).then(r => r.data),
    enabled: !!id,
  })

  const reviewMutation = useMutation({
    mutationFn: () => applicationAPI.review(id, { decision, notes }),
    onSuccess:  () => {
      queryClient.invalidateQueries(['admin-application', id])
      queryClient.invalidateQueries(['admin-applications'])
      setShowReview(false)
    }
  })

  if (isLoading) return (
    <div className="min-h-screen bg-slate-50"><AdminNav />
      <div className="flex justify-center py-20"><Spinner size="lg" /></div>
    </div>
  )
  if (!app) return null

  const checks   = app.eligibility_details || {}
  const canReview = ['submitted','document_review','shortlisted','waiver_required'].includes(app.status)

  const fieldRow = (label, value) => (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value || '—'}</span>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="max-w-5xl mx-auto px-4 py-8">

        <Link to="/admin/applications" className="text-sm text-blue-900 hover:underline mb-4 inline-block">
          ← Back to Applications
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{app.scheme?.name}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge label={app.status.replace(/_/g,' ')} type={app.status} />
              <Badge label={app.scheme?.award_type} type={app.scheme?.award_type} />
              <span className="text-sm text-gray-500">
                ₦{Number(app.scheme?.award_amount||0).toLocaleString()}
              </span>
            </div>
          </div>
          {canReview && (
            <Button onClick={() => setShowReview(true)} variant="gold">
              Review Application
            </Button>
          )}
        </div>

        {/* Conflict alert */}
        {app.status === 'double_dip_flag' && (
          <Alert type="conflict" title="Multiple award conflict detected" className="mb-6">
            <p className="text-sm">
              This student has {app.conflict_scheme_ids?.length || 0} conflicting active award(s).
              You may approve the waiver (if submitted) or reject this application.
            </p>
            {app.waiver_submitted && (
              <p className="mt-2 text-sm font-medium">✓ Student has submitted a waiver</p>
            )}
          </Alert>
        )}

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Student info */}
          <Card title="Student">
            {fieldRow('Name',        app.student?.full_name)}
            {fieldRow('Ward',        app.student?.ward?.replace(/_/g,' '))}
            {fieldRow('Level',       app.student?.level ? `${app.student.level} Level` : null)}
            {fieldRow('CGPA',        app.student?.cgpa)}
            {fieldRow('NIN Verified',app.student?.nimc_verified ? 'Yes' : 'No')}
            {fieldRow('Disability',  app.student?.has_disability ? 'Yes' : 'No')}
            {fieldRow('Host Comm.',  app.student?.is_host_community ? 'Yes' : 'No')}
            <div className="pt-2">
              <Link to={`/admin/students/${app.student?.id}`}
                className="text-sm text-blue-900 hover:underline">
                View full student profile →
              </Link>
            </div>
          </Card>

          {/* Scheme info */}
          <Card title="Scheme Details">
            {fieldRow('Provider',    app.scheme?.provider?.name)}
            {fieldRow('Year',        app.scheme?.academic_year)}
            {fieldRow('Amount',      `₦${Number(app.scheme?.award_amount||0).toLocaleString()}`)}
            {fieldRow('Type',        app.scheme?.award_type)}
            {fieldRow('Stacking',    app.scheme?.stacking_policy?.replace(/_/g,' '))}
            {fieldRow('Submitted',   app.submission_date ? new Date(app.submission_date).toLocaleString() : null)}
            {fieldRow('Reviewed by', app.reviewed_by ? app.reviewed_by : null)}
            {app.reviewer_notes && (
              <div className="pt-2">
                <p className="text-xs text-gray-400">Reviewer notes</p>
                <p className="text-sm text-gray-700 mt-0.5">{app.reviewer_notes}</p>
              </div>
            )}
          </Card>
        </div>

        {/* Eligibility checks */}
        {Object.keys(checks).length > 0 && (
          <Card title="Eligibility Check Results" subtitle="Run automatically by the CBR at submission" className="mb-6">
            <div className="grid md:grid-cols-2 gap-2">
              {Object.entries(checks).map(([key, val]) => {
                const label  = CHECK_LABELS[key] || key.replace(/_/g,' ')
                const passed = val?.passed ?? true
                let detail   = ''
                if (key === 'cgpa')       detail = `Student: ${val.student_cgpa} | Required: ${val.required_cgpa}${val.relaxation_applied ? ' (disability relaxation applied)' : ''}`
                if (key === 'level')      detail = `Student: ${val.student_level} Level | Allowed: ${val.allowed_levels?.join(', ')}`
                if (key === 'ward')       detail = `Student ward: ${val.student_ward}`
                if (key === 'double_dip') detail = passed ? 'No conflicts found' : `${val.conflict_details?.length || 0} conflict(s) detected`
                if (key === 'slots')      detail = `${val.remaining_slots} slots remaining`
                return <CheckResult key={key} label={label} passed={passed} detail={detail} />
              })}
            </div>
          </Card>
        )}

        {/* Status history */}
        {history?.length > 0 && (
          <Card title="Status Timeline">
            <div className="relative pl-6">
              <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-100" />
              {history.map((h) => (
                <div key={h.id} className="relative mb-4 last:mb-0">
                  <div className="absolute -left-4 top-1 w-3 h-3 bg-blue-900 rounded-full border-2 border-white" />
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 capitalize">
                      {h.to_status.replace(/_/g,' ')}
                    </p>
                    <Badge label={h.to_status.replace(/_/g,' ')} type={h.to_status} />
                  </div>
                  {h.reason && <p className="text-xs text-gray-500 mt-0.5">{h.reason}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(h.changed_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Review modal */}
      <Modal open={showReview} onClose={() => setShowReview(false)} title="Review Application"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowReview(false)}>Cancel</Button>
            <Button
              variant={decision === 'approved' ? 'success' : 'danger'}
              onClick={() => reviewMutation.mutate()}
              disabled={reviewMutation.isPending}>
              {reviewMutation.isPending ? 'Submitting...' :
               decision === 'approved' ? 'Approve Application' : 'Reject Application'}
            </Button>
          </>
        }>
        <div className="flex flex-col gap-4">
          <Alert type="warning" title="This action updates the student's application status">
            Approving will decrement available slots and set this as the student's active award.
            The student will be notified by SMS.
          </Alert>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Decision</label>
            <div className="flex gap-3">
              {['approved','rejected','shortlisted'].map(d => (
                <button key={d} onClick={() => setDecision(d)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition capitalize ${
                    decision === d
                      ? d === 'approved'    ? 'bg-green-600 text-white border-green-600'
                      : d === 'rejected'   ? 'bg-red-600 text-white border-red-600'
                      :                     'bg-purple-600 text-white border-purple-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}>
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              Notes {decision === 'rejected' && <span className="text-red-500">*</span>}
            </label>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={decision === 'rejected' ? 'State the reason for rejection...' : 'Optional reviewer notes...'}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-blue-900 outline-none" />
          </div>

          {reviewMutation.isError && (
            <Alert type="error">Review failed. Please try again.</Alert>
          )}
        </div>
      </Modal>
    </div>
  )
}
