"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Save, MoreVertical, Edit } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface SavedQuery {
  id: number
  title: string
  sqlText: string
  queryText: string
  outputMode: number
  createdAt: Date
}

interface SavedDashboard {
  id: number
  title: string
}

interface HistoryPanelProps {
  onSelectQuery?: (query: SavedQuery) => void
  onEditQuery?: (query: SavedQuery) => void
  onSelectDashboard?: (dashboard: SavedDashboard) => void
  readOnlyMode?: boolean
}

export function HistoryPanel({
  onSelectQuery,
  onEditQuery,
  onSelectDashboard,
  readOnlyMode = false,
}: HistoryPanelProps) {
  const [queries, setQueries] = useState<SavedQuery[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedQuery, setSelectedQuery] = useState<SavedQuery | null>(null)
  const [selectedDashboard, setSelectedDashboard] = useState<SavedDashboard | null>(null)
  const [view, setView] = useState<"queries" | "dashboards">(readOnlyMode ? "dashboards" : "queries")

  const router = useRouter();
  
  // Dashboards state
  const [dashboards, setDashboards] = useState<SavedDashboard[]>([])
  const [dashboardLoading, setDashboardLoading] = useState(false)
  const [dashboardError, setDashboardError] = useState<string | null>(null)

  // For demo purposes, using hardcoded user and company IDs
  const userId = 1
  const companyId = 1

  // Queries loading effect
  useEffect(() => {
    async function loadQueries() {
      try {
        setLoading(true)
        setError(null)
        // Fetch from API route
        const res = await fetch("/api/saved-queries")
        if (!res.ok) throw new Error("Failed to fetch saved queries")
        const data = await res.json()
        setQueries(data.queries || [])
      } catch (err: any) {
        setError(err.message || "Failed to load saved queries")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    // Only load queries if not read-only and queries view is selected
    if (!readOnlyMode && view === "queries") {
      loadQueries()
    }
  }, [readOnlyMode, view])

  // Listen for query updates to refresh the list
  useEffect(() => {
    const handleQueryUpdated = () => {
      // Refresh queries when a query is updated
      if (!readOnlyMode && view === "queries") {
        async function refreshQueries() {
          try {
            setLoading(true)
            const res = await fetch("/api/saved-queries")
            if (!res.ok) throw new Error("Failed to fetch saved queries")
            const data = await res.json()
            setQueries(data.queries || [])
          } catch (err: any) {
            setError(err.message || "Failed to load saved queries")
            console.error(err)
          } finally {
            setLoading(false)
          }
        }
        refreshQueries()
      }
    }

    window.addEventListener('queryUpdated', handleQueryUpdated)
    return () => {
      window.removeEventListener('queryUpdated', handleQueryUpdated)
    }
  }, [readOnlyMode, view])

  // Dashboards loading effect
  useEffect(() => {
    async function loadDashboards() {
      try {
        setDashboardLoading(true)
        setDashboardError(null)
        // Fetch from API route
        const res = await fetch("/api/dashboard")
        if (!res.ok) throw new Error("Failed to fetch dashboards")
        const data = await res.json()
        setDashboards(data.dashboards || [])
      } catch (err: any) {
        setDashboardError(err.message || "Failed to load dashboards")
      } finally {
        setDashboardLoading(false)
      }
    }
    // Only load dashboards if not read-only and dashboards view is selected
    if ((readOnlyMode && view === "dashboards") || (!readOnlyMode && view === "dashboards")) {
      loadDashboards()
    }
  }, [readOnlyMode, view])

  const handleQueryClick = (query: SavedQuery) => {
    setSelectedQuery(query)
    if (onSelectQuery) {
      onSelectQuery(query)
    }
  }

  const handleDashboardClick = (dashboard: SavedDashboard) => {
    setSelectedDashboard(dashboard)
    if (onSelectDashboard) {
      onSelectDashboard(dashboard)
    }
  }

  const handleEditClick = (query: SavedQuery, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent query selection
    if (onEditQuery) {
      onEditQuery(query)
    }
  }

  return (
    <div className="bg-card rounded-lg shadow-md border border-border overflow-hidden h-full flex flex-col min-w-[220px] max-w-[340px]">
      {/* Title and radio buttons */}
      <div className="bg-card p-4 border-b border-border flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Save className="h-5 w-5" />
          <h2 className="text-xl font-mono font-bold px-1 py-0.5 bg-black text-white rounded" style={{ letterSpacing: "-0.5px" }}>
            {readOnlyMode ? "Saved Dashboards" : "Saved"}
          </h2>
        </div>
        {/* Radio selector: only in edit mode */}
        {!readOnlyMode && (
          <div className="flex items-center gap-4 mt-2 ml-1">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="history-panel-view"
                value="queries"
                checked={view === "queries"}
                onChange={() => setView("queries")}
                className="form-radio accent-white"
              />
              <span className="text-sm font-mono font-medium">Queries</span>
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="history-panel-view"
                value="dashboards"
                checked={view === "dashboards"}
                onChange={() => setView("dashboards")}
                className="form-radio accent-white"
              />
              <span className="text-sm font-mono font-medium">Dashboards</span>
            </label>
          </div>
        )}
      </div>

      {/* List */}
      <div className="p-3 overflow-y-auto flex-1">
        {/* Queries */}
        {view === "queries" && !readOnlyMode && (
          <>
            {loading && (
              <div className="space-y-2 p-1">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
            )}
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md">
                <p>Error loading saved queries: {error}</p>
              </div>
            )}
            {!loading && !error && queries.length === 0 && (
              <div className="text-center p-6 text-muted-foreground">
                <p>No saved queries found</p>
              </div>
            )}
            {!loading && !error && queries.length > 0 && (
              <div className="space-y-2">
                {queries.map((query) => (
                  <div key={query.id}>
                    <div
                      className={`relative group w-full text-left p-3 rounded-md border border-border hover:bg-muted transition-colors ${
                        selectedQuery?.id === query.id ? "bg-muted" : ""
                      }`}
                    >
                      <button
                        className="w-full text-left"
                        onClick={() => handleQueryClick(query)}
                      >
                        <span className="font-mono font-medium">{query.title}</span>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-background/50">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => handleEditClick(query, e)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {/* Dashboards */}
        {view === "dashboards" && (
          <>
            {dashboardLoading && (
              <div className="space-y-2 p-1">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
            )}
            {dashboardError && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md">
                <p>Error loading dashboards: {dashboardError}</p>
              </div>
            )}
            {!dashboardLoading && !dashboardError && dashboards.length === 0 && (
              <div className="text-center p-6 text-muted-foreground">
                <p>No saved dashboards found</p>
              </div>
            )}
            {!dashboardLoading && !dashboardError && dashboards.length > 0 && (
              <div className="space-y-2">
                {dashboards.map((dashboard) =>
                  readOnlyMode ? (
                    <button
                      key={dashboard.id}
                      className="block w-full text-left p-3 rounded-md border border-border hover:bg-muted transition-colors"
                      onClick={() => router.push(`?d=${dashboard.id}`)}
                    >
                      <span className="font-mono font-medium">{dashboard.title}</span>
                    </button>
                  ) : (
                    <div
                      key={dashboard.id}
                      className={`flex items-center justify-between w-full p-3 rounded-md border border-border hover:bg-muted transition-colors ${
                        selectedDashboard?.id === dashboard.id ? "bg-muted" : ""
                      }`}
                    >
                      <button
                        className="flex-1 text-left"
                        onClick={() => handleDashboardClick(dashboard)}
                      >
                        <span className="font-mono font-medium">{dashboard.title}</span>
                      </button>
                      <button
                        className="ml-2 p-1 rounded hover:bg-accent"
                        aria-label="Dashboard actions"
                        type="button"
                        // No modal logic yet
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        )}
        {/* (readOnlyMode dashboard UI can remain as before for now) */}
      </div>
    </div>
  )
}
