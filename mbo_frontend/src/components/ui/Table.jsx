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