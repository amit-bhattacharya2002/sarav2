'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { DropZone } from '../../../components/drop-zone'
import { BarGraph } from '../../../components/bar-graph'
import { PieGraph } from '../../../components/pie-chart'
import { TableView } from '../../../components/table-view'
import { decryptDashboardId } from '@/lib/encryption'

type Visualization = {
  id: string;
  type: string;
  title: string;
  columns: any;
  color: string;
  sql: string;
  data?: any;
  originalId?: string;
};

export default function SharedDashboard() {
  const params = useParams()
  
  // Handle different possible formats of the ID
  let encryptedId: string
  if (Array.isArray(params?.id)) {
    encryptedId = params.id[0]
  } else {
    encryptedId = params?.id as string
  }
  
  // URL decode the ID to handle encoded characters like %3A (:)
  encryptedId = decodeURIComponent(encryptedId)
  
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboardTitle, setDashboardTitle] = useState("Dashboard")
  const [topLeftTitle, setTopLeftTitle] = useState("Sample Title")
  const [topRightTitle, setTopRightTitle] = useState("Sample Title")
  const [bottomTitle, setBottomTitle] = useState("Sample Title")
  const [allVisualizations, setAllVisualizations] = useState<Visualization[]>([])
  const [quadrants, setQuadrants] = useState<{ 
    topLeft: string | null; 
    topRight: string | null; 
    bottom: string | null 
  }>({
    topLeft: null,
    topRight: null,
    bottom: null,
  })

  useEffect(() => {
    const loadSharedDashboard = async () => {
      if (!encryptedId) {
        setError('Invalid dashboard ID')
        setIsLoading(false)
        return
      }

      try {
        // Decrypt the dashboard ID
        const dashboardId = decryptDashboardId(encryptedId)
        
        const res = await fetch(`/api/dashboard?id=${dashboardId}&shared=true`)
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || 'Dashboard not found')
        }
        
        const responseData = await res.json()
        const data = responseData.dashboard
        
        if (!data) {
          throw new Error('Dashboard data not found')
        }

        setDashboardTitle(data.title || "Shared Dashboard")
        setTopLeftTitle(data.topLeftTitle || "Sample Title")
        setTopRightTitle(data.topRightTitle || "Sample Title")
        setBottomTitle(data.bottomTitle || "Sample Title")

        // Parse quadrants and visualizations
        const parsedQuadrants = typeof data.quadrants === 'string' ? JSON.parse(data.quadrants) : data.quadrants
        const parsedVizList = typeof data.visualizations === 'string' ? JSON.parse(data.visualizations) : data.visualizations
        const sVisualizationsData = data.sVisualizations || data.s_visualizations

        // Load from cache if available
        if (sVisualizationsData) {
          const parsedCachedVisualizations = typeof sVisualizationsData === 'string' 
            ? JSON.parse(sVisualizationsData) 
            : sVisualizationsData

          if (Array.isArray(parsedCachedVisualizations) && parsedCachedVisualizations.length > 0) {
            setAllVisualizations(parsedCachedVisualizations)
            
            // Map quadrants
            const quadrantMap: any = {}
            for (const quadrant in parsedQuadrants) {
              const expectedOriginalId = parsedQuadrants[quadrant]
              const expectedViz = parsedVizList?.find((v: any) => v.id === expectedOriginalId)
              const expectedType = expectedViz?.type

              const match = parsedCachedVisualizations.find((v: any) => {
                const primaryMatch = (v.originalId === expectedOriginalId || (v.sql && v.sql === expectedViz?.sql)) &&
                  v.type === expectedType
                const fallbackMatch = v.id === expectedOriginalId && v.type === expectedType
                return primaryMatch || fallbackMatch
              })

              quadrantMap[quadrant] = match ? match.id : null
            }
            
            setQuadrants({
              topLeft: quadrantMap.topLeft || null,
              topRight: quadrantMap.topRight || null,
              bottom: quadrantMap.bottom || null,
            })
          }
        }
      } catch (err: any) {
        console.error('Failed to load shared dashboard:', err)
        setError(err.message || 'Failed to load dashboard')
      } finally {
        setIsLoading(false)
      }
    }

    loadSharedDashboard()
  }, [encryptedId])

  const getVisualizationById = (id: string) => allVisualizations.find((v: Visualization) => v.id === id)

  const renderDroppedViz = (vizId: string) => {
    const viz = getVisualizationById(vizId)
    if (!viz) return null

    if (viz.type === 'chart' || viz.type === 'visualization') {
      return <BarGraph data={viz.data || []} />
    }

    if (viz.type === 'pie') {
      return (
        <PieGraph
          data={viz.data || []}
          compact
          legendScale={1}
        />
      )
    }

    if (viz.type === 'table') {
      return <TableView data={viz.data || []} columns={viz.columns || []} compact readOnlyMode={true} inDashboard={true} />
    }

    return <div className="text-sm text-muted-foreground">Unsupported visualization type</div>
  }

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-xl font-semibold text-destructive mb-2">Dashboard Not Found</div>
          <div className="text-muted-foreground">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-screen flex flex-col overflow-hidden">
        {/* SARA Header */}
        <header className="flex-shrink-0 flex items-center justify-start py-2 px-6 border-b border-border bg-card">
          <h1 
            className="text-2xl md:text-3xl inter font-semibold bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => window.location.href = '/'}
          >
            SARA
          </h1>
        </header>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-hidden px-6 pb-6">
          <div className="bg-card rounded-lg p-6 border border-border h-full flex flex-col">
            <h1 className="text-xl font-mono font-semibold text-center mb-4 flex-shrink-0">{dashboardTitle}</h1>
            
            <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
              {/* Top Left */}
              <div className="flex flex-col flex-1 min-h-0">
                <h2 className="text-sm font-mono font-medium text-center mb-2 flex-shrink-0">{topLeftTitle}</h2>
                <DropZone
                  id="topLeft"
                  onDrop={() => {}} // No-op in read-only mode
                  onRemove={() => {}} // No-op in read-only mode
                  readOnlyMode={true}
                  className="flex-1 min-h-0"
                >
                  {quadrants.topLeft ? renderDroppedViz(quadrants.topLeft) : (
                    <div className="h-full flex items-center justify-center font-mono font-semibold text-muted-foreground">
                      No visualization
                    </div>
                  )}
                </DropZone>
              </div>

              {/* Top Right */}
              <div className="flex flex-col flex-1 min-h-0">
                <h2 className="text-sm font-mono font-medium text-center mb-2 flex-shrink-0">{topRightTitle}</h2>
                <DropZone
                  id="topRight"
                  onDrop={() => {}} // No-op in read-only mode
                  onRemove={() => {}} // No-op in read-only mode
                  readOnlyMode={true}
                  className="flex-1 min-h-0"
                >
                  {quadrants.topRight ? renderDroppedViz(quadrants.topRight) : (
                    <div className="h-full flex items-center justify-center font-mono font-semibold text-muted-foreground">
                      No visualization
                    </div>
                  )}
                </DropZone>
              </div>
            </div>

            {/* Bottom */}
            <div className="flex flex-col flex-1 min-h-0">
              <h2 className="text-sm font-mono font-medium text-center mb-2 flex-shrink-0">{bottomTitle}</h2>
              <DropZone
                id="bottom"
                onDrop={() => {}} // No-op in read-only mode
                onRemove={() => {}} // No-op in read-only mode
                readOnlyMode={true}
                className="flex-1 min-h-0"
              >
                {quadrants.bottom ? renderDroppedViz(quadrants.bottom) : (
                  <div className="h-full flex items-center justify-center font-mono font-semibold text-muted-foreground">
                    No visualization
                  </div>
                )}
              </DropZone>
            </div>
          </div>
        </div>
      </div>
    </DndProvider>
  )
} 