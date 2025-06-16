'use client'

import { useDrag } from 'react-dnd'

interface TableViewProps {
  data: any[]
  columns: { key: string; name: string }[]
  height?: number
  compact?: boolean
  outputMode?: string // ✅ track whether it's a table or chart
  sql?: string        // <-- ADD THIS LINE
}

export function TableView({
  data,
  columns,
  height = 200,
  compact = false,
  outputMode = 'table',
  sql,                // <-- ADD THIS LINE
}: TableViewProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'visualization',
    item: {
      id: `viz-${Date.now()}`,
      type: outputMode,
      title: 'Query Result',
      data,
      columns,
      color: 'hsl(var(--chart-4))',
      sql,              // <-- ADD THIS LINE
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [data, columns, outputMode, sql]) // <-- include sql as dependency

  return (
    <div ref={drag} className="h-full w-full overflow-auto cursor-move" style={{ opacity: isDragging ? 0.5 : 1 }}>
      <table className={`w-full border-collapse ${compact ? "text-xs" : "text-sm"}`}>
        <thead>
          <tr className="bg-muted">
            {columns.map((col, i) => {
              const readableName = col.name
                .replace(/_/g, ' ')              // replace underscores with spaces
                .replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()) // Title Case
              return (
                // <th key={i} className={`${compact ? "p-1" : "p-2"} text-left font-medium sticky top-0 bg-muted z-10`}>
                //   {compact ? readableName.substring(0, 10) : readableName}
                //   {compact && readableName.length > 10 ? "..." : ""}
                // </th>
                <th key={i} className={`${compact ? "p-1" : "p-2"} text-left font-medium sticky top-0 bg-muted z-10`}>
                  {readableName}
                </th>
                
              )
            })}

          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-b hover:bg-muted/50">
              {columns.map((col, j) => {
                const cellValue = row[col.key]
                const displayValue = (() => {
                  if (typeof cellValue === 'number' || (!isNaN(cellValue) && cellValue !== null && cellValue !== '')) {
                    return Math.round(Number(cellValue)).toLocaleString('en-US', { maximumFractionDigits: 0 })
                  }
                  if (typeof cellValue === 'string' && cellValue.match(/^\d{4}-\d{2}-\d{2}T/)) {
                    return new Date(cellValue).toLocaleDateString('en-CA') // e.g., 2024-05-10
                  }
                  if (compact && typeof cellValue === "string" && cellValue.length > 10) {
                    return cellValue.substring(0, 10) + "..."
                  }
                  return cellValue
                })()


                return (
                  <td key={j} className={`${compact ? "p-1" : "p-2"} whitespace-nowrap`}>
                    {displayValue}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
