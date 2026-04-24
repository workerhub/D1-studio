type Props = {
  columns: string[];
  rows: unknown[][];
  rowsAffected: number;
  isSelect: boolean;
  executionTime: number;
};

export default function ResultsTable({ columns, rows, rowsAffected, isSelect, executionTime }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
        <span>{isSelect ? `${rowsAffected} row(s)` : `${rowsAffected} row(s) affected`}</span>
        <span>·</span>
        <span>{executionTime}ms</span>
      </div>
      <div className="overflow-auto flex-1">
        {isSelect && columns.length > 0 ? (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 sticky top-0">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="border border-gray-200 px-3 py-1.5 text-left font-medium text-gray-700 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className="border border-gray-200 px-3 py-1 text-gray-800 whitespace-nowrap max-w-xs truncate"
                      title={String(cell ?? '')}
                    >
                      {cell === null ? <span className="text-gray-400 italic">NULL</span> : String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          !isSelect && (
            <div className="p-4 text-sm text-gray-500">
              {rowsAffected} row(s) affected in {executionTime}ms
            </div>
          )
        )}
      </div>
    </div>
  );
}
