'use client'

import { useDrag } from 'react-dnd'
import { useState, useEffect } from 'react'
import { Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FullscreenResultsModal } from "./fullscreen-results-modal"

interface TableViewProps {
  data: any[]
  columns: { key: string; name: string }[]
  height?: number
  compact?: boolean
  outputMode?: string // ✅ track whether it's a table or chart
  sql?: string        // <-- ADD THIS LINE
  hideExpandButton?: boolean // Add this prop to hide expand button in modal
}

export function TableView({
  data,
  columns,
  height = 200,
  compact = false,
  outputMode = 'table',
  sql,                // <-- ADD THIS LINE
  hideExpandButton = false, // Add this prop
}: TableViewProps) {
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(columns.map(col => col.key)))
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [columnOrder, setColumnOrder] = useState<string[]>(columns.map(col => col.key))
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [fullscreenModalOpen, setFullscreenModalOpen] = useState(false)
  const [startInFullscreen, setStartInFullscreen] = useState(false)

  // Initialize selected columns and order when columns change
  useEffect(() => {
    setSelectedColumns(new Set(columns.map(col => col.key)))
    setColumnOrder(columns.map(col => col.key))
  }, [columns])

  const toggleColumn = (columnKey: string) => {
    setSelectedColumns(prev => {
      const newSet = new Set(prev)
      if (newSet.has(columnKey)) {
        newSet.delete(columnKey)
      } else {
        newSet.add(columnKey)
      }
      return newSet
    })
  }

  const toggleAllColumns = () => {
    if (selectedColumns.size === columns.length) {
      setSelectedColumns(new Set())
    } else {
      setSelectedColumns(new Set(columns.map(col => col.key)))
    }
  }

  // Handle column reordering
  const handleColumnDragStart = (e: React.DragEvent, columnKey: string) => {
    e.stopPropagation() // Prevent triggering table drag
    setDraggedColumn(columnKey)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent triggering table drag
    e.dataTransfer.dropEffect = 'move'
  }

  const handleColumnDrop = (e: React.DragEvent, targetColumnKey: string) => {
    e.preventDefault()
    e.stopPropagation() // Prevent triggering table drag
    if (!draggedColumn || draggedColumn === targetColumnKey) return

    setColumnOrder(prev => {
      const newOrder = [...prev]
      const draggedIndex = newOrder.indexOf(draggedColumn)
      const targetIndex = newOrder.indexOf(targetColumnKey)
      
      // Remove dragged item from its current position
      newOrder.splice(draggedIndex, 1)
      // Insert dragged item at target position
      newOrder.splice(targetIndex, 0, draggedColumn)
      
      return newOrder
    })
    setDraggedColumn(null)
  }

  const handleColumnDragEnd = (e: React.DragEvent) => {
    e.stopPropagation() // Prevent triggering table drag
    setDraggedColumn(null)
  }

  // Filter and order columns based on selection and order
  const visibleColumns = columnOrder
    .map(key => columns.find(col => col.key === key))
    .filter((col): col is { key: string; name: string } => col !== undefined && selectedColumns.has(col.key))

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'visualization',
    item: {
      id: `viz-${Date.now()}`,
      type: outputMode,
      title: 'Query Result',
      data,
      columns, // Always use all columns for the data, not just visible ones
      color: 'hsl(var(--chart-4))',
      sql,              // <-- ADD THIS LINE
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [data, columns, outputMode, sql]) // Use all columns, not just visible ones

  const handleExpandClick = () => {
    setStartInFullscreen(true)
    setFullscreenModalOpen(true)
  }

  const handleModalClose = (open: boolean) => {
    setFullscreenModalOpen(open)
    if (!open) {
      setStartInFullscreen(false)
    }
  }

  return (
    <>
      <div ref={drag as any} className="h-full w-full cursor-move flex flex-col" style={{ opacity: isDragging ? 0.5 : 1 }}>
        {/* Header with Expand Button */}
        <div className="flex items-center justify-between mb-2 p-2 bg-muted/20 rounded border border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowColumnSelector(!showColumnSelector)}
              className="text-sm font-mono font-medium text-primary hover:underline"
            >
              {showColumnSelector ? "▼ Hide" : "▶ Show"} Column Selector
            </button>
            <button
              onClick={toggleAllColumns}
              className="text-xs font-mono text-muted-foreground hover:text-foreground"
            >
              {selectedColumns.size === columns.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          {!hideExpandButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExpandClick}
              className="h-8 w-8 p-0"
              title="Open in full screen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {showColumnSelector && (
          <div className="mb-2 p-2 bg-muted/20 rounded border border-border flex-shrink-0">
            <div className="grid grid-cols-2 gap-2">
              {columns.map((col) => {
                const readableName = col.name
                  .replace(/_/g, ' ')
                  .replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase())
                
                return (
                  <label key={col.key} className="flex items-center gap-2 text-sm font-mono cursor-pointer hover:bg-muted/50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={selectedColumns.has(col.key)}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded"
                    />
                    <span className="truncate">{readableName}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* Table - Scrollable area with dynamic height */}
        <div className="flex-1 overflow-auto min-h-0">
          <table className={`border-collapse ${compact ? "text-xs" : "text-sm"}`} style={{ minWidth: 'max-content' }}>
            <thead>
              <tr className="bg-muted">
                {visibleColumns.map((col, i) => {
                  const readableName = col.name
                    .replace(/_/g, ' ')              // replace underscores with spaces
                    .replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()) // Title Case
                  return (
                    <th 
                      key={col.key} 
                      className={`${compact ? "p-1" : "p-2"} text-left font-medium sticky top-0 bg-muted z-10 border-b border-border tracking-normal cursor-move select-none ${
                        draggedColumn === col.key ? 'opacity-50' : ''
                      }`}
                      draggable
                      onDragStart={(e) => handleColumnDragStart(e, col.key)}
                      onDragOver={handleColumnDragOver}
                      onDrop={(e) => handleColumnDrop(e, col.key)}
                      onDragEnd={handleColumnDragEnd}
                      title="Drag to reorder column"
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">⋮⋮</span>
                        {readableName}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b hover:bg-muted/50">
                  {visibleColumns.map((col, j) => {
                    const cellValue = row[col.key]
                    const displayValue = (() => {
                      // Handle nested objects (like _id containing {constituentId, name})
                      if (typeof cellValue === 'object' && cellValue !== null) {
                        if (cellValue.name) {
                          return cellValue.name
                        }
                        if (cellValue.constituentId) {
                          return cellValue.constituentId
                        }
                        return JSON.stringify(cellValue)
                      }
                      
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
                      <td key={j} className={`${compact ? "p-1" : "p-2"} whitespace-nowrap border-r border-border/20`}>
                        {displayValue}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fullscreen Modal */}
      {!hideExpandButton && (
        <FullscreenResultsModal
          open={fullscreenModalOpen}
          onOpenChange={handleModalClose}
          data={data}
          columns={columns}
          outputMode={outputMode}
          sql={sql}
          title="Query Results - Full Screen"
          startInFullscreen={startInFullscreen}
        />
      )}
    </>
  )
}
