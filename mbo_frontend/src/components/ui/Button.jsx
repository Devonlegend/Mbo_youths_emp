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