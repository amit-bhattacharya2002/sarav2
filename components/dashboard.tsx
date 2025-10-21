'use client'

import { ChevronLeft, ChevronRight, Save, Filter, Trash2, AlertTriangle, AlertCircle, XCircle, X, LogOut, Download, Share, Sparkles, ChevronDown } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { clearSession, canSaveDashboards, canUpdateDashboards } from '@/lib/auth'
import { useCurrentUser } from '@/components/auth-guard'
import { BarGraph } from '@/components/bar-graph'
import { TableView } from '@/components/table-view'
import { DropZone } from '@/components/drop-zone'
import { HistoryPanel } from '@/components/history-panel'
import { QueryPanel } from '@/components/query-panel'
import { ShareLinkDialog } from './share-link-dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PieGraph } from '@/components/pie-chart'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LayoutList, BarChart2, PieChart } from 'lucide-react'
import { DraggableChart } from '@/components/draggable-chart'
import { DraggablePieChart } from '@/components/draggable-pie'
import { ShareDashboardSection } from './share-dashboard-section'
import { GhostIndicator } from '@/components/ui/ghost-indicator'
import { DeleteConfirmationModal } from './delete-confirmation-modal'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'


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

export default function Dashboard() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const [allVisualizations, setAllVisualizations] = useState<Visualization[]>([]);
  const [quadrants, setQuadrants] = useState<{ topLeft: string | null; topRight: string | null; bottom: string | null }>({
    topLeft: null,
    topRight: null,
    bottom: null,
  });

  const [lastDroppedItem, setLastDroppedItem] = useState<any>(null);



    
    
  function handleSaveDashboard() {
    const usedVizIds = Object.values(quadrants).filter(Boolean);

    
    const saveReadyVisualizations = Object.entries(quadrants)
      .filter(([_, vizId]) => !!vizId)
      .map(([quadrant, vizId]: [string, string | null]) => {
        const viz = allVisualizations.find((v: Visualization) => v.id === vizId);
        if (!viz) return null;
        const title =
          quadrant === "topLeft"
            ? topLeftTitle
            : quadrant === "topRight"
            ? topRightTitle
            : quadrant === "bottom"
            ? bottomTitle
            : viz.title;
        const { id, type, columns, color, sql } = viz;
        return { id, type, title, columns, color, sql, quadrant };
      })
      .filter(Boolean);
    
    const saveReadySVisualizations = Object.entries(quadrants)
      .filter(([_, vizId]) => !!vizId)
      .map(([quadrant, vizId]: [string, string | null]) => {
        const viz = allVisualizations.find((v: Visualization) => v.id === vizId);
        if (!viz) return null;
        const title =
          quadrant === "topLeft"
            ? topLeftTitle
            : quadrant === "topRight"
            ? topRightTitle
            : quadrant === "bottom"
            ? bottomTitle
            : viz.title;
        
        // Create a complete snapshot of the visualization with exact column configuration
        const snapshotViz = {
          ...viz,
          title,
          quadrant,
          // Store the exact column configuration as it was when saved
          savedColumns: viz.columns ? [...viz.columns] : [],
          // Create a unique identifier that includes the exact column configuration
          columnConfigHash: viz.columns ? 
            JSON.stringify(viz.columns.map((col: any) => ({ key: col.key, name: col.name })).sort((a: any, b: any) => a.key.localeCompare(b.key))) : 
            '',
          // Store the original saved query ID for reference
          originalSavedQueryId: viz.originalId || viz.id,
          // Timestamp when this snapshot was created
          snapshotTimestamp: new Date().toISOString()
        };
        
        return snapshotViz;
      })
      .filter(Boolean);


    const payload = {
      ...(dashboardIdNumber ? { action: 'update', dashboardId: dashboardIdNumber } : {}),
      title: dashboardSectionTitle,
      quadrants,
      visualizations: saveReadyVisualizations,
      s_visualizations: saveReadySVisualizations,
      topLeftTitle,
      topRightTitle,
      bottomTitle,
    };

    
    fetch('/api/dashboard', {
      method: 'POST',
      headers: createHeaders(),
      body: JSON.stringify(payload),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          const isUpdate = !!dashboardIdNumber;
          // Show ghost indicator instead of alert
          setGhostMessage(isUpdate ? "Your dashboard has been updated successfully." : "Your dashboard has been saved successfully.");
          setShowGhostIndicator(true);
          // Hide ghost indicator after 3 seconds
          setTimeout(() => setShowGhostIndicator(false), 3000);
          
          // If this was a new dashboard (no id before), update the URL and let the app reload with the new ID!
          if (!dashboardId && data.dashboard?.id) {
            console.log('🔍 New dashboard saved, redirecting to:', `/dashboard?d=${data.dashboard.id}&edit=true`);
            
            // Set the original data for the newly created dashboard before redirecting
            const newOriginalData = {
              title: dashboardSectionTitle,
              topLeftTitle,
              topRightTitle,
              bottomTitle,
              quadrants,
              visualizations: allVisualizations
            };
            setOriginalDashboardData(newOriginalData);
            setHasDashboardChanges(false);
            setIsNewlyCreatedDashboard(true);
            
            router.replace(`/dashboard?d=${data.dashboard.id}&edit=true`);
            return;
          }
          
          // If this was an update, reset the change tracking
          if (isUpdate) {
            // Update the original data to reflect the current state
            const updatedOriginalData = {
              title: dashboardSectionTitle,
              topLeftTitle,
              topRightTitle,
              bottomTitle,
              quadrants,
              visualizations: allVisualizations
            };
            // Update originalDashboardData to reflect the newly saved state
            setOriginalDashboardData(updatedOriginalData);
            setHasDashboardChanges(false);
            setIsNewlyCreatedDashboard(false); // Reset flag after first update
            
            // Trigger history panel refresh for dashboard updates
            const event = new CustomEvent('dashboardUpdated', { 
              detail: { dashboardId: dashboardIdNumber } 
            });
            window.dispatchEvent(event);
          }
        } else {
          alert('Error saving dashboard: ' + (data.error || 'Unknown error'));
        }
      })
      .catch(err => {
        alert('Error saving dashboard: ' + err.message);
      });
  }

  function handleDeleteDashboard() {
    if (!dashboardIdNumber) {
      alert('No dashboard to delete');
      return;
    }

    setDeleteDashboardModalOpen(true);
    return;
  }

  const handleConfirmDeleteDashboard = async () => {
    if (!dashboardIdNumber) {
      alert('No dashboard to delete');
      return;
    }

    try {
      const response = await fetch(`/api/dashboard?id=${dashboardIdNumber}`, {
        method: 'DELETE',
        headers: createHeaders(),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Show ghost indicator instead of alert
        setGhostMessage("Your dashboard has been deleted successfully.");
        setShowGhostIndicator(true);
        // Hide ghost indicator after 3 seconds
        setTimeout(() => setShowGhostIndicator(false), 3000);
        
        // Clear all dashboard data
        setQuadrants({ topLeft: null, topRight: null, bottom: null });
        setAllVisualizations([]);
        setDashboardSectionTitle("Untitled Dashboard");
        setTopLeftTitle("Sample Title");
        setTopRightTitle("Sample Title");
        setBottomTitle("Sample Title");
        setOriginalDashboardData(null);
        setHasDashboardChanges(false);
        setIsNewlyCreatedDashboard(false);
        
        // Remove dashboardId from URL and set to new mode
        router.replace('/dashboard?edit=true');
        
        // Trigger history panel refresh for dashboard updates
        const event = new CustomEvent('dashboardUpdated', { 
          detail: { dashboardId: dashboardIdNumber } 
        });
        window.dispatchEvent(event);
      } else {
        alert('Error deleting dashboard: ' + (data.error || 'Unknown error'));
      }
    } catch (err: any) {
      alert('Error deleting dashboard: ' + err.message);
    }
  }

  
  const searchParams = useSearchParams();
  const dashboardId = searchParams.get('d');

  // Only treat dashboardId as valid if it's a positive integer
  const dashboardIdNumber = dashboardId && !isNaN(Number(dashboardId)) && Number(dashboardId) > 0 ? Number(dashboardId) : null;
  
  const editParam = searchParams.get('edit');
  const editMode = editParam === 'true';
  const readOnlyMode = !editMode;
    
  // TODO: make this work for read-only mode
  const [collapsedPanels, setCollapsedPanels] = useState<Record<'left' | 'middle' | 'right', boolean>>({
    left: false, // Collapsed in edit mode, expanded in read-only mode
    middle: false,
    right: true, // Start minimized when app loads
  })

  const [panelWidths, setPanelWidths] = useState<Record<'left' | 'middle' | 'right', string>>({
    left: '20%',
    middle: '40%',
    right: '40%',
  })

  const [question, setQuestion] = useState('')
  const [comboPrompt, setComboPrompt] = useState('')
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [outputMode, setOutputMode] = useState('table')
  const [isLoading, setIsLoading] = useState(false)
  const [isGlobalLoading, setIsGlobalLoading] = useState(false)
  const [processingTime, setProcessingTime] = useState<'fast' | 'longer' | null>(null)
  const [sqlQuery, setSqlQuery] = useState<string | null>(null)
  const [queryResults, setQueryResults] = useState<any[] | null>(null)
  const [columns, setColumns] = useState<{ key: string; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  
  // Delete confirmation modal states
  const [deleteDashboardModalOpen, setDeleteDashboardModalOpen] = useState(false)
  const [deleteQueryModalOpen, setDeleteQueryModalOpen] = useState(false)
  const [deleteSavedQueryModalOpen, setDeleteSavedQueryModalOpen] = useState(false)

  // Stabilize setQuestion to prevent unnecessary re-renders
  const stableSetQuestion = useCallback((value: string) => {
    setQuestion(value)
  }, [])

  // Handle combo prompt changes
  const handleComboPromptChange = useCallback((combo: string) => {
    setComboPrompt(combo)
  }, [])

  // Handle selected columns changes
  const handleSelectedColumnsChange = useCallback((columns: string[]) => {
    setSelectedColumns(columns)
  }, [])

  const stableSetOutputMode = useCallback((value: string) => {
    setOutputMode(value)
  }, [])

  const stableSetSqlQuery = useCallback((value: string | null) => {
    setSqlQuery(value)
  }, [])

  const stableSetQueryResults = useCallback((value: any[] | null) => {
    setQueryResults(value)
  }, [])

  const stableSetColumns = useCallback((value: { key: string; name: string }[]) => {
    setColumns(value)
  }, [])

  const stableSetError = useCallback((value: string | null) => {
    setError(value)
  }, [])

  const [dashboardSectionTitle, setDashboardSectionTitle] = useState("Sample Title")
  const [topLeftTitle, setTopLeftTitle] = useState("Sample Title");
  const [topRightTitle, setTopRightTitle] = useState("Sample Title");
  const [bottomTitle, setBottomTitle] = useState("Sample Title");

  const [filterModalOpen, setFilterModalOpen] = useState(false);

  // Add edit mode state
  const [isEditingSavedQuery, setIsEditingSavedQuery] = useState(false)
  const [editingQueryId, setEditingQueryId] = useState<number | null>(null)
  const [originalQueryData, setOriginalQueryData] = useState<any>(null)
  const [selectedSavedQueryId, setSelectedSavedQueryId] = useState<number | null>(null)
  const [saveStatus, setSaveStatus] = useState<null | "success" | "error" | "saving">(null)
  const [showGhostIndicator, setShowGhostIndicator] = useState(false)
  const [ghostMessage, setGhostMessage] = useState("")
  
  // Chart column selection state
  const [selectedXColumn, setSelectedXColumn] = useState<string>('')
  const [selectedYColumn, setSelectedYColumn] = useState<string>('')

  // Add dashboard change tracking state
  const [originalDashboardData, setOriginalDashboardData] = useState<any>(null)
  const [hasDashboardChanges, setHasDashboardChanges] = useState(false)
  const [isNewlyCreatedDashboard, setIsNewlyCreatedDashboard] = useState(false)
  const isUserActionRef = useRef(false)

  // Add tabbed panel state
  const [activeTabId, setActiveTabId] = useState<string>('active-query')
  const [tabs, setTabs] = useState<Array<{
    id: string
    title: string
    type: 'active' | 'saved'
    queryId?: number
    data?: any
  }>>([
    {
      id: 'active-query',
      title: 'Active Query',
      type: 'active'
    }
  ])

  // State for viewing saved queries directly in center pane
  const [viewingSavedQuery, setViewingSavedQuery] = useState<any>(null)
  
  // Main query panel sorting state
  const [mainSortColumn, setMainSortColumn] = useState<string | null>(null)
  const [mainSortDirection, setMainSortDirection] = useState<'asc' | 'desc' | null>(null)
  
  // Handle sorting changes from QueryPanel
  const handleMainSortChange = useCallback((column: string | null, direction: 'asc' | 'desc' | null) => {
    console.log('🔄 Dashboard: Main query panel sort change received:', { column, direction })
    console.log('🔄 Dashboard: Current mainSortColumn:', mainSortColumn, 'Current mainSortDirection:', mainSortDirection)
    setMainSortColumn(column)
    setMainSortDirection(direction)
  }, [mainSortColumn, mainSortDirection])

  // Add state for collapsible panels
  // const [showSavedQueries, setShowSavedQueries] = useState(true);
  // const [showCreateDashboard, setShowCreateDashboard] = useState(true);

  // Function to check if dashboard has changes
  const checkDashboardChanges = () => {
    console.log('🔍 checkDashboardChanges called:', {
      hasOriginalData: !!originalDashboardData,
      isGlobalLoading,
      isUserAction: isUserActionRef.current,
      originalData: originalDashboardData
    });

    if (!originalDashboardData) {
      // If no original data, we're creating a new dashboard
      // For new dashboards, we should enable the Update button when there are visualizations
      const hasVisualizations = Object.values(quadrants).some(Boolean);
      setHasDashboardChanges(hasVisualizations);
      console.log('🔍 No original data - new dashboard mode, hasVisualizations:', hasVisualizations);
      return;
    }

    // Don't check for changes if we're still loading the dashboard
    if (isGlobalLoading) {
      console.log('🔍 Still loading dashboard, skipping change check');
      return;
    }

    const currentData = {
      title: dashboardSectionTitle,
      topLeftTitle,
      topRightTitle,
      bottomTitle,
      quadrants,
      visualizations: allVisualizations
    };

    // More robust change detection
    const titleChanged = currentData.title !== originalDashboardData.title;
    const topLeftChanged = currentData.topLeftTitle !== originalDashboardData.topLeftTitle;
    const topRightChanged = currentData.topRightTitle !== originalDashboardData.topRightTitle;
    const bottomChanged = currentData.bottomTitle !== originalDashboardData.bottomTitle;
    const quadrantsChanged = JSON.stringify(currentData.quadrants) !== JSON.stringify(originalDashboardData.quadrants);
    
    // Simplified visualization change detection
    const vizChanged = allVisualizations.length !== originalDashboardData.visualizations.length ||
      JSON.stringify(allVisualizations.map(v => ({ id: v.id, type: v.type }))) !== 
      JSON.stringify(originalDashboardData.visualizations.map(v => ({ id: v.id, type: v.type })));

    const hasChanges = titleChanged || topLeftChanged || topRightChanged || bottomChanged || quadrantsChanged || vizChanged;

    console.log('🔍 Change check for saved dashboard:', {
      hasChanges,
      titleChanged,
      topLeftChanged,
      topRightChanged,
      bottomChanged,
      quadrantsChanged,
      vizChanged,
      currentVizCount: allVisualizations.length,
      originalVizCount: originalDashboardData.visualizations.length,
      currentQuadrants: currentData.quadrants,
      originalQuadrants: originalDashboardData.quadrants,
      currentTitle: currentData.title,
      originalTitle: originalDashboardData.title,
      isUserAction: isUserActionRef.current
    });

    // If this is a user action (like dropping a visualization), don't override the forced value
    if (isUserActionRef.current) {
      console.log('🔍 User action in progress, keeping hasDashboardChanges as is');
      return;
    }

    setHasDashboardChanges(hasChanges);
  };

  // Manual trigger for change detection
  const triggerChangeDetection = () => {
    console.log('🔍 Manual change detection triggered');
    console.log('🔍 Current visualizations count:', allVisualizations.length);
    console.log('🔍 Original visualizations count:', originalDashboardData?.visualizations?.length || 0);
    
    isUserActionRef.current = true;
    
    // Force set changes to true immediately for user actions
    setHasDashboardChanges(true);
    console.log('🔍 Forced hasDashboardChanges to true');
    
    // Don't call checkDashboardChanges() for user actions - just keep the forced value
    // The useEffect will handle proper change detection later
    
    // Reset the flag after a longer delay
    setTimeout(() => {
      isUserActionRef.current = false;
      console.log('🔍 Reset user action flag');
    }, 2000);
  };

  // Simplified change detection - only consider it changed if there's an actual difference
  const hasDashboardChangesSimplified = () => {
    if (!originalDashboardData) return false;
    
    // Check if visualization count changed
    if (allVisualizations.length !== originalDashboardData.visualizations.length) {
      console.log('🔍 Simplified change detection: visualization count changed', {
        current: allVisualizations.length,
        original: originalDashboardData.visualizations.length
      });
      return true;
    }
    
    // Check if any visualization IDs, types, or column orders are different
    const currentVizData = allVisualizations.map(v => ({ 
      id: v.id, 
      type: v.type,
      columns: v.columns // Include column order in comparison
    }));
    const originalVizData = originalDashboardData.visualizations.map(v => ({ 
      id: v.id, 
      type: v.type,
      columns: v.columns // Include column order in comparison
    }));
    
    const vizChanged = JSON.stringify(currentVizData) !== JSON.stringify(originalVizData);
    
    if (vizChanged) {
      console.log('🔍 Simplified change detection: visualization content changed', {
        current: currentVizData,
        original: originalVizData
      });
      return true;
    }
    
    // Check other dashboard properties
    const titleChanged = dashboardSectionTitle !== originalDashboardData.title;
    const topLeftChanged = topLeftTitle !== originalDashboardData.topLeftTitle;
    const topRightChanged = topRightTitle !== originalDashboardData.topRightTitle;
    const bottomChanged = bottomTitle !== originalDashboardData.bottomTitle;
    const quadrantsChanged = JSON.stringify(quadrants) !== JSON.stringify(originalDashboardData.quadrants);
    
    const hasChanges = titleChanged || topLeftChanged || topRightChanged || bottomChanged || quadrantsChanged;
    
    if (hasChanges) {
      console.log('🔍 Simplified change detection: other properties changed', {
        titleChanged,
        topLeftChanged,
        topRightChanged,
        bottomChanged,
        quadrantsChanged
      });
      return true;
    }
    
    console.log('🔍 Simplified change detection: no changes detected');
    return false;
  };

  // Effect to check for changes when dashboard data changes
  useEffect(() => {
    console.log('🔍 Change detection useEffect triggered:', {
      hasOriginalData: !!originalDashboardData,
      isUserAction: isUserActionRef.current,
      isGlobalLoading,
      willCheckChanges: originalDashboardData && !isGlobalLoading
    });
    
    // Check for changes if we're not loading
    // For saved dashboards: check against original data
    // For new dashboards: enable button when visualizations are added
    if (!isGlobalLoading) {
      checkDashboardChanges();
    }
  }, [originalDashboardData, dashboardSectionTitle, topLeftTitle, topRightTitle, bottomTitle, quadrants, allVisualizations.length, isGlobalLoading]);

  // Separate effect to watch for visualization content changes
  useEffect(() => {
    if (originalDashboardData && !isGlobalLoading) {
      // Check if visualization content has changed (not just count)
      const vizContentChanged = JSON.stringify(allVisualizations.map(v => ({ id: v.id, type: v.type, title: v.title }))) !== 
        JSON.stringify(originalDashboardData.visualizations.map(v => ({ id: v.id, type: v.type, title: v.title })));
      
      if (vizContentChanged) {
        console.log('🔍 Visualization content changed, triggering change detection');
        checkDashboardChanges();
      }
    }
  }, [allVisualizations, originalDashboardData, isGlobalLoading]);

  // Effect to ensure change detection is properly initialized when dashboard loads
  useEffect(() => {
    if (originalDashboardData && !isGlobalLoading && dashboardIdNumber) {
      console.log('🔍 Dashboard loaded, ensuring change detection is initialized');
      // Force a change detection check after a short delay to ensure all state is settled
      setTimeout(() => {
        checkDashboardChanges();
      }, 200);
    }
  }, [originalDashboardData, isGlobalLoading, dashboardIdNumber]);

  // Effect to reset change tracking when loading finishes
  // Temporarily disabled to prevent overriding manual change detection
  // useEffect(() => {
  //   if (!isGlobalLoading && originalDashboardData && dashboardIdNumber && !isUserActionRef.current) {
  //     // Dashboard has finished loading, reset change tracking
  //     // Only reset if we're not in the middle of a user action
  //     setHasDashboardChanges(false);
  //     console.log('🔍 Dashboard loading finished, resetting change tracking');
  //   }
  // }, [isGlobalLoading, originalDashboardData, dashboardIdNumber, isUserActionRef]);

  
  
  useEffect(() => {
    console.log("🏁 Dashboard loader useEffect running!", { readOnlyMode, dashboardId, editMode });
    const loadDashboard = async () => {
      // Load dashboard if we have a dashboardId and we're either in read-only mode OR edit mode
      if (!dashboardId || (!readOnlyMode && !editMode)) return;
  
      setIsGlobalLoading(true);
  
      try {
        const res = await fetch(`/api/dashboard?id=${dashboardId}`, {
          headers: createHeaders()
        });
        const responseData = await res.json();
        
        // Extract dashboard data from the response
        const data = responseData.dashboard;
        if (!data) {
          throw new Error('Dashboard data not found');
        }

        const { id, title, quadrants, visualizations, s_visualizations, sVisualizations } = data;
        setDashboardSectionTitle(title || "Untitled Dashboard");

        setTopLeftTitle(data.topLeftTitle || "Sample Title");
        setTopRightTitle(data.topRightTitle || "Sample Title");
        setBottomTitle(data.bottomTitle || "Sample Title");

        // Parse quadrants JSON string
        const parsedQuadrants = typeof quadrants === 'string' ? JSON.parse(quadrants) : quadrants;
        
        // Parse visualizations JSON string
        const parsedVizList = typeof visualizations === 'string' ? JSON.parse(visualizations) : visualizations;

        // Handle both field name formats from API
        const sVisualizationsData = sVisualizations || s_visualizations;
        
        // DEBUG: Are we loading from cache?
        console.log("🔍 Checking cached data:", { sVisualizationsData, sVisualizations, s_visualizations });
        
        // Parse the cached data if it's a string
        let parsedCachedVisualizations = null;
        if (sVisualizationsData) {
          try {
            parsedCachedVisualizations = typeof sVisualizationsData === 'string' 
              ? JSON.parse(sVisualizationsData) 
              : sVisualizationsData;
            console.log("✅ Parsed cached visualizations:", parsedCachedVisualizations);
          } catch (error) {
            console.error("❌ Error parsing cached visualizations:", error);
            parsedCachedVisualizations = null;
          }
        }
        
        if (Array.isArray(parsedCachedVisualizations) && parsedCachedVisualizations.length > 0) {
          console.log("✅ Loading dashboard from CACHE (sVisualizations)!");
          
          // Transform cached visualizations to ensure chart data is properly formatted and use saved columns
          const transformedVisualizations = parsedCachedVisualizations.map(viz => {
            // Use saved columns if available, otherwise fall back to current columns
            const columnsToUse = viz.savedColumns && viz.savedColumns.length > 0 ? viz.savedColumns : viz.columns;
            
            if ((viz.type === 'chart' || viz.type === 'pie') && Array.isArray(viz.data)) {
              // Check if data is already in chart format (has name/value structure)
              const isChartFormat = viz.data.length > 0 && 
                typeof viz.data[0] === 'object' && 
                'name' in viz.data[0] && 
                'value' in viz.data[0];
              
              console.log(`🔍 Chart ${viz.id} (${viz.type}): isChartFormat=${isChartFormat}, dataLength=${viz.data.length}, savedColumnsLength=${viz.savedColumns?.length || 0}, currentColumnsLength=${viz.columns?.length || 0}`);
              
              if (!isChartFormat && columnsToUse && columnsToUse.length >= 2) {
                // Transform raw data to chart format using saved columns
                const chartData = viz.data.map((row: any) => ({
                  name: row[columnsToUse[0]?.key] || 'Unknown',
                  value: Number(row[columnsToUse[1]?.key]) || 0,
                }));
                
                console.log(`✅ Transformed chart data for ${viz.id} using saved columns:`, chartData.slice(0, 3));
                return { ...viz, data: chartData, columns: columnsToUse };
              }
            }
            
            // Return visualization with saved columns if available
            return { ...viz, columns: columnsToUse || viz.columns };
          });
          
          setAllVisualizations(transformedVisualizations);
        
          // Use snapshot data directly - no need for complex matching since we store complete snapshots
          const quadrantMap: any = {};
          console.log("🔍 Using snapshot data directly for quadrant mapping");
          
          for (const quadrant in parsedQuadrants) {
            const expectedOriginalId = parsedQuadrants[quadrant];
            
            // Find the snapshot that matches this quadrant
            const snapshot = parsedCachedVisualizations.find(v => v.quadrant === quadrant);
            
            if (snapshot) {
              console.log(`✅ Found snapshot for ${quadrant}:`, { 
                id: snapshot.id, 
                type: snapshot.type, 
                title: snapshot.title,
                hasSavedColumns: !!snapshot.savedColumns,
                columnCount: snapshot.savedColumns?.length || 0
              });
              quadrantMap[quadrant] = snapshot.id;
            } else {
              console.log(`❌ No snapshot found for ${quadrant}`);
              quadrantMap[quadrant] = null;
            }
          }
          
          console.log("🔍 Final quadrant mapping:", quadrantMap);
          
          setQuadrants({
            topLeft: quadrantMap.topLeft || null,
            topRight: quadrantMap.topRight || null,
            bottom: quadrantMap.bottom || null,
          });
        
          // Expand the right panel to show the loaded dashboard
          setCollapsedPanels(prev => ({ ...prev, right: false }));

          // Set original dashboard data for change tracking (cache path)
          const originalData = {
            title: title || "Untitled Dashboard",
            topLeftTitle: data.topLeftTitle || "Sample Title",
            topRightTitle: data.topRightTitle || "Sample Title",
            bottomTitle: data.bottomTitle || "Sample Title",
            quadrants: {
              topLeft: quadrantMap.topLeft || null,
              topRight: quadrantMap.topRight || null,
              bottom: quadrantMap.bottom || null,
            },
            visualizations: transformedVisualizations
          };
          setOriginalDashboardData(originalData);
          setIsNewlyCreatedDashboard(false); // This is an existing dashboard being loaded
          console.log('🔍 Original dashboard data set (URL load cache path):', originalData);

          // Initialize change detection after loading
          setTimeout(() => {
            console.log('🔍 Initializing change detection after dashboard load (cache path)');
            checkDashboardChanges();
          }, 100);

          setIsGlobalLoading(false);
          return;
        }
  
        // DEBUG: Fallback to SQL
        console.log("⏳ No cache found, re-running SQL for all visualizations.");
        // ... legacy SQL rerun logic ...
        const quadrantMap = {};
        let loadedCount = 0;
  
        const handleLoaded = () => {
          loadedCount++;
          if (loadedCount === visualizations.length) {
            setIsGlobalLoading(false);
          }
        };
  
        if (!parsedVizList || parsedVizList.length === 0) {
          console.log("ℹ️ No visualizations to load, skipping SQL execution");
          setIsGlobalLoading(false);
          return;
        }
  
        for (const viz of parsedVizList || []) {
          const fetchAndAddViz = async () => {
            try {
              const resultRes = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  question: 'Dashboard Query',
                  sql: viz.sql,
                  outputMode: 'table',
                  columns: [{ key: 'id', name: 'ID' }] // Provide a default column structure
                }),
              });
  
              const result = await resultRes.json();
              if (!resultRes.ok) throw new Error(result.error || 'Query failed');

              const chartData =
                viz.type === 'chart' || viz.type === 'pie'
                  ? result.data.map(row => ({
                      name: row[result.columns[0]?.key] || 'Unknown',
                      value: Number(row[result.columns[1]?.key]) || 0,
                    }))
                  : result.data;
  
              // Create stable ID based on content and column order
              const stableId = `load-${viz.type}-${JSON.stringify(chartData).slice(0, 100)}-${JSON.stringify(result.columns?.map(col => col.key) || []).slice(0, 50)}-${viz.sql ? viz.sql.slice(0, 50) : 'no-sql'}`

              const newViz = {
                id: stableId,
                type: viz.type,
                title: viz.title || 'Query Result',
                data: chartData,
                columns: result.columns || [],
                color: viz.color || 'hsl(var(--chart-4))',
                originalId: viz.id,
                sql: viz.sql,
              };
  
              setAllVisualizations(prev => [...prev, newViz]);
  
              for (const quadrant in parsedQuadrants) {
                if (parsedQuadrants[quadrant] === viz.id) {
                  setQuadrants(prev => ({ ...prev, [quadrant]: newViz.id }));
                }
              }
            } catch (err) {
              console.error('Error loading visualization:', err);
            } finally {
              handleLoaded();
            }
          };
  
          fetchAndAddViz();
        }
      } catch (err) {
        console.error('Failed to load read-only dashboard:', err);
        setIsGlobalLoading(false);
      }
    };
  
    loadDashboard();
  }, [readOnlyMode, dashboardId, editMode]);
    

  
  const togglePanel = (panel: 'left' | 'middle' | 'right') => {
    // Prevent right panel from being collapsed in read-only mode
    if (readOnlyMode && panel === 'right') {
      return
    }
    
    setCollapsedPanels((prev) => ({
      ...prev,
      [panel]: !prev[panel],
    }))
  }




  
  
  useEffect(() => {
    const collapsedWidth = '100px';
    console.log('🔍 Panel state debugging:', { 
      readOnlyMode, 
      collapsedPanels, 
      leftCollapsed: collapsedPanels.left,
      middleCollapsed: collapsedPanels.middle,
      rightCollapsed: collapsedPanels.right 
    });
    
    if (readOnlyMode) {
      // In read-only mode, we only have left (history) and right (dashboard) panels
      // Calculate proper widths that account for gaps and don't squeeze panels
      const leftWidth = collapsedPanels.left ? collapsedWidth : '300px'; // Fixed width instead of percentage
      const rightWidth = collapsedPanels.left 
        ? `calc(100% - ${collapsedWidth} - 0.5rem)` // Account for gap 
        : `calc(100% - 300px - 0.5rem)`; // Account for gap
      
      console.log('🔍 Read-only mode panel widths:', { leftWidth, rightWidth });
      
      setPanelWidths({
        left: leftWidth,
        middle: '0%',
        right: rightWidth,
      });
      return;
    }
    
    // Regular logic in edit mode - handle all three panels
    const fullWidth = 100;
    
    // Left panel: fixed size (20% when expanded, 100px when collapsed)
    const leftWidth = collapsedPanels.left ? 3 : 20;
    
    // Calculate remaining space for middle and right panels
    const remainingWidth = fullWidth - leftWidth;
    
    // Middle and right panels share the remaining space
    const middleWidth = collapsedPanels.middle ? 3 : 40;
    const rightWidth = collapsedPanels.right ? 3 : 40;
    
    // Calculate how much space middle and right panels actually need
    const middleRightUsed = middleWidth + rightWidth;
    const middleRightRemaining = remainingWidth - middleRightUsed;
    
    // Distribute remaining space between middle and right panels only
    let middleFinal = middleWidth;
    let rightFinal = rightWidth;
    
    if (middleRightRemaining > 0) {
      const nonCollapsedMiddleRight = [
        !collapsedPanels.middle,
        !collapsedPanels.right
      ].filter(Boolean).length;
      
      if (nonCollapsedMiddleRight > 0) {
        const extraPerPanel = middleRightRemaining / nonCollapsedMiddleRight;
        if (!collapsedPanels.middle) middleFinal += extraPerPanel;
        if (!collapsedPanels.right) rightFinal += extraPerPanel;
      }
    }
    
    const newPanelWidths = {
      left: collapsedPanels.left ? collapsedWidth : `${leftWidth}%`,
      middle: collapsedPanels.middle ? collapsedWidth : `${middleFinal}%`,
      right: collapsedPanels.right ? collapsedWidth : `${rightFinal}%`,
    };
    
    console.log('🔍 Edit mode panel widths:', newPanelWidths);
    setPanelWidths(newPanelWidths);
  }, [collapsedPanels, readOnlyMode]);
  
  







  
  // Helper function to predict if query will use fast path
  const predictProcessingTime = (question: string): 'fast' | 'longer' => {
    const q = question.toLowerCase().trim()
    
    // Check for fast path patterns
    // Pattern 1: "top N donors of YEAR by age/name/amount" with sorting
    const m1 = q.match(/\btop\s+(\d+)\s+donors?\s+of\s+(\d{4})(?:\s+by\s+(?:their\s+)?(age|name|amount)|\s*,\s*sort\s+by\s+(age|name|amount)(?:\s+in\s+(?:ascending|descending)\s+order)?)\b/i)
    if (m1) return 'fast'
    
    // Pattern 2: "top N donors of YEAR" (basic, no additional sorting/filtering)
    const m2 = q.match(/\btop\s+(\d+)\s+donors?\s+of\s+(\d{4})\b/i)
    if (m2 && !q.match(/\b(?:and\s+)?(?:sort|by|age|name|amount|older|younger|between|gender|alumni)\b/i)) {
      return 'fast'
    }
    
    // Pattern 2b: "top donors of YEAR" or "show me top donors of YEAR" (without explicit number)
    const m2b = q.match(/\b(?:show\s+me\s+)?top\s+donors?\s+of\s+(\d{4})\b/i)
    if (m2b && !q.match(/\b(?:and\s+)?(?:sort|by|age|name|amount|older|younger|between|gender|alumni)\b/i)) {
      return 'fast'
    }
    
    // Pattern 3: "top N donations of YEAR"
    const m3 = q.match(/\btop\s+(\d+)\s+donations?\s+of\s+(\d{4})\b/i)
    if (m3) return 'fast'
    
    // Pattern 4: "top N donors of YEAR, include FIELD1, FIELD2" (with include requests)
    const m4 = q.match(/\btop\s+(\d+)\s+donors?\s+of\s+(\d{4})(?:,|\s+and)?\s+include\s+(.+?)(?:\s+and\s+(.+?))?(?:\s+and\s+(.+?))?$/i)
    if (m4 && !q.match(/\b(?:and\s+)?(?:sort|by|older|younger|between)\b/i)) return 'fast'
    
    // Pattern 4b: "show me top donors of YEAR, include FIELD1, FIELD2" (without explicit number)
    const m4b = q.match(/\b(?:show\s+me\s+)?top\s+donors?\s+of\s+(\d{4})(?:,|\s+and)?\s+include\s+(.+?)(?:\s+and\s+(.+?))?(?:\s+and\s+(.+?))?$/i)
    if (m4b && !q.match(/\b(?:and\s+)?(?:sort|by|older|younger|between)\b/i)) return 'fast'
    
    // If none of the fast path patterns match, it will use LLM pipeline
    return 'longer'
  }

  const handleQuerySubmit = async (queryToExecute?: string) => {
    const query = queryToExecute || question
    if (!query) return
    setIsLoading(true)
    setError(null)
    const predictedTime = predictProcessingTime(query)
    console.log('🔮 Predicted processing time for:', query, '→', predictedTime)
    setProcessingTime(predictedTime)

    try {
      const res = await fetch('/api/generate-sql', {
        method: 'POST',
        headers: createHeaders(),
        body: JSON.stringify({ question: query }),
      })

      const data = await res.json()
      if (!res.ok) {
        console.error('🔴 SQL Generation Error:', data)
        throw new Error(data.error || data.message || 'SQL generation failed')
      }

      setSqlQuery(data.sql)

      const resultRes = await fetch('/api/query', {
        method: 'POST',
        headers: createHeaders(),
        body: JSON.stringify({ 
          question: question || 'Query',
          sql: data.sql,
          outputMode: outputMode,
          columns: []
        }),
      })

      const result = await resultRes.json()
      if (!resultRes.ok) {
        console.error('🔴 Query Execution Error:', result)
        throw new Error(result.error || result.message || 'Query execution failed')
      }

      setQueryResults(result.data || [])
      setColumns(result.columns || [])

      // Create stable ID based on content and column order
      const stableId = `query-${outputMode}-${JSON.stringify(result.data).slice(0, 100)}-${JSON.stringify(result.columns?.map(col => col.key) || []).slice(0, 50)}-${data.sql ? data.sql.slice(0, 50) : 'no-sql'}`
      console.log('🪄 handleQuerySubmit generating stableId:', stableId)

      // Save as draggable visualization -- REMOVE `data`, ADD `sql`
      const newViz = {
        id: stableId,
        type: outputMode,
        title: 'Query Result',
        columns:
          outputMode === 'table' && result.columns
            ? result.columns.map(col => ({ key: col.key, name: col.name }))
            : [],
        color: 'hsl(var(--chart-4))',
        sql: data.sql, // <-- Always include SQL
        data: result.data || [],   // <<< ADD THIS
      }

      setAllVisualizations((prev) => [...prev, newViz])
      
      // Trigger change detection for new visualization after state update
      setTimeout(() => {
        triggerChangeDetection();
      }, 50);

    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Unknown error')
      setProcessingTime(null)
    } finally {
      setIsLoading(false)
    }
  }


  const runSqlQuery = async (sql: string, mode: string) => {
    try {
      setIsLoading(true)
      setError(null)
      setProcessingTime(null)
  
      const resultRes = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: question || 'Query',
          sql,
          outputMode: mode,
          columns: []
        }),
      })
  
      const result = await resultRes.json()
      if (!resultRes.ok) throw new Error(result.error || 'Query execution error')
  
      setQueryResults(result.data || [])
      setColumns(result.columns || [])
  
      // Create stable ID based on content
      const stableId = `sql-${mode}-${JSON.stringify(result.data).slice(0, 100)}-${JSON.stringify(result.columns?.map(col => col.key) || []).slice(0, 50)}-${sql ? sql.slice(0, 50) : 'no-sql'}`

      // Save as draggable visualization -- REMOVE `data`, ADD `sql`
      const newViz = {
        id: stableId,
        type: mode,
        title: 'Query Result',
        columns:
          mode === 'table' && result.columns
            ? result.columns.map(col => ({ key: col.key, name: col.name }))
            : [],
        color: 'hsl(var(--chart-4))',
        sql, // <-- Always include SQL argument
      }
  
      setAllVisualizations((prev) => [...prev, newViz])
      
      // Trigger change detection for new visualization after state update
      setTimeout(() => {
        triggerChangeDetection();
      }, 50);
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }



  // Handle updating a saved query
  const handleUpdateSavedQuery = async () => {
    if (!selectedSavedQueryId) return;
    
    try {
  setSaveStatus("saving");
  
  // Prepare visual config for charts and sorting
const visualConfig = (() => {
  const config: any = {}
  
  // Add chart configuration
  if ((outputMode === 'chart' || outputMode === 'pie') && selectedXColumn && selectedYColumn) {
    config.selectedXColumn = selectedXColumn
    config.selectedYColumn = selectedYColumn
    config.outputMode = outputMode
  }
  
  // Add sorting configuration
  if (mainSortColumn && mainSortDirection) {
    console.log('🔄 Dashboard: Adding sorting config to visualConfig:', { mainSortColumn, mainSortDirection })
    config.sortColumn = mainSortColumn
    config.sortDirection = mainSortDirection
  } else {
    console.log('🔄 Dashboard: No sorting config to add - mainSortColumn:', mainSortColumn, 'mainSortDirection:', mainSortDirection)
  }
  
  return Object.keys(config).length > 0 ? config : null
})();

console.log('🪄 Updating saved query with visualConfig:', visualConfig);
  
  const response = await fetch('/api/query', {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({
      action: 'update',
      id: selectedSavedQueryId,
      title: question,
      question: question,
      comboPrompt: comboPrompt || question,
      sql: sqlQuery,
      outputMode: outputMode,
      columns: columns,
      visualConfig,
      selectedColumns: selectedColumns,
      filteredColumns: {} // Empty for main query panel
    })
  });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update query');
      }

      setSaveStatus("success");
      setIsEditingSavedQuery(false);
      
      // Show ghost indicator
      setGhostMessage("Your query has been updated successfully.");
      setShowGhostIndicator(true);
      // Hide ghost indicator after 3 seconds
      setTimeout(() => setShowGhostIndicator(false), 3000);
      
      // Update original data to reflect current state
      setOriginalQueryData({
        question,
        sql: sqlQuery,
        outputMode,
        data: queryResults,
        columns,
        visualConfig: {
          selectedXColumn,
          selectedYColumn,
          sortColumn: mainSortColumn,
          sortDirection: mainSortDirection
        },
        sortColumn: mainSortColumn,
        sortDirection: mainSortDirection
      });
      
      // Trigger history panel refresh
      const event = new CustomEvent('queryUpdated', { detail: { queryId: selectedSavedQueryId } });
      window.dispatchEvent(event);
      
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err: any) {
      console.error('Error updating query:', err);
      setSaveStatus("error");
      setError(err.message || 'Failed to update query');
      setTimeout(() => setSaveStatus(null), 2000);
    }
  }

  // Cancel edit mode - clear everything and return to blank active query
  const handleCancelEdit = () => {
    // Clear the current query and reset to new query mode
    handleClearQuery();
    
    // Trigger history panel to clear selection highlighting
    const event = new CustomEvent('queryCleared');
    window.dispatchEvent(event);
  }

  // Handle deleting a saved query
  const handleDeleteSavedQuery = async () => {
    if (!selectedSavedQueryId) return;
    
    setDeleteQueryModalOpen(true);
    return;
  }

  const handleConfirmDeleteQuery = async () => {
    if (!selectedSavedQueryId) return;
    
    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: createHeaders(),
        body: JSON.stringify({
          action: 'delete',
          id: selectedSavedQueryId
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete query');
      }

      // Show ghost indicator
      setGhostMessage("Your query has been deleted successfully.");
      setShowGhostIndicator(true);
      // Hide ghost indicator after 3 seconds
      setTimeout(() => setShowGhostIndicator(false), 3000);

      // Clear the current query and reset to new query mode
      handleClearQuery();
      
      // Trigger history panel refresh
      const event = new CustomEvent('queryUpdated', { detail: { queryId: selectedSavedQueryId } });
      window.dispatchEvent(event);
      
    } catch (err: any) {
      console.error('Error deleting query:', err);
      setError(err.message || 'Failed to delete query');
    }
  }

  const handleConfirmDeleteSavedQuery = async () => {
    // This function will be called from the modal, but we need to get the query ID from the current context
    // For now, we'll use a simple approach - this can be enhanced later
    const currentQueryId = selectedSavedQueryId;
    
    if (!currentQueryId) return;
    
    try {
      const response = await fetch('/api/query', {
        method: 'DELETE',
        headers: createHeaders(),
        body: JSON.stringify({ id: currentQueryId })
      });

      if (!response.ok) {
        throw new Error('Failed to delete query');
      }

      // Show ghost indicator
      setGhostMessage("Your query has been deleted successfully.");
      setShowGhostIndicator(true);
      // Hide ghost indicator after 3 seconds
      setTimeout(() => setShowGhostIndicator(false), 3000);

      // Clear the current query and reset to new query mode
      handleClearQuery();
      
      // Trigger history panel refresh
      const event = new CustomEvent('queryUpdated', { detail: { action: 'deleted', queryId: currentQueryId } });
      window.dispatchEvent(event);
      
    } catch (err: any) {
      console.error('Error deleting query:', err);
      setError(err.message || 'Failed to delete query');
    }
  }

  // Check if there are changes from original data
const hasChanges = () => {
  if (!originalQueryData) return false;
  
  // Check for column order changes
  const hasColumnOrderChanged = () => {
    if (!originalQueryData.columns || !columns) return false;
    if (originalQueryData.columns.length !== columns.length) return true;
    
    return originalQueryData.columns.some((originalCol: any, index: number) => {
      const currentCol = columns[index];
      return !currentCol || originalCol.key !== currentCol.key;
    });
  };
  
  // Check for chart configuration changes
  const hasChartConfigChanged = () => {
    if (outputMode !== 'chart' && outputMode !== 'pie') return false;
    
    const originalVisualConfig = originalQueryData.visualConfig;
    const currentXColumn = selectedXColumn;
    const currentYColumn = selectedYColumn;
    
    console.log('🪄 hasChartConfigChanged check:', {
      outputMode,
      originalVisualConfig,
      currentXColumn,
      currentYColumn
    });
    
    // If no original visual config, check if current config is different from defaults
    if (!originalVisualConfig) {
      const isDifferent = currentXColumn !== columns[0]?.key || currentYColumn !== columns[1]?.key;
      console.log('🪄 No original config, checking against defaults:', {
        currentXColumn,
        currentYColumn,
        defaultX: columns[0]?.key,
        defaultY: columns[1]?.key,
        isDifferent
      });
      return isDifferent;
    }
    
    // Compare with original visual config
    const isDifferent = (
      originalVisualConfig.selectedXColumn !== currentXColumn ||
      originalVisualConfig.selectedYColumn !== currentYColumn
    );
    console.log('🪄 Comparing with original config:', {
      originalX: originalVisualConfig.selectedXColumn,
      originalY: originalVisualConfig.selectedYColumn,
      currentX: currentXColumn,
      currentY: currentYColumn,
      isDifferent
    });
    return isDifferent;
  };
  
  // Check for sorting changes
  const hasSortingChanged = () => {
    const originalSortColumn = originalQueryData.sortColumn || null;
    const originalSortDirection = originalQueryData.sortDirection || null;
    
    // Compare with current sorting state
    const sortingChanged = originalSortColumn !== mainSortColumn ||
                          originalSortDirection !== mainSortDirection;
    
    console.log('🪄 Sorting change check:', {
      originalSortColumn,
      currentSortColumn: mainSortColumn,
      originalSortDirection,
      currentSortDirection: mainSortDirection,
      sortingChanged
    });
    
    return sortingChanged;
  };
  
  const questionChanged = question !== originalQueryData.question;
  const sqlChanged = sqlQuery !== originalQueryData.sql;
  const outputModeChanged = outputMode !== originalQueryData.outputMode;
  const columnOrderChanged = hasColumnOrderChanged();
  const chartConfigChanged = hasChartConfigChanged();
  const sortingChanged = hasSortingChanged();
  
  const hasChanges = (
    questionChanged ||
    sqlChanged ||
    outputModeChanged ||
    columnOrderChanged ||
    sortingChanged ||
    chartConfigChanged
  );
  
  console.log('🪄 hasChanges function result:', {
    questionChanged,
    sqlChanged,
    outputModeChanged,
    columnOrderChanged,
    sortingChanged,
    chartConfigChanged,
    hasChanges
  });
  
  return hasChanges;
}

  // Clear query function
  const handleClearQuery = () => {
    setQuestion('');
    setComboPrompt('');
    setSqlQuery(null);
    setQueryResults(null);
    setColumns([]);
    setError(null);
    setSelectedSavedQueryId(null);
    setIsEditingSavedQuery(false);
    setOriginalQueryData(null);
    setSaveStatus(null);
    setSelectedXColumn('');
    setSelectedYColumn('');
    setSelectedColumns([]); // Reset selected columns
  }



  // Open saved query in a new tab
  const openSavedQueryTab = (query: any) => {
    console.log('🔄 openSavedQueryTab called with query:', query.id, query.title)
    const tabId = `saved-query-${query.id}`
    
    // Check if tab already exists
    const existingTab = tabs.find(tab => tab.id === tabId)
    if (existingTab) {
      console.log('🔄 Tab already exists, switching to it:', tabId)
      setActiveTabId(tabId)
      return
    }

    // Add new tab
    const newTab = {
      id: tabId,
      title: query.title || query.queryText || 'Saved Query',
      type: 'saved' as const,
      queryId: query.id,
      data: query
    }

    console.log('🔄 Creating new tab:', newTab)
    setTabs(prev => [...prev, newTab])
    setActiveTabId(tabId)
  }

  // Load saved query into main active query panel (legacy function)
  const loadSavedQueryIntoActivePanel = async (query: any) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Load the saved query data
      const resultRes = await fetch('/api/query', {
        method: 'POST',
        headers: createHeaders(),
        body: JSON.stringify({ 
          action: 'fetchSaved',
          id: query.id
        }),
      });
      
      const result = await resultRes.json();
      if (!resultRes.ok) throw new Error(result.error || 'Failed to load saved query');
      
      // Populate the main query panel with saved query data
      setQuestion(result.question || '');
      // For old saved queries without comboPrompt, use the question as comboPrompt
      setComboPrompt(result.comboPrompt || result.question || '');
      setSelectedColumns(result.selectedColumns || []);
      setSqlQuery(result.sql || '');
      setQueryResults(result.data || []);
      setColumns(result.columns || []);
      setOutputMode(result.outputMode || 'table');
      
      // Load chart configuration if available
      if (result.visualConfig) {
        setSelectedXColumn(result.visualConfig.selectedXColumn || '');
        setSelectedYColumn(result.visualConfig.selectedYColumn || '');
        
        // Load sorting configuration if available
        if (result.visualConfig.sortColumn !== undefined || result.visualConfig.sortDirection !== undefined) {
          console.log('🔄 Dashboard: Loading sorting state from saved query:', { 
            sortColumn: result.visualConfig.sortColumn, 
            sortDirection: result.visualConfig.sortDirection 
          });
          setMainSortColumn(result.visualConfig.sortColumn || null);
          setMainSortDirection(result.visualConfig.sortDirection || null);
        }
      } else if (result.columns && result.columns.length >= 2) {
        // Fallback to first two columns if no visual config
        setSelectedXColumn(result.columns[0]?.key || '');
        setSelectedYColumn(result.columns[1]?.key || '');
      }
      
      // Set the selected saved query ID for update functionality
      setSelectedSavedQueryId(query.id);
      
      // Set original data for change tracking
      setOriginalQueryData({
        question: result.question,
        sql: result.sql,
        outputMode: result.outputMode,
        data: result.data,
        columns: result.columns,
        visualConfig: result.visualConfig,
        sortColumn: result.visualConfig?.sortColumn || null,
        sortDirection: result.visualConfig?.sortDirection || null
      });
      
      // Automatically go into edit mode for saved queries
setIsEditingSavedQuery(true);
      
    } catch (err: any) {
      console.error('Error loading saved query:', err);
      setError(err.message || 'Failed to load saved query');
    } finally {
      setIsLoading(false);
    }
  };

  const closeTab = (tabId: string) => {
    if (tabId === 'active-query') return // Cannot close active query tab
    
    setTabs(prev => prev.filter(tab => tab.id !== tabId))
    
    // If closing the active tab, switch to active query tab
    if (activeTabId === tabId) {
      setActiveTabId('active-query')
    }
  }

  // Function to go back to active query
  const goBackToActiveQuery = () => {
    setViewingSavedQuery(null)
  }

  // Helper function to create headers with user ID
  const createHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }
    if (currentUser) {
      headers['x-user-id'] = currentUser.id.toString()
    }
    return headers
  }

  // Handle logout
  const handleLogout = () => {
    clearSession()
    router.push('/login')
  }

  const getCurrentTabData = () => {
    const currentTab = tabs.find(tab => tab.id === activeTabId)
    return currentTab
  }
  

  
  const handleDrop = (quadrantId: 'topLeft' | 'topRight' | 'bottom', item: Visualization) => {
    setLastDroppedItem(item);
    console.log('🪄 Diagnostics: Last Dropped Item', item);
    console.log('🪄 Moving chart to dashboard - triggering change detection');
  
    const itemId = item.id;
    console.log('🪄 Item ID being dropped:', itemId);
    console.log('🪄 Item being dropped:', item);
    console.log('🪄 Item columns:', item.columns);
    console.log('🪄 All existing visualization IDs:', allVisualizations.map(v => v.id));
    console.log('🪄 All existing visualizations:', allVisualizations);
    
    // Check if item exists by ID first
    let itemExists = allVisualizations.some((v) => v.id === itemId);
    
    // If not found by ID, check if an item with the same content exists
    if (!itemExists) {
      console.log('🪄 Checking for content match...');
      console.log('🪄 Dropped item type:', item.type);
      console.log('🪄 Dropped item data:', item.data);
      
      itemExists = allVisualizations.some((v) => {
        const typeMatch = v.type === item.type;
        const dataMatch = JSON.stringify(v.data) === JSON.stringify(item.data);
        const columnsMatch = JSON.stringify(v.columns) === JSON.stringify(item.columns);
        
        console.log('🪄 Comparing with existing item:', {
          existingType: v.type,
          existingData: v.data,
          existingColumns: v.columns,
          itemColumns: item.columns,
          typeMatch,
          dataMatch,
          columnsMatch
        });
        
        return typeMatch && dataMatch && columnsMatch;
      });
      
      if (itemExists) {
        console.log('🪄 Found duplicate by content, will use existing item');
        // Use the existing item's ID instead
        const existingItem = allVisualizations.find((v) => 
          v.type === item.type && 
          JSON.stringify(v.data) === JSON.stringify(item.data) &&
          JSON.stringify(v.columns) === JSON.stringify(item.columns)
        );
        if (existingItem) {
          item.id = existingItem.id; // Update the item ID to match existing
        }
      } else {
        console.log('🪄 No content match found');
      }
    }
    
    console.log('🪄 Item exists in allVisualizations:', itemExists);
    
    // Update itemId in case it was changed by content matching
    const finalItemId = item.id;
  
    // If item doesn't exist in allVisualizations, add it
    if (!itemExists) {
      console.log('🪄 Adding new visualization with columns:', item.columns);
      setAllVisualizations((prev) => {
        const newVisualizations = [...prev, item];
        console.log('🪄 Added new visualization, new count:', newVisualizations.length);
        console.log('🪄 New visualization columns:', item.columns);
        return newVisualizations;
      });
    } else {
      console.log('🪄 Item already exists, not adding new visualization');
    }
  
    // Check if the item is already in another quadrant and remove it
    setQuadrants((prev) => {
      const newQuadrants = { ...prev };
      
      // Remove item from any existing quadrant
      Object.keys(newQuadrants).forEach((key) => {
        if (newQuadrants[key as keyof typeof newQuadrants] === finalItemId) {
          newQuadrants[key as keyof typeof newQuadrants] = null;
        }
      });
      
      // Add item to the new quadrant
      newQuadrants[quadrantId] = finalItemId;
      
      console.log('🪄 Moved visualization from existing quadrant to:', quadrantId);
      return newQuadrants;
    });
      
    // Trigger change detection after state updates are complete
    setTimeout(() => {
      triggerChangeDetection();
    }, 50);
  
    // Improved diagnostics: only log error if data.length > 0, table is in DOM, and after enough time
    setTimeout(() => {
      // Only check if this quadrant is still showing the dropped viz
      if (quadrants[quadrantId] !== finalItemId) return;

      const dropZone = document.querySelector(`[data-quadrant-id="${quadrantId}"]`);
      const table = dropZone ? dropZone.querySelector('table') : null;
      let renderedRows = 0;
      if (table) {
        renderedRows = table.querySelectorAll('tbody tr').length;
      }
      const expectedRows = Array.isArray(item.data) ? item.data.length : 0;
      if (item.type === 'table' && expectedRows > 0) {
        if (renderedRows < expectedRows) {
          // Only log warning, not error, and only if still mismatched after 600ms
          setTimeout(() => {
            const tableRetry = dropZone ? dropZone.querySelector('table') : null;
            let renderedRowsRetry = 0;
            if (tableRetry) renderedRowsRetry = tableRetry.querySelectorAll('tbody tr').length;
            if (renderedRowsRetry < expectedRows) {
              console.warn(`⚠️ Table dropped in '${quadrantId}' expected ${expectedRows} rows, but TableView rendered ${renderedRowsRetry}. This could be a timing issue or React render delay.`);
            } else {
              console.log(`✅ Table dropped in '${quadrantId}' rendered ${renderedRowsRetry} rows after retry.`);
            }
          }, 600);
        } else {
          console.log(`✅ Table dropped in '${quadrantId}' rendered ${renderedRows} rows (expected ${expectedRows}).`);
        }
      }
    }, 400); // Wait a bit longer
  };


  
  
  const handleSelectDashboard = async (dashboard: { id: number; title: string }) => {
    console.log('🔍 handleSelectDashboard called:', dashboard);
    // Always update the URL to reflect the selected dashboard and edit mode!
    router.replace(`/dashboard?d=${dashboard.id}&edit=true`);
  
    setIsGlobalLoading(true);
    try {
      const res = await fetch(`/api/dashboard?id=${dashboard.id}`, {
        headers: createHeaders()
      });
      if (!res.ok) throw new Error("Failed to load dashboard");
      const responseData = await res.json();
      
      // Extract dashboard data from the response
      const data = responseData.dashboard;
      if (!data) {
        throw new Error('Dashboard data not found');
      }

      const { id, title, quadrants, visualizations, s_visualizations, sVisualizations } = data;
      setDashboardSectionTitle(title || "Untitled Dashboard");

      setTopLeftTitle(data.topLeftTitle || "Sample Title");
      setTopRightTitle(data.topRightTitle || "Sample Title");
      setBottomTitle(data.bottomTitle || "Sample Title");

      // Parse quadrants JSON string
      const parsedQuadrants = typeof quadrants === 'string' ? JSON.parse(quadrants) : quadrants;
      
      // Parse visualizations JSON string
      const parsedVizList = typeof visualizations === 'string' ? JSON.parse(visualizations) : visualizations;

      // Handle both field name formats from API
      const sVisualizationsData = sVisualizations || s_visualizations;

      // DEBUG: Are we loading from cache?
      console.log("🔍 handleSelectDashboard - Checking cached data:", { sVisualizationsData, sVisualizations, s_visualizations });

      // Parse the cached data if it's a string
      let parsedCachedVisualizations = null;
      if (sVisualizationsData) {
        try {
          parsedCachedVisualizations = typeof sVisualizationsData === 'string' 
            ? JSON.parse(sVisualizationsData) 
            : sVisualizationsData;
          console.log("✅ handleSelectDashboard - Parsed cached visualizations:", parsedCachedVisualizations);
        } catch (error) {
          console.error("❌ handleSelectDashboard - Error parsing cached visualizations:", error);
          parsedCachedVisualizations = null;
        }
      }

      // Use cache if present and non-empty
      if (Array.isArray(parsedCachedVisualizations) && parsedCachedVisualizations.length > 0) {
        console.log("✅ handleSelectDashboard - Loading from CACHE!");
        
        // Transform cached visualizations to ensure chart data is properly formatted and use saved columns
        const transformedVisualizations = parsedCachedVisualizations.map(viz => {
          // Use saved columns if available, otherwise fall back to current columns
          const columnsToUse = viz.savedColumns && viz.savedColumns.length > 0 ? viz.savedColumns : viz.columns;
          
          if ((viz.type === 'chart' || viz.type === 'pie') && Array.isArray(viz.data)) {
            // Check if data is already in chart format (has name/value structure)
            const isChartFormat = viz.data.length > 0 && 
              typeof viz.data[0] === 'object' && 
              'name' in viz.data[0] && 
              'value' in viz.data[0];
            
            console.log(`🔍 handleSelectDashboard Chart ${viz.id} (${viz.type}): isChartFormat=${isChartFormat}, dataLength=${viz.data.length}, savedColumnsLength=${viz.savedColumns?.length || 0}, currentColumnsLength=${viz.columns?.length || 0}`);
            
            if (!isChartFormat && columnsToUse && columnsToUse.length >= 2) {
              // Transform raw data to chart format using saved columns
              const chartData = viz.data.map((row: any) => ({
                name: row[columnsToUse[0]?.key] || 'Unknown',
                value: Number(row[columnsToUse[1]?.key]) || 0,
              }));
              
              console.log(`✅ handleSelectDashboard Transformed chart data for ${viz.id} using saved columns:`, chartData.slice(0, 3));
              return { ...viz, data: chartData, columns: columnsToUse };
            }
          }
          
          // Return visualization with saved columns if available
          return { ...viz, columns: columnsToUse || viz.columns };
        });
        
        setAllVisualizations(transformedVisualizations);

        // Use snapshot data directly for quadrant mapping
        const quadrantMap: any = {};
        for (const quadrant in parsedQuadrants) {
          // Find the snapshot that matches this quadrant
          const snapshot = parsedCachedVisualizations.find(v => v.quadrant === quadrant);
          
          if (snapshot) {
            console.log(`✅ handleSelectDashboard - Found snapshot for ${quadrant}:`, { 
              id: snapshot.id, 
              type: snapshot.type, 
              title: snapshot.title,
              hasSavedColumns: !!snapshot.savedColumns,
              columnCount: snapshot.savedColumns?.length || 0
            });
            quadrantMap[quadrant] = snapshot.id;
          } else {
            console.log(`❌ handleSelectDashboard - No snapshot found for ${quadrant}`);
            quadrantMap[quadrant] = null;
          }
        }
        setQuadrants({
          topLeft: quadrantMap.topLeft || null,
          topRight: quadrantMap.topRight || null,
          bottom: quadrantMap.bottom || null,
        });

        // Set original dashboard data for change tracking (cache path)
        const originalData = {
          title: title || "Untitled Dashboard",
          topLeftTitle: data.topLeftTitle || "Sample Title",
          topRightTitle: data.topRightTitle || "Sample Title",
          bottomTitle: data.bottomTitle || "Sample Title",
          quadrants: {
            topLeft: quadrantMap.topLeft || null,
            topRight: quadrantMap.topRight || null,
            bottom: quadrantMap.bottom || null,
          },
          visualizations: transformedVisualizations
        };
        setOriginalDashboardData(originalData);
        setIsNewlyCreatedDashboard(false); // This is an existing dashboard being loaded
        console.log('🔍 Original dashboard data set (cache path):', originalData);

        setIsGlobalLoading(false);
        return;
      }
  
      // FALLBACK: re-run SQL for each viz (your current logic)
      setAllVisualizations([]);
      setQuadrants({
        topLeft: null,
        topRight: null,
        bottom: null,
      });
  
      if (!parsedVizList || parsedVizList.length === 0) {
        console.log("ℹ️ handleSelectDashboard - No visualizations to load, skipping SQL execution");
        setIsGlobalLoading(false);
        return;
      }

      const newVisualizations: any[] = [];
      const quadrantMapping: any = {};

      for (const viz of parsedVizList || []) {
        try {
          const resultRes = await fetch('/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              question: 'Dashboard Query',
              sql: viz.sql,
              outputMode: 'table',
              columns: [{ key: 'id', name: 'ID' }] // Provide a default column structure
            }),
          });
          const result = await resultRes.json();
          if (!resultRes.ok) throw new Error(result.error || 'Query failed');
  
          const chartData =
            viz.type === 'chart' || viz.type === 'pie'
              ? result.data.map(row => ({
                  name: row[result.columns[0]?.key] || 'Unknown',
                  value: Number(row[result.columns[1]?.key]) || 0,
                }))
              : result.data;
  
          const newViz = {
            id: `viz-${Date.now()}-${Math.random()}`,
            type: viz.type,
            title: viz.title || 'Query Result',
            data: chartData,
            columns: result.columns || [],
            color: viz.color || 'hsl(var(--chart-4))',
            originalId: viz.id,
            sql: viz.sql,
          };
  
          newVisualizations.push(newViz);
  
          for (const quadrant in parsedQuadrants) {
            if (parsedQuadrants[quadrant] === viz.id) {
              quadrantMapping[quadrant] = newViz.id;
            }
          }
        } catch (err) {
          console.error('Error loading visualization:', err);
        }
      }
  
      setAllVisualizations(newVisualizations);
      setQuadrants({
        topLeft: quadrantMapping.topLeft || null,
        topRight: quadrantMapping.topRight || null,
        bottom: quadrantMapping.bottom || null,
      });

      // Expand the right panel to show the loaded dashboard
      setCollapsedPanels(prev => ({ ...prev, right: false }));

      // Set original dashboard data for change tracking (SQL fallback path)
      const originalData = {
        title: title || "Untitled Dashboard",
        topLeftTitle: data.topLeftTitle || "Sample Title",
        topRightTitle: data.topRightTitle || "Sample Title",
        bottomTitle: data.bottomTitle || "Sample Title",
        quadrants: {
          topLeft: quadrantMapping.topLeft || null,
          topRight: quadrantMapping.topRight || null,
          bottom: quadrantMapping.bottom || null,
        },
        visualizations: newVisualizations
      };
      setOriginalDashboardData(originalData);
      setIsNewlyCreatedDashboard(false); // This is an existing dashboard being loaded
      console.log('🔍 Original dashboard data set (SQL fallback path):', originalData);

      // Initialize change detection after loading
      setTimeout(() => {
        console.log('🔍 Initializing change detection after dashboard load (SQL fallback path)');
        checkDashboardChanges();
      }, 100);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsGlobalLoading(false);
    }
  };
    


  

  const getVisualizationById = (id: string) => allVisualizations.find((v: Visualization) => v.id === id)



  const renderDroppedViz = (vizId: string) => {
    const viz = getVisualizationById(vizId);
    console.log(`🔍 renderDroppedViz called with vizId: ${vizId}`);
    console.log(`🔍 Found visualization:`, viz);
    
    if (!viz) return null;
  
    if (viz.type === 'chart' || viz.type === 'visualization') {
      console.log(`🔍 Rendering DraggableChart with SQL:`, viz.sql);
      return (
        <DraggableChart 
          data={viz.data || []} 
          type="chart"
          sql={viz.sql}
          columns={viz.columns || []}
          showExpandButton={false}
        />
      );
    }
  
    if (viz.type === 'pie') {
      console.log(`🔍 Rendering DraggablePieChart with SQL:`, viz.sql);
      return (
        <DraggablePieChart 
          data={viz.data || []} 
          sql={viz.sql}
          columns={viz.columns || []}
          showExpandButton={false}
        />
      );
    }
  
    if (viz.type === 'table') {
      console.log('🪄 renderDroppedViz rendering table with SQL:', viz.sql);
      return (
        <TableView 
          data={viz.data || []} 
          columns={viz.columns || []} 
          compact 
          readOnlyMode={readOnlyMode} 
          inDashboard={true}
          initialFilterColumns={{}}
          onFilterColumnsChange={() => {}} // No-op for dropped tables
          showFilterButton={false} // Hide filter button for dropped tables
          showHeader={false} // Hide entire header for dropped tables
          sql={viz.sql} // Pass SQL for potential future dynamic updates
          onColumnOrderChange={(reorderedColumns) => {
            console.log('🪄 onColumnOrderChange called with:', reorderedColumns);
            // Update the visualization with the new column order
            setAllVisualizations(prev => 
              prev.map(v => 
                v.id === viz.id 
                  ? { ...v, columns: reorderedColumns }
                  : v
              )
            );
            // Trigger dashboard change detection to enable the update button
            triggerChangeDetection();
          }}
        />
      );
    }
  
    return <div className="text-sm text-muted-foreground">Unsupported viz type</div>;
  };

  
  


  const renderCollapsedPanel = (panel: 'left' | 'middle' | 'right', label: string) => (
    <button
      className="h-full w-full bg-card border border-border rounded-lg shadow-md flex flex-col items-center justify-center text-muted-foreground"
      onClick={() => togglePanel(panel)}
    >
      {panel === 'right' && <ChevronLeft className="h-4 w-4 mb-1" />}
      {panel === 'left' && <ChevronRight className="h-4 w-4 mb-1" />}
      {panel === 'middle' && <ChevronRight className="h-4 w-4 mb-1" />}
      <span className="text-xs">{label}</span>
    </button>
  )

  // Tabbed Panel Component - TEMPORARILY DISABLED
  /*
  const renderTabbedPanel = useCallback(() => {
    const currentTab = getCurrentTabData()
    
    return (
      <div className="flex flex-col h-full bg-card rounded-lg border border-border shadow-md overflow-hidden">
        <div className="flex border-b border-border bg-muted/20 relative">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`
                flex items-center gap-2 px-4 py-3 cursor-pointer border-r border-border transition-colors
                ${activeTabId === tab.id 
                  ? 'bg-background border-b-0 font-medium text-foreground' 
                  : 'hover:bg-muted/50 text-muted-foreground'
                }
              `}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="text-sm truncate max-w-[120px]">
                {tab.title}
              </span>
              {tab.type === 'saved' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeTab(tab.id)
                  }}
                  className="ml-1 p-1 hover:bg-muted rounded text-xs opacity-60 hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          {currentTab?.type === 'active' ? (
            <QueryPanel
              question={question}
              setQuestion={stableSetQuestion}
              outputMode={outputMode}
              setOutputMode={stableSetOutputMode}
              isLoading={isLoading}
              processingTime={processingTime}
              sqlQuery={sqlQuery}
              setSqlQuery={stableSetSqlQuery}
              queryResults={queryResults}
              setQueryResults={stableSetQueryResults}
              columns={columns}
              setColumns={stableSetColumns}
              error={error}
              setError={stableSetError}
              onSubmit={handleQuerySubmit}
              onComboPromptChange={handleComboPromptChange}
            onSelectedColumnsChange={handleSelectedColumnsChange}
            readOnlyMode={readOnlyMode}
            comboPrompt={comboPrompt}
            initialSelectedColumns={selectedColumns}
            />
          ) : currentTab?.type === 'saved' ? (
            <SavedQueryTab
              query={currentTab.data}
              onClose={() => closeTab(currentTab.id)}
            />
          ) : null}
        </div>
      </div>
    )
  }, [activeTabId, tabs, question, stableSetQuestion, outputMode, stableSetOutputMode, isLoading, sqlQuery, stableSetSqlQuery, queryResults, stableSetQueryResults, columns, stableSetColumns, error, stableSetError, handleQuerySubmit, getCurrentTabData, setActiveTabId, closeTab, togglePanel])
  */

  // Simple Panel Component - shows either active query or saved query
  const renderSimplePanel = useCallback(() => {
    return (
      <div className="flex flex-col h-full bg-card rounded-lg border border-border shadow-md overflow-hidden">
        {(() => {
  console.log('🪄 renderSimplePanel check:', { viewingSavedQuery: !!viewingSavedQuery });
  return viewingSavedQuery;
})() ? (
          // Show saved query with back button
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
              <h3 className="text-sm font-semibold text-foreground">
                {viewingSavedQuery.title || viewingSavedQuery.queryText || 'Saved Query'}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={goBackToActiveQuery}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Active Query
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <SavedQueryTab
                query={viewingSavedQuery}
                onClose={goBackToActiveQuery}
              />
            </div>
          </div>
        ) : (
          // Show active query
          <QueryPanel
            question={question}
            setQuestion={stableSetQuestion}
            outputMode={outputMode}
            setOutputMode={stableSetOutputMode}
            isLoading={isLoading}
            processingTime={processingTime}
            sqlQuery={sqlQuery}
            setSqlQuery={stableSetSqlQuery}
            queryResults={queryResults}
            setQueryResults={stableSetQueryResults}
            columns={columns}
            setColumns={stableSetColumns}
            error={error}
            setError={stableSetError}
            onSubmit={handleQuerySubmit}
            onComboPromptChange={handleComboPromptChange}
            onSelectedColumnsChange={handleSelectedColumnsChange}
            readOnlyMode={readOnlyMode}
            isEditingSavedQuery={isEditingSavedQuery}
            handleUpdateSavedQuery={handleUpdateSavedQuery}
            handleCancelEdit={handleCancelEdit}
            hasChanges={hasChanges}
            selectedSavedQueryId={selectedSavedQueryId}
            handleDeleteSavedQuery={handleDeleteSavedQuery}
            onClearQuery={handleClearQuery}
            selectedXColumn={selectedXColumn}
            setSelectedXColumn={setSelectedXColumn}
            selectedYColumn={selectedYColumn}
            setSelectedYColumn={setSelectedYColumn}
            currentUser={currentUser}
            setOriginalQueryData={setOriginalQueryData}
            onSortChange={handleMainSortChange}
            initialSortColumn={mainSortColumn}
            initialSortDirection={mainSortDirection}
            comboPrompt={comboPrompt}
            initialSelectedColumns={selectedColumns}
          />
        )}
      </div>
    )
  }, [viewingSavedQuery, question, stableSetQuestion, outputMode, stableSetOutputMode, isLoading, sqlQuery, stableSetSqlQuery, queryResults, stableSetQueryResults, columns, stableSetColumns, error, stableSetError, handleQuerySubmit, goBackToActiveQuery, handleMainSortChange, mainSortColumn, mainSortDirection])

  // Saved Query Tab Component
  const SavedQueryTab = ({ query, onClose }: { query: any; onClose: () => void }) => {
  console.log('🪄 SavedQueryTab rendered for query:', query.id);
    const [tabQueryResults, setTabQueryResults] = useState<any[] | null>(null)
    const [tabColumns, setTabColumns] = useState<{ key: string; name: string }[]>([])
    const [tabIsLoading, setTabIsLoading] = useState(false)
    const [tabError, setTabError] = useState<string | null>(null)
    
    // Tab-specific edit state
    const [tabIsEditing, setTabIsEditing] = useState(false)
    const [tabOriginalData, setTabOriginalData] = useState<any>(null)
    const [tabQuestion, setTabQuestion] = useState('')
    const [tabSqlQuery, setTabSqlQuery] = useState<string | null>(null)
    const [tabOutputMode, setTabOutputMode] = useState('table')
    const [tabSaveStatus, setTabSaveStatus] = useState<null | "success" | "error" | "saving">(null)
    const [tabCurrentTitle, setTabCurrentTitle] = useState(query?.title || query?.queryText || 'Saved Query')
    const [tabShowSql, setTabShowSql] = useState(false)
    
    // Tab-specific sorting state
    const [tabSortColumn, setTabSortColumn] = useState<string | null>(null)
    const [tabSortDirection, setTabSortDirection] = useState<'asc' | 'desc' | null>(null)
    
    // Chart configuration state
    const [tabSelectedXColumn, setTabSelectedXColumn] = useState<string>('')
    const [tabSelectedYColumn, setTabSelectedYColumn] = useState<string>('')
    
    // Column selector state for saved queries
    const [tabIsColumnSelectorExpanded, setTabIsColumnSelectorExpanded] = useState(false)
    const [tabValidationErrors, setTabValidationErrors] = useState<string[]>([])
    const [tabValidationWarnings, setTabValidationWarnings] = useState<string[]>([])
    const [tabShowValidation, setTabShowValidation] = useState(false)

    // Smart column selection function (same as in QueryPanel)
    const getSmartColumnSelection = (columns: any[], question: string, results: any[]) => {
      const questionLower = question.toLowerCase();

      // Define patterns for different query types
      const patterns = {
        // Donor queries
        donor: {
          keywords: ['donor', 'donors', 'contributor', 'contributors', 'giver', 'givers', 'customer', 'customers'],
          xPriority: ['fullname', 'name', 'donor', 'contributor', 'giver', 'customer', 'account'],
          yPriority: ['amount', 'total', 'sum', 'total_amount', 'donation_amount', 'contribution_amount', 'gift_amount']
        },
        // Date/time queries
        date: {
          keywords: ['date', 'time', 'year', 'month', 'day', 'period', 'quarter', 'gift date', 'donation date'],
          xPriority: ['date', 'year', 'month', 'day', 'period', 'quarter', 'time', 'giftdate'],
          yPriority: ['amount', 'total', 'sum', 'count', 'total_amount', 'donation_amount', 'gift_amount']
        },
        // Category queries
        category: {
          keywords: ['category', 'type', 'group', 'classification', 'segment', 'source', 'designation', 'appeal'],
          xPriority: ['category', 'type', 'group', 'classification', 'segment', 'source', 'designation', 'appeal', 'name'],
          yPriority: ['amount', 'total', 'sum', 'count', 'total_amount', 'gift_amount']
        },
        // Location queries
        location: {
          keywords: ['location', 'city', 'state', 'country', 'region', 'area', 'address'],
          xPriority: ['location', 'city', 'state', 'country', 'region', 'area', 'address', 'name'],
          yPriority: ['amount', 'total', 'sum', 'count', 'total_amount', 'gift_amount']
        },
        // Gender/Age queries
        demographic: {
          keywords: ['gender', 'age', 'male', 'female', 'demographic', 'old', 'young'],
          xPriority: ['gender', 'age', 'name', 'fullname'],
          yPriority: ['amount', 'total', 'sum', 'count', 'total_amount', 'gift_amount']
        }
      };

      // Determine query type based on question
      let queryType = 'default';
      for (const [type, pattern] of Object.entries(patterns)) {
        if (pattern.keywords.some(keyword => questionLower.includes(keyword))) {
          queryType = type;
          break;
        }
      }

      // Find best X column
      let xColumn = columns[0]?.key || '';
      if (queryType !== 'default') {
        const pattern = patterns[queryType as keyof typeof patterns];
        for (const priority of pattern.xPriority) {
          const found = columns.find(col =>
            col.key.toLowerCase().includes(priority) ||
            col.name.toLowerCase().includes(priority)
          );
          if (found) {
            xColumn = found.key;
            break;
          }
        }
      }

      // Find best Y column (prefer numeric/amount columns)
      let yColumn = columns[1]?.key || '';
      if (queryType !== 'default') {
        const pattern = patterns[queryType as keyof typeof patterns];
        for (const priority of pattern.yPriority) {
          const found = columns.find(col =>
            col.key.toLowerCase().includes(priority) ||
            col.name.toLowerCase().includes(priority)
          );
          if (found) {
            yColumn = found.key;
            break;
          }
        }
      }

      // If no smart match found, try to find numeric columns for Y-axis
      if (yColumn === columns[1]?.key) {
        const numericColumns = columns.filter(col => {
          const key = col.key.toLowerCase();
          const name = col.name.toLowerCase();
          return key.includes('amount') || key.includes('total') || key.includes('sum') || 
                 key.includes('count') || name.includes('amount') || name.includes('total') ||
                 name.includes('sum') || name.includes('count');
        });
        
        if (numericColumns.length > 0) {
          yColumn = numericColumns[0].key;
        }
      }

      // Fallback: if we couldn't find good matches, use first two columns
      if (!xColumn || !yColumn) {
        xColumn = columns[0]?.key || '';
        yColumn = columns[1]?.key || '';
      }

      // Ensure X and Y are different
      if (xColumn === yColumn && columns.length > 1) {
        yColumn = columns[1]?.key || '';
      }

      console.log('🎯 Smart column selection (SavedQueryTab):', { question, queryType, xColumn, yColumn, columns: columns.map(c => c.key) });

      return { xColumn, yColumn };
    };
    const [tabSelectedColumns, setTabSelectedColumns] = useState<string[]>([])
    const [tabColumnSelectionMode, setTabColumnSelectionMode] = useState<'auto' | 'all' | 'custom'>('auto')
    const [tabFilteredColumns, setTabFilteredColumns] = useState<Record<string, boolean>>({})

    // Debug: Log tab state
    console.log('🪄 SavedQueryTab state:', { 
      tabIsEditing, 
      tabOutputMode, 
      tabQueryResults: tabQueryResults?.length, 
      tabColumns: tabColumns?.length 
    });

// Debug: Log when X/Y column selections change
const handleXColumnChange = useCallback((value: string) => {
  console.log('🪄 X Column changed from', tabSelectedXColumn, 'to', value);
  console.log('🪄 Current tabIsEditing:', tabIsEditing);
  console.log('🪄 Current tabOriginalData:', tabOriginalData);
  setTabSelectedXColumn(value);
}, [tabSelectedXColumn, tabIsEditing, tabOriginalData]);

const handleYColumnChange = useCallback((value: string) => {
  console.log('🪄 Y Column changed from', tabSelectedYColumn, 'to', value);
  console.log('🪄 Current tabIsEditing:', tabIsEditing);
  console.log('🪄 Current tabOriginalData:', tabOriginalData);
  setTabSelectedYColumn(value);
}, [tabSelectedYColumn, tabIsEditing, tabOriginalData]);

// Debug: Test that the handlers are working
console.log('🪄 Debug: SavedQueryTab handlers initialized');
console.log('🪄 Debug: This means a saved query tab is being rendered');

// Debug: Monitor X/Y column changes and trigger hasTabChanges check
// Moved this useEffect after hasTabChanges function definition

    // Ref for textarea focus
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    
    // Validation function for saved query tabs
    const validateTabQueryInput = useCallback((query: string) => {
      const errors: string[] = []
      const warnings: string[] = []
      
      if (!query.trim()) {
        errors.push("Please enter a question or query")
        return { isValid: false, errors, warnings }
      }
      
      if (query.trim().length < 3) {
        errors.push("Query is too short. Please provide more details")
        return { isValid: false, errors, warnings }
      }
      
      const problematicPatterns = [
        { pattern: /drop\s+table/i, message: "DROP TABLE commands are not allowed" },
        { pattern: /delete\s+from/i, message: "DELETE commands are not allowed" },
        { pattern: /truncate/i, message: "TRUNCATE commands are not allowed" },
        { pattern: /alter\s+table/i, message: "ALTER TABLE commands are not allowed" },
        { pattern: /create\s+table/i, message: "CREATE TABLE commands are not allowed" },
        { pattern: /insert\s+into/i, message: "INSERT commands are not allowed" },
        { pattern: /update\s+set/i, message: "UPDATE commands are not allowed" },
        { pattern: /grant\s+/i, message: "GRANT commands are not allowed" },
        { pattern: /revoke\s+/i, message: "REVOKE commands are not allowed" },
      ]
      
      for (const { pattern, message } of problematicPatterns) {
        if (pattern.test(query)) {
          errors.push(message)
        }
      }
      
      if (query.length > 1000) {
        warnings.push("Very long queries may take longer to process")
      }
      
      return { isValid: errors.length === 0, errors, warnings }
    }, [])
    
    // Auto-expand column selector when user is actively typing in saved query
    useEffect(() => {
      // Only expand when user is editing and no query has been executed yet - VALIDATION COMMENTED OUT
      if (tabQuestion.trim().length > 0 && tabIsEditing && !tabIsLoading && (tabQueryResults === null || tabQueryResults === undefined)) {
        setTabIsColumnSelectorExpanded(true)
      } else {
        // Collapse in all other cases (empty question, loading, or any query results)
        setTabIsColumnSelectorExpanded(false)
      }
    }, [tabQuestion, tabIsEditing, tabIsLoading, tabQueryResults])
    
    // Memoized callback for column order changes to prevent infinite loops
    const handleTabColumnOrderChange = useCallback((reorderedColumns: { key: string; name: string }[]) => {
      setTabColumns(reorderedColumns)
      
      // Update tabOriginalData to reflect the new column order for change detection
      if (tabOriginalData) {
        setTabOriginalData({
          ...tabOriginalData,
          columns: reorderedColumns
        })
      }
    }, [tabOriginalData])
    
    // Handle filter columns changes in the tab
    const handleTabFilterColumnsChange = useCallback((filterColumns: Record<string, boolean>) => {
      console.log('🔄 SAVED QUERY TAB filter columns changed:', filterColumns)
      console.log('🔄 SAVED QUERY TAB current tabFilteredColumns:', tabFilteredColumns)
      console.log('🔄 SAVED QUERY TAB setting tabFilteredColumns to:', filterColumns)
      setTabFilteredColumns(filterColumns)
    }, [tabFilteredColumns])

    // Handle sort changes in the tab
    const handleTabSortChange = useCallback((column: string | null, direction: 'asc' | 'desc' | null) => {
      console.log('🔄 SAVED QUERY TAB sort change called:', { column, direction, queryId: query.id })
      console.log('🔄 Current tabIsEditing:', tabIsEditing)
      console.log('🔄 Current tabOriginalData:', tabOriginalData)
      
      setTabSortColumn(column)
      setTabSortDirection(direction)
      
      // Automatically enter edit mode when user sorts data
      if (!tabIsEditing) {
        console.log('🔄 Auto-entering edit mode due to sort change')
        setTabIsEditing(true)
        
        // Set up original data for change detection if not already set
        if (!tabOriginalData) {
          console.log('🔄 Setting up original data for change detection')
          setTabOriginalData({
            question: tabQuestion,
            sql: tabSqlQuery,
            outputMode: tabOutputMode,
            data: tabQueryResults,
            columns: tabColumns,
            visualConfig: null,
            sortColumn: null,
            sortDirection: null,
            selectedColumns: tabSelectedColumns,
            filteredColumns: tabFilteredColumns
          })
        }
      }
    }, [tabIsEditing, tabOriginalData, tabQuestion, tabSqlQuery, tabOutputMode, tabQueryResults, tabColumns, tabSelectedColumns, tabFilteredColumns])

    // Function to determine error type and icon for tabs
    const getTabErrorInfo = (errorMessage: string) => {
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

    // Callback to update tab title and refresh history panel
    const handleQueryUpdated = useCallback((updatedQuery: any) => {
      // Update the tab title
      setTabs(prev => prev.map(tab => 
        tab.id === `saved-query-${query.id}` 
          ? { ...tab, title: updatedQuery.title || updatedQuery.queryText || 'Saved Query' }
          : tab
      ))
      
      // Update the current title state
      setTabCurrentTitle(updatedQuery.title || updatedQuery.queryText || 'Saved Query')
      
      // Force refresh of history panel by triggering a re-render
      // This will cause the HistoryPanel to reload its queries
      const event = new CustomEvent('queryUpdated', { detail: { queryId: query.id } })
      window.dispatchEvent(event)
    }, [query.id])

    useEffect(() => {
      const loadSavedQueryData = async () => {
        if (!query?.id) return
        
        setTabIsLoading(true)
        setTabError(null)
        
        try {
          const resultRes = await fetch('/api/query', {
            method: 'POST',
            headers: createHeaders(),
            body: JSON.stringify({ 
              action: 'fetchSaved',
              id: query.id
            }),
          })
          
          const result = await resultRes.json()
          if (!resultRes.ok) throw new Error(result.error || 'Failed to load saved results')
          
          setTabQueryResults(result.data || [])
          setTabColumns(result.columns || [])
          setTabQuestion(result.question || '')
          setTabSqlQuery(result.sql || '')
          setTabOutputMode(result.outputMode || 'table')
          setTabCurrentTitle(result.title || result.question || 'Saved Query')
          
          // Set chart configuration if available
          if (result.visualConfig) {
            setTabSelectedXColumn(result.visualConfig.selectedXColumn || '')
            setTabSelectedYColumn(result.visualConfig.selectedYColumn || '')
          } else if (result.columns && result.columns.length >= 2) {
            // Smart column selection for charts
            const { xColumn, yColumn } = getSmartColumnSelection(result.columns, result.question || '', result.data || []);
            setTabSelectedXColumn(xColumn)
            setTabSelectedYColumn(yColumn)
          }
          
          // Initialize selected columns for filter
          setTabSelectedColumns(result.selectedColumns || [])
          
          // Initialize filtered columns
          setTabFilteredColumns(result.filteredColumns || {})
          
          // Initialize sorting state from visualConfig
          const savedSortColumn = result.visualConfig?.sortColumn || null
          const savedSortDirection = result.visualConfig?.sortDirection || null
          setTabSortColumn(savedSortColumn)
          setTabSortDirection(savedSortDirection)
          
          // Store original data for edit mode
          setTabOriginalData({
            question: result.question,
            sql: result.sql,
            outputMode: result.outputMode,
            data: result.data,
            columns: result.columns,
            visualConfig: result.visualConfig,
            sortColumn: savedSortColumn,
            sortDirection: savedSortDirection,
            selectedColumns: result.selectedColumns || [],
            filteredColumns: result.filteredColumns || {}
          })
        } catch (err: any) {
          console.error('Error loading saved query:', err)
          setTabError(err.message || 'Failed to load saved query')
        } finally {
          setTabIsLoading(false)
        }
      }

      loadSavedQueryData()
    }, [query?.id])

    // Initialize tabQuestion when entering edit mode
    useEffect(() => {
      if (tabIsEditing && query?.queryText && !tabQuestion) {
        setTabQuestion(query.queryText)
      }
    }, [tabIsEditing, query?.queryText])

    // Focus textarea when entering edit mode
    useEffect(() => {
      if (tabIsEditing && textareaRef.current) {
        setTimeout(() => {
          textareaRef.current?.focus()
        }, 100)
      }
    }, [tabIsEditing])

    // Tab-specific edit functions
    const handleTabEdit = useCallback(() => {
      setTabIsEditing(true)
    }, [])

    const handleTabSearch = useCallback(async () => {
      if (!tabQuestion) return
      
      setTabIsLoading(true)
      setTabError(null)
      setTabIsColumnSelectorExpanded(false) // Collapse column selector when search is pressed

      try {
        // Prepare the question with column selection information
        let modifiedQuestion = tabQuestion
        
        if (tabColumnSelectionMode === 'all') {
          modifiedQuestion = `${tabQuestion} Include all columns.`
        } else if (tabColumnSelectionMode === 'custom' && tabSelectedColumns.length > 0) {
          const columnList = tabSelectedColumns.join(', ')
          modifiedQuestion = `${tabQuestion} Include only columns: ${columnList}.`
        }
        // For 'auto' mode, use the original question without modification

        const res = await fetch('/api/generate-sql', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({ question: modifiedQuestion }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Server error')

        setTabSqlQuery(data.sql)

        const resultRes = await fetch('/api/query', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({ 
            question: tabQuestion || 'Query',
            sql: data.sql,
            outputMode: tabOutputMode,
            columns: [{ key: 'id', name: 'ID' }]
          }),
        })

        const result = await resultRes.json()
        if (!resultRes.ok) throw new Error(result.error || 'Query execution error')

        setTabQueryResults(result.data || [])
        setTabColumns(result.columns || [])
      } catch (err: any) {
        console.error(err)
        setTabError(err.message || 'Unknown error')
      } finally {
        setTabIsLoading(false)
      }
    }, [tabQuestion, tabOutputMode, tabColumnSelectionMode, tabSelectedColumns])

    const handleTabUpdate = useCallback(async () => {
      if (!query?.id) return
      
      setTabSaveStatus("saving")
      try {
        // Prepare visual config for charts and sorting
        const visualConfig = (() => {
          const config: any = {}
          
          // Add chart configuration
          if ((tabOutputMode === 'chart' || tabOutputMode === 'pie') && tabSelectedXColumn && tabSelectedYColumn) {
            config.selectedXColumn = tabSelectedXColumn
            config.selectedYColumn = tabSelectedYColumn
            config.outputMode = tabOutputMode
          }
          
          // Add sorting configuration
          if (tabSortColumn && tabSortDirection) {
            config.sortColumn = tabSortColumn
            config.sortDirection = tabSortDirection
          }
          
          return Object.keys(config).length > 0 ? config : null
        })();

        const response = await fetch('/api/query', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({
            action: 'update',
            id: query.id,
            title: tabQuestion,
            question: tabQuestion,
            sql: tabSqlQuery,
            outputMode: tabOutputMode,
            columns: tabColumns,
            visualConfig,
            selectedColumns: tabSelectedColumns,
            filteredColumns: tabFilteredColumns
          })
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to update query')
        }

        setTabIsEditing(false)
        setTabSaveStatus("success")
        
        // Reload the data to show updated results
        const resultRes = await fetch('/api/query', {
          method: 'POST',
          headers: createHeaders(),
          body: JSON.stringify({ 
            action: 'fetchSaved',
            id: query.id
          }),
        })
        
        const result = await resultRes.json()
        if (resultRes.ok) {
          setTabQueryResults(result.data || [])
          setTabColumns(result.columns || [])
          setTabOriginalData({
            question: result.question,
            sql: result.sql,
            outputMode: result.outputMode,
            data: result.data,
            columns: result.columns,
            visualConfig: result.visualConfig,
            sortColumn: tabSortColumn,
            sortDirection: tabSortDirection,
            selectedColumns: result.selectedColumns || []
          })
          
          // Restore chart configuration if available
          if (result.visualConfig) {
            setTabSelectedXColumn(result.visualConfig.selectedXColumn || '')
            setTabSelectedYColumn(result.visualConfig.selectedYColumn || '')
          } else if (result.columns && result.columns.length >= 2) {
            // Fallback to first two columns if no visual config
            setTabSelectedXColumn(result.columns[0]?.key || '')
            setTabSelectedYColumn(result.columns[1]?.key || '')
          }
          
          // Update the current title
          setTabCurrentTitle(result.title || result.question || 'Saved Query')
          
          // Notify parent components about the update
          handleQueryUpdated({
            id: query.id,
            title: tabQuestion,
            queryText: tabQuestion
          })
        }

        setTimeout(() => setTabSaveStatus(null), 2000)
      } catch (err: any) {
        console.error('Error updating query:', err)
        setTabSaveStatus("error")
        setTimeout(() => setTabSaveStatus(null), 2000)
      }
    }, [query?.id, tabQuestion, tabSqlQuery, tabOutputMode, tabColumns, handleQueryUpdated])

    const handleTabCancel = useCallback(() => {
      if (tabOriginalData) {
        setTabQuestion(tabOriginalData.question)
        setTabSqlQuery(tabOriginalData.sql)
        setTabOutputMode(tabOriginalData.outputMode)
        setTabQueryResults(tabOriginalData.data)
        setTabColumns(tabOriginalData.columns)
        
        // Restore chart configuration if available
        if (tabOriginalData.visualConfig) {
          setTabSelectedXColumn(tabOriginalData.visualConfig.selectedXColumn || '')
          setTabSelectedYColumn(tabOriginalData.visualConfig.selectedYColumn || '')
        } else if (tabOriginalData.columns && tabOriginalData.columns.length >= 2) {
          // Fallback to first two columns if no visual config
          setTabSelectedXColumn(tabOriginalData.columns[0]?.key || '')
          setTabSelectedYColumn(tabOriginalData.columns[1]?.key || '')
        }
      }
      setTabIsEditing(false)
    }, [tabOriginalData])

    const handleTabDelete = useCallback(async () => {
      if (!query?.id) return
      
      setDeleteSavedQueryModalOpen(true);
      return;
    }, [query?.id])



    const hasTabChanges = useCallback(() => {
      if (!tabIsEditing || !tabOriginalData) return false
      
      // Check for column order changes
      const hasColumnOrderChanged = () => {
        if (!tabOriginalData.columns || !tabColumns) return false;
        if (tabOriginalData.columns.length !== tabColumns.length) return true;
        
        return tabOriginalData.columns.some((originalCol: any, index: number) => {
          const currentCol = tabColumns[index];
          return !currentCol || originalCol.key !== currentCol.key;
        });
      };
      
      // Check for chart configuration changes
      const hasChartConfigChanged = () => {
        if (tabOutputMode !== 'chart' && tabOutputMode !== 'pie') return false;
        
        const originalVisualConfig = tabOriginalData.visualConfig;
        const currentXColumn = tabSelectedXColumn;
        const currentYColumn = tabSelectedYColumn;
        
        console.log('🪄 hasChartConfigChanged debug:', {
          tabOutputMode,
          originalVisualConfig,
          currentXColumn,
          currentYColumn,
          tabColumns: tabColumns?.map(col => col.key)
        });
        
        // If no original visual config, check if current config is different from defaults
        if (!originalVisualConfig) {
          const isDifferent = currentXColumn !== tabColumns[0]?.key || currentYColumn !== tabColumns[1]?.key;
          console.log('🪄 No original config, checking against defaults:', {
            currentXColumn,
            currentYColumn,
            defaultX: tabColumns[0]?.key,
            defaultY: tabColumns[1]?.key,
            isDifferent
          });
          return isDifferent;
        }
        
        // Compare with original visual config
        const isDifferent = (
          originalVisualConfig.selectedXColumn !== currentXColumn ||
          originalVisualConfig.selectedYColumn !== currentYColumn
        );
        console.log('🪄 Comparing with original config:', {
          originalX: originalVisualConfig.selectedXColumn,
          originalY: originalVisualConfig.selectedYColumn,
          currentX: currentXColumn,
          currentY: currentYColumn,
          isDifferent
        });
        return isDifferent;
      };
      
      const columnOrderChanged = hasColumnOrderChanged();
      const chartConfigChanged = hasChartConfigChanged();
      const questionChanged = tabQuestion !== tabOriginalData.question;
      const sqlChanged = tabSqlQuery !== tabOriginalData.sql;
      const outputModeChanged = tabOutputMode !== tabOriginalData.outputMode;
      
      // Check for sorting changes
      const sortingChanged = (() => {
        const originalSortColumn = tabOriginalData.sortColumn || null;
        const originalSortDirection = tabOriginalData.sortDirection || null;
        
        return originalSortColumn !== tabSortColumn ||
               originalSortDirection !== tabSortDirection;
      })();
      
      // Check for selected columns changes
      const selectedColumnsChanged = (() => {
        const originalSelectedColumns = tabOriginalData.selectedColumns || [];
        const currentSelectedColumns = tabSelectedColumns || [];
        
        console.log('🔄 hasTabChanges - selectedColumns comparison:', {
          originalSelectedColumns,
          currentSelectedColumns,
          originalSorted: originalSelectedColumns.sort(),
          currentSorted: currentSelectedColumns.sort()
        });
        
        // Compare arrays by converting to JSON strings
        const changed = JSON.stringify(originalSelectedColumns.sort()) !== JSON.stringify(currentSelectedColumns.sort());
        console.log('🔄 hasTabChanges - selectedColumnsChanged:', changed);
        return changed;
      })();
      
      // Check for filtered columns changes
      const filteredColumnsChanged = (() => {
        const originalFilteredColumns = tabOriginalData.filteredColumns || {};
        const currentFilteredColumns = tabFilteredColumns || {};
        
        console.log('🔄 hasTabChanges - filteredColumns comparison:', {
          originalFilteredColumns,
          currentFilteredColumns
        });
        
        // Compare objects by converting to JSON strings
        const changed = JSON.stringify(originalFilteredColumns) !== JSON.stringify(currentFilteredColumns);
        console.log('🔄 hasTabChanges - filteredColumnsChanged:', changed);
        return changed;
      })();
      
      const hasChanges = (
        questionChanged ||
        sqlChanged ||
        outputModeChanged ||
        columnOrderChanged ||
        sortingChanged ||
        chartConfigChanged ||
        selectedColumnsChanged ||
        filteredColumnsChanged
      );
      
      console.log('🪄 hasTabChanges debug:', {
        tabIsEditing,
        hasOriginalData: !!tabOriginalData,
        questionChanged,
        sqlChanged,
        outputModeChanged,
        columnOrderChanged,
        sortingChanged,
        chartConfigChanged,
        selectedColumnsChanged,
        hasChanges,
        originalSortColumn: tabOriginalData?.sortColumn,
        currentSortColumn: tabSortColumn,
        originalSortDirection: tabOriginalData?.sortDirection,
        currentSortDirection: tabSortDirection,
        originalSelectedColumns: tabOriginalData?.selectedColumns,
        currentSelectedColumns: tabSelectedColumns
      });
      
      console.log('🪄 hasTabChanges sorting comparison:', {
        originalSortColumn: tabOriginalData?.sortColumn,
        currentSortColumn: tabSortColumn,
        originalSortDirection: tabOriginalData?.sortDirection,
        currentSortDirection: tabSortDirection,
        sortingChanged
      });
      
      return hasChanges;
    }, [tabIsEditing, tabOriginalData, tabQuestion, tabSqlQuery, tabOutputMode, tabColumns, tabSortColumn, tabSortDirection, tabSelectedXColumn, tabSelectedYColumn, tabSelectedColumns, tabFilteredColumns])

// Debug: Monitor X/Y column changes and trigger hasTabChanges check
useEffect(() => {
  if (tabIsEditing && tabOriginalData) {
    console.log('🪄 X/Y columns changed, checking hasTabChanges...');
    const hasChanges = hasTabChanges();
    console.log('🪄 hasTabChanges result:', hasChanges);
  }
}, [tabSelectedXColumn, tabSelectedYColumn, tabIsEditing, tabOriginalData, hasTabChanges]);

// Debug: Monitor selected columns changes and trigger hasTabChanges check
useEffect(() => {
  if (tabIsEditing && tabOriginalData) {
    console.log('🪄 Selected columns changed, checking hasTabChanges...');
    const hasChanges = hasTabChanges();
    console.log('🪄 hasTabChanges result:', hasChanges);
  }
}, [tabSelectedColumns, tabIsEditing, tabOriginalData, hasTabChanges]);

// Debug: Monitor filtered columns changes and trigger hasTabChanges check
useEffect(() => {
  if (tabIsEditing && tabOriginalData) {
    console.log('🪄 Filtered columns changed, checking hasTabChanges...');
    const hasChanges = hasTabChanges();
    console.log('🪄 hasTabChanges result:', hasChanges);
  }
}, [tabFilteredColumns, tabIsEditing, tabOriginalData, hasTabChanges]);

    const handleQuestionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      setTabQuestion(newValue)
      
      // Validate input and update validation state - COMMENTED OUT
      // const validation = validateTabQueryInput(newValue)
      // setTabValidationErrors(validation.errors)
      // setTabValidationWarnings(validation.warnings)
      // setTabShowValidation(validation.errors.length > 0)
    }, [])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleTabSearch()
      }
    }, [handleTabSearch])

    // Excel export function for saved query tabs
    const handleTabExportToExcel = useCallback(() => {
      if (!tabQueryResults || !tabColumns.length) return;

      try {
        // Create a new workbook
        const workbook = XLSX.utils.book_new();
        
        // Convert query results to worksheet format with proper date handling
        const worksheetData = tabQueryResults.map(row => {
          const newRow: any = {};
          tabColumns.forEach(col => {
            const cellValue = row[col.key];
            
            // Handle date values to prevent timezone issues
            if (typeof cellValue === 'string' && cellValue.match(/^\d{4}-\d{2}-\d{2}T/)) {
              // Parse the date string and create a date object without timezone conversion
              const dateMatch = cellValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
              if (dateMatch) {
                const [, year, month, day] = dateMatch;
                // Create date in local timezone to avoid timezone conversion issues
                const localDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                newRow[col.name] = localDate;
              } else {
                newRow[col.name] = cellValue;
              }
            } else {
              newRow[col.name] = cellValue;
            }
          });
          return newRow;
        });
        
        // Create worksheet from data
        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Query Results');
        
        // Generate filename with timestamp and query title
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const safeTitle = tabCurrentTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
        const filename = `${safeTitle}_${timestamp}.xlsx`;
        
        // Write file and trigger download
        XLSX.writeFile(workbook, filename);
        
        // Show success notification
        toast.success('Excel file exported successfully!', {
          description: `File saved as: ${filename}`
        });
      } catch (error) {
        console.error('Error exporting to Excel:', error);
        setTabError('Failed to export to Excel');
        toast.error('Failed to export to Excel', {
          description: 'Please try again'
        });
      }
    }, [tabQueryResults, tabColumns, tabCurrentTitle, setTabError]);

    const errorInfo = getTabErrorInfo(tabError || '');

    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{tabCurrentTitle}</h2>
          <div className={`flex items-center gap-2 ${tabIsColumnSelectorExpanded ? 'hidden' : ''}`}>
            {tabIsEditing ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleTabUpdate}
                  disabled={(() => {
  const hasChanges = hasTabChanges();
  const isDisabled = !tabQuestion || !tabSqlQuery || !tabOutputMode || !tabColumns.length || !tabQueryResults?.length || tabSaveStatus === "saving" || !hasChanges;
  console.log('🪄 Update button disabled check:', {
    hasChanges,
    isDisabled,
    tabQuestion: !!tabQuestion,
    tabSqlQuery: !!tabSqlQuery,
    tabOutputMode: !!tabOutputMode,
    tabColumnsLength: tabColumns.length,
    tabQueryResultsLength: tabQueryResults?.length,
    tabSaveStatus,
    tabSelectedColumns: tabSelectedColumns,
    tabOriginalDataSelectedColumns: tabOriginalData?.selectedColumns
  });
  return isDisabled;
})()}
                >
                  {tabSaveStatus === "saving" ? "Saving..." : tabSaveStatus === "success" ? "Saved!" : tabSaveStatus === "error" ? "Error" : "Update"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTabCancel}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleTabEdit}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleTabDelete}
                >
                  Delete
                </Button>
                {/* Excel Export Button for saved query tabs - only for table output */}
                {tabQueryResults && tabQueryResults.length > 0 && tabColumns.length > 0 && tabOutputMode === 'table' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTabExportToExcel}
                  >
                    <Download className="h-4 w-4" />
                    <span>Excel</span>
                  </Button>
                )}
              </>
            )}
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded"
            >
              ×
            </button>
          </div>
        </div>

        {tabIsLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
              <div className="text-sm font-medium text-muted-foreground">Loading query results...</div>
              {/* {processingTime === 'longer' && (
                <div className="text-xs text-muted-foreground/70">Thinking longer for more accurate results</div>
              )} */}
            </div>
          </div>
        )}

        {tabError && (
          <div className="mt-4">
            {(() => {
              const errorInfo = getTabErrorInfo(tabError)
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
                    <div className="text-sm bg-white/50 p-2 rounded border text-gray-700">
                      {tabError}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTabError(null)}
                    className="h-6 w-6 p-0 hover:bg-white/50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )
            })()}
          </div>
        )}

        {tabIsEditing ? (
          // Edit mode - show query interface with same layout as Active Query
          <div key={`edit-mode-${query?.id}`} className="flex flex-col h-full overflow-hidden">
            <h2 className="text-xl font-semibold mb-2">Edit Query</h2>

            <Textarea
              ref={textareaRef}
              key={`tab-edit-${query?.id}`}
              placeholder="e.g. Show me the top 10 donors of 2024"
              value={tabQuestion}
              onChange={handleQuestionChange}
              onKeyDown={handleKeyDown}
              className="mb-2"
            />


            {/* Column Selector - Show when user is typing in saved query */}
            {tabQuestion.trim().length > 0 && (
              <div className="mb-4 bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                {/* Header with toggle button */}
                <button
                  onClick={() => setTabIsColumnSelectorExpanded(!tabIsColumnSelectorExpanded)}
                  className={`w-full p-4 text-left flex items-center justify-between transition-colors hover:bg-accent/50`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="font-medium">Column Selector</span>
                    <span className="text-sm text-muted-foreground">Choose which columns to include</span>
                  </div>
                  {tabIsColumnSelectorExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                
                {/* Collapsible content */}
                {tabIsColumnSelectorExpanded && (
                  <div className={`border-t border-border`}>
                    {/* Quick Actions - Fixed */}
                    <div className="px-4 pt-3 pb-2">
                      <div className="flex gap-2">
                        {/* Auto option */}
                        <button
                          onClick={() => {
                            setTabColumnSelectionMode('auto')
                            setTabSelectedColumns([])
                            console.log('Auto column selection for saved query')
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            tabColumnSelectionMode === 'auto' 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                          }`}
                        >
                          <Sparkles className="h-3 w-3 mr-1" />
                          Auto
                        </button>
                        
                        {/* All Columns option */}
                        <button
                          onClick={() => {
                            setTabColumnSelectionMode('all')
                            setTabSelectedColumns([])
                            console.log('Include all columns for saved query')
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            tabColumnSelectionMode === 'all' 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                          }`}
                        >
                          All Columns
                        </button>
                      </div>
                    </div>
                    
                    {/* Column Bubbles - Scrollable */}
                    <div className="px-4 pb-4 max-h-[30vh] overflow-y-auto">
                      <div className="space-y-3">
                        {/* Gifts Table Columns */}
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">Gifts Table</h4>
                          <div className="flex flex-wrap gap-2">
                            {['ACCOUNTID', 'GIFTID', 'GIFTDATE', 'GIFTAMOUNT', 'TRANSACTIONTYPE', 'GIFTTYPE', 'PAYMENTMETHOD', 'PLEDGEID', 'SOFTCREDITINDICATOR', 'SOFTCREDITAMOUNT', 'SOFTCREDITID', 'SOURCECODE', 'DESIGNATION', 'UNIT', 'PURPOSECATEGORY', 'APPEAL', 'GIVINGLEVEL', 'UUID'].map((column) => (
                              <button
                                key={column}
                                onClick={() => {
                                  setTabColumnSelectionMode('custom')
                                  setTabSelectedColumns(prev => {
                                    if (prev.includes(column)) {
                                      return prev.filter(col => col !== column)
                                    } else {
                                      return [...prev, column]
                                    }
                                  })
                                  console.log('Toggle column:', column)
                                }}
                                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                                  tabSelectedColumns.includes(column) && tabColumnSelectionMode === 'custom'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted hover:bg-muted/80'
                                }`}
                              >
                                {column}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        {/* Constituents Table Columns */}
                        <div>
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">Constituents Table</h4>
                          <div className="flex flex-wrap gap-2">
                            {['ACCOUNTID', 'LOOKUPID', 'TYPE', 'DONORTYPE1', 'ALUMNITYPE', 'UNDERGRADUATEDEGREE1', 'UNDERGRADUATIONYEAR1', 'UNDERGRADUATEPREFERREDCLASSYEAR1', 'UNDERGRADUATESCHOOL1', 'GRADUATEDEGREE1', 'GRADUATEGRADUATIONYEAR1', 'GRADUATEPREFERREDCLASSYEAR1', 'GRADUATESCHOOL1', 'GENDER', 'DECEASED', 'SOLICITATIONRESTRICTIONS', 'DONOTMAIL', 'DONOTPHONE', 'DONOTEMAIL', 'MARRIEDTOALUM', 'SPOUSELOOKUPID', 'SPOUSEID', 'ASSIGNEDACCOUNT', 'VOLUNTEER', 'WEALTHSCORE', 'GEPSTATUS', 'EVENTSATTENDED', 'EVENTS', 'AGE', 'FULLNAME', 'PMFULLNAME', 'FULLADDRESS', 'HOMETELEPHONE', 'EMAIL'].map((column) => (
                              <button
                                key={column}
                                onClick={() => {
                                  setTabColumnSelectionMode('custom')
                                  setTabSelectedColumns(prev => {
                                    if (prev.includes(column)) {
                                      return prev.filter(col => col !== column)
                                    } else {
                                      return [...prev, column]
                                    }
                                  })
                                  console.log('Toggle column:', column)
                                }}
                                className={`px-2 py-1 text-xs rounded-md transition-colors ${
                                  tabSelectedColumns.includes(column) && tabColumnSelectionMode === 'custom'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted hover:bg-muted/80'
                                }`}
                              >
                                {column}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 mb-2">
              <ToggleGroup
                type="single"
                value={tabOutputMode}
                onValueChange={(value) => {
  console.log('🪄 Output mode changed from', tabOutputMode, 'to', value);
  if (value) setTabOutputMode(value)
}}
                className="flex gap-2"
              >
                <ToggleGroupItem value="table" aria-label="Table View">
                  <LayoutList className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="chart" aria-label="Bar Chart View">
                  <BarChart2 className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="pie" aria-label="Pie Chart View">
                  <PieChart className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Column Selection for Charts */}
{(() => {
  console.log('🪄 Chart Configuration visibility check:', {
    tabOutputMode,
    tabColumnsLength: tabColumns.length,
    shouldShow: (tabOutputMode === 'chart' || tabOutputMode === 'pie') && tabColumns.length >= 2
  });
  return (tabOutputMode === 'chart' || tabOutputMode === 'pie') && tabColumns.length >= 2;
})() && (
              <div className="mb-2 p-3 bg-muted/20 rounded border border-border">
                <div className="text-sm font-medium mb-2">Chart Configuration</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      X-Axis ({tabOutputMode === 'chart' ? 'Categories' : 'Labels'})
                    </label>
                    <Select value={tabSelectedXColumn} onValueChange={handleXColumnChange}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {tabColumns.map((col) => (
                          <SelectItem key={col.key} value={col.key}>
                            {col.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Y-Axis ({tabOutputMode === 'chart' ? 'Values' : 'Sizes'})
                    </label>
                    <Select value={tabSelectedYColumn} onValueChange={handleYColumnChange}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {tabColumns.map((col) => (
                          <SelectItem key={col.key} value={col.key}>
                            {col.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            <Button 
              className="mb-2"
              disabled={!tabQuestion || tabIsLoading}
              onClick={handleTabSearch}
            >
              {tabIsLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 mr-2 border-2 border-white border-t-transparent" />
                  Searching...
                </>
              ) : (
                "Search"
              )}
            </Button>

            {/* Results Title */}
            <div className="font-bold text-lg mb-2 mt-2" style={{ color: "#16a34a" }}>Results:</div>

            {/* Results Panel - Scrollable */}
            {tabQueryResults && tabQueryResults.length > 0 && tabColumns.length >= 1 && (
              <div className={`flex-1 overflow-auto bg-card border rounded p-4 ${tabIsColumnSelectorExpanded ? 'hidden' : ''}`}>
                <div className="overflow-x-auto">
                  {tabOutputMode === 'table' && (
                    <div data-testid="saved-query-tab-tableview-edit-mode">
                      <TableView 
                        data={tabQueryResults} 
                        columns={tabColumns} 
                        sql={tabSqlQuery || undefined} 
                        readOnlyMode={readOnlyMode}
                        onColumnOrderChange={handleTabColumnOrderChange}
                        onSortChange={(column, direction) => {
                          console.log('🔄 SAVED QUERY TAB TableView onSortChange called (EDIT MODE):', { column, direction, queryId: query.id })
                          handleTabSortChange(column, direction)
                        }}
                        externalSortColumn={tabSortColumn}
                        externalSortDirection={tabSortDirection}
                        inDashboard={true}
                        initialFilterColumns={tabFilteredColumns}
                        onFilterColumnsChange={handleTabFilterColumnsChange}
                      />
                    </div>
                  )}
                  
                  {tabOutputMode === 'chart' && (
                    <DraggableChart
                      data={tabQueryResults.map((row) => {
                        const chartData = {
                          name: row[tabSelectedXColumn] || row.donor || row._id?.name || 'Unknown',
                          value: Number(row[tabSelectedYColumn] || row.totalAmount) || 0,
                        };
                        console.log('🪄 Chart data mapping:', {
                          tabSelectedXColumn,
                          tabSelectedYColumn,
                          rowData: row,
                          chartData
                        });
                        return chartData;
                      })}
                      type={tabOutputMode}
                      sql={tabSqlQuery || undefined}
                      columns={tabColumns}
                      showExpandButton={false}
                    />
                  )}
                  
                  {tabOutputMode === 'pie' && (
                    <DraggablePieChart
                      data={tabQueryResults.map((row) => ({
                        name: row[tabSelectedXColumn] || row.donor || row._id?.name || 'Unknown',
                        value: Number(row[tabSelectedYColumn] || row.totalAmount) || 0,
                      }))}
                      sql={tabSqlQuery || undefined}
                      columns={tabColumns}
                      showExpandButton={false}
                    />
                  )}
                </div>
                
                {/* Show/Hide SQL */}
                {tabSqlQuery && (
                  <div className="mt-4">
                    <button
                      onClick={() => setTabShowSql(!tabShowSql)}
                      className="text-left text-sm font-semibold text-primary hover:underline focus:outline-none"
                    >
                      {tabShowSql ? "▼ Hide SQL" : "▶ Show SQL"}
                    </button>
                    {tabShowSql && (
                      <div className="mt-1 bg-muted p-2 rounded text-sm text-muted-foreground border border-border overflow-x-auto">
                        <pre className="whitespace-pre-wrap break-words">{tabSqlQuery}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tabError && <div className="text-red-500 mt-2">{tabError}</div>}

            {/* Action Buttons - REMOVED DUPLICATE BUTTONS */}
          </div>
        ) : (
          // View mode - show results
          <div className="flex flex-col h-full overflow-hidden">
            {tabQueryResults && tabQueryResults.length > 0 && tabColumns.length >= 1 && (
              <div className="flex-1 overflow-auto">
                {tabOutputMode === 'table' && (
                  <div data-testid="saved-query-tab-tableview-view-mode">
                    <TableView 
                      data={tabQueryResults} 
                      columns={tabColumns} 
                      compact 
                      readOnlyMode={readOnlyMode}
                      onColumnOrderChange={handleTabColumnOrderChange}
                      onSortChange={(column, direction) => {
                        console.log('🔄 SAVED QUERY TAB TableView onSortChange called (VIEW MODE):', { column, direction, queryId: query.id })
                        handleTabSortChange(column, direction)
                      }}
                      externalSortColumn={tabSortColumn}
                      externalSortDirection={tabSortDirection}
                      inDashboard={true}
                      initialFilterColumns={tabFilteredColumns}
                      onFilterColumnsChange={handleTabFilterColumnsChange}
                    />
                  </div>
                )}
                
                {tabOutputMode === 'chart' && (
                  <DraggableChart
                    data={tabQueryResults.map((row) => {
                      const chartData = {
                        name: row[tabSelectedXColumn] || row.donor || row._id?.name || 'Unknown',
                        value: Number(row[tabSelectedYColumn] || row.totalAmount) || 0,
                      };
                      console.log('🪄 View mode chart data mapping:', {
                        tabSelectedXColumn,
                        tabSelectedYColumn,
                        rowData: row,
                        chartData
                      });
                      return chartData;
                    })}
                    type={tabOutputMode}
                    sql={tabSqlQuery || undefined}
                    columns={tabColumns}
                    showExpandButton={false}
                  />
                )}
                
                {tabOutputMode === 'pie' && (
                  <DraggablePieChart
                    data={tabQueryResults.map((row) => ({
                      name: row[tabSelectedXColumn] || row.donor || row._id?.name || 'Unknown',
                      value: Number(row[tabSelectedYColumn] || row.totalAmount) || 0,
                    }))}
                    sql={tabSqlQuery || undefined}
                    columns={tabColumns}
                    showExpandButton={false}
                  />
                )}
              </div>
            )}

            {tabQueryResults && tabQueryResults.length === 0 && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                No results found
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // if (isGlobalLoading) {
  //   return (
  //     <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
  //       <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
  //     </div>
  //   )
  // }
  

  
  return (
    <>
      <GhostIndicator 
        message={ghostMessage}
        isVisible={showGhostIndicator}
      />
      <DndProvider backend={HTML5Backend}>
      
      <div className="flex flex-col h-screen relative">

        {/* SARA Header */}
        <header className="flex items-center justify-between py-2 px-6 border-b border-border bg-card mb-4">
          <h1 
            className="text-2xl md:text-3xl sara-brand font-semibold bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity"
            onClick={async () => {
              // In read-only mode, navigate directly without save prompt
              if (readOnlyMode) {
                router.push('/');
                return;
              }
              
              // Check if there's an active query (question, results, or visualizations)
              const hasActiveQuery = question || queryResults?.length || allVisualizations.length > 0;
              
              if (hasActiveQuery) {
                const shouldSave = confirm('Save Query? Your current query will be lost if you don\'t save it.');
                if (shouldSave) {
                  // Save the current query before navigating
                  try {
                    const response = await fetch('/api/query', {
                      method: 'POST',
                      headers: createHeaders(),
                      body: JSON.stringify({
                        action: 'save',
                        title: question || 'Saved Query',
                        question: question,
                        comboPrompt: comboPrompt || question,
                        sql: sqlQuery,
                        outputMode: outputMode,
                        columns: columns,
                        data: queryResults,
                        selectedColumns: selectedColumns
                      })
                    });

                    if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.error || 'Failed to save query');
                    }

                    alert('Query saved successfully!');
                  } catch (err: any) {
                    console.error('Error saving query:', err);
                    alert('Failed to save query: ' + err.message);
                    return; // Don't navigate if save failed
                  }
                }
              }
              
              // Navigate to home page
              router.push('/');
            }}
          >
            SARA
          </h1>
          
          {/* User Info and Logout */}
          {currentUser && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Welcome, {currentUser.username}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          )}
        </header>

        <div className="flex flex-1 overflow-hidden gap-2 px-2 pb-2">
          {/* Left Panel */}
          <div style={{ width: panelWidths.left }} className="relative transition-all duration-500 ease-in-out h-full">
            {collapsedPanels.left ? (
              renderCollapsedPanel('left', 'Saved')
            ) : (
              <div className="relative h-full">
                <button
                  className="absolute top-3 right-3 z-10 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full p-1 hover:bg-background/90 transition-all"
                  onClick={() => togglePanel('left')}
                  title="Collapse"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <HistoryPanel
                  readOnlyMode={readOnlyMode}   
                  onSelectQuery={loadSavedQueryIntoActivePanel}
                  onSelectDashboard={handleSelectDashboard}
                />
              </div>
            )}
          </div>




          
          {/* Middle Panel - hidden in read-only mode */}
          {!readOnlyMode && (
            <div style={{ width: panelWidths.middle }} className="relative transition-all duration-500 ease-in-out overflow-hidden">
              {collapsedPanels.middle ? (
                renderCollapsedPanel('middle', 'Query')
              ) : (
                <div className="relative h-full overflow-hidden">
                  <button
                    className="absolute top-3 right-3 z-10 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full p-1 hover:bg-background/90 transition-all"
                    onClick={() => togglePanel('middle')}
                    title="Collapse"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {renderSimplePanel()}
                </div>
              )}
            </div>
          )}




          
                      {/* Right Panel */}
            <div style={{ width: panelWidths.right }} className="relative flex flex-col rounded-lg border border-border bg-card overflow-hidden transition-all duration-500 ease-in-out h-full">
            {collapsedPanels.right ? (
              renderCollapsedPanel('right', 'Dashboard')
            ) : (
              <>
                {!readOnlyMode && (
                  <button
                    className="absolute top-3 left-3 z-10 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full p-1 hover:bg-background/90 transition-all"
                    onClick={() => togglePanel('right')}
                    title="Collapse"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
                
                {/* Show placeholder when in read-only mode with no dashboard selected */}
                {readOnlyMode && !dashboardIdNumber ? (
                  <div className="flex-1 bg-card rounded-lg border border-border overflow-auto">
                    <div className="h-full flex items-center justify-center p-8">
                      <div className="text-center">
                        <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-12 max-w-md">
                          <div className="flex flex-col items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-foreground mb-2">
                                No Dashboard Selected
                              </h3>
                              <p className="text-sm text-muted-foreground mb-1">
                                Click on a saved dashboard to view it here
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Select from the "Saved Dashboards" panel on the left
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 p-4 pb-24 overflow-hidden border-b border-border flex flex-col relative min-h-0">
                    <input
                      type="text"
                      value={dashboardSectionTitle || ""}
                                                  onChange={(e) => {
                              setDashboardSectionTitle(e.target.value);
                              setTimeout(() => triggerChangeDetection(), 100);
                            }}
                      readOnly={readOnlyMode}
                      className={`text-lg font-semibold mt-1 mb-3 bg-transparent outline-none w-full text-center ${
                        readOnlyMode ? 'cursor-default' : 'cursor-text'
                      }`}
                    />
                    {/* NEW unified grid — fills available height */}
                    <div className="grid grid-cols-2 gap-2 flex-1 min-h-0" style={{ gridTemplateRows: '1fr 1fr' }}>
                      {/* Top Left */}
                      <div className="flex flex-col min-h-0">
                        <input
                          type="text"
                          value={topLeftTitle || ""}
                                                      onChange={(e) => {
                              setTopLeftTitle(e.target.value);
                              setTimeout(() => triggerChangeDetection(), 100);
                            }}
                          readOnly={readOnlyMode}
                          className={`text-sm font-medium text-center mt-1 mb-2 bg-transparent outline-none w-full flex-shrink-0 ${
                            readOnlyMode ? 'cursor-default' : 'cursor-text'
                          }`}
                        />
                        <DropZone
                          id="topLeft"
                          onDrop={(item) => handleDrop('topLeft', item)}
                          onRemove={() => {
                          setQuadrants((prev) => ({ ...prev, topLeft: null }));
                          setTimeout(() => triggerChangeDetection(), 100);
                        }}
                          data-quadrant-id="topLeft"
                          readOnlyMode={readOnlyMode}
                          className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden"
                        >
                          {quadrants.topLeft ? renderDroppedViz(quadrants.topLeft) : (
                            <div className="h-full flex items-center justify-center text-sm font-semibold" style={{ color: '#16a34a' }}>
                              {readOnlyMode ? 'No visualization' : 'Drag results here'}
                            </div>
                          )}
                        </DropZone>
                      </div>

                      {/* Top Right */}
                      <div className="flex flex-col min-h-0">
                        <input
                          type="text"
                          value={topRightTitle || ""}
                                                      onChange={(e) => {
                              setTopRightTitle(e.target.value);
                              setTimeout(() => triggerChangeDetection(), 100);
                            }}
                          readOnly={readOnlyMode}
                          className={`text-sm font-medium text-center mt-1 mb-2 bg-transparent outline-none w-full flex-shrink-0 ${
                            readOnlyMode ? 'cursor-default' : 'cursor-text'
                          }`}
                        />
                        <DropZone
                          id="topRight"
                          onDrop={(item) => handleDrop('topRight', item)}
                          onRemove={() => {
                          setQuadrants((prev) => ({ ...prev, topRight: null }));
                          setTimeout(() => triggerChangeDetection(), 100);
                        }}
                          data-quadrant-id="topRight"
                          readOnlyMode={readOnlyMode}
                          className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden"
                        >
                          {quadrants.topRight ? renderDroppedViz(quadrants.topRight) : (
                            <div className="h-full flex items-center justify-center font-semibold text-sm" style={{ color: '#16a34a' }}>
                              {readOnlyMode ? 'No visualization' : 'Drag results here'}
                            </div>
                          )}
                        </DropZone>
                      </div>

                      {/* Bottom (spans full width) */}
                      <div className="flex flex-col min-h-0 col-span-2">
                        <input
                          type="text"
                          value={bottomTitle || ""}
                                                      onChange={(e) => {
                              setBottomTitle(e.target.value);
                              setTimeout(() => triggerChangeDetection(), 100);
                            }}
                          readOnly={readOnlyMode}
                          className={`text-sm font-medium text-center mt-1 mb-2 bg-transparent outline-none w-full flex-shrink-0 ${
  readOnlyMode ? 'cursor-default' : 'cursor-text'
}`}
                        />
                        <DropZone
                          id="bottom"
                          onDrop={(item) => handleDrop('bottom', item)}
                          onRemove={() => {
                          setQuadrants((prev) => ({ ...prev, bottom: null }));
                          setTimeout(() => triggerChangeDetection(), 100);
                        }}
                          data-quadrant-id="bottom"
                          readOnlyMode={readOnlyMode}
                          className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden"
                        >
                          {quadrants.bottom ? renderDroppedViz(quadrants.bottom) : (
                            <div className="h-full flex items-center justify-center font-semibold text-sm" style={{ color: '#16a34a' }}>
                              {readOnlyMode ? 'No visualization' : 'Drag results here'}
                            </div>
                          )}
                        </DropZone>
                      </div>
                    </div>
                  </div>
                )}

                  




                  
                  
                
                {/* Action buttons - different for edit vs read-only mode */}
                <div className="p-4 bg-card">
                  <div className="flex flex-row items-center justify-between w-full gap-2">
                    {!readOnlyMode ? (
                      // Edit mode buttons
                      <>
                        <div className="flex flex-col gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={handleSaveDashboard}
                                  variant="default"
                                  className="flex items-center gap-2"
                                  disabled={(() => {
                                    const hasVisualizations = Object.values(quadrants).some(Boolean);
                                    const canSave = dashboardIdNumber ? canUpdateDashboards() : canSaveDashboards();
                                    // For newly created dashboards, enable when visualizations are present and user can save
                                    // For existing dashboards, enable when there are changes and user can update
                                    const shouldDisable = !canSave || !hasVisualizations || (!!dashboardIdNumber && !isNewlyCreatedDashboard && !hasDashboardChanges);
                                    console.log('🔍 Save button disabled check:', {
                                      canSave,
                                      hasVisualizations,
                                      dashboardIdNumber,
                                      hasDashboardChanges,
                                      isNewlyCreatedDashboard,
                                      shouldDisable
                                    });
                                    return shouldDisable;
                                  })()}
                                >
                                  <Save className="h-5 w-5" />
                                  <span>{dashboardIdNumber ? 'Update' : 'Save'}</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {!canSaveDashboards() && !canUpdateDashboards() 
                                    ? "This option is not available for demo purpose" 
                                    : dashboardIdNumber 
                                      ? "Update dashboard" 
                                      : "Save dashboard"
                                  }
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          {!canSaveDashboards() && !canUpdateDashboards() && (
                            <span className="text-xs text-muted-foreground italic">
                              Demo accounts cannot save dashboards
                            </span>
                          )}
                        </div>

                          {dashboardIdNumber && (
                            <div className="flex flex-col gap-1">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      onClick={handleDeleteDashboard}
                                      variant="destructive"
                                      className="flex items-center gap-2"
                                      disabled={!canUpdateDashboards()}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      <span>Delete</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>
                                      {!canUpdateDashboards() 
                                        ? "This option is not available for demo purpose" 
                                        : "Delete dashboard"
                                      }
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              
                              {!canUpdateDashboards() && (
                                <span className="text-xs text-muted-foreground italic">
                                  Demo accounts cannot delete dashboards
                                </span>
                              )}
                            </div>
                          )}

                          {dashboardIdNumber && (
                            <Button
                              onClick={() => setShareDialogOpen(true)}
                              variant="outline"
                              className="flex items-center gap-2"
                            >
                              <Share className="h-4 w-4" />
                              <span>Share</span>
                            </Button>
                          )}

                        <Button
                          onClick={() => {
                            // Clear all dashboard data
                            setQuadrants({ topLeft: null, topRight: null, bottom: null });
                            setAllVisualizations([]);
                            setDashboardSectionTitle("Untitled Dashboard");
                            setTopLeftTitle("Sample Title");
                            setTopRightTitle("Sample Title");
                            setBottomTitle("Sample Title");
                            setOriginalDashboardData(null);
                            setHasDashboardChanges(false);
                            setIsNewlyCreatedDashboard(false);
                            // Remove dashboardId from URL and set to new mode
                            router.replace('/dashboard?edit=true');
                          }}
                          variant="ghost"
                          className="flex items-center gap-2"
                        >
                          <X className="h-4 w-4" />
                          <span>Clear</span>
                        </Button>
                      </>
                    ) : (
                      // Read-only mode - only share button
                      dashboardIdNumber && (
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => setShareDialogOpen(true)}
                            variant="outline"
                            className="flex items-center gap-2"
                          >
                            <Share className="h-4 w-4" />
                            <span>Share Dashboard</span>
                          </Button>
                        </div>
                      )
                    )}
                  </div>
                </div>



                
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => togglePanel('right')}
                >

                </Button>
              </>
            )}
          </div>
        </div>






        
                
        <ShareLinkDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          dashboardId={dashboardIdNumber || undefined}
          dashboardTitle={dashboardSectionTitle}
        />


        {/* ✅ Enhanced Debug Info */}
{/*         <div className="bg-muted p-4 text-sm border-t border-border mt-2">
          <h3 className="font-semibold mb-2">🛠 Visualization Diagnostics</h3>
          {allVisualizations.length === 0 ? (
            <div>No visualizations saved yet.</div>
          ) : (
            allVisualizations.map((viz, index) => (
              <div key={viz.id} className="mb-4 p-2 border rounded bg-card">
                <div><strong>Viz #{index + 1}</strong> — <code>{viz.title}</code></div>
                <div><strong>ID:</strong> {viz.id}</div>
                <div><strong>Type:</strong> {viz.type}</div>
                <div><strong>Data (first 2 rows):</strong>
                  <pre className="text-xs whitespace-pre-wrap bg-muted p-2 rounded mt-1">
                    {JSON.stringify(viz.data?.slice(0, 2), null, 2) || '(none)'}
                  </pre>
                </div>
                <div><strong>Columns:</strong>
                  <pre className="text-xs whitespace-pre-wrap bg-muted p-2 rounded mt-1">
                    {JSON.stringify(viz.columns || [], null, 2)}
                  </pre>
                </div>
              </div>
            ))
          )}
        </div> */}
          
{/*         <div className="bg-muted p-4 text-sm border-t border-border mt-2">
          <h3 className="font-semibold mb-2">Debug Info</h3>
          <div><strong>Question:</strong> {question || '(empty)'}</div>
          <div><strong>SQL Query:</strong> {sqlQuery || '(not generated yet)'}</div>
          <div><strong>Is Loading:</strong> {String(isLoading)}</div>
          <div><strong>Error:</strong> {error || '(none)'}</div>
          <div><strong>Output Mode:</strong> {outputMode}</div>
          <div><strong>Query Results:</strong> {queryResults ? `${queryResults.length} rows` : '(no results)'}</div>
          <div><strong>Columns:</strong> {columns.length > 0 ? JSON.stringify(columns, null, 2) : '(none)'}</div>
          <div><strong>Query Results Sample:</strong>
            <pre className="text-xs mt-1 whitespace-pre-wrap">
              {queryResults ? JSON.stringify(queryResults.slice(0, 3), null, 2) : '(none)'}
            </pre>
          </div>

          <div><strong>Data Sent to Drag Item:</strong>
            <pre className="text-xs mt-1 whitespace-pre-wrap">
              {queryResults && columns.length >= 2
                ? JSON.stringify(
                    queryResults.slice(0, 3).map(row => ({
                      name: row[columns[0].key],
                      value: Number(row[columns[1].key]) || 0
                    })),
                    null,
                    2
                  )
                : '(insufficient columns)'}
            </pre>
          </div>
          
          
        </div>         */}
        

        {/* 🔒 Save-Ready Dashboard Preview */}
{/*         <div className="bg-muted p-4 text-sm border-t border-border mt-2">
          <h3 className="font-semibold mb-2">📦 Save-Ready Dashboard</h3>
          <div><strong>Title:</strong> {dashboardSectionTitle}</div>
          <div><strong>Quadrants:</strong>
            <pre className="text-xs whitespace-pre-wrap bg-muted p-2 rounded mt-1">
              {JSON.stringify(quadrants, null, 2)}
            </pre>
          </div>
          <div><strong>Visualizations:</strong>
            <pre className="text-xs whitespace-pre-wrap bg-muted p-2 rounded mt-1">
              {JSON.stringify(
                allVisualizations.filter((v) => Object.values(quadrants).includes(v.id)),
                null,
                2
              )}
            </pre>
          </div>
        </div> */}
          
        
      </div>


    {isGlobalLoading && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-auto">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
          <div className="text-sm font-medium text-muted-foreground">Loading...</div>
        </div>
      </div>
    )}

    {/* Delete Confirmation Modals */}
    <DeleteConfirmationModal
      open={deleteDashboardModalOpen}
      onOpenChange={setDeleteDashboardModalOpen}
      onConfirm={handleConfirmDeleteDashboard}
      title="Delete Dashboard"
      itemType="dashboard"
      description="Are you sure you want to delete this dashboard? This action cannot be undone."
    />

    <DeleteConfirmationModal
      open={deleteQueryModalOpen}
      onOpenChange={setDeleteQueryModalOpen}
      onConfirm={handleConfirmDeleteQuery}
      title="Delete Query"
      itemType="query"
      description="Are you sure you want to delete this query? This action cannot be undone."
    />

    <DeleteConfirmationModal
      open={deleteSavedQueryModalOpen}
      onOpenChange={setDeleteSavedQueryModalOpen}
      onConfirm={handleConfirmDeleteSavedQuery}
      title="Delete Saved Query"
      itemType="saved query"
      description="Are you sure you want to delete this saved query? This action cannot be undone."
    />
      
    </DndProvider>
    </>
  )
}
