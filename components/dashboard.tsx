
'use client'

import { ChevronLeft, ChevronRight, Save, Filter, Trash2, AlertTriangle, AlertCircle, XCircle, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useCallback, useRef } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { BarGraph } from '@/components/bar-graph'
import { TableView } from '@/components/table-view'
import { DropZone } from '@/components/drop-zone'
import { HistoryPanel } from '@/components/history-panel'
import { QueryPanel } from '@/components/query-panel'
import { ShareLinkDialog } from '@/components/share-link-dialog'
import { Button } from '@/components/ui/button'
import { PieGraph } from '@/components/pie-chart'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { LayoutList, BarChart2, PieChart } from 'lucide-react'
import { DraggableChart } from '@/components/draggable-chart'
import { DraggablePieChart } from '@/components/draggable-pie'


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

export default function () {
  const router = useRouter();
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
        return { ...viz, title, quadrant };
      })
      .filter(Boolean);


    const payload = {
      ...(dashboardIdNumber ? { id: dashboardIdNumber } : {}),
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok) {
          alert('Dashboard saved!');
          // If this was a new dashboard (no id before), update the URL and let the app reload with the new ID!
          if (!dashboardId && data.id) {
            router.replace(`/?d=${data.id}&edit=true`);
            return;
          }
        } else {
          alert('Error saving dashboard: ' + (data.error || 'Unknown error'));
        }
      })
      .catch(err => {
        alert('Error saving dashboard: ' + err.message);
      });
  }




  


  
  const searchParams = useSearchParams();
  const dashboardId = searchParams.get('d');

  // Only treat dashboardId as valid if it's a positive integer
  const dashboardIdNumber = dashboardId && !isNaN(Number(dashboardId)) && Number(dashboardId) > 0 ? Number(dashboardId) : null;
  
  const editParam = searchParams.get('edit');
  const editMode = editParam === 'true';
  const readOnlyMode = !editMode;
    
    
  const [collapsedPanels, setCollapsedPanels] = useState<Record<'left' | 'middle' | 'right', boolean>>({
    left: !readOnlyMode,
    middle: false,
    right: !readOnlyMode,
  })

  const [panelWidths, setPanelWidths] = useState<Record<'left' | 'middle' | 'right', string>>({
    left: '20%',
    middle: '40%',
    right: '40%',
  })

  const [question, setQuestion] = useState('')
  const [outputMode, setOutputMode] = useState('table')
  const [isLoading, setIsLoading] = useState(false)
  const [isGlobalLoading, setIsGlobalLoading] = useState(false)
  const [sqlQuery, setSqlQuery] = useState<string | null>(null)
  const [queryResults, setQueryResults] = useState<any[] | null>(null)
  const [columns, setColumns] = useState<{ key: string; name: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  // Stabilize setQuestion to prevent unnecessary re-renders
  const stableSetQuestion = useCallback((value: string) => {
    setQuestion(value)
  }, [])

  const stableSetOutputMode = useCallback((value: string) => {
    setOutputMode(value)
  }, [])

  const stableSetSqlQuery = useCallback((value: string | null) => {
    setSqlQuery(value)
  }, [])

  const stableSetQueryResults = useCallback((value: any[]) => {
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

  // Add state for collapsible panels
  // const [showSavedQueries, setShowSavedQueries] = useState(true);
  // const [showCreateDashboard, setShowCreateDashboard] = useState(true);

  
  
  useEffect(() => {
    console.log("🏁 Dashboard loader useEffect running!", { readOnlyMode, dashboardId });
    const loadDashboard = async () => {
      if (!readOnlyMode || !dashboardId) return;
  
      setIsGlobalLoading(true);
  
      try {
        const res = await fetch(`/api/dashboard?id=${dashboardId}`);
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
          setAllVisualizations(parsedCachedVisualizations);
        
          // Improved quadrant mapping
          const quadrantMap: any = {};
          for (const quadrant in parsedQuadrants) {
            const expectedOriginalId = parsedQuadrants[quadrant];
            const expectedViz = parsedVizList?.find(v => v.id === expectedOriginalId);
            const expectedType = expectedViz?.type;
        
            const match = parsedCachedVisualizations.find(
              v =>
                (v.originalId === expectedOriginalId || (v.sql && v.sql === expectedViz?.sql)) &&
                v.type === expectedType
            );
        
            quadrantMap[quadrant] = match ? match.id : null;
          }
          setQuadrants({
            topLeft: quadrantMap.topLeft || null,
            topRight: quadrantMap.topRight || null,
            bottom: quadrantMap.bottom || null,
          });
        
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
  }, [readOnlyMode, dashboardId]);
    

  
  const togglePanel = (panel: 'left' | 'middle' | 'right') => {
    setCollapsedPanels((prev) => ({
      ...prev,
      [panel]: !prev[panel],
    }))
  }




  
  
  useEffect(() => {
    const collapsedWidth = '100px';
    if (readOnlyMode) {
      const leftWidth = collapsedPanels.left ? collapsedWidth : '20%';
      const rightWidth = collapsedPanels.left ? '100%' : (collapsedPanels.right ? collapsedWidth : '80%');
      setPanelWidths({
        left: leftWidth,
        middle: '0%',
        right: rightWidth,
      });
      return;
    }
    // Regular logic in edit mode
    const fullWidth = 100;
    const newPanelWidths = {
      left: collapsedPanels.left ? collapsedWidth : '20%',
      middle: collapsedPanels.middle ? collapsedWidth : '',
      right: collapsedPanels.right ? collapsedWidth : '',
    };
    const fixedLeftPercent = collapsedPanels.left ? 3 : 20;
    const collapsedCount = ['middle', 'right'].filter((p): p is 'middle' | 'right' => collapsedPanels[p as keyof typeof collapsedPanels]).length;
    const collapsedTotal = collapsedCount * 3;
    const availableWidth = fullWidth - fixedLeftPercent - collapsedTotal;
    const proportions: Record<'middle' | 'right', number> = { middle: 40, right: 40 };
    const visible = (['middle', 'right'] as const).filter((p) => !collapsedPanels[p]);
    const totalVisible = visible.reduce((sum, p) => sum + proportions[p], 0);
    visible.forEach((panel) => {
      newPanelWidths[panel] = `${(proportions[panel] / totalVisible) * availableWidth}%`;
    });
    setPanelWidths(newPanelWidths);
  }, [collapsedPanels, readOnlyMode]);
  
  







  
  const handleQuerySubmit = async () => {
    if (!question) return
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/generate-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Server error')

      setSqlQuery(data.sql)

      const resultRes = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: question || 'Query',
          sql: data.sql,
          outputMode: outputMode,
          columns: []
        }),
      })

      const result = await resultRes.json()
      if (!resultRes.ok) throw new Error(result.error || 'Query execution error')

      setQueryResults(result.data || [])
      setColumns(result.columns || [])

      // Save as draggable visualization -- REMOVE `data`, ADD `sql`
      const newViz = {
        id: `viz-${Date.now()}`,
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

    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }


  const runSqlQuery = async (sql: string, mode: string) => {
    try {
      setIsLoading(true)
      setError(null)
  
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
  
      // Save as draggable visualization -- REMOVE `data`, ADD `sql`
      const newViz = {
        id: `viz-${Date.now()}`,
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
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle editing a saved query
  const handleEditQuery = async (query: any) => {
    // This function is no longer needed as saved query tabs have their own edit functionality
    console.log('Edit functionality moved to individual tabs')
  }

  // Handle updating a saved query
  const handleUpdateSavedQuery = async () => {
    // This function is no longer needed as saved query tabs have their own update functionality
    console.log('Update functionality moved to individual tabs')
  }

  // Cancel edit mode
  const handleCancelEdit = () => {
    // This function is no longer needed as saved query tabs have their own cancel functionality
    console.log('Cancel functionality moved to individual tabs')
  }

  // Check if there are changes from original data
  const hasChanges = () => {
    // This function is no longer needed as saved query tabs have their own change detection
    return false
  }

  // Handle Edit button click for selected saved query
  const handleEditSavedQuery = () => {
    // This function is no longer needed as saved query tabs have their own edit functionality
    console.log('Edit functionality moved to individual tabs')
  }

  // Handle Delete button click for selected saved query
  const handleDeleteSavedQuery = async () => {
    // This function is no longer needed as saved query tabs have their own delete functionality
    console.log('Delete functionality moved to individual tabs')
  }

  // Tab management functions
  const openSavedQueryTab = (query: any) => {
    const tabId = `saved-query-${query.id}`
    
    // Check if tab already exists
    const existingTab = tabs.find(tab => tab.id === tabId)
    if (existingTab) {
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

    setTabs(prev => [...prev, newTab])
    setActiveTabId(tabId)
  }

  const closeTab = (tabId: string) => {
    if (tabId === 'active-query') return // Cannot close active query tab
    
    setTabs(prev => prev.filter(tab => tab.id !== tabId))
    
    // If closing the active tab, switch to active query tab
    if (activeTabId === tabId) {
      setActiveTabId('active-query')
    }
  }

  const getCurrentTabData = () => {
    const currentTab = tabs.find(tab => tab.id === activeTabId)
    return currentTab
  }
  

  
  const handleDrop = (quadrantId: 'topLeft' | 'topRight' | 'bottom', item: Visualization) => {
    setLastDroppedItem(item);
    console.log('🪄 Diagnostics: Last Dropped Item', item);
  
    const itemId = item.id;
    const itemExists = allVisualizations.some((v) => v.id === itemId);
  
    if (!itemExists) {
      setAllVisualizations((prev) => [...prev, item]);
    }
  
    // Reset and assign to prevent rendering conflicts
    setQuadrants((prev) => ({
      ...prev,
      [quadrantId]: null, // reset first
    }));
  
    setTimeout(() => {
      setQuadrants((prev) => ({
        ...prev,
        [quadrantId]: itemId,
      }));
  
      // Improved diagnostics: only log error if data.length > 0, table is in DOM, and after enough time
      setTimeout(() => {
        // Only check if this quadrant is still showing the dropped viz
        if (quadrants[quadrantId] !== itemId) return;
  
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
    }, 0); // delay for React state reflow
  };


  
  
  const handleSelectDashboard = async (dashboard: { id: number; title: string }) => {
    // Always update the URL to reflect the selected dashboard and edit mode!
    router.replace(`/?d=${dashboard.id}&edit=true`);
  
    setIsGlobalLoading(true);
    try {
      const res = await fetch(`/api/dashboard?id=${dashboard.id}`);
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
        setAllVisualizations(parsedCachedVisualizations);

        // Map quadrants: match by originalId or sql, fallback to first
        const quadrantMap: any = {};
        for (const quadrant in parsedQuadrants) {
          const expectedOriginalId = parsedQuadrants[quadrant];
          const expectedViz = parsedVizList?.find(v => v.id === expectedOriginalId);
          const expectedType = expectedViz?.type;

          const match = parsedCachedVisualizations.find(
            v =>
              (v.originalId === expectedOriginalId || (v.sql && v.sql === expectedViz?.sql)) &&
              v.type === expectedType
          );

          quadrantMap[quadrant] = match ? match.id : null;
        }
        setQuadrants({
          topLeft: quadrantMap.topLeft || null,
          topRight: quadrantMap.topRight || null,
          bottom: quadrantMap.bottom || null,
        });

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
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsGlobalLoading(false);
    }
  };
    


  

  const getVisualizationById = (id: string) => allVisualizations.find((v: Visualization) => v.id === id)



  const renderDroppedViz = (vizId: string) => {
    const viz = getVisualizationById(vizId);
    if (!viz) return null;
  
    if (viz.type === 'chart' || viz.type === 'visualization') {
      return <BarGraph data={viz.data || []} height={150} />;
    }
  
    if (viz.type === 'pie') {
      let legendScale = 0.75;
    
      const isTopQuadrant = vizId === quadrants.topLeft || vizId === quadrants.topRight;
      const isLeftOpen = !collapsedPanels.left;
      const isMiddleHidden = collapsedPanels.middle;
    
      if (readOnlyMode) {
        legendScale = isTopQuadrant
          ? collapsedPanels.left ? 1.25 : 1
          : 0.75;
      } else {
        // This handles edit mode: middle panel hidden, left open
        if (isTopQuadrant && isLeftOpen && isMiddleHidden) {
          legendScale = 1.25;
        }
      }

  
      return (
        <PieGraph
          data={viz.data || []}
          height={150}
          compact
          legendScale={legendScale}
        />
      );
    }
  
    if (viz.type === 'table') {
      return <TableView data={viz.data || []} columns={viz.columns || []} compact />;
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
      <span className="text-xs">{label}</span>
    </button>
  )

  // Tabbed Panel Component - moved outside to prevent recreation
  const renderTabbedPanel = useCallback(() => {
    const currentTab = getCurrentTabData()
    
    return (
      <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
        {/* Tab Headers */}
        <div className="flex border-b border-border bg-muted/20 relative">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`
                flex items-center gap-2 px-4 py-3 cursor-pointer border-r border-border transition-colors
                ${activeTabId === tab.id 
                  ? 'bg-background border-b-0 font-mono font-medium text-foreground' 
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
          
          {/* Chevron button positioned in the tab area */}
          <button
            className="absolute top-3 right-3 z-10 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full p-1 hover:bg-background/90 transition-all"
            onClick={() => togglePanel('middle')}
            title="Collapse"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {currentTab?.type === 'active' ? (
            <QueryPanel
              question={question}
              setQuestion={stableSetQuestion}
              outputMode={outputMode}
              setOutputMode={stableSetOutputMode}
              isLoading={isLoading}
              sqlQuery={sqlQuery}
              setSqlQuery={stableSetSqlQuery}
              queryResults={queryResults}
              setQueryResults={stableSetQueryResults}
              columns={columns}
              setColumns={stableSetColumns}
              error={error}
              setError={stableSetError}
              onSubmit={handleQuerySubmit}
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

  // Saved Query Tab Component
  const SavedQueryTab = ({ query, onClose }: { query: any; onClose: () => void }) => {
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

    // Ref for textarea focus
    const textareaRef = useRef<HTMLTextAreaElement>(null)

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
            headers: { 'Content-Type': 'application/json' },
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
          
          // Store original data for edit mode
          setTabOriginalData({
            question: result.question,
            sql: result.sql,
            outputMode: result.outputMode,
            data: result.data,
            columns: result.columns
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

      try {
        const res = await fetch('/api/generate-sql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: tabQuestion }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Server error')

        setTabSqlQuery(data.sql)

        const resultRes = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
    }, [tabQuestion, tabOutputMode])

    const handleTabUpdate = useCallback(async () => {
      if (!query?.id) return
      
      setTabSaveStatus("saving")
      try {
        const response = await fetch('/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            id: query.id,
            title: tabQuestion,
            question: tabQuestion,
            sql: tabSqlQuery,
            outputMode: tabOutputMode,
            columns: tabColumns
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
          headers: { 'Content-Type': 'application/json' },
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
            columns: result.columns
          })
          
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
      }
      setTabIsEditing(false)
    }, [tabOriginalData])

    const handleTabDelete = useCallback(async () => {
      if (!query?.id) return
      
      if (!confirm('Are you sure you want to delete this saved query?')) return
      
      try {
        const response = await fetch('/api/query', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: query.id })
        })

        if (!response.ok) {
          throw new Error('Failed to delete query')
        }

        // Dispatch event to refresh history panel
        const event = new CustomEvent('queryUpdated', { detail: { action: 'deleted', queryId: query.id } })
        window.dispatchEvent(event)

        onClose() // Close the tab after successful deletion
      } catch (err: any) {
        console.error('Error deleting query:', err)
        alert('Failed to delete query: ' + err.message)
      }
    }, [query?.id, onClose])

    const hasTabChanges = useCallback(() => {
      if (!tabIsEditing || !tabOriginalData) return false
      
      return (
        tabQuestion !== tabOriginalData.question ||
        tabSqlQuery !== tabOriginalData.sql ||
        tabOutputMode !== tabOriginalData.outputMode
      )
    }, [tabIsEditing, tabOriginalData, tabQuestion, tabSqlQuery, tabOutputMode])

    const handleQuestionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setTabQuestion(e.target.value)
    }, [])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleTabSearch()
      }
    }, [handleTabSearch])

    const errorInfo = getTabErrorInfo(tabError || '');

    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-mono font-semibold">{tabCurrentTitle}</h2>
          <div className="flex items-center gap-2">
            {tabIsEditing ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleTabUpdate}
                  disabled={!tabQuestion || !tabSqlQuery || !tabOutputMode || !tabColumns.length || !tabQueryResults?.length || tabSaveStatus === "saving" || !hasTabChanges()}
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
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
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
                    <div className="text-sm font-mono bg-white/50 p-2 rounded border text-gray-700">
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
            <h2 className="text-xl font-mono font-semibold mb-2">Edit Query</h2>

            <Textarea
              ref={textareaRef}
              key={`tab-edit-${query?.id}`}
              placeholder="e.g. Show me the top 10 donors of 2024"
              value={tabQuestion}
              onChange={handleQuestionChange}
              onKeyDown={handleKeyDown}
              className="mb-2"
            />

            <div className="flex gap-2 mb-2">
              <ToggleGroup
                type="single"
                value={tabOutputMode}
                onValueChange={(value) => {
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
            <div className="font-mono font-bold text-lg mb-2 mt-2" style={{ color: "#16a34a" }}>Results:</div>

            {/* Results Panel - Scrollable */}
            {tabQueryResults && tabQueryResults.length > 0 && tabColumns.length >= 1 && (
              <div className="flex-1 overflow-auto bg-card border rounded p-4">
                <div className="overflow-x-auto">
                  {tabOutputMode === 'table' && (
                    <TableView data={tabQueryResults} columns={tabColumns} sql={tabSqlQuery || undefined} />
                  )}
                  
                  {tabOutputMode === 'chart' && (
                    <DraggableChart
                      data={tabQueryResults.map((row) => ({
                        name: row.donor || row._id?.name || row[tabColumns[0]?.key] || 'Unknown',
                        value: Number(row.totalAmount || row[tabColumns[1]?.key]) || 0,
                      }))}
                      height={200}
                      type={tabOutputMode}
                      sql={tabSqlQuery || undefined}
                      columns={tabColumns}
                    />
                  )}
                  
                  {tabOutputMode === 'pie' && (
                    <DraggablePieChart
                      data={tabQueryResults.map((row) => ({
                        name: row.donor || row._id?.name || row[tabColumns[0]?.key] || 'Unknown',
                        value: Number(row.totalAmount || row[tabColumns[1]?.key]) || 0,
                      }))}
                      height={200}
                      sql={tabSqlQuery || undefined}
                      columns={tabColumns}
                    />
                  )}
                </div>
                
                {/* Show/Hide SQL */}
                {tabSqlQuery && (
                  <div className="mt-4">
                    <button
                      onClick={() => setTabShowSql(!tabShowSql)}
                      className="text-left text-sm font-mono font-semibold text-primary hover:underline focus:outline-none"
                    >
                      {tabShowSql ? "▼ Hide SQL" : "▶ Show SQL"}
                    </button>
                    {tabShowSql && (
                      <div className="mt-1 bg-muted p-2 rounded text-sm font-mono text-muted-foreground border border-border overflow-x-auto">
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
                <TableView data={tabQueryResults} columns={tabColumns} compact />
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
    <DndProvider backend={HTML5Backend}>
      
      <div className="flex flex-col h-screen relative">

        {/* SARA Header */}
        <header className="flex items-center justify-start py-2 px-6 border-b border-border bg-card mb-4">
          <h1 
            className="text-2xl md:text-3xl inter font-semibold bg-gradient-to-r from-green-800 to-green-500 bg-clip-text text-transparent cursor-pointer hover:opacity-80 transition-opacity"
            onClick={async () => {
              // Check if there's an active query (question, results, or visualizations)
              const hasActiveQuery = question || queryResults?.length || allVisualizations.length > 0;
              
              if (hasActiveQuery) {
                const shouldSave = confirm('Save Query? Your current query will be lost if you don\'t save it.');
                if (shouldSave) {
                  // Save the current query before navigating
                  try {
                    const response = await fetch('/api/query', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'save',
                        title: question || 'Saved Query',
                        question: question,
                        sql: sqlQuery,
                        outputMode: outputMode,
                        columns: columns,
                        data: queryResults
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
        </header>

        <div className="flex flex-1 overflow-hidden gap-2 px-2 pb-2">
          {/* Left Panel */}
          <div style={{ width: panelWidths.left }} className="relative transition-all duration-500 ease-in-out">
            {!collapsedPanels.left && (
              <button
                className="absolute top-3 right-3 z-10 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full p-1 hover:bg-background/90 transition-all"
                onClick={() => togglePanel('left')}
                title="Collapse"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {collapsedPanels.left ? (
              renderCollapsedPanel('left', 'Saved')
            ) : (
                <HistoryPanel
                  readOnlyMode={readOnlyMode}   
                  onSelectQuery={openSavedQueryTab}
                  onSelectDashboard={handleSelectDashboard}
                  onEditQuery={handleEditQuery}
                />
            )}
          </div>




          
          {/* Middle Panel - hidden in read-only mode */}
          {!readOnlyMode && (
            <div style={{ width: panelWidths.middle }} className="relative transition-all duration-500 ease-in-out overflow-hidden">
              {collapsedPanels.middle ? (
                renderCollapsedPanel('middle', 'Query')
              ) : (
                  <div className="relative h-full overflow-hidden">
                    {renderTabbedPanel()}
                  </div>
                )}
            </div>
          )}




          
          {/* Right Panel */}
          <div style={{ width: panelWidths.right }} className="relative flex flex-col transition-all duration-500 ease-in-out">
            {collapsedPanels.right ? (
              renderCollapsedPanel('right', 'Dashboard')
            ) : (
              <>
                <button
                  className="absolute top-3 left-3 z-10 bg-background/80 backdrop-blur-sm border border-border/50 rounded-full p-1 hover:bg-background/90 transition-all"
                  onClick={() => togglePanel('right')}
                  title="Collapse"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="flex-1 bg-card rounded-lg p-4 border border-border overflow-auto">
                  <input
                    type="text"
                    value={dashboardSectionTitle || ""}
                    onChange={(e) => setDashboardSectionTitle(e.target.value)}
                    className="text-lg font-mono font-semibold mt-1 mb-4 bg-transparent outline-none w-full text-center"
                  />
                  <div className="grid grid-cols-2 gap-2 mb-2">


                    
                    <div className="flex flex-col">
                      <input
                        type="text"
                        value={topLeftTitle || ""}
                        onChange={(e) => setTopLeftTitle(e.target.value)}
                        className="text-sm font-mono font-medium text-center mt-2 mb-2 bg-transparent outline-none w-full"
                      />

                      <DropZone
                        id="topLeft"
                        onDrop={(item) => handleDrop("topLeft", item)}
                        onRemove={() => setQuadrants((prev) => ({ ...prev, topLeft: null }))}
                        data-quadrant-id="topLeft"
                      >
                        {quadrants.topLeft ? renderDroppedViz(quadrants.topLeft) : (
                          <div className="h-36 flex items-center justify-center font-mono font-semibold" style={{ color: "#16a34a" }}>
                            Drag results here
                          </div>
                        )}
                      </DropZone>
                      
                    </div>
                    <div className="flex flex-col">
                      <input
                        type="text"
                        value={topRightTitle || ""}
                        onChange={(e) => setTopRightTitle(e.target.value)}
                        className="text-sm font-mono font-medium text-center mt-2 mb-2 bg-transparent outline-none w-full"
                      />

                      
                      <DropZone
                        id="topRight"
                        onDrop={(item) => handleDrop("topRight", item)}
                        onRemove={() => setQuadrants((prev) => ({ ...prev, topRight: null }))}
                        data-quadrant-id="topRight"
                      >
                        {quadrants.topRight ? renderDroppedViz(quadrants.topRight) : (
                          <div className="h-36 flex items-center justify-center font-mono font-semibold" style={{ color: "#16a34a" }}>
                            Drag results here
                          </div>
                        )}
                      </DropZone>


                      
                    </div>



                    
                  </div>
                  <div className="flex flex-col mt-4">


                    
                    <input
                      type="text"
                      value={bottomTitle || ""}
                      onChange={(e) => setBottomTitle(e.target.value)}
                      className="text-sm font-mono font-medium text-center mb-1 bg-transparent outline-none w-full"
                    />


                    
                    <DropZone
                      id="bottom"
                      onDrop={(item) => handleDrop('bottom', item)}
                      onRemove={() => setQuadrants((prev) => ({ ...prev, bottom: null }))}
                      data-quadrant-id="bottom"
                    >
                      {quadrants.bottom ? renderDroppedViz(quadrants.bottom) : (
                        <div className="h-44 flex items-center justify-center font-mono font-semibold" style={{ color: "#16a34a" }}>
                          Drag results here
                        </div>
                      )}
                    </DropZone>


                    
                    
                    {/** Diagnostics for all quadrants */}
{/*                     <div className="mt-4 bg-muted p-2 rounded text-xs border">
                      <div className="font-semibold mb-2">🛠 Dashboard Quadrant Diagnostics</div>
                      {(['topLeft', 'topRight', 'bottom'] as const).map((pos) => {
                        const vizId = quadrants[pos];
                        const viz = getVisualizationById(vizId);
                        if (!viz) return (
                          <div key={pos} className="mb-2">
                            <div className="font-semibold">{pos}:</div>
                            <div className="text-muted-foreground">No visualization assigned.</div>
                          </div>
                        );
                        const { data, ...meta } = viz;
                        return (
                          <div key={pos} className="mb-4">
                            <div className="font-semibold">{pos}:</div>
                            <pre>{JSON.stringify(meta, null, 2)}</pre>
                            {viz.sql && (
                              <>
                                <div className="font-semibold">SQL:</div>
                                <pre className="whitespace-pre-wrap break-words">{viz.sql}</pre>
                              </>
                            )}
                            {Array.isArray(data) && data.length > 0 && (
                              <>
                                <div className="font-semibold">Output Data (sample):</div>
                                <pre className="whitespace-pre-wrap break-words">
                                  {JSON.stringify(data.slice(0, 3), null, 2)}
                                </pre>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>  */}



                    
                  </div>
                </div>

                  




                  
                  
                
                {/* Save & Clear buttons only in edit mode */}
                {!readOnlyMode && (
                  <div className="p-4 border-t bg-card">
                    <div className="flex flex-row items-center justify-between w-full gap-2">
                      <Button
                        onClick={handleSaveDashboard}
                        variant="default"
                        className="flex items-center gap-2"
                        disabled={!Object.values(quadrants).some(Boolean)}
                      >
                        <Save className="h-5 w-5" />
                        <span>Save</span>
                      </Button>

                      
                      <Button
                        onClick={() => {
                          setQuadrants({ topLeft: null, topRight: null, bottom: null });
                          setDashboardSectionTitle("Untitled Dashboard");
                          setTopLeftTitle("Sample Title");
                          setTopRightTitle("Sample Title");
                          setBottomTitle("Sample Title");
                          // Remove dashboardId from URL and set to new mode
                          router.replace('/?edit=true');
                        }}
                        variant="ghost"
                        className="flex items-center gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Clear</span>
                      </Button>

                      
                    </div>
                  </div>
                )}


                
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
          State={{
            quadrants,
            visualizations: allVisualizations.filter((v) =>
              Object.values(quadrants).includes(v.id)
            ),
          }}
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 pointer-events-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    )}
      

      
    </DndProvider>
  )
}
