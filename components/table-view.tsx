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
  // Initial filter columns for saved queries (JSON object with column keys and boolean values)
  initialFilterColumns?: Record<string, boolean>
  // Callback when filter columns change
  onFilterColumnsChange?: (filterColumns: Record<string, boolean>) => void
  // Show/hide the filter button
  showFilterButton?: boolean
  // Show/hide the entire header section
  showHeader?: boolean
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
  initialFilterColumns,
  onFilterColumnsChange,
  showFilterButton = true,
  showHeader = true,
}: TableViewProps) {
  
  // Debug: Log which TableView instance this is
  console.log('🔄 TableView component rendered with onSortChange:', !!onSortChange, 'inDashboard:', inDashboard, 'readOnlyMode:', readOnlyMode, 'onFilterColumnsChange:', !!onFilterColumnsChange)
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(columns.map(col => col.key)))
  const [columnOrder, setColumnOrder] = useState<string[]>(columns.map(col => col.key))
  
  // Track if we've initialized from saved data to prevent re-initialization
  const hasInitializedFromSaved = useRef(false)
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [fullscreenModalOpen, setFullscreenModalOpen] = useState(false)
  const [startInFullscreen, setStartInFullscreen] = useState(false)
  const [isColumnSelectorModalOpen, setIsColumnSelectorModalOpen] = useState(false)
  const lastColumnOrderRef = useRef<string[]>(columns.map(col => col.key))
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Reset initialization flag when columns change (new query)
  useEffect(() => {
    hasInitializedFromSaved.current = false
  }, [columns])

  // Initialize selected columns and order when columns change
  useEffect(() => {
    // If we have initial filter columns (from saved query) and haven't initialized yet, use them
    if (initialFilterColumns && Object.keys(initialFilterColumns).length > 0 && !hasInitializedFromSaved.current) {
      // Convert the filter columns object to a Set of selected column keys
      const selectedColumnKeys = Object.entries(initialFilterColumns)
        .filter(([key, isVisible]) => isVisible && columns.some(c => c.key === key))
        .map(([key]) => key)
      
      if (selectedColumnKeys.length > 0) {
        setSelectedColumns(new Set(selectedColumnKeys))
        hasInitializedFromSaved.current = true
      } else {
        // If no valid filter columns, select all
        setSelectedColumns(new Set(columns.map(col => col.key)))
        hasInitializedFromSaved.current = true
      }
    } else if (!hasInitializedFromSaved.current) {
      // Only reset to all columns if this is the first time or if no columns were previously selected
      setSelectedColumns(prev => {
        // If no previous selection or if all previous columns are gone, select all new columns
        if (prev.size === 0 || !columns.some(col => prev.has(col.key))) {
          return new Set(columns.map(col => col.key))
        }
        // Otherwise, keep existing selections and add any new columns
        const newSet = new Set(prev)
        columns.forEach(col => {
          if (!newSet.has(col.key)) {
            newSet.add(col.key)
          }
        })
        return newSet
      })
      hasInitializedFromSaved.current = true
    }
    setColumnOrder(columns.map(col => col.key))
  }, [columns, initialFilterColumns])

  // Notify parent when filter columns change
  useEffect(() => {
    console.log('🔄 TableView useEffect triggered - selectedColumns changed:', Array.from(selectedColumns))
    console.log('🔄 TableView onFilterColumnsChange callback exists:', !!onFilterColumnsChange)
    console.log('🔄 TableView columns:', columns.map(c => c.key))
    if (onFilterColumnsChange) {
      // Convert selectedColumns Set to a Record<string, boolean> format
      const filterColumnsObject: Record<string, boolean> = {}
      columns.forEach(col => {
        filterColumnsObject[col.key] = selectedColumns.has(col.key)
      })
      console.log('🔄 TableView calling onFilterColumnsChange with:', filterColumnsObject)
      console.log('🔄 TableView selectedColumns Set:', selectedColumns)
      onFilterColumnsChange(filterColumnsObject)
    }
  }, [selectedColumns, onFilterColumnsChange, columns])

  // Reset sorting when data changes significantly, but not when external sorting is being applied
  useEffect(() => {
    // Only reset sorting if no external sorting is being applied
    if (externalSortColumn === null && externalSortDirection === null) {
      setSortColumn(null)
      setSortDirection('asc')
    }
  }, [data, externalSortColumn, externalSortDirection])

  // Handle external sorting control
  useEffect(() => {
    // Always update when external sorting values change, even if they're null
    console.log('🔄 TableView: Applying external sorting:', { externalSortColumn, externalSortDirection })
    setSortColumn(externalSortColumn)
    setSortDirection(externalSortDirection)
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

      // Handle dates first (multiple formats)
      const dateRegexes = [
        /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
        /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
        /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
        /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO datetime
        /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, // MySQL datetime
      ]
      
      const aIsDate = dateRegexes.some(regex => regex.test(String(aDisplayValue)))
      const bIsDate = dateRegexes.some(regex => regex.test(String(bDisplayValue)))
      
      // Debug logging for date detection
      if (sortColumn && sortColumn.toLowerCase().includes('date')) {
        console.log('🔄 TableView: Date sorting attempt:', {
          sortColumn,
          aDisplayValue: String(aDisplayValue),
          bDisplayValue: String(bDisplayValue),
          aIsDate,
          bIsDate,
          aType: typeof aDisplayValue,
          bType: typeof bDisplayValue
        })
      }
      
      if (aIsDate && bIsDate) {
        const aDate = new Date(String(aDisplayValue))
        const bDate = new Date(String(bDisplayValue))
        const aTime = aDate.getTime()
        const bTime = bDate.getTime()
        
        if (!isNaN(aTime) && !isNaN(bTime)) {
          console.log('🔄 TableView: Sorting dates:', { aDisplayValue, bDisplayValue, aTime, bTime, sortDirection })
          return sortDirection === 'asc' ? aTime - bTime : bTime - aTime
        }
      }
      
      // Fallback: Try to parse as dates even if regex doesn't match
      if (sortColumn && sortColumn.toLowerCase().includes('date')) {
        const aDate = new Date(String(aDisplayValue))
        const bDate = new Date(String(bDisplayValue))
        const aTime = aDate.getTime()
        const bTime = bDate.getTime()
        
        if (!isNaN(aTime) && !isNaN(bTime)) {
          console.log('🔄 TableView: Fallback date sorting:', { aDisplayValue, bDisplayValue, aTime, bTime, sortDirection })
          return sortDirection === 'asc' ? aTime - bTime : bTime - aTime
        }
      }

      // Handle numbers and numeric strings
      const aNum = parseFloat(aDisplayValue)
      const bNum = parseFloat(bDisplayValue)
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
      }

      // Handle strings (including date strings that don't match YYYY-MM-DD)
      const aString = String(aDisplayValue).toLowerCase()
      const bString = String(bDisplayValue).toLowerCase()
      
      if (aString < bString) return sortDirection === 'asc' ? -1 : 1
      if (aString > bString) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sortColumn, sortDirection])

  // Handle column sorting
  const handleColumnSort = (columnKey: string) => {
    console.log('🔄 TableView handleColumnSort called with:', columnKey)
    console.log('🔄 TableView onSortChange callback exists:', !!onSortChange)
    console.log('🔄 TableView available columns:', columns.map(c => ({ key: c.key, name: c.name })))
    console.log('🔄 TableView sample data for column:', columnKey, data.slice(0, 3).map(row => ({ [columnKey]: row[columnKey] })))
    
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
    
    console.log('🔄 TableView setting sort state:', { newSortColumn, newSortDirection })
    
    // Update internal state
    setSortColumn(newSortColumn)
    setSortDirection(newSortDirection)
    
    // Notify parent component if callback provided
    if (onSortChange) {
      console.log('🔄 TableView calling onSortChange with:', { newSortColumn, newSortDirection })
      onSortChange(newSortColumn, newSortDirection)
    } else {
      console.log('🔄 TableView onSortChange is null/undefined')
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
          const stableId = `table-${outputMode}-${JSON.stringify(sortedData).slice(0, 100)}-${JSON.stringify(visibleColumns.map(col => col.key)).slice(0, 50)}-${sql ? sql.slice(0, 50) : 'no-sql'}`
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
      data: sortedData, // Use sorted data instead of original data
      columns: visibleColumns, // Use reordered visible columns for dragging
      color: 'hsl(var(--chart-4))',
      sql,              // <-- ADD THIS LINE
    },
    canDrag: !readOnlyMode, // Disable dragging in read-only mode
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [stableId, sortedData, visibleColumns, outputMode, sql, readOnlyMode]) // Use sortedData instead of data

  // Call the callback when column order changes - only when order actually changes
  useEffect(() => {
    // Only proceed if column reordering is enabled
    if (outputMode !== 'chart' && outputMode !== 'pie' && !(inDashboard && readOnlyMode)) {
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
    }
  }, [columnOrder, columns, onColumnOrderChange, outputMode, inDashboard, readOnlyMode])

  // Early return if no data or columns
  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        No data available
      </div>
    );
  }

  // Debug: Log the first few rows to check for data issues
  console.log('🔄 TableView data check:', {
    totalRows: data.length,
    firstRow: data[0],
    columns: visibleColumns.map(col => col.key)
  });

  if (!columns || !Array.isArray(columns) || columns.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        No columns defined
      </div>
    );
  }

  const toggleColumn = (columnKey: string) => {
    console.log('🔄 TableView toggleColumn called:', columnKey)
    setSelectedColumns(prev => {
      const newSet = new Set(prev)
      if (newSet.has(columnKey)) {
        newSet.delete(columnKey)
        console.log('🔄 Removed column:', columnKey)
      } else {
        newSet.add(columnKey)
        console.log('🔄 Added column:', columnKey)
      }
      console.log('🔄 New selectedColumns Set:', Array.from(newSet))
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
        {showHeader && (
        <div className="flex items-center justify-between mb-2 p-2 bg-muted/20 rounded border border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            {showFilterButton && (
              <Dialog open={isColumnSelectorModalOpen} onOpenChange={setIsColumnSelectorModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    <span>Filter</span>
                  </Button>
                </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Filter Columns</DialogTitle>
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
            )}
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
        )}


        {/* Table - Scrollable area with dynamic height */}
        <div className="flex-1 overflow-auto min-h-0 relative">
          <table 
            className={`border-collapse w-full ${compact ? "text-xs" : "text-sm"}`} 
            style={{ 
              tableLayout: 'auto',
              width: '100%'
            }}
          >
            <thead className="relative z-20 bg-muted" style={{ backgroundColor: 'hsl(var(--muted))', zIndex: 20 }}>
              <tr className="bg-muted" style={{ backgroundColor: 'hsl(var(--muted))' }}>
                {visibleColumns.map((col, i) => {
                  return (
                    <th 
                      key={col.key} 
                      className={`${compact ? "p-1" : "p-2"} text-left font-medium sticky top-0 bg-muted z-20 border-b border-border tracking-normal select-none h-10 ${
                        draggedColumn === col.key ? 'opacity-50' : ''
                      } ${(outputMode === 'chart' || outputMode === 'pie' || (inDashboard && readOnlyMode)) ? 'cursor-pointer' : 'cursor-move'} hover:bg-muted transition-colors ${
                        sortColumn === col.key ? 'bg-primary/10 border-primary/20' : ''
                      }`}
                      style={{ 
                        whiteSpace: 'nowrap',
                        backgroundColor: 'hsl(var(--muted))',
                        zIndex: 20
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
              {sortedData.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="text-center py-8 text-muted-foreground">
                    <div className="flex flex-col items-center">
                      <div className="text-lg font-medium mb-1">No results found</div>
                      <div className="text-sm">No data matches your current criteria</div>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedData.map((row, i) => (
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
                    
                    // Check if this is a fallback value that needs ghost text (only for Full Name)
                    const isFallbackValue = (() => {
                      const stringValue = String(cellValue)
                      
                      // Debug: Check what we're getting
                      if (col.name === 'Full Name' || col.key === 'Full Name') {
                        console.log('🔍 Checking Full Name:')
                        console.log('  - stringValue:', stringValue)
                        console.log('  - colName:', col.name)
                        console.log('  - colKey:', col.key)
                        console.log('  - matches:', stringValue.match(/^\[Account [\w-]+\]$/))
                      }
                      
                      // Only check for Full Name fallback pattern: [Account XXXXX] (including UUIDs with hyphens)
                      if ((col.name === 'Full Name' || col.key === 'Full Name') && stringValue.match(/^\[Account [\w-]+\]$/)) {
                        console.log('✅ Found fallback value:', stringValue)
                        return true
                      }
                      return false
                    })()

                    return (
                      <td key={j} className={`${compact ? "p-1" : "p-2"} border-r border-border/20`}                       style={{ 
                        whiteSpace: 'nowrap'
                      }}>
                        {isFallbackValue ? (
                          <div className="flex flex-col">
                            <span className="text-gray-500 italic text-xs">
                              No name on file
                            </span>
                            <span className="text-foreground/60 text-xs">
                              {displayValue}
                            </span>
                          </div>
                        ) : (
                          displayValue
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))
              )}
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
