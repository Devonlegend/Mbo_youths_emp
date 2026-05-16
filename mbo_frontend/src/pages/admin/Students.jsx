// src/pages/admin/Students.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { studentAPI } from '../../services/api'
import { AdminNav } from '../../components/layout/index'
import { Card, Badge, Input, Select, Spinner, Table } from '../../components/ui/index'

const WARDS = [
  { value: '', label: 'All Wards' },
  ...['effiat','ewang','ebughu','uda','unyene','ekim','ibiaku','mbo_central','udung_uko','enwang']
    .map(w => ({ value: w, label: w.replace('_',' ').replace(/\b\w/g, l => l.toUpperCase()) }))
]

export default function AdminStudents() {
  const navigate = useNavigate()
  const [search, setSearch]   = useState('')
  const [ward,   setWard]     = useState('')
  const [verified, setVerified] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-students', search, ward, verified],
    queryFn:  () => studentAPI.list({
      ...(search   ? { search }             : {}),
      ...(ward     ? { ward }               : {}),
      ...(verified ? { is_verified: verified } : {}),
    }).then(r => r.data),
    keepPreviousData: true,
  })

  const students = data?.results || data || []

  const columns = [
    { key: 'full_name',   label: 'Name',
      render: (v, row) => (
        <div>
          <p className="font-medium text-gray-800">{v}</p>
          <p className="text-xs text-gray-400">{row.user?.email}</p>
        </div>
      )
    },
    { key: 'ward',        label: 'Ward',
      render: v => <span className="capitalize">{v?.replace(/_/g,' ')}</span>
    },
    { key: 'level',       label: 'Level',
      render: v => v ? `${v} Level` : '—'
    },
    { key: 'cgpa',        label: 'CGPA',
      render: v => v ?? '—'
    },
    { key: 'nimc_verified', label: 'NIN Verified',
      render: v => <Badge label={v ? 'Verified' : 'Pending'} type={v ? 'approved' : 'draft'} />
    },
    { key: 'has_disability', label: 'Disability',
      render: v => v ? <Badge label="Yes" type="vocational" /> : '—'
    },
    { key: 'is_host_community', label: 'Host Comm.',
      render: v => v ? <Badge label="Yes" type="scholarship" /> : '—'
    },
    { key: 'active_award', label: 'Active Award',
      render: v => v
        ? <span className="text-xs text-green-700 font-medium truncate max-w-[120px] block">{v}</span>
        : <span className="text-xs text-gray-400">None</span>
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Students</h1>
            <p className="text-sm text-gray-500 mt-1">
              {data?.count ?? students.length} registered students
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 flex flex-wrap gap-3">
          <Input
            placeholder="Search name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <select value={ward} onChange={e => setWard(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[140px]">
            {WARDS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
          <select value={verified} onChange={e => setVerified(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All statuses</option>
            <option value="true">NIN Verified</option>
            <option value="false">Not Verified</option>
          </select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <Card>
            <Table
              columns={columns}
              data={students}
              onRowClick={row => navigate(`/admin/students/${row.id}`)}
              emptyMessage="No students found matching your filters"
            />
          </Card>
        )}
      </div>
    </div>
  )
}
