"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

import { Loader2, Save, Trash2, LayoutList, BarChart2, PieChart, X } from "lucide-react"
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
  setSqlQuery: (value: string) => void
  queryResults: any[] | null
  setQueryResults: (value: any[]) => void
  columns: { key: string; name: string }[]
  setColumns: (value: { key: string; name: string }[]) => void
  error: string | null
  setError: (value: string | null) => void
  onSubmit: () => void
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
  error,
  queryResults,
  columns,
  onSubmit,
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

  // Ref for textarea focus
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
      } else {
        setSaveStatus("error");
      }
    } catch (err) {
      setSaveStatus("error");
    }
    setTimeout(() => setSaveStatus(null), 2000);
  }


  
  return (
    <div className="flex flex-col h-full bg-card rounded-lg shadow-md p-4 border border-border">
      <h2 className="text-xl font-semibold mb-2">Current Query</h2>

      <Textarea
        ref={textareaRef}
        placeholder="e.g. Show me the top 10 donors of 2024"
        value={question}
        onChange={handleQuestionChange}
        onKeyDown={handleKeyDown}
        className="mb-2"
      />

      <TooltipProvider>
        <ToggleGroup
          type="single"
          value={outputMode}
          onValueChange={(value) => {
            if (value) setOutputMode(value)
          }}
          className="mb-2 flex gap-2"
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
        className="mb-2"
      >
        {isLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Search"}
      </Button>

      {/* Results Title */}
      <div className="font-bold text-lg mb-2 mt-2" style={{ color: "#16a34a" }}>Results:</div>
      

      
      {queryResults && queryResults.length > 0 && columns.length >= 1 && (
        <div className="bg-card border mt-4 rounded p-4 overflow-auto" style={{ minHeight: '200px', maxWidth: '100%' }}>
          <div className="overflow-x-auto">
            {outputMode === 'table' && (
              <TableView data={queryResults} columns={columns} sql={sqlQuery || undefined} />
            )}
          

          
            {outputMode === 'chart' && (
              <DraggableChart
                data={queryResults.map((row) => ({
                  name: row.donor || row._id?.name || row[columns[0]?.key] || 'Unknown',
                  value: Number(row.totalAmount || row[columns[1]?.key]) || 0,
                }))}
                height={200}
                type={outputMode}
                sql={sqlQuery || undefined}
                columns={columns}
              />
            )}
          
            {outputMode === 'pie' && (
              <DraggablePieChart
                data={queryResults.map((row) => ({
                  name: row.donor || row._id?.name || row[columns[0]?.key] || 'Unknown',
                  value: Number(row.totalAmount || row[columns[1]?.key]) || 0,
                }))}
                height={200}
                sql={sqlQuery || undefined}
                columns={columns}
              />
            )}
          </div>
          
          {/* Show/Hide SQL -- always at the bottom of the results box */}
          {sqlQuery && (
            <div className="mt-4">
              <button
                onClick={() => setShowSql(!showSql)}
                className="text-left text-sm font-semibold text-primary hover:underline focus:outline-none"
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
      )}
      



      {error && <div className="text-red-500 mt-2">{error}</div>}


      {/* Fixed Save/Clear Button Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 border-t bg-card flex flex-row items-center justify-between gap-2 rounded-b-lg">
        
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
              // onClick={handleClearQuery}
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
