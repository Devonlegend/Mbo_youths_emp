// ============================================================
// src/pages/student/Dashboard.jsx
// ============================================================
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import useAuthStore from '../../store/authStore'
import { applicationAPI } from '../../services/api'
import { StudentNav } from '../../components/layout/index'
import { Card, Badge, StatCard, Alert, Spinner } from '../../components/ui/index'

export default function StudentDashboard() {
  const { user } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['my-applications'],
    queryFn:  () => applicationAPI.myList().then(r => r.data),
  })

  const applications = data?.results || data || []
  const approved  = applications.filter(a => a.status === 'approved').length
  const flagged   = applications.filter(a => a.status === 'double_dip_flag').length
  const pending   = applications.filter(a =>
    ['submitted','document_review','shortlisted','eligibility_check'].includes(a.status)
  ).length

  return (
    <div className="min-h-screen bg-slate-50">
      <StudentNav />
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-800">Welcome back</h1>
          <p className="text-gray-500 text-sm mt-1">
            Track your scholarship and vocational award applications below.
          </p>
        </div>

        {/* Conflict alert */}
        {flagged > 0 && (
          <Alert type="conflict" title={`${flagged} application(s) flagged — action required`} className="mb-6">
            You have a multiple award conflict. Click the flagged application to review and submit a waiver.
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Applications" value={applications.length} icon="📋" />
          <StatCard label="Approved Awards"    value={approved} color="text-green-700" icon="✓" />
          <StatCard label="Under Review"       value={pending}  color="text-blue-700"  icon="🔍" />
          <StatCard label="Needs Attention"    value={flagged}  color="text-orange-600" icon="⚠" />
        </div>

        {/* Applications */}
        <Card title="Your Applications" subtitle="Click any application to view full details">
          {isLoading ? (
            <div className="flex justify-center py-8"><Spinner size="lg" /></div>
          ) : applications.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-4xl mb-3">🎓</p>
              <p className="text-gray-500 font-medium">No applications yet</p>
              <p className="text-gray-400 text-sm mt-1">Browse open awards and apply today</p>
              <Link to="/student/schemes"
                className="mt-4 inline-block text-blue-900 text-sm font-medium hover:underline">
                Browse awards →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-50">
              {applications.map(app => (
                <Link key={app.id} to={`/student/applications/${app.id}`}
                  className="flex items-center justify-between py-4 hover:bg-slate-50 rounded-lg px-2 transition -mx-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm truncate">{app.scheme?.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge label={app.scheme?.award_type === 'vocational' ? '🔧 Vocational' : '🎓 Scholarship'}
                        type={app.scheme?.award_type} />
                      <span className="text-xs text-gray-400">
                        ₦{Number(app.scheme?.award_amount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <Badge label={app.status.replace(/_/g,' ')} type={app.status} />
                    <span className="text-gray-300">›</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {[
            { to: '/student/schemes',  label: 'Browse Awards',    icon: '🔍' },
            { to: '/student/verify',   label: 'Verify NIN',       icon: '🪪' },
            { to: '/student/bank',     label: 'Bank Details',     icon: '🏦' },
            { to: '/student/profile',  label: 'My Profile',       icon: '👤' },
          ].map(l => (
            <Link key={l.to} to={l.to}
              className="bg-white border border-gray-100 rounded-xl p-4 text-center hover:shadow-sm hover:border-blue-200 transition">
              <p className="text-2xl mb-2">{l.icon}</p>
              <p className="text-sm font-medium text-gray-700">{l.label}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}