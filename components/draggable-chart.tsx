'use client'

import { useDrag } from 'react-dnd'
import { BarGraph } from './bar-graph'
import { PieGraph } from './pie-chart'

interface DraggableChartProps {
  data: { name: string; value: number }[]
  height?: number
  type?: 'chart' | 'pie'
  sql?: string
  columns?: { key: string; name: string }[]
}

export function DraggableChart({
  data,
  height = 200,
  type = 'chart',
  sql,
  columns = [],
}: DraggableChartProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'visualization',
    item: {
      id: `viz-${Date.now()}`,
      type,
      title: 'Query Result',
      data,
      columns,
      color: 'hsl(var(--chart-4))',
      sql,
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [data, type, sql, columns])

  return (
    <div ref={drag} style={{ opacity: isDragging ? 0.5 : 1 }}>
      {type === 'pie' ? (
        <PieGraph data={data} height={height} />
      ) : (
        <BarGraph data={data} height={height} />
      )}
    </div>
  )
}
