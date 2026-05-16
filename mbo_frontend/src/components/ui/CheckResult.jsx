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