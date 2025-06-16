
'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { BarGraph } from '@/components/bar-graph'
import { TableView } from '@/components/table-view'
import { DropZone } from '@/components/drop-zone'
import { HistoryPanel } from '@/components/history-panel'
import { QueryPanel } from '@/components/query-panel'
import { ShareLinkDialog } from '@/components/share-link-dialog'
import { ChevronLeft, ChevronRight, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PieGraph } from '@/components/pie-chart'


export default function () {
  const [allVisualizations, setAllVisualizations] = useState([])
  const [quadrants, setQuadrants] = useState({
    topLeft: null,
    topRight: null,
    bottom: null,
  })





  
  
  function handleSaveDashboard() {
    const usedVizIds = Object.values(quadrants).filter(Boolean);
    // Structure-only (legacy, minimal fields)
    const saveReadyVisualizations = allVisualizations
      .filter(viz => usedVizIds.includes(viz.id))
      .map(({ id, type, title, columns, color, sql }) => ({
        id,
        type,
        title,
        columns,
        color,
        sql,
      }));
  
    // Full visualizations including output data
    const saveReadySVisualizations = allVisualizations
      .filter(viz => usedVizIds.includes(viz.id));
  
    const payload = {
      title: dashboardSectionTitle,
      quadrants,
      visualizations: saveReadyVisualizations,
      s_visualizations: saveReadySVisualizations, // <-- include output data!
    };
  
    // POST to your API
    fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(res => {
      if (res.ok) {
        alert('Dashboard saved!');
      } else {
        res.json().then(err => {
          alert('Error saving dashboard: ' + (err.error || res.statusText));
        });
      }
    }).catch(err => {
      alert('Error saving dashboard: ' + err.message);
    });
  }




  
  const searchParams = useSearchParams() 
  const dashboardId = searchParams.get('d')
  const readOnlyMode = !!dashboardId
  
    
  const [collapsedPanels, setCollapsedPanels] = useState({
    left: false,
    middle: false,
    right: false,
  })

  const [panelWidths, setPanelWidths] = useState({
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
  const [componentKey, setComponentKey] = useState(Date.now())
  const [shareDialogOpen, setShareDialogOpen] = useState(false)

  const [dashboardSectionTitle, setDashboardSectionTitle] = useState("Sample Title")
  const [dropZoneTitles, setDropZoneTitles] = useState({
    topLeft: "Sample Title",
    topRight: "Sample Title",
    bottom: "Sample Title",
  })





  
  
  useEffect(() => {
    console.log("🏁 Dashboard loader useEffect running!", { readOnlyMode, dashboardId });
    const loadDashboard = async () => {
      if (!readOnlyMode || !dashboardId) return;
  
      setIsGlobalLoading(true);
  
      try {
        const res = await fetch(`/api/dashboard?id=${dashboardId}`);
        const data = await res.json();
  
        const { title, quadrants, visualizations, s_visualizations } = data;
        setDashboardSectionTitle(title);
  
        // DEBUG: Are we loading from cache?
        if (Array.isArray(s_visualizations) && s_visualizations.length > 0) {
          console.log("✅ Loading dashboard from CACHE (s_visualizations)!");
          setAllVisualizations(s_visualizations);
  
          // (quadrant mapping code...)
          const quadrantMap = {};
          for (const quadrant in quadrants) {
            const match = s_visualizations.find(
              v =>
                (quadrants[quadrant] && v.originalId && v.originalId === quadrants[quadrant]) ||
                (quadrants[quadrant] && v.sql && v.sql === (visualizations?.find(old => old.id === quadrants[quadrant])?.sql))
            ) || s_visualizations[0];
            quadrantMap[quadrant] = match ? match.id : null;
          }
          setQuadrants(quadrantMap);
  
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
  
        if (!visualizations || visualizations.length === 0) {
          setIsGlobalLoading(false);
        }
  
        for (const viz of visualizations || []) {
          const fetchAndAddViz = async () => {
            try {
              const resultRes = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sql: viz.sql }),
              });
  
              const result = await resultRes.json();
              if (!resultRes.ok) throw new Error(result.error || 'Query failed');
  
              const chartData =
                viz.type === 'chart' || viz.type === 'pie'
                  ? result.rows.map(row => ({
                      name: row[result.columns[0]?.key] || 'Unknown',
                      value: Number(row[result.columns[1]?.key]) || 0,
                    }))
                  : result.rows;
  
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
  
              for (const quadrant in quadrants) {
                if (quadrants[quadrant] === viz.id) {
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
    if (readOnlyMode) {
      const leftWidth = collapsedPanels.left ? '0%' : '20%'
      const rightWidth = collapsedPanels.left ? '100%' : '80%'
  
      setPanelWidths({
        left: leftWidth,
        middle: '0%',
        right: rightWidth,
      })
      return
    }
  
    // Regular logic in edit mode
    const collapsedWidth = '40px'
    const fullWidth = 100
  
    const newPanelWidths = {
      left: collapsedPanels.left ? collapsedWidth : '20%',
      middle: collapsedPanels.middle ? collapsedWidth : '',
      right: collapsedPanels.right ? collapsedWidth : '',
    }
  
    const fixedLeftPercent = collapsedPanels.left ? 3 : 20
    const collapsedCount = ['middle', 'right'].filter((p) => collapsedPanels[p]).length
    const collapsedTotal = collapsedCount * 3
    const availableWidth = fullWidth - fixedLeftPercent - collapsedTotal
  
    const proportions = { middle: 40, right: 40 }
    const visible = ['middle', 'right'].filter((p) => !collapsedPanels[p])
    const totalVisible = visible.reduce((sum, p) => sum + proportions[p], 0)
  
    visible.forEach((panel) => {
      newPanelWidths[panel] = `${(proportions[panel] / totalVisible) * availableWidth}%`
    })
  
    setPanelWidths(newPanelWidths)
  }, [collapsedPanels, readOnlyMode])
  
  







  
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
        body: JSON.stringify({ sql: data.sql }),
      })

      const result = await resultRes.json()
      if (!resultRes.ok) throw new Error(result.error || 'Query execution error')

      setQueryResults(result.rows || [])
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
        data: result.rows || [],   // <<< ADD THIS
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
        body: JSON.stringify({ sql }),
      })
  
      const result = await resultRes.json()
      if (!resultRes.ok) throw new Error(result.error || 'Query execution error')
  
      setQueryResults(result.rows || [])
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
  

  
  const handleDrop = (quadrantId, item) => {
    const itemId = item.id
    const itemExists = allVisualizations.some((v) => v.id === itemId)
  
    if (!itemExists) {
      setAllVisualizations((prev) => [...prev, item])
    }
  
    // Reset and assign to prevent rendering conflicts
    setQuadrants((prev) => ({
      ...prev,
      [quadrantId]: null, // reset first
    }))
  
    setTimeout(() => {
      setQuadrants((prev) => ({
        ...prev,
        [quadrantId]: itemId,
      }))
    }, 0) // delay for React state reflow
  }


  
  const handleSelectDashboard = async (dashboard: { id: number; title: string }) => {
    setIsGlobalLoading(true);
    try {
      const res = await fetch(`/api/dashboard?id=${dashboard.id}`);
      if (!res.ok) throw new Error("Failed to load dashboard");
      const data = await res.json();
  
      const { title, quadrants, visualizations } = data;
      setDashboardSectionTitle(title || "Untitled Dashboard");
  
      // Clear previous state
      setAllVisualizations([]);
      setQuadrants({
        topLeft: null,
        topRight: null,
        bottom: null,
      });
  
      // Load each visualization
      const newVisualizations: any[] = [];
      const quadrantMapping: any = {};
  
      for (const viz of visualizations) {
        try {
          const resultRes = await fetch('/api/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sql: viz.sql }),
          });
          const result = await resultRes.json();
          if (!resultRes.ok) throw new Error(result.error || 'Query failed');

          
          const chartData =
            viz.type === 'chart' || viz.type === 'pie'
              ? result.rows.map(row => ({
                  name: row[result.columns[0]?.key] || 'Unknown',
                  value: Number(row[result.columns[1]?.key]) || 0,
                }))
              : result.rows;
          
          const newViz = {
            id: `viz-${Date.now()}-${Math.random()}`,
            type: viz.type,
            title: viz.title || 'Query Result',
            data: chartData, // <-- THIS LINE RESTORED
            columns: result.columns || [],
            color: viz.color || 'hsl(var(--chart-4))',
            originalId: viz.id,
            sql: viz.sql,
          };
          
  
          newVisualizations.push(newViz);
  
          for (const quadrant in quadrants) {
            if (quadrants[quadrant] === viz.id) {
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

  

  

  const getVisualizationById = (id) => allVisualizations.find((v) => v.id === id)



  const renderDroppedViz = (vizId) => {
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
      <ChevronRight className="h-4 w-4 mb-1" />
      <span className="text-xs">{label}</span>
    </button>
  )


  // if (isGlobalLoading) {
  //   return (
  //     <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80">
  //       <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
  //     </div>
  //   )
  // }
  

  
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex flex-col h-screen">
        <h1 className="text-2xl font-bold text-center py-4"> </h1>

        <div className="flex flex-1 overflow-hidden gap-2 px-2 pb-2">
          {/* Left Panel */}
          <div style={{ width: panelWidths.left }} className="relative transition-all duration-500 ease-in-out">
            {collapsedPanels.left ? (
              renderCollapsedPanel('left', 'Saved')
            ) : (
              <>
                <HistoryPanel
                  readOnlyMode={readOnlyMode}   
                  onSelectQuery={async (q) => {
                    setIsLoading(true)
                    
                    setSqlQuery(q.sql_text)
                    
                    const mode = q.output_mode === 2
                      ? 'chart'
                      : q.output_mode === 3
                      ? 'pie'
                      : 'table'
                    
                    try {
                      const resultRes = await fetch('/api/query', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sql: q.sql_text }),
                      })
                    
                      const result = await resultRes.json()
                      if (!resultRes.ok) throw new Error(result.error || 'Query execution error')
                    
                      setOutputMode(mode)
                      setQueryResults(result.rows || [])
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
                        sql: q.sql_text, // <-- Always include SQL
                      }
                    
                      setAllVisualizations((prev) => [...prev, newViz])

                      // console.log("📦 Full query object received from HistoryPanel:", q)  
                      // console.log("🔍 query_text received from HistoryPanel:", q.query_text)
                      
                      setQuestion(q.query_text)

                      // console.log("📦 Full query object:", q);
                      // console.log("🔍 query_text being passed to setQuestion:", q.query_text);
                      // setQuestion(q.query_text);
                      // setTimeout(() => {
                      //   console.log("✅ question state after setting:", q.query_text);
                      // }, 50);                      

                      
                    } catch (err: any) {
                      console.error(err)
                      setError(err.message || 'Unknown error')
                    } finally {                      
                      setIsLoading(false)
                    }

                  }}
                  onSelectDashboard={handleSelectDashboard}
                />


{/*                 <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => togglePanel('left')}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button> */}
              </>
            )}
          </div>




          
          {/* Middle Panel - hidden in read-only mode */}
          {!readOnlyMode && (
            <div style={{ width: panelWidths.middle }} className="relative transition-all duration-500 ease-in-out">
              {collapsedPanels.middle ? (
                renderCollapsedPanel('middle', 'Query')
              ) : (
                <>
                  <QueryPanel
                    question={question}
                    setQuestion={setQuestion}
                    outputMode={outputMode}
                    setOutputMode={setOutputMode}
                    isLoading={isLoading}
                    setIsLoading={setIsLoading}
                    sqlQuery={sqlQuery}
                    setSqlQuery={setSqlQuery}
                    queryResults={queryResults}
                    setQueryResults={setQueryResults}
                    columns={columns}
                    setColumns={setColumns}
                    error={error}
                    setError={setError}
                    setKey={setComponentKey}
                    key={componentKey}
                    onSubmit={handleQuerySubmit}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => togglePanel('middle')}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                </>
              )}
            </div>
          )}




          
          {/* Right Panel */}
          <div style={{ width: panelWidths.right }} className="relative flex flex-col transition-all duration-500 ease-in-out">
            {collapsedPanels.right ? (
              renderCollapsedPanel('right', 'Dashboard')
            ) : (
              <>
                <div className="flex-1 bg-card rounded-lg p-4 border border-border overflow-auto">
                  <input
                    type="text"
                    value={dashboardSectionTitle}
                    onChange={(e) => setDashboardSectionTitle(e.target.value)}
                    className="text-lg font-semibold mt-1 mb-4 bg-transparent outline-none w-full text-center"
                  />
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {['topLeft', 'topRight'].map((pos) => (
                      <div key={pos} className="flex flex-col">
                        <input
                          type="text"
                          value={dropZoneTitles[pos]}
                          onChange={(e) => setDropZoneTitles(prev => ({ ...prev, [pos]: e.target.value }))}
                          className="text-sm font-medium text-center mt-2 mb-2 bg-transparent outline-none w-full"
                        />
                        <DropZone
                          id={pos}
                          onDrop={(item) => handleDrop(pos, item)}
                          onRemove={() => setQuadrants((prev) => ({ ...prev, [pos]: null }))}
                        >
                          {quadrants[pos] ? renderDroppedViz(quadrants[pos]) : (
                            <div className="h-36 flex items-center justify-center text-muted-foreground">
                              Drop here
                            </div>
                          )}
                        </DropZone>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col mt-4">
                    <input
                      type="text"
                      value={dropZoneTitles.bottom}
                      onChange={(e) => setDropZoneTitles(prev => ({ ...prev, bottom: e.target.value }))}
                      className="text-sm font-medium text-center mb-1 bg-transparent outline-none w-full"
                    />
                    <DropZone
                      id="bottom"
                      onDrop={(item) => handleDrop('bottom', item)}
                      onRemove={() => setQuadrants((prev) => ({ ...prev, bottom: null }))}
                    >
                      {quadrants.bottom ? renderDroppedViz(quadrants.bottom) : (
                        <div className="h-44 flex items-center justify-center text-muted-foreground">
                          Drop here
                        </div>
                      )}
                    </DropZone>

                    
                    {/** Diagnostics for all quadrants */}
                    <div className="mt-4 bg-muted p-2 rounded text-xs border">
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
                    </div> 



                    
                  </div>
                </div>
                {/* Save button only in edit mode */}
                {!readOnlyMode && (
                  <div className="p-4 border-t bg-card">
                    <Button
                      onClick={handleSaveDashboard}
                      variant="default"
                      className="flex items-center gap-2 w-full justify-center"
                    >
                      <Save className="h-5 w-5" />
                      <span>Save dashboard</span>
                    </Button>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => togglePanel('right')}
                >
                  <ChevronLeft className="h-5 w-5" />
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
