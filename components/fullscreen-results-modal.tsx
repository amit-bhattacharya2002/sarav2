"use client"

import { useState, useEffect } from "react"
import { X, Maximize2, Minimize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TableView } from "@/components/table-view"
import { BarGraph } from "@/components/bar-graph"
import { PieGraph } from "@/components/pie-chart"

interface FullscreenResultsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: any[]
  columns: { key: string; name: string }[]
  outputMode: string
  sql?: string
  title?: string
  startInFullscreen?: boolean
  readOnlyMode?: boolean // Add this prop to control close button visibility
}

export function FullscreenResultsModal({
  open,
  onOpenChange,
  data,
  columns,
  outputMode,
  sql,
  title = "Query Results",
  startInFullscreen = false,
  readOnlyMode = false // Add this parameter
}: FullscreenResultsModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(startInFullscreen)

  useEffect(() => {
    if (open && startInFullscreen) {
      setIsFullscreen(true)
    }
  }, [open, startInFullscreen])

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const handleClose = () => {
    setIsFullscreen(false)
    onOpenChange(false)
  }

  if (isFullscreen) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="w-screen h-screen max-w-none max-h-none p-0 border-0 rounded-none"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            margin: 0,
            transform: 'none',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="flex flex-row items-center justify-between p-6 border-b flex-shrink-0">
            <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
            {/* <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleFullscreen}
                className="h-8 w-8 p-0"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div> */}
          </div>
          
          <div className="flex-1 overflow-auto min-h-0">
            {data && data.length > 0 && columns.length >= 1 ? (
              <>
                {outputMode === 'table' && (
                  <div className="h-full w-full overflow-auto">
                    <table className="border-collapse text-sm w-full" style={{ minWidth: 'max-content' }}>
                      <thead>
                        <tr className="bg-muted">
                          {columns.map((col) => {
                            const readableName = col.name
                              .replace(/_/g, ' ')
                              .replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase())
                            return (
                              <th 
                                key={col.key} 
                                className="p-3 text-left font-medium sticky top-0 bg-muted z-10 border-b border-border"
                              >
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
                                if (typeof cellValue === 'object' && cellValue !== null) {
                                  if (cellValue.name) return cellValue.name
                                  if (cellValue.constituentId) return cellValue.constituentId
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
                                  return new Date(cellValue).toLocaleDateString('en-CA')
                                }
                                return cellValue
                              })()

                              return (
                                <td key={j} className="p-3 whitespace-nowrap border-r border-border/20">
                                  {displayValue}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {outputMode === 'chart' && (
                  <div className="h-full w-full p-4">
                    <BarGraph 
                      data={data.map(row => ({
                        name: row[columns[0]?.key] || 'Unknown',
                        value: Number(row[columns[1]?.key]) || 0
                      }))}
                      height={600}
                    />
                  </div>
                )}

                {outputMode === 'pie' && (
                  <div className="h-full w-full p-4">
                    <PieGraph 
                      data={data.map(row => ({
                        name: row[columns[0]?.key] || 'Unknown',
                        value: Number(row[columns[1]?.key]) || 0
                      }))}
                      height={600}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground font-mono p-8">
                <div className="text-center">
                  <div className="text-lg mb-2">No results to display</div>
                  <div className="text-sm">No data available for full-screen view</div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 flex-shrink-0">
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="h-8 w-8 p-0"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            {!readOnlyMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto min-h-0">
          {data && data.length > 0 && columns.length >= 1 ? (
            <>
              {outputMode === 'table' && (
                <TableView 
                  data={data} 
                  columns={columns} 
                  sql={sql} 
                  compact={false}
                  hideExpandButton={true}
                  readOnlyMode={readOnlyMode}
                />
              )}

              {outputMode === 'chart' && (
                <div className="h-full w-full p-4">
                  <BarGraph 
                    data={data.map(row => ({
                      name: row[columns[0]?.key] || 'Unknown',
                      value: Number(row[columns[1]?.key]) || 0
                    }))}
                    height={400}
                  />
                </div>
              )}

              {outputMode === 'pie' && (
                <div className="h-full w-full p-4">
                  <PieGraph 
                    data={data.map(row => ({
                      name: row[columns[0]?.key] || 'Unknown',
                      value: Number(row[columns[1]?.key]) || 0
                    }))}
                    height={400}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground font-mono p-8">
              <div className="text-center">
                <div className="text-lg mb-2">No results to display</div>
                <div className="text-sm">No data available for full-screen view</div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 