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