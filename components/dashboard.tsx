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

  // --- Drop Zone Titles: make persistent
  const [dropZoneTitles, setDropZoneTitles] = useState({
    topLeft: "Sample Title",
    topRight: "Sample Title",
    bottom: "Sample Title",
  })

  // --- Dashboard title
  const [dashboardSectionTitle, setDashboardSectionTitle] = useState("Sample Title")

  // ... (other state variables unchanged) ...

  // --- Save Dashboard (now includes dropZoneTitles & persists custom viz titles)
  function handleSaveDashboard() {
    const usedVizIds = Object.values(quadrants).filter(Boolean);

    // For each quadrant, update the viz title to match dropZoneTitles
    const saveReadyVisualizations = allVisualizations
      .filter(viz => usedVizIds.includes(viz.id))
      .map(viz => {
        // Find which quadrant this viz is currently in, if any
        const quadrant = Object.entries(quadrants).find(([key, value]) => value === viz.id)?.[0];
        // Use the drop zone title if available, else fall back to the viz's own title
        const title = quadrant ? dropZoneTitles[quadrant] : viz.title;
        return {
          ...viz,
          title,
        };
      });

    // Same for s_visualizations
    const saveReadySVisualizations = allVisualizations
      .filter(viz => usedVizIds.includes(viz.id))
      .map(viz => {
        const quadrant = Object.entries(quadrants).find(([key, value]) => value === viz.id)?.[0];
        const title = quadrant ? dropZoneTitles[quadrant] : viz.title;
        return {
          ...viz,
          title,
        };
      });

    const payload = {
      title: dashboardSectionTitle,
      quadrants,
      visualizations: saveReadyVisualizations,
      s_visualizations: saveReadySVisualizations,
      dropZoneTitles, // <-- NEW: persist custom section titles!
    };

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

  // --- Loader: load dropZoneTitles if present
  const searchParams = useSearchParams()
  const dashboardId = searchParams.get('d')
  const readOnlyMode = !!dashboardId

  useEffect(() => {
    const loadDashboard = async () => {
      if (!readOnlyMode || !dashboardId) return;

      setIsGlobalLoading(true);

      try {
        const res = await fetch(`/api/dashboard?id=${dashboardId}`);
        const data = await res.json();

        const { title, quadrants, visualizations, s_visualizations, dropZoneTitles: loadedDropZoneTitles } = data;
        setDashboardSectionTitle(title);

        // --- LOAD dropZoneTitles if present; else fallback to loaded viz titles, else default
        if (loadedDropZoneTitles) {
          setDropZoneTitles(loadedDropZoneTitles);
        } else {
          // fallback: use viz titles if available
          setDropZoneTitles({
            topLeft: (s_visualizations?.find(v => v.id === quadrants?.topLeft)?.title) || "Sample Title",
            topRight: (s_visualizations?.find(v => v.id === quadrants?.topRight)?.title) || "Sample Title",
            bottom: (s_visualizations?.find(v => v.id === quadrants?.bottom)?.title) || "Sample Title",
          });
        }

        // --- (existing cache loader logic, with improved quadrant mapping)
        if (Array.isArray(s_visualizations) && s_visualizations.length > 0) {
          setAllVisualizations(s_visualizations);

          const quadrantMap: any = {};
          for (const quadrant in quadrants) {
            const expectedOriginalId = quadrants[quadrant];
            const expectedViz = visualizations?.find(v => v.id === expectedOriginalId);
            const expectedType = expectedViz?.type;

            const match = s_visualizations.find(
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

        // ... (fallback to SQL rerun logic unchanged) ...
      } catch (err) {
        console.error('Failed to load read-only dashboard:', err);
        setIsGlobalLoading(false);
      }
    };

    loadDashboard();
  }, [readOnlyMode, dashboardId]);

  // --- Also update handleSelectDashboard similarly for edit mode
  const handleSelectDashboard = async (dashboard: { id: number; title: string }) => {
    setIsGlobalLoading(true);
    try {
      const res = await fetch(`/api/dashboard?id=${dashboard.id}`);
      if (!res.ok) throw new Error("Failed to load dashboard");
      const data = await res.json();

      const { title, quadrants, visualizations, s_visualizations, dropZoneTitles: loadedDropZoneTitles } = data;
      setDashboardSectionTitle(title || "Untitled Dashboard");

      if (loadedDropZoneTitles) {
        setDropZoneTitles(loadedDropZoneTitles);
      } else {
        setDropZoneTitles({
          topLeft: (s_visualizations?.find(v => v.id === quadrants?.topLeft)?.title) || "Sample Title",
          topRight: (s_visualizations?.find(v => v.id === quadrants?.topRight)?.title) || "Sample Title",
          bottom: (s_visualizations?.find(v => v.id === quadrants?.bottom)?.title) || "Sample Title",
        });
      }

      if (Array.isArray(s_visualizations) && s_visualizations.length > 0) {
        setAllVisualizations(s_visualizations);

        const quadrantMap: any = {};
        for (const quadrant in quadrants) {
          const expectedOriginalId = quadrants[quadrant];
          const expectedViz = visualizations?.find(v => v.id === expectedOriginalId);
          const expectedType = expectedViz?.type;

          const match = s_visualizations.find(
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

      // ... (fallback to SQL rerun logic unchanged) ...
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  // --- The rest of your component (rendering, handlers, etc.) remains unchanged ---
  // Just be sure that <input value={dropZoneTitles[pos]} ... /> is used for each drop zone,
  // and that setDropZoneTitles is used in their onChange handlers (which your code already does).

  // ... rest of component ...
}
