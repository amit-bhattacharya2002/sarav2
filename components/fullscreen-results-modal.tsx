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

interface FullscreenResultsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: any[]
  columns: { key: string; name: string }[]
  outputMode: string
  sql?: string
  title?: string
  startInFullscreen?: boolean
}

export function FullscreenResultsModal({
  open,
  onOpenChange,
  data,
  columns,
  outputMode,
  sql,
  title = "Query Results",
  startInFullscreen = false
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
          }}
        >
          <div className="flex flex-col h-full">
            <div className="flex flex-row items-center justify-between p-6 border-b flex-shrink-0">
              <h2 className="text-xl font-semibold">{title}</h2>
              <div className="flex items-center gap-2">
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
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden min-h-0">
              {data && data.length > 0 && columns.length >= 1 ? (
                <div className="h-full w-full overflow-hidden">
                  {outputMode === 'table' && (
                    <div className="h-full w-full overflow-hidden">
                      <TableView 
                        data={data} 
                        columns={columns} 
                        sql={sql} 
                        compact={false}
                        hideExpandButton={true}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground font-mono p-8">
                  <div className="text-center">
                    <div className="text-lg mb-2">No results to display</div>
                    <div className="text-sm">No data available for full-screen view</div>
                  </div>
                </div>
              )}
            </div>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden min-h-0">
          {data && data.length > 0 && columns.length >= 1 ? (
            <div className="h-full w-full overflow-hidden">
              {outputMode === 'table' && (
                <div className="h-full w-full overflow-hidden">
                  <TableView 
                    data={data} 
                    columns={columns} 
                    sql={sql} 
                    compact={false}
                    hideExpandButton={true}
                  />
                </div>
              )}
            </div>
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