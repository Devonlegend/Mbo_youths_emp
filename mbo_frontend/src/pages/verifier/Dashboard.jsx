// src/pages/verifier/Dashboard.jsx
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { studentAPI } from '../../services/api'
import { AdminNav } from '../../components/layout/index'
import { Card, Badge, StatCard, Spinner, Table } from '../../components/ui/index'

export default function VerifierDashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['pending-verification'],
    queryFn:  () => studentAPI.list({ is_verified: 'false' }).then(r => r.data),
  })

  const students = data?.results || data || []

  const columns = [
    { key: 'full_name', label: 'Student',
      render: (v, row) => (
        <div>
          <p className="font-medium text-sm">{v}</p>
          <p className="text-xs text-gray-400">{row.user?.email}</p>
        </div>
      )
    },
    { key: 'ward', label: 'Ward',
      render: v => <span className="capitalize">{v?.replace(/_/g,' ')}</span>
    },
    { key: 'nimc_verified', label: 'NIN',
      render: v => <Badge label={v ? 'Verified' : 'Pending'} type={v ? 'approved' : 'rejected'} />
    },
    { key: 'physical_verified', label: 'Physical Check',
      render: v => <Badge label={v ? 'Done' : 'Needed'} type={v ? 'approved' : 'draft'} />
    },
    { key: 'residency_certificate_url', label: 'Residency Doc',
      render: v => v
        ? <a href={v} target="_blank" rel="noreferrer" className="text-blue-900 text-xs underline">View</a>
        : '—'
    },
    { key: 'created_at', label: 'Registered',
      render: v => v ? new Date(v).toLocaleDateString() : '—'
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800">Verification Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            Students awaiting physical document verification
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <StatCard label="Pending Verification" value={students.length} icon="🔍" color="text-orange-600" />
          <StatCard label="Verified Today"       value="—" icon="✓" color="text-green-700" />
          <StatCard label="Your Queue"           value={students.length} icon="📋" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <Card title="Students Pending Verification">
            <Table
              columns={columns}
              data={students}
              onRowClick={row => navigate(`/verifier/students/${row.id}`)}
              emptyMessage="No students pending verification — queue is clear ✓"
            />
          </Card>
        )}
      </div>
    </div>
  )
}
