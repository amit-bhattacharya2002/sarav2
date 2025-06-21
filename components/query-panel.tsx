"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

import { Loader2, Save, Trash2, LayoutList, BarChart2, PieChart } from "lucide-react"
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
  setKey: (value: number) => void
  onSubmit: () => void
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
}: QueryPanelProps) {
  const [showSql, setShowSql] = useState(false)

  return (
    <div className="flex flex-col h-full bg-card rounded-lg shadow-md p-4 border border-border">
      <h2 className="text-xl font-semibold mb-2">Current Query</h2>

      <Textarea
        placeholder="e.g. Show me the top 10 donors of 2024"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSubmit()
          }
        }}
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

      <Button onClick={onSubmit} disabled={isLoading} className="mb-2">
        {isLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Search"}
      </Button>

      {/* Results Title */}
      <div className="font-bold text-lg mb-2 mt-2" style={{ color: "#16a34a" }}>Results:</div>
      

      
      {queryResults && queryResults.length > 0 && columns.length >= 1 && (
        <div className="bg-card border mt-4 rounded p-4 overflow-auto" style={{ minHeight: '200px' }}>
          {outputMode === 'table' && (
            <TableView
              data={queryResults}
              columns={columns}
              sql={sqlQuery}
            />
          )}


{/* // NEW DIAGNOSTICS */}
          
{/*           {queryResults && queryResults.length > 0 && columns.length >= 1 && (
            <div className="bg-card border mt-4 rounded p-4 overflow-auto" style={{ minHeight: '200px' }}>
              {outputMode === 'table' && (
                <TableView
                  data={queryResults}
                  columns={columns}
                  sql={sqlQuery}
                />
              )}
    
              {outputMode === 'table' && sqlQuery && (
                <div className="mt-4 bg-muted p-2 rounded text-xs border">
                  <div className="font-semibold mb-1">Diagnostics: Table Metadata</div>
                  <div>
                    <strong>SQL:</strong>
                    <pre className="whitespace-pre-wrap break-words">{sqlQuery}</pre>
                  </div>
                  <div className="mt-2">
                    <strong>Columns:</strong>
                    <pre>{JSON.stringify(columns, null, 2)}</pre>
                  </div>
                  {queryResults && queryResults.length > 0 && (
                    <div className="mt-2">
                      <strong>Data sample:</strong>
                      <pre>{JSON.stringify(queryResults.slice(0, 3), null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
    
              {outputMode === 'chart' && (
                <DraggableChart
                  data={queryResults.map((row) => ({
                    name: row[columns[0].key],
                    value: Number(row[columns[1].key]) || 0,
                  }))}
                  height={200}
                  type={outputMode}
                  sql={sqlQuery}
                  columns={columns}
                />
              )}
    
              {outputMode === 'pie' && (
                <DraggablePieChart
                  data={queryResults.map((row) => ({
                    name: row[columns[0].key],
                    value: Number(row[columns[1].key]) || 0,
                  }))}
                  height={200}
                  sql={sqlQuery}
                  columns={columns}
                />
              )}
            </div>
          )} */}
          
          
{/* // END of NEW DIAGNOSTICS         */}

          
          {outputMode === 'table' && sqlQuery && (
            <div className="mt-4 bg-muted p-2 rounded text-xs border">
              <div className="font-semibold mb-1">Diagnostics: Table Metadata</div>
              <div>
                <strong>SQL:</strong>
                <pre className="whitespace-pre-wrap break-words">{sqlQuery}</pre>
              </div>
              <div className="mt-2">
                <strong>Columns:</strong>
                <pre>{JSON.stringify(columns, null, 2)}</pre>
              </div>
            </div>
          )}

          {outputMode === 'chart' && (
            <DraggableChart
              data={queryResults.map((row) => ({
                name: row[columns[0].key],
                value: Number(row[columns[1].key]) || 0,
              }))}
              height={200}
              type={outputMode}
              sql={sqlQuery}
              columns={columns}
            />
          )}

          {outputMode === 'pie' && (
            <DraggablePieChart
              data={queryResults.map((row) => ({
                name: row[columns[0].key],
                value: Number(row[columns[1].key]) || 0,
              }))}
              height={200}
              sql={sqlQuery}
              columns={columns}
            />
          )}
        </div>
      )}

      {sqlQuery && (
        <div className="mt-2">
          <button
            onClick={() => setShowSql(!showSql)}
            className="text-left text-sm font-semibold text-primary hover:underline focus:outline-none"
          >
            {showSql ? "▼ Hide SQL" : "▶ Show SQL"}
          </button>
          {showSql && (
            <div className="mt-1 bg-muted p-2 rounded text-sm font-mono text-muted-foreground border border-border">
              <pre className="whitespace-pre-wrap break-words">{sqlQuery}</pre>
            </div>
          )}
        </div>
      )}

      {error && <div className="text-red-500 mt-2">{error}</div>}


      {/* Fixed Save/Clear Button Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-4 border-t bg-card flex flex-row items-center justify-between gap-2 rounded-b-lg">
        <Button
          variant="default"
          className="flex items-center gap-2"
          // onClick={handleSaveQuery}
        >
          <Save className="h-5 w-5" />
          <span>Save</span>
        </Button>
        <Button
          variant="ghost"
          className="flex items-center gap-2"
          // onClick={handleClearQuery}
        >
          <Trash2 className="h-5 w-5" />
          <span>Clear</span>
        </Button>
      </div>      

      
    </div>
  )
}
