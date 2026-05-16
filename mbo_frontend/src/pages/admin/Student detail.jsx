// src/pages/admin/StudentDetail.jsx
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { studentAPI, applicationAPI } from '../../services/api'
import { AdminNav } from '../../components/layout/index'
import { Card, Badge, Button, Alert, Spinner, Table } from '../../components/ui/index'

export default function AdminStudentDetail() {
  const { id } = useParams()
  const queryClient = useQueryClient()

  const { data: student, isLoading } = useQuery({
    queryKey: ['admin-student', id],
    queryFn:  () => studentAPI.detail(id).then(r => r.data),
  })

  const { data: appsData } = useQuery({
    queryKey: ['student-applications', id],
    queryFn:  () => applicationAPI.list({ student: id }).then(r => r.data),
    enabled: !!id,
  })

  const approveResidency = useMutation({
    mutationFn: () => studentAPI.update(id, { residency_manually_approved: true }),
    onSuccess:  () => queryClient.invalidateQueries(['admin-student', id]),
  })

  if (isLoading) return (
    <div className="min-h-screen bg-slate-50"><AdminNav />
      <div className="flex justify-center py-20"><Spinner size="lg" /></div>
    </div>
  )
  if (!student) return null

  const applications = appsData?.results || appsData || []

  const appColumns = [
    { key: 'scheme',  label: 'Scheme',
      render: (v) => (
        <div>
          <p className="font-medium text-sm">{v?.name}</p>
          <Badge label={v?.award_type} type={v?.award_type} />
        </div>
      )
    },
    { key: 'status',  label: 'Status',
      render: v => <Badge label={v.replace(/_/g,' ')} type={v} />
    },
    { key: 'submission_date', label: 'Submitted',
      render: v => v ? new Date(v).toLocaleDateString() : '—'
    },
    { key: 'eligibility_passed', label: 'Eligible',
      render: v => v === null ? '—' : v
        ? <Badge label="Yes" type="approved" />
        : <Badge label="No"  type="rejected" />
    },
    { key: 'has_conflict', label: 'Conflict',
      render: v => v ? <Badge label="Yes" type="double_dip_flag" /> : '—'
    },
  ]

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

        {/* Back */}
        <Link to="/admin/students" className="text-sm text-blue-900 hover:underline mb-4 inline-block">
          ← Back to Students
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{student.full_name}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge label={student.ward?.replace(/_/g,' ')} type="draft" />
              <Badge label={student.nimc_verified ? 'NIN Verified' : 'Not Verified'}
                type={student.nimc_verified ? 'approved' : 'rejected'} />
              {student.has_disability    && <Badge label="Disability"     type="vocational" />}
              {student.is_host_community && <Badge label="Host Community" type="scholarship" />}
              {student.active_award      && <Badge label="Active Award"   type="approved" />}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* Personal info */}
          <Card title="Personal Information">
            {fieldRow('Full Name',      student.full_name)}
            {fieldRow('Date of Birth',  student.date_of_birth)}
            {fieldRow('Gender',         student.gender)}
            {fieldRow('Ward',           student.ward?.replace(/_/g,' '))}
            {fieldRow('LGA of Origin',  student.lga_of_origin)}
            {fieldRow('State',          student.state_of_origin)}
            {fieldRow('Phone',          student.user?.phone_number)}
            {fieldRow('Email',          student.user?.email)}
          </Card>

          {/* Academic info */}
          <Card title="Academic Details">
            {fieldRow('Institution',    student.academic_records?.[0]?.institution_name)}
            {fieldRow('Course',         student.academic_records?.[0]?.course_of_study)}
            {fieldRow('Level',          student.level ? `${student.level} Level` : null)}
            {fieldRow('CGPA',           student.cgpa)}
            {fieldRow('Active Award',   student.active_award || 'None')}
            {fieldRow('NIN Verified',   student.nimc_verified ? 'Yes' : 'No')}
            {fieldRow('Physical Check', student.physical_verified ? 'Completed' : 'Pending')}
            {fieldRow('Registered',     student.created_at ? new Date(student.created_at).toLocaleDateString() : null)}
          </Card>
        </div>

        {/* Residency override */}
        {!student.nimc_verified && student.residency_certificate_url && !student.residency_manually_approved && (
          <Alert type="warning" title="Residency certificate pending review" className="mb-6">
            This student's LGA of origin does not match Mbo. They have uploaded a residency certificate.
            <div className="mt-3 flex gap-3">
              <Button size="sm" variant="success"
                onClick={() => approveResidency.mutate()}
                disabled={approveResidency.isPending}>
                {approveResidency.isPending ? 'Approving...' : 'Approve Residency'}
              </Button>
              <a href={student.residency_certificate_url} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">View Certificate</Button>
              </a>
            </div>
          </Alert>
        )}

        {/* Application history */}
        <Card title="Application History" subtitle={`${applications.length} applications`}>
          <Table
            columns={appColumns}
            data={applications}
            onRowClick={row => window.open(`/admin/applications/${row.id}`, '_blank')}
            emptyMessage="No applications yet"
          />
        </Card>
      </div>
    </div>
  )
}
