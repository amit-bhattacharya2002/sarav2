'use client'

import { useDrag } from 'react-dnd'
import { useState } from 'react'
import { Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BarGraph } from './bar-graph'
import { PieGraph } from './pie-chart'
import { FullscreenResultsModal } from "./fullscreen-results-modal"

interface DraggableChartProps {
  data: { name: string; value: number }[]
  type?: 'chart' | 'pie'
  sql?: string
  columns?: { key: string; name: string }[]
  showExpandButton?: boolean
}

export function DraggableChart({
  data,
  type = 'chart',
  sql,
  columns = [],
  showExpandButton = true,
}: DraggableChartProps) {
  const [fullscreenModalOpen, setFullscreenModalOpen] = useState(false)
  const [startInFullscreen, setStartInFullscreen] = useState(false)

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
    <>
      <div ref={drag as any} style={{ opacity: isDragging ? 0.5 : 1 }} className="relative h-full w-full">
        {/* Expand Button - only show if showExpandButton is true */}
        {showExpandButton && (
          <div className="absolute top-2 right-2 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStartInFullscreen(true)
                setFullscreenModalOpen(true)
              }}
              className="h-8 w-8 p-0 bg-background/80 backdrop-blur-sm"
              title="Open in full screen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        
        {type === 'pie' ? (
          <PieGraph data={data} />
        ) : (
          <BarGraph data={data} />
        )}
      </div>

      {/* Fullscreen Modal */}
      <FullscreenResultsModal
        open={fullscreenModalOpen}
        onOpenChange={(open) => {
          setFullscreenModalOpen(open)
          if (!open) {
            setStartInFullscreen(false)
          }
        }}
        data={data.map(item => ({ [columns[0]?.key || 'name']: item.name, [columns[1]?.key || 'value']: item.value }))}
        columns={columns}
        outputMode={type}
        sql={sql}
        title="Chart Results - Full Screen"
        startInFullscreen={startInFullscreen}
      />
    </>
  )
}
