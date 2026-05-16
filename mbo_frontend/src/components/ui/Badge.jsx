export function Badge({ label, type = '' }) {
  const map = {
    submitted:        'bg-blue-100 text-blue-800',
    approved:         'bg-green-100 text-green-800',
    rejected:         'bg-red-100 text-red-800',
    double_dip_flag:  'bg-orange-100 text-orange-800',
    waiver_required:  'bg-yellow-100 text-yellow-800',
    draft:            'bg-gray-100 text-gray-500',
    shortlisted:      'bg-purple-100 text-purple-800',
    document_review:  'bg-indigo-100 text-indigo-800',
    withdrawn:        'bg-gray-100 text-gray-400',
    scholarship:      'bg-blue-100 text-blue-800',
    vocational:       'bg-teal-100 text-teal-800',
    lga:              'bg-blue-100 text-blue-800',
    state:            'bg-purple-100 text-purple-800',
    corporate:        'bg-yellow-100 text-yellow-800',
    ngo:              'bg-green-100 text-green-800',
    open:             'bg-green-100 text-green-800',
    closed:           'bg-gray-100 text-gray-500',
    draft_scheme:     'bg-yellow-100 text-yellow-800',
  }
  const colour = map[type] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${colour}`}>
      {label}
    </span>
  )
}