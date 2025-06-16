'use client'

import { useDrag } from 'react-dnd'
import { PieGraph } from './pie-chart'

interface DraggablePieChartProps {
  data: { name: string; value: number }[]
  height?: number
  sql?: string
  columns?: { key: string; name: string }[]
}

export function DraggablePieChart({
  data,
  height = 200,
  sql,
  columns = [],
}: DraggablePieChartProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'visualization',
    item: {
      id: `viz-${Date.now()}`,
      type: 'pie',
      title: 'Query Result',
      data,
      columns,
      color: 'hsl(var(--chart-4))',
      sql,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [data, sql, columns])

  return (
    <div ref={drag} style={{ opacity: isDragging ? 0.5 : 1 }}>
      <PieGraph data={data} height={height} />
    </div>
  )
}
