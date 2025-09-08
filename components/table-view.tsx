'use client'

import { useDrag } from 'react-dnd'
import { useState, useEffect, useRef, useMemo } from 'react'
import { Maximize2, Filter, ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FullscreenResultsModal } from "./fullscreen-results-modal"

interface TableViewProps {
  data: any[]
  columns: { key: string; name: string }[]
  height?: number
  compact?: boolean
  outputMode?: string // ✅ track whether it's a table or chart
  sql?: string        // <-- ADD THIS LINE
  hideExpandButton?: boolean // Add this prop to hide expand button in modal
  readOnlyMode?: boolean // Add this prop to control dragging behavior
  onColumnOrderChange?: (reorderedColumns: { key: string; name: string }[]) => void // Add callback for column order changes
  inDashboard?: boolean // Add this prop to indicate if table is in a dashboard
  // External sorting control
  externalSortColumn?: string | null
  externalSortDirection?: 'asc' | 'desc' | null
  onSortChange?: (column: string | null, direction: 'asc' | 'desc' | null) => void
}

type SortDirection = 'asc' | 'desc' | null

export function TableView({
  data,
  columns,
  height = 200,
  compact = false,
  outputMode = 'table',
  sql,                // <-- ADD THIS LINE
  hideExpandButton = false, // Add this prop
  readOnlyMode = false, // Add this prop
  onColumnOrderChange, // Add this prop
  inDashboard = false, // Add this prop
  externalSortColumn = null,
  externalSortDirection = null,
  onSortChange,
}: TableViewProps) {
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(columns.map(col => col.key)))
  const [columnOrder, setColumnOrder] = useState<string[]>(columns.map(col => col.key))
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [fullscreenModalOpen, setFullscreenModalOpen] = useState(false)
  const [startInFullscreen, setStartInFullscreen] = useState(false)
  const [isColumnSelectorModalOpen, setIsColumnSelectorModalOpen] = useState(false)
  const lastColumnOrderRef = useRef<string[]>(columns.map(col => col.key))
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Initialize selected columns and order when columns change
  useEffect(() => {
    setSelectedColumns(new Set(columns.map(col => col.key)))
    setColumnOrder(columns.map(col => col.key))
  }, [columns])

  // Reset sorting when data changes significantly
  useEffect(() => {
    setSortColumn(null)
    setSortDirection('asc')
  }, [data])

  // Handle external sorting control
  useEffect(() => {
    if (externalSortColumn !== undefined && externalSortDirection !== undefined) {
      setSortColumn(externalSortColumn)
      setSortDirection(externalSortDirection)
    }
  }, [externalSortColumn, externalSortDirection])

  // Filter and order columns based on selection and order
  const visibleColumns = columnOrder
    .map(key => columns.find(col => col.key === key))
    .filter((col): col is { key: string; name: string } => col !== undefined && selectedColumns.has(col.key))

  // Sort data based on current sort state
  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) {
      return data
    }

    return [...data].sort((a, b) => {
      const aValue = a[sortColumn]
      const bValue = b[sortColumn]

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return sortDirection === 'asc' ? -1 : 1
      if (bValue === null || bValue === undefined) return sortDirection === 'asc' ? 1 : -1

      // Handle nested objects (like _id containing {constituentId, name})
      let aDisplayValue = aValue
      let bDisplayValue = bValue
      
      if (typeof aValue === 'object' && aValue !== null) {
        aDisplayValue = aValue.name || aValue.constituentId || JSON.stringify(aValue)
      }
      if (typeof bValue === 'object' && bValue !== null) {
        bDisplayValue = bValue.name || bValue.constituentId || JSON.stringify(bValue)
      }

      // Handle numbers and numeric strings
      const aNum = parseFloat(aDisplayValue)
      const bNum = parseFloat(bDisplayValue)
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
      }

      // Handle strings (including date strings)
      const aString = String(aDisplayValue).toLowerCase()
      const bString = String(bDisplayValue).toLowerCase()
      
      if (aString < bString) return sortDirection === 'asc' ? -1 : 1
      if (aString > bString) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortColumn, sortDirection])

  // Handle column sorting
  const handleColumnSort = (columnKey: string) => {
    let newSortColumn: string | null = null
    let newSortDirection: 'asc' | 'desc' | null = 'asc'
    
    if (sortColumn === columnKey) {
      // Toggle direction if same column
      if (sortDirection === 'asc') {
        newSortDirection = 'desc'
        newSortColumn = columnKey
      } else if (sortDirection === 'desc') {
        newSortColumn = null
        newSortDirection = 'asc'
      }
    } else {
      // New column, start with ascending
      newSortColumn = columnKey
      newSortDirection = 'asc'
    }
    
    // Update internal state
    setSortColumn(newSortColumn)
    setSortDirection(newSortDirection)
    
    // Notify parent component if callback provided
    if (onSortChange) {
      onSortChange(newSortColumn, newSortDirection)
    }
  }

  // Get sort icon for a column
  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) return null
    return sortDirection === 'asc' ? 
      <ChevronUp className="h-4 w-4 text-primary" /> : 
      <ChevronDown className="h-4 w-4 text-primary" />
  }

  // Create a stable ID based on content and column order
          const stableId = `table-${outputMode}-${JSON.stringify(data).slice(0, 100)}-${JSON.stringify(visibleColumns.map(col => col.key)).slice(0, 50)}-${sql ? sql.slice(0, 50) : 'no-sql'}`
        console.log('🪄 TableView generating stableId:', stableId)
        console.log('🪄 TableView columns prop:', columns)
        console.log('🪄 TableView visibleColumns:', visibleColumns)

  // All hooks must be called before any early returns
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'visualization',
    item: readOnlyMode ? null : {
      id: stableId,
      type: outputMode,
      title: 'Query Result',
      data,
      columns: visibleColumns, // Use reordered visible columns for dragging
      color: 'hsl(var(--chart-4))',
      sql,              // <-- ADD THIS LINE
    },
    canDrag: !readOnlyMode, // Disable dragging in read-only mode
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [stableId, data, visibleColumns, outputMode, sql, readOnlyMode]) // Use visibleColumns instead of columns

  // Early return if no data or columns
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        No data available
      </div>
    );
  }

  if (!columns || !Array.isArray(columns) || columns.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        No columns defined
      </div>
    );
  }

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
    // Disable column reordering for charts and tables in read-only dashboard mode
    if (outputMode === 'chart' || outputMode === 'pie' || (inDashboard && readOnlyMode)) {
      e.preventDefault()
      return
    }
    
    e.stopPropagation() // Prevent triggering table drag
    setDraggedColumn(columnKey)
    e.dataTransfer.effectAllowed = 'move'
  }

  // Handle column click for sorting (prevented during drag)
  const handleColumnClick = (e: React.MouseEvent, columnKey: string) => {
    // Don't sort if we're dragging
    if (draggedColumn) {
      return
    }
    
    e.preventDefault()
    e.stopPropagation()
    handleColumnSort(columnKey)
  }

  const handleColumnDragOver = (e: React.DragEvent) => {
    // Disable column reordering for charts and tables in read-only dashboard mode
    if (outputMode === 'chart' || outputMode === 'pie' || (inDashboard && readOnlyMode)) {
      e.preventDefault()
      return
    }
    
    e.preventDefault()
    e.stopPropagation() // Prevent triggering table drag
    e.dataTransfer.dropEffect = 'move'
  }

  const handleColumnDrop = (e: React.DragEvent, targetColumnKey: string) => {
    // Disable column reordering for charts and tables in read-only dashboard mode
    if (outputMode === 'chart' || outputMode === 'pie' || (inDashboard && readOnlyMode)) {
      e.preventDefault()
      return
    }
    
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

  // Call the callback when column order changes - only when order actually changes
  useEffect(() => {
    // Disable column reordering for charts and tables in read-only dashboard mode
    if (outputMode === 'chart' || outputMode === 'pie' || (inDashboard && readOnlyMode)) {
      return
    }
    
    if (onColumnOrderChange && columnOrder.length > 0) {
      // Check if the order has actually changed from the last time we called the callback
      const hasOrderChanged = columnOrder.length !== lastColumnOrderRef.current.length ||
        columnOrder.some((key, index) => key !== lastColumnOrderRef.current[index])
      
      if (hasOrderChanged) {
        const reorderedColumns = columnOrder
          .map(key => columns.find(col => col.key === key))
          .filter((col): col is { key: string; name: string } => col !== undefined)
        
        onColumnOrderChange(reorderedColumns)
        lastColumnOrderRef.current = [...columnOrder]
      }
    }
  }, [columnOrder, columns, onColumnOrderChange, outputMode, inDashboard, readOnlyMode])

  const handleColumnDragEnd = (e: React.DragEvent) => {
    // Disable column reordering for charts and tables in read-only dashboard mode
    if (outputMode === 'chart' || outputMode === 'pie' || (inDashboard && readOnlyMode)) {
      e.preventDefault()
      return
    }
    
    e.stopPropagation() // Prevent triggering table drag
    setDraggedColumn(null)
  }

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
      <div 
        ref={readOnlyMode ? undefined : (drag as any)} 
        className={`h-full w-full flex flex-col ${readOnlyMode ? '' : 'cursor-move'}`} 
        style={{ opacity: isDragging ? 0.5 : 1 }}
      >
        {/* Header with Column Selector and Expand Button */}
        <div className="flex items-center justify-between mb-2 p-2 bg-muted/20 rounded border border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <Dialog open={isColumnSelectorModalOpen} onOpenChange={setIsColumnSelectorModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  <span>Columns</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Table Column Selection</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium">Select columns to display:</span>
                    <button
                      onClick={toggleAllColumns}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      {selectedColumns.size === columns.length ? "Deselect All" : "Select All"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                    {columns.map((col) => {
                      return (
                        <label key={col.key} className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={selectedColumns.has(col.key)}
                            onChange={() => toggleColumn(col.key)}
                            className="rounded"
                          />
                          <span className="truncate">{col.name}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          {/* {!hideExpandButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExpandClick}
              className="h-8 w-8 p-0"
              title="Open in full screen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          )} */}
        </div>
        


        {/* Table - Scrollable area with dynamic height */}
        <div className="flex-1 overflow-auto min-h-0">
          <table 
            className={`border-collapse w-full ${compact ? "text-xs" : "text-sm"}`} 
            style={{ 
              tableLayout: 'auto',
              width: '100%'
            }}
          >
            <thead>
              <tr className="bg-muted">
                {visibleColumns.map((col, i) => {
                  return (
                    <th 
                      key={col.key} 
                      className={`${compact ? "p-1" : "p-2"} text-left font-medium sticky top-0 bg-muted z-10 border-b border-border tracking-normal select-none h-10 ${
                        draggedColumn === col.key ? 'opacity-50' : ''
                      } ${(outputMode === 'chart' || outputMode === 'pie' || (inDashboard && readOnlyMode)) ? 'cursor-pointer' : 'cursor-move'} hover:bg-muted/80 transition-colors ${
                        sortColumn === col.key ? 'bg-primary/10 border-primary/20' : ''
                      }`}
                      style={{ 
                        whiteSpace: 'nowrap'
                      }}
                      draggable={outputMode !== 'chart' && outputMode !== 'pie' && (!inDashboard || !readOnlyMode)}
                      onDragStart={(e) => handleColumnDragStart(e, col.key)}
                      onDragOver={handleColumnDragOver}
                      onDrop={(e) => handleColumnDrop(e, col.key)}
                      onDragEnd={handleColumnDragEnd}
                      onClick={(e) => handleColumnClick(e, col.key)}
                      title={
                        (outputMode === 'chart' || outputMode === 'pie') 
                          ? "Click to sort column" 
                          : (inDashboard && readOnlyMode)
                            ? "Click to sort column" 
                            : "Click to sort, drag to reorder column"
                      }
                    >
                      <div className="flex items-center gap-1 h-full">
                        {(outputMode !== 'chart' && outputMode !== 'pie' && (!inDashboard || !readOnlyMode)) && (
                          <span className="text-xs text-muted-foreground">⋮⋮</span>
                        )}
                        <span className="leading-tight">{col.name}</span>
                        {getSortIcon(col.key)}
                      </div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, i) => (
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
                        const numValue = Number(cellValue)
                        // Special handling for year values (4-digit numbers between 1900-2100)
                        if (numValue >= 1900 && numValue <= 2100 && numValue.toString().length === 4) {
                          return numValue.toString() // Return year without formatting
                        }
                        return Math.round(numValue).toLocaleString('en-US', { maximumFractionDigits: 0 })
                      }
                      if (typeof cellValue === 'string' && cellValue.match(/^\d{4}-\d{2}-\d{2}T/)) {
                        // Parse the date string to avoid timezone conversion issues
                        const dateMatch = cellValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
                        if (dateMatch) {
                          const [, year, month, day] = dateMatch;
                          return `${year}-${month}-${day}`; // Return date in YYYY-MM-DD format
                        }
                        return cellValue;
                      }
                      // Removed truncation logic to show full content
                      return cellValue
                    })()

                    return (
                      <td key={j} className={`${compact ? "p-1" : "p-2"} border-r border-border/20`}                       style={{ 
                        whiteSpace: 'nowrap'
                      }}>
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
          readOnlyMode={readOnlyMode}
        />
      )}
    </>
  )
}
