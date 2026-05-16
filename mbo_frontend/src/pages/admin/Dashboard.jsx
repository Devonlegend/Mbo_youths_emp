// src/pages/admin/Dashboard.jsx
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { studentAPI, applicationAPI } from '../../services/api'
import { AdminNav } from '../../components/layout/index'
import { Card, StatCard, Alert, Badge, Spinner } from '../../components/ui/index'

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['student-stats'],
    queryFn:  () => studentAPI.stats().then(r => r.data),
  })
  const { data: appsData } = useQuery({
    queryKey: ['all-applications-summary'],
    queryFn:  () => applicationAPI.list({ page_size: 100 }).then(r => r.data),
  })
  const { data: flaggedData } = useQuery({
    queryKey: ['flagged-applications'],
    queryFn:  () => applicationAPI.flagged().then(r => r.data),
  })

  const apps    = appsData?.results || appsData || []
  const flagged = flaggedData?.results || flaggedData || []
  const approved = apps.filter(a => a.status === 'approved').length
  const pending  = apps.filter(a => ['submitted','document_review','shortlisted'].includes(a.status)).length

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Mbo LGA Universal Award Portal — overview</p>
        </div>

        {/* Conflict alert */}
        {flagged.length > 0 && (
          <Alert type="conflict" title={`${flagged.length} application(s) require admin review`} className="mb-6">
            These applications have been flagged for multiple award conflicts.{' '}
            <Link to="/admin/applications?status=double_dip_flag" className="underline font-medium">
              Review now →
            </Link>
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Students"    value={stats?.total_students ?? '—'}    icon="👥" />
          <StatCard label="Verified"          value={stats?.verified ?? '—'}          icon="✓"  color="text-green-700" />
          <StatCard label="With Active Award" value={stats?.with_active_award ?? '—'} icon="🏆" color="text-blue-700" />
          <StatCard label="Conflict Flags"    value={flagged.length}                  icon="⚠"  color="text-orange-600" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <StatCard label="Total Applications" value={apps.length}  icon="📋" />
          <StatCard label="Approved"           value={approved}     icon="✓"  color="text-green-700" />
          <StatCard label="Pending Review"     value={pending}      icon="🔍" color="text-blue-700" />
        </div>

        {/* Ward breakdown */}
        {stats?.by_ward && (
          <Card title="Students by Ward" className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(stats.by_ward).map(([ward, count]) => (
                <div key={ward} className="bg-slate-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-blue-900">{count}</p>
                  <p className="text-xs text-gray-500 mt-1 capitalize">{ward.replace(/_/g,' ')}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { to: '/admin/students',      label: 'Manage Students',   icon: '👥' },
            { to: '/admin/schemes',       label: 'Manage Schemes',    icon: '📚' },
            { to: '/admin/applications',  label: 'All Applications',  icon: '📋' },
            { to: '/admin/disbursements', label: 'Disbursements',     icon: '💳' },
          ].map(l => (
            <Link key={l.to} to={l.to}
              className="bg-white border border-gray-100 rounded-xl p-5 text-center hover:shadow-sm hover:border-blue-200 transition">
              <p className="text-3xl mb-2">{l.icon}</p>
              <p className="text-sm font-medium text-gray-700">{l.label}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}