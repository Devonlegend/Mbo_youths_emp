import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { schemeAPI, applicationAPI } from '../../services/api'
import { StudentNav } from '../../components/layout/index'
import { Card, Badge, Button, Alert, Spinner, Select } from '../../components/ui/index'

export default function SchemeList() {
  const queryClient = useQueryClient()
  const [feedback, setFeedback]   = useState({})
  const [typeFilter, setTypeFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['schemes', typeFilter],
    queryFn:  () => schemeAPI.list(typeFilter ? { award_type: typeFilter } : {}).then(r => r.data),
  })

  const applyMutation = useMutation({
    mutationFn: (schemeId) => applicationAPI.submit({ scheme_id: schemeId }),
    onSuccess: (res, schemeId) => {
      const d = res.data
      setFeedback(prev => ({ ...prev, [schemeId]: {
        type:    d.has_conflict ? 'conflict' : d.eligible ? 'success' : 'rejected',
        message: d.message,
        checks:  d.checks,
      }}))
      queryClient.invalidateQueries(['my-applications'])
    },
    onError: (err, schemeId) => {
      setFeedback(prev => ({ ...prev, [schemeId]: {
        type:    'error',
        message: err.response?.data?.error || 'Something went wrong. Try again.',
      }}))
    }
  })

  const schemes = data?.results || data || []

  return (
    <div className="min-h-screen bg-slate-50">
      <StudentNav />
      <div className="max-w-4xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Browse Open Awards</h1>
            <p className="text-sm text-gray-500 mt-1">Scholarships and Vocational Training programmes</p>
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
            <option value="">All types</option>
            <option value="scholarship">Scholarships</option>
            <option value="vocational">Vocational</option>
          </select>
        </div>

        {/* One active award rule notice */}
        <Alert type="info" title="One active award at a time" className="mb-6">
          You may hold only ONE active award simultaneously — whether a scholarship or a vocational
          training award. Applying while holding an active award will flag a conflict which you
          can resolve by submitting a waiver.
        </Alert>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : schemes.length === 0 ? (
          <Card>
            <div className="text-center py-10">
              <p className="text-4xl mb-3">📭</p>
              <p className="text-gray-500">No open awards at the moment</p>
              <p className="text-gray-400 text-sm mt-1">Check back soon for new opportunities</p>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {schemes.map(scheme => {
              const fb       = feedback[scheme.id]
              const isPending = applyMutation.isPending && applyMutation.variables === scheme.id

              return (
                <div key={scheme.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      {/* Title row */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="font-semibold text-gray-800">{scheme.name}</h3>
                        <Badge label={scheme.award_type} type={scheme.award_type} />
                        <Badge label={scheme.provider?.provider_type || 'lga'} type={scheme.provider?.provider_type} />
                      </div>

                      <p className="text-sm text-gray-500 mb-4 leading-relaxed">{scheme.description}</p>

                      {/* Meta row */}
                      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          💰 <strong className="text-gray-700">₦{Number(scheme.award_amount).toLocaleString()}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          🪑 <strong className="text-gray-700">{scheme.remaining_slots}</strong> slots remaining
                        </span>
                        <span className="flex items-center gap-1">
                          📅 Closes <strong className="text-gray-700">{scheme.application_close_date}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          🏢 {scheme.provider?.name}
                        </span>
                      </div>

                      {/* Eligibility summary */}
                      {scheme.eligibility_criteria && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {scheme.eligibility_criteria.min_cgpa && (
                            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                              Min CGPA: {scheme.eligibility_criteria.min_cgpa}
                            </span>
                          )}
                          {scheme.eligibility_criteria.allowed_levels?.length > 0 && (
                            <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                              Levels: {scheme.eligibility_criteria.allowed_levels.join(', ')}
                            </span>
                          )}
                          {scheme.eligibility_criteria.ward_restriction?.length > 0 && (
                            <span className="bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                              Ward restricted
                            </span>
                          )}
                          {scheme.eligibility_criteria.host_community_only && (
                            <span className="bg-yellow-50 text-yellow-700 text-xs px-2 py-0.5 rounded-full">
                              Host communities only
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Apply button */}
                    <div className="shrink-0">
                      {fb ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg ${
                          fb.type === 'success'  ? 'bg-green-100 text-green-800' :
                          fb.type === 'conflict' ? 'bg-orange-100 text-orange-800' :
                          fb.type === 'rejected' ? 'bg-red-100 text-red-800' :
                                                   'bg-gray-100 text-gray-600'
                        }`}>
                          {fb.type === 'success' ? '✓ Applied' :
                           fb.type === 'conflict' ? '⚠ Conflict' :
                           fb.type === 'rejected' ? '✗ Ineligible' : '✗ Error'}
                        </span>
                      ) : (
                        <Button onClick={() => applyMutation.mutate(scheme.id)} disabled={isPending}>
                          {isPending ? 'Applying...' : 'Apply Now'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Feedback panel */}
                  {fb && (
                    <div className={`mt-4 p-3 rounded-lg text-sm ${
                      fb.type === 'success'  ? 'bg-green-50 text-green-800 border border-green-200' :
                      fb.type === 'conflict' ? 'bg-orange-50 text-orange-800 border border-orange-200' :
                      fb.type === 'rejected' ? 'bg-red-50 text-red-800 border border-red-200' :
                                              'bg-gray-50 text-gray-700 border border-gray-200'
                    }`}>
                      <p className="font-medium">{fb.message}</p>
                      {fb.type === 'conflict' && (
                        <p className="mt-1 text-xs">Go to your dashboard to view the application and submit a waiver.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}