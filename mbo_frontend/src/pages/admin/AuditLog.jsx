// src/pages/admin/AuditLog.jsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { auditAPI } from '../../services/api'
import { AdminNav } from '../../components/layout/index'
import { Card, Input, Spinner, Table, Alert } from '../../components/ui/index'

export default function AdminAudit() {
  const [search, setSearch]     = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', search, dateFrom, dateTo],
    queryFn:  () => auditAPI.list({
      ...(search   ? { search }              : {}),
      ...(dateFrom ? { timestamp_after: dateFrom }  : {}),
      ...(dateTo   ? { timestamp_before: dateTo }   : {}),
    }).then(r => r.data),
    keepPreviousData: true,
  })

  const logs = data?.results || data || []

  const columns = [
    { key: 'timestamp', label: 'Time',
      render: v => (
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {new Date(v).toLocaleString()}
        </span>
      )
    },
    { key: 'actor', label: 'User',
      render: v => (
        <div>
          <p className="text-sm font-medium">{v?.email || 'System'}</p>
          <p className="text-xs text-gray-400">{v?.role}</p>
        </div>
      )
    },
    { key: 'action', label: 'Action',
      render: v => (
        <code className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-700">{v}</code>
      )
    },
    { key: 'target_model', label: 'Target', render: v => v || '—' },
    { key: 'ip_address',   label: 'IP',     render: v => (
      <span className="text-xs text-gray-400">{v || '—'}</span>
    )},
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            Immutable record of all admin actions — NDPA 2023 compliance
          </p>
        </div>

        <Alert type="info" title="NDPA compliance record" className="mb-6">
          This log is append-only. No record can be edited or deleted. All access to student data,
          application reviews, and disbursement authorizations are recorded here permanently.
        </Alert>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 mb-6 flex flex-wrap gap-3">
          <Input placeholder="Search action or email..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px]" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white" />
          </div>
          {(search || dateFrom || dateTo) && (
            <button onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }}
              className="text-sm text-gray-400 hover:text-gray-600 px-2">
              Clear
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <Card subtitle={`${data?.count ?? logs.length} log entries`}>
            <Table
              columns={columns}
              data={logs}
              emptyMessage="No audit entries found"
            />
          </Card>
        )}
      </div>
    </div>
  )
}
