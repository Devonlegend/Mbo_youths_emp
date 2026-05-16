// src/pages/admin/Applications.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { applicationAPI } from '../../services/api'
import { AdminNav } from '../../components/layout/index'
import { Card, Badge, Input, Spinner, Table, Alert } from '../../components/ui/index'

const STATUSES = [
  { value: '',                 label: 'All statuses' },
  { value: 'submitted',        label: 'Submitted' },
  { value: 'double_dip_flag',  label: '⚠ Conflict Flagged' },
  { value: 'document_review',  label: 'Document Review' },
  { value: 'shortlisted',      label: 'Shortlisted' },
  { value: 'approved',         label: 'Approved' },
  { value: 'rejected',         label: 'Rejected' },
  { value: 'waiver_required',  label: 'Waiver Required' },
  { value: 'withdrawn',        label: 'Withdrawn' },
]

export default function AdminApplications() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus]   = useState(searchParams.get('status') || '')
  const [search, setSearch]   = useState('')
  const [awardType, setAwardType] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-applications', status, search, awardType],
    queryFn:  () => applicationAPI.list({
      ...(status    ? { status }                       : {}),
      ...(search    ? { search }                       : {}),
      ...(awardType ? { scheme__award_type: awardType } : {}),
    }).then(r => r.data),
    keepPreviousData: true,
  })

  const applications = data?.results || data || []
  const flagged = applications.filter(a => a.status === 'double_dip_flag').length

  const columns = [
    { key: 'student', label: 'Student',
      render: (v) => (
        <div>
          <p className="font-medium text-sm">{v?.full_name}</p>
          <p className="text-xs text-gray-400 capitalize">{v?.ward?.replace(/_/g,' ')}</p>
        </div>
      )
    },
    { key: 'scheme', label: 'Scheme',
      render: (v) => (
        <div>
          <p className="text-sm text-gray-700 truncate max-w-[180px]">{v?.name}</p>
          <Badge label={v?.award_type} type={v?.award_type} />
        </div>
      )
    },
    { key: 'scheme', label: 'Amount',
      render: (v) => `₦${Number(v?.award_amount||0).toLocaleString()}`
    },
    { key: 'status', label: 'Status',
      render: v => <Badge label={v.replace(/_/g,' ')} type={v} />
    },
    { key: 'has_conflict', label: 'Conflict',
      render: v => v ? <Badge label="Yes" type="double_dip_flag" /> : '—'
    },
    { key: 'eligibility_passed', label: 'Eligible',
      render: v => v === null ? '—' : v
        ? <Badge label="Yes" type="approved" />
        : <Badge label="No"  type="rejected" />
    },
    { key: 'submission_date', label: 'Submitted',
      render: v => v ? new Date(v).toLocaleDateString() : '—'
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Applications</h1>
            <p className="text-sm text-gray-500 mt-1">
              {data?.count ?? applications.length} applications total
            </p>
          </div>
        </div>

        {/* Conflict alert */}
        {flagged > 0 && !status && (
          <Alert type="conflict" title={`${flagged} conflict-flagged applications need review`} className="mb-6">
            <button onClick={() => setStatus('double_dip_flag')}
              className="underline font-medium text-sm mt-1">
              Filter to show flagged only →
            </button>
          </Alert>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 flex flex-wrap gap-3">
          <Input placeholder="Search student name..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[180px]" />

          <select value={status} onChange={e => setStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[160px]">
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <select value={awardType} onChange={e => setAwardType(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All types</option>
            <option value="scholarship">Scholarship</option>
            <option value="vocational">Vocational</option>
          </select>

          {(status || search || awardType) && (
            <button onClick={() => { setStatus(''); setSearch(''); setAwardType('') }}
              className="text-sm text-gray-400 hover:text-gray-600 px-2">
              Clear filters
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <Card>
            <Table
              columns={columns}
              data={applications}
              onRowClick={row => navigate(`/admin/applications/${row.id}`)}
              emptyMessage="No applications found"
            />
          </Card>
        )}
      </div>
    </div>
  )
}
