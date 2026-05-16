// src/components/ui/Button.jsx
export function Button({ children, onClick, type = 'button',
  variant = 'primary', disabled = false, className = '', size = 'md' }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' }
  const variants = {
    primary:  'bg-blue-900 text-white hover:bg-blue-800',
    secondary:'bg-gray-100 text-gray-800 hover:bg-gray-200',
    danger:   'bg-red-600  text-white hover:bg-red-700',
    success:  'bg-green-700 text-white hover:bg-green-600',
    outline:  'border border-blue-900 text-blue-900 hover:bg-blue-50',
    ghost:    'text-gray-600 hover:bg-gray-100',
    gold:     'bg-yellow-500 text-blue-900 hover:bg-yellow-400 font-bold',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}

// src/components/ui/Card.jsx
export function Card({ children, className = '', title, subtitle }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${className}`}>
      {(title || subtitle) && (
        <div className="px-6 py-4 border-b border-gray-100">
          {title    && <h2 className="font-semibold text-gray-800">{title}</h2>}
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  )
}

// src/components/ui/Badge.jsx
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

// src/components/ui/Input.jsx
export function Input({ label, error, hint, className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        className={`border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900 transition
          ${error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'}`}
        {...props}
      />
      {hint  && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// src/components/ui/Select.jsx
export function Select({ label, error, options = [], className = '', ...props }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <select
        className={`border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900 bg-white transition
          ${error ? 'border-red-400' : 'border-gray-300'}`}
        {...props}
      >
        <option value="">Select...</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// src/components/ui/Spinner.jsx
export function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
  return (
    <div className={`${sizes[size]} border-2 border-gray-200 border-t-blue-900 rounded-full animate-spin ${className}`} />
  )
}

// src/components/ui/Alert.jsx
export function Alert({ type = 'info', title, children, className = '' }) {
  const styles = {
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error:   'bg-red-50 border-red-200 text-red-800',
    conflict:'bg-orange-50 border-orange-200 text-orange-800',
  }
  const icons = {
    info: 'ℹ', success: '✓', warning: '⚠', error: '✗', conflict: '⚠'
  }
  return (
    <div className={`border rounded-xl p-4 ${styles[type]} ${className}`}>
      {title && <p className="font-semibold text-sm mb-1">{icons[type]} {title}</p>}
      <div className="text-sm">{children}</div>
    </div>
  )
}

// src/components/ui/Modal.jsx
export function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">{footer}</div>}
      </div>
    </div>
  )
}

// src/components/ui/Table.jsx
export function Table({ columns, data, onRowClick, emptyMessage = 'No records found' }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-100">
            {columns.map(col => (
              <th key={col.key} className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="text-center py-8 text-gray-400">{emptyMessage}</td></tr>
          ) : data.map((row, i) => (
            <tr key={row.id || i}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-gray-50 transition ${onRowClick ? 'cursor-pointer hover:bg-blue-50' : ''}`}>
              {columns.map(col => (
                <td key={col.key} className="px-4 py-3 text-gray-700">
                  {col.render ? col.render(row[col.key], row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// src/components/ui/StatCard.jsx
export function StatCard({ label, value, sub, color = 'text-blue-900', icon }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
          <p className="text-sm text-gray-500 mt-1">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
    </div>
  )
}

// src/components/ui/CheckResult.jsx — shows one eligibility check result
export function CheckResult({ label, passed, detail }) {
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${passed ? 'bg-green-50' : 'bg-red-50'}`}>
      <span className={`text-lg leading-none mt-0.5 ${passed ? 'text-green-600' : 'text-red-500'}`}>
        {passed ? '✓' : '✗'}
      </span>
      <div>
        <p className={`text-sm font-medium ${passed ? 'text-green-800' : 'text-red-800'}`}>{label}</p>
        {detail && <p className="text-xs text-gray-500 mt-0.5">{detail}</p>}
      </div>
    </div>
  )
}