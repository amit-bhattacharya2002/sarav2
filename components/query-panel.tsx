"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { Loader2, Save, Trash2, LayoutList, BarChart2, PieChart, X, AlertTriangle, AlertCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { TableView } from "@/components/table-view"
import { DraggableChart } from './draggable-chart'
import { DraggablePieChart } from './draggable-pie'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TooltipProvider } from '@/components/ui/tooltip'



interface QueryPanelProps {
  question: string
  setQuestion: (value: string) => void
  outputMode: string
  setOutputMode: (value: string) => void
  isLoading: boolean
  sqlQuery: string | null
  setSqlQuery: (value: string | null) => void
  queryResults: any[] | null
  setQueryResults: (value: any[] | null) => void
  columns: { key: string; name: string }[]
  setColumns: (value: { key: string; name: string }[]) => void
  error: string | null
  setError: (value: string | null) => void
  onSubmit: () => void
  readOnlyMode?: boolean // Add this prop
  isEditingSavedQuery?: boolean
  handleUpdateSavedQuery?: () => Promise<void>
  handleCancelEdit?: () => void
  hasChanges?: () => boolean
  selectedSavedQueryId?: number | null
  handleEditSavedQuery?: () => void
  handleDeleteSavedQuery?: () => Promise<void>
}

export function QueryPanel({
  question,
  setQuestion,
  outputMode,
  setOutputMode,
  isLoading,
  sqlQuery,
  setSqlQuery,
  error,
  setError,
  queryResults,
  setQueryResults,
  columns,
  setColumns,
  onSubmit,
  readOnlyMode,
  isEditingSavedQuery = false,
  handleUpdateSavedQuery,
  handleCancelEdit,
  hasChanges,
  selectedSavedQueryId,
  handleEditSavedQuery,
  handleDeleteSavedQuery,
}: QueryPanelProps) {
  const [showSql, setShowSql] = useState(false)
  const [saveStatus, setSaveStatus] = useState<null | "success" | "error" | "saving">(null);
  
  // Chart column selection state
  const [selectedXColumn, setSelectedXColumn] = useState<string>('')
  const [selectedYColumn, setSelectedYColumn] = useState<string>('')
  
  // Chart configuration panel collapse state
  const [isChartConfigCollapsed, setIsChartConfigCollapsed] = useState(false)

  // Ref for textarea focus
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-select default columns when results change
  useEffect(() => {
    if (columns.length >= 2 && (!selectedXColumn || !selectedYColumn)) {
      setSelectedXColumn(columns[0]?.key || '')
      setSelectedYColumn(columns[1]?.key || '')
    }
  }, [columns, selectedXColumn, selectedYColumn])

  // Stable event handlers
  const handleQuestionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(e.target.value)
  }, [setQuestion])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }, [onSubmit])

  // Clear query function
  const handleClearQuery = useCallback(() => {
    setQuestion('')
    setSqlQuery(null)
    setQueryResults(null)
    setColumns([])
    setError(null)
    setShowSql(false)
    // Focus the textarea after clearing
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
  }, [setQuestion, setSqlQuery, setQueryResults, setColumns, setError])

  
  async function handleSaveQuery() {
    setSaveStatus("saving");
    try {
      const payload = {
        action: "save", // <-- This tells the backend to save, not run
        question,
        sql: sqlQuery,
        outputMode,
        columns,
        dataSample: queryResults?.slice(0, 3) || [],
        // userId, companyId, visualConfig, panelPosition: add if needed
      };
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveStatus("success");
        // Dispatch event to refresh history panel
        const event = new CustomEvent('queryUpdated', { detail: { action: 'saved' } });
        window.dispatchEvent(event);
      } else {
        setSaveStatus("error");
      }
    } catch (err) {
      setSaveStatus("error");
    }
    setTimeout(() => setSaveStatus(null), 2000);
  }

  // Function to determine error type and icon
  const getErrorInfo = (errorMessage: string) => {
    const lowerError = errorMessage.toLowerCase()
    
    if (lowerError.includes('syntax') || lowerError.includes('parse') || lowerError.includes('invalid syntax')) {
      return {
        type: 'syntax',
        icon: XCircle,
        color: 'text-red-500',
        bgColor: 'bg-red-50 border-red-200',
        title: 'Syntax Error',
        description: 'There seems to be a syntax issue with your query.'
      }
    } else if (lowerError.includes('timeout') || lowerError.includes('connection')) {
      return {
        type: 'connection',
        icon: AlertTriangle,
        color: 'text-orange-500',
        bgColor: 'bg-orange-50 border-orange-200',
        title: 'Connection Error',
        description: 'Unable to connect to the database. Please try again.'
      }
    } else if (lowerError.includes('not found') || lowerError.includes('does not exist') || lowerError.includes('unknown')) {
      return {
        type: 'notfound',
        icon: AlertCircle,
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50 border-yellow-200',
        title: 'Not Found',
        description: 'The requested data or table could not be found.'
      }
    } else {
      return {
        type: 'general',
        icon: AlertTriangle,
        color: 'text-red-500',
        bgColor: 'bg-red-50 border-red-200',
        title: 'Query Error',
        description: 'An error occurred while processing your query.'
      }
    }
  }

  
  return (
    <div className="flex flex-col h-full bg-card rounded-lg shadow-md border border-border overflow-hidden">
      <div className="flex-shrink-0 p-4 pb-0">
        <h2 className="text-xl font-mono font-semibold mb-2">Current Query</h2>

        <Textarea
          ref={textareaRef}
          placeholder="e.g. Show me the top 10 donors of 2024"
          value={question}
          onChange={handleQuestionChange}
          onKeyDown={handleKeyDown}
          className="mb-2"
        />

        <div className="flex items-center justify-between gap-4 mb-2">
          <TooltipProvider>
            <ToggleGroup
              type="single"
              value={outputMode}
              onValueChange={(value) => {
                if (value) setOutputMode(value)
              }}
              className="flex gap-2"
            >
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value="table"
                  aria-label="Table View"
                  className={outputMode === "table" ? "border border-primary bg-muted/30" : ""}
                >
                  <LayoutList className="h-5 w-5" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Tabular</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value="chart"
                  aria-label="Bar Chart View"
                  className={outputMode === "chart" ? "border border-primary bg-muted/30" : ""}
                >
                  <BarChart2 className="h-5 w-5" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Bar Chart</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <ToggleGroupItem
                  value="pie"
                  aria-label="Pie Chart View"
                  className={outputMode === "pie" ? "border border-primary bg-muted/30" : ""}
                >
                  <PieChart className="h-5 w-5" />
                </ToggleGroupItem>
              </TooltipTrigger>
              <TooltipContent>Pie Chart (Coming Soon)</TooltipContent>
            </Tooltip>
            </ToggleGroup>
          </TooltipProvider>

          <Button 
            onClick={onSubmit} 
            disabled={isLoading || (isEditingSavedQuery && (!hasChanges || !hasChanges())) || (!!selectedSavedQueryId && !isEditingSavedQuery)}
          >
            {isLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Search"}
          </Button>
        </div>

        {/* Column Selection for Charts */}
        {(outputMode === 'chart' || outputMode === 'pie') && columns.length >= 2 && (
          <div className="mb-2 bg-muted/20 rounded border border-border">
            {/* Collapsible Header */}
            <button
              onClick={() => setIsChartConfigCollapsed(!isChartConfigCollapsed)}
              className="w-full p-3 flex items-center justify-between text-left hover:bg-muted/10 transition-colors rounded-t"
            >
              <span className="text-sm font-medium">Chart Configuration</span>
              {isChartConfigCollapsed ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            
            {/* Collapsible Content */}
            {!isChartConfigCollapsed && (
              <div className="px-3 pb-3 border-t border-border/50">
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      X-Axis ({outputMode === 'chart' ? 'Categories' : 'Labels'})
                    </label>
                    <Select value={selectedXColumn} onValueChange={setSelectedXColumn}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col.key} value={col.key}>
                            {col.name.replace(/_/g, ' ').replace(/\w\S*/g, txt => 
                              txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Y-Axis ({outputMode === 'chart' ? 'Values' : 'Sizes'})
                    </label>
                    <Select value={selectedYColumn} onValueChange={setSelectedYColumn}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col.key} value={col.key}>
                            {col.name.replace(/_/g, ' ').replace(/\w\S*/g, txt => 
                              txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results Title */}
      {/* <div className="font-mono font-bold text-lg mb-2 mt-2" style={{ color: "#16a34a" }}>Results:</div> */}
      
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-auto p-4 pt-0">
        {/* Results Area - Always visible with border */}
        <div className="bg-card border-2 border-dashed border-muted-foreground/30 rounded p-4 flex flex-col flex-1 h-full">
        {queryResults && queryResults.length > 0 && columns.length >= 1 ? (
          <div className="h-full w-full overflow-auto flex-1 min-h-0">
            {outputMode === 'table' && (
              <div className="h-full w-full overflow-hidden">
                <TableView data={queryResults} columns={columns} sql={sqlQuery || undefined} readOnlyMode={readOnlyMode} />
              </div>
            )}
          
            {outputMode === 'chart' && (
              <div className="h-full w-full overflow-auto">
                <DraggableChart
                  data={queryResults.map((row) => ({
                    name: row[selectedXColumn] || row.donor || row._id?.name || 'Unknown',
                    value: Number(row[selectedYColumn] || row.totalAmount) || 0,
                  }))}
                  height={400}
                  type={outputMode}
                  sql={sqlQuery || undefined}
                  columns={columns}
                />
              </div>
            )}
          
            {outputMode === 'pie' && (
              <div className="h-full w-full overflow-auto">
                <DraggablePieChart
                  data={queryResults.map((row) => ({
                    name: row[selectedXColumn] || row.donor || row._id?.name || 'Unknown',
                    value: Number(row[selectedYColumn] || row.totalAmount) || 0,
                  }))}
                  height={400}
                  sql={sqlQuery || undefined}
                  columns={columns}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground font-mono p-8">
            <div className="text-center">
              <div className="text-lg mb-2">No results yet</div>
              <div className="text-sm">Run a query to see results here</div>
            </div>
          </div>
        )}
        
        {/* Show/Hide SQL -- always at the bottom of the results box */}
        {sqlQuery && (
          <div className="mt-4 border-t pt-4 flex-shrink-0">
            <button
              onClick={() => setShowSql(!showSql)}
              className="text-left text-sm font-mono font-semibold text-primary hover:underline focus:outline-none"
            >
              {showSql ? "▼ Hide SQL" : "▶ Show SQL"}
            </button>
            {showSql && (
              <div className="mt-1 bg-muted p-2 rounded text-sm font-mono text-muted-foreground border border-border overflow-x-auto">
                <pre className="whitespace-pre-wrap break-words">{sqlQuery}</pre>
              </div>
            )}
          </div>
        )}

        </div>

        {error && (
          <div className="mt-4">
            {(() => {
              const errorInfo = getErrorInfo(error)
              const IconComponent = errorInfo.icon
              
              return (
                <div className={`p-4 rounded-lg border ${errorInfo.bgColor} flex items-start gap-3`}>
                  <IconComponent className={`h-5 w-5 ${errorInfo.color} flex-shrink-0 mt-0.5`} />
                  <div className="flex-1">
                    <div className={`font-semibold ${errorInfo.color} mb-1`}>
                      {errorInfo.title}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      {errorInfo.description}
                    </div>
                    <div className="text-sm font-mono bg-white/50 p-2 rounded border text-gray-700">
                      {error}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setError(null)}
                    className="h-6 w-6 p-0 hover:bg-white/50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Fixed Save/Clear Button Bar */}
      <div className="flex-shrink-0 p-4 border-t bg-card flex flex-row items-center justify-between gap-2">
        
        {isEditingSavedQuery ? (
          // Edit mode: Update and Cancel
          <>
            <Button
              variant="default"
              className="flex items-center gap-2"
              onClick={handleUpdateSavedQuery}
              disabled={
                !question || !sqlQuery || !outputMode || !columns.length || !queryResults?.length || saveStatus === "saving" ||
                (!hasChanges || !hasChanges())
              }
            >
              <Save className="h-5 w-5" />
              {saveStatus === "saving" ? "Saving..." : saveStatus === "success" ? "Saved!" : saveStatus === "error" ? "Error" : "Update"}
            </Button>
            
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={handleCancelEdit}
            >
              <X className="h-5 w-5" />
              <span>Cancel</span>
            </Button>
          </>
        ) : selectedSavedQueryId ? (
          // Selected saved query: Edit and Delete
          <>
            <Button
              variant="default"
              className="flex items-center gap-2"
              onClick={handleEditSavedQuery}
            >
              <Save className="h-5 w-5" />
              <span>Edit</span>
            </Button>
            
            <Button
              variant="destructive"
              className="flex items-center gap-2"
              onClick={handleDeleteSavedQuery}
            >
              <Trash2 className="h-5 w-5" />
              <span>Delete</span>
            </Button>
          </>
        ) : (
          // New query: Save and Clear
          <>
            <Button
              variant="default"
              className="flex items-center gap-2"
              onClick={handleSaveQuery}
              disabled={
                !question || !sqlQuery || !outputMode || !columns.length || !queryResults?.length || saveStatus === "saving"
              }
            >
              <Save className="h-5 w-5" />
              {saveStatus === "saving" ? "Saving..." : saveStatus === "success" ? "Saved!" : saveStatus === "error" ? "Error" : "Save"}
            </Button>
            
            <Button
              variant="ghost"
              className="flex items-center gap-2"
              onClick={handleClearQuery}
            >
              <Trash2 className="h-5 w-5" />
              <span>Clear</span>
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
