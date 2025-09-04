"use client"

import { useState, useCallback, useRef, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

import { Loader2, Save, Trash2, LayoutList, BarChart2, PieChart, X, AlertTriangle, AlertCircle, XCircle, Download, Settings, ChevronDown, ChevronRight, Info, Sparkles } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { TableView } from "@/components/table-view"
import { DraggableChart } from './draggable-chart'
import { DraggablePieChart } from './draggable-pie'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TooltipProvider } from '@/components/ui/tooltip'
import { GhostIndicator } from '@/components/ui/ghost-indicator'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

// Database schema columns - all available columns from the database
const DATABASE_COLUMNS = [
  // Gifts table columns
  { key: 'g.ACCOUNTID', name: 'Account ID', table: 'gifts' },
  { key: 'g.GIFTID', name: 'Gift ID', table: 'gifts' },
  { key: 'g.GIFTDATE', name: 'Gift Date', table: 'gifts' },
  { key: 'g.GIFTAMOUNT', name: 'Gift Amount', table: 'gifts' },
  { key: 'g.TRANSACTIONTYPE', name: 'Transaction Type', table: 'gifts' },
  { key: 'g.GIFTTYPE', name: 'Gift Type', table: 'gifts' },
  { key: 'g.PAYMENTMETHOD', name: 'Payment Method', table: 'gifts' },
  { key: 'g.PLEDGEID', name: 'Pledge ID', table: 'gifts' },
  { key: 'g.SOFTCREDITINDICATOR', name: 'Soft Credit Indicator', table: 'gifts' },
  { key: 'g.SOFTCREDITAMOUNT', name: 'Soft Credit Amount', table: 'gifts' },
  { key: 'g.SOFTCREDITID', name: 'Soft Credit ID', table: 'gifts' },
  { key: 'g.SOURCECODE', name: 'Source Code', table: 'gifts' },
  { key: 'g.DESIGNATION', name: 'Designation', table: 'gifts' },
  { key: 'g.UNIT', name: 'Unit', table: 'gifts' },
  { key: 'g.PURPOSECATEGORY', name: 'Purpose Category', table: 'gifts' },
  { key: 'g.APPEAL', name: 'Appeal', table: 'gifts' },
  { key: 'g.GIVINGLEVEL', name: 'Giving Level', table: 'gifts' },
  { key: 'g.UUID', name: 'UUID', table: 'gifts' },
  
  // Constituents table columns
  { key: 'c.LOOKUPID', name: 'Lookup ID', table: 'constituents' },
  { key: 'c.TYPE', name: 'Type', table: 'constituents' },
  { key: 'c.DONORTYPE1', name: 'Donor Type', table: 'constituents' },
  { key: 'c.PERSONORGANIZATIONINDICATOR', name: 'Person/Organization', table: 'constituents' },
  { key: 'c.ALUMNITYPE', name: 'Alumni Type', table: 'constituents' },
  { key: 'c.UNDERGRADUATEDEGREE1', name: 'Undergraduate Degree', table: 'constituents' },
  { key: 'c.UNDERGRADUATIONYEAR1', name: 'Undergraduate Year', table: 'constituents' },
  { key: 'c.UNDERGRADUATEPREFERREDCLASSYEAR1', name: 'Preferred Class Year', table: 'constituents' },
  { key: 'c.UNDERGRADUATESCHOOL1', name: 'Undergraduate School', table: 'constituents' },
  { key: 'c.GRADUATEDEGREE1', name: 'Graduate Degree', table: 'constituents' },
  { key: 'c.GRADUATEGRADUATIONYEAR1', name: 'Graduate Year', table: 'constituents' },
  { key: 'c.GRADUATEPREFERREDCLASSYEAR1', name: 'Graduate Preferred Class Year', table: 'constituents' },
  { key: 'c.GRADUATESCHOOL1', name: 'Graduate School', table: 'constituents' },
  { key: 'c.GENDER', name: 'Gender', table: 'constituents' },
  { key: 'c.DECEASED', name: 'Deceased', table: 'constituents' },
  { key: 'c.SOLICITATIONRESTRICTIONS', name: 'Solicitation Restrictions', table: 'constituents' },
  { key: 'c.DONOTMAIL', name: 'Do Not Mail', table: 'constituents' },
  { key: 'c.DONOTPHONE', name: 'Do Not Phone', table: 'constituents' },
  { key: 'c.DONOTEMAIL', name: 'Do Not Email', table: 'constituents' },
  { key: 'c.MARRIEDTOALUM', name: 'Married To Alum', table: 'constituents' },
  { key: 'c.SPOUSELOOKUPID', name: 'Spouse Lookup ID', table: 'constituents' },
  { key: 'c.SPOUSEID', name: 'Spouse ID', table: 'constituents' },
  { key: 'c.ASSIGNEDACCOUNT', name: 'Assigned Account', table: 'constituents' },
  { key: 'c.VOLUNTEER', name: 'Volunteer', table: 'constituents' },
  { key: 'c.WEALTHSCORE', name: 'Wealth Score', table: 'constituents' },
  { key: 'c.GEPSTATUS', name: 'GEP Status', table: 'constituents' },
  { key: 'c.EVENTSATTENDED', name: 'Events Attended', table: 'constituents' },
  { key: 'c.EVENTS', name: 'Events', table: 'constituents' },
  { key: 'c.AGE', name: 'Age', table: 'constituents' },
  { key: 'c.FULLNAME', name: 'Full Name', table: 'constituents' },
  { key: 'c.PMFULLNAME', name: 'PM Full Name', table: 'constituents' },
  { key: 'c.FULLADDRESS', name: 'Full Address', table: 'constituents' },
  { key: 'c.HOMETELEPHONE', name: 'Home Telephone', table: 'constituents' },
  { key: 'c.EMAIL', name: 'Email', table: 'constituents' },
  
  // Common calculated/aggregated columns
  { key: 'YEAR(g.GIFTDATE)', name: 'Year', table: 'calculated' },
  { key: 'SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2)))', name: 'Total Amount', table: 'calculated' },
  { key: 'COUNT(*)', name: 'Count', table: 'calculated' },
  { key: 'AVG(CAST(g.GIFTAMOUNT AS DECIMAL(15,2)))', name: 'Average Amount', table: 'calculated' }
]



interface QueryPanelProps {
  question: string
  setQuestion: (value: string) => void
  outputMode: string
  setOutputMode: (value: string) => void
  isLoading: boolean
  sqlQuery: string | null
  setSqlQuery: (value: string | null) => void
  queryResults: any[] | null
  setQueryResults: (value: any[] | null) => void
  columns: { key: string; name: string }[]
  setColumns: (value: { key: string; name: string }[]) => void
  error: string | null
  setError: (value: string | null) => void
  onSubmit: () => void
  readOnlyMode?: boolean // Add this prop
  isEditingSavedQuery?: boolean
  handleUpdateSavedQuery?: () => Promise<void>
  handleCancelEdit?: () => void
  hasChanges?: () => boolean
  selectedSavedQueryId?: number | null
  handleDeleteSavedQuery?: () => Promise<void>
  onClearQuery?: () => void
  selectedXColumn?: string
  setSelectedXColumn?: (value: string) => void
  selectedYColumn?: string
  setSelectedYColumn?: (value: string) => void
  currentUser?: any // Add currentUser prop
  setOriginalQueryData?: (data: any) => void // Add setOriginalQueryData prop
}

export function QueryPanel({
  question,
  setQuestion,
  outputMode,
  setOutputMode,
  isLoading,
  sqlQuery,
  setSqlQuery,
  error,
  setError,
  queryResults,
  setQueryResults,
  columns,
  setColumns,
  onSubmit,
  readOnlyMode,
  isEditingSavedQuery = false,
  handleUpdateSavedQuery,
  handleCancelEdit,
  hasChanges,
  selectedSavedQueryId,
  handleDeleteSavedQuery,
  onClearQuery,
  selectedXColumn: propSelectedXColumn,
  setSelectedXColumn: propSetSelectedXColumn,
  selectedYColumn: propSelectedYColumn,
  setSelectedYColumn: propSetSelectedYColumn,
  currentUser,
  setOriginalQueryData,
}: QueryPanelProps) {
  const [showSql, setShowSql] = useState(false)
  const [saveStatus, setSaveStatus] = useState<null | "success" | "error" | "saving">(null);
  const [isChartConfigModalOpen, setIsChartConfigModalOpen] = useState(false)
  const [showChartGhostText, setShowChartGhostText] = useState(false)
  const [showGhostIndicator, setShowGhostIndicator] = useState(false)
  const [ghostMessage, setGhostMessage] = useState("")
  // External sorting state
  const [externalSortColumn, setExternalSortColumn] = useState<string | null>(null)
  const [externalSortDirection, setExternalSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [isColumnSelectorExpanded, setIsColumnSelectorExpanded] = useState(true)
  
  // Memoized callback for column order changes to prevent infinite loops
  const handleColumnOrderChange = useCallback((reorderedColumns: { key: string; name: string }[]) => {
    setColumns(reorderedColumns)
  }, [setColumns])

  // Function to handle programmatic sorting
  const handleSortChange = useCallback((column: string | null, direction: 'asc' | 'desc' | null) => {
    console.log('🔄 Query panel sort change:', { column, direction })
    setExternalSortColumn(column)
    setExternalSortDirection(direction)
  }, [])

  // Function to programmatically sort by column
  const sortByColumn = useCallback((columnName: string, direction: 'asc' | 'desc') => {
    console.log('🔄 Programmatic sort request:', { columnName, direction })
    setExternalSortColumn(columnName)
    setExternalSortDirection(direction)
  }, [])

  // Example: How to use programmatic sorting
  // This could be triggered by user prompts, commands, or other UI elements
  // Example usage:
  // - sortByColumn('Total Amount', 'desc') // Sort by Total Amount in descending order
  // - sortByColumn('Full Name', 'asc')     // Sort by Full Name in ascending order
  // - sortByColumn('Year', 'desc')         // Sort by Year in descending order

  // Function to parse sorting requests from user prompts
  const parseSortRequest = useCallback((prompt: string) => {
    const promptLower = prompt.toLowerCase()
    
    // Look for sorting keywords
    const sortKeywords = {
      'ascending': 'asc',
      'asc': 'asc',
      'ascend': 'asc',
      'low to high': 'asc',
      'smallest to largest': 'asc',
      'a to z': 'asc',
      'descending': 'desc',
      'desc': 'desc',
      'descend': 'desc',
      'high to low': 'desc',
      'largest to smallest': 'desc',
      'z to a': 'desc'
    }
    
    // Find sort direction
    let direction: 'asc' | 'desc' | null = null
    for (const [keyword, dir] of Object.entries(sortKeywords)) {
      if (promptLower.includes(keyword)) {
        direction = dir as 'asc' | 'desc'
        break
      }
    }
    
    // If no direction specified, default to ascending
    if (!direction) {
      direction = 'asc'
    }
    
    // Look for column names in the prompt
    const availableColumns = columns.map(col => col.name.toLowerCase())
    let targetColumn: string | null = null
    
    for (const columnName of availableColumns) {
      if (promptLower.includes(columnName.toLowerCase())) {
        targetColumn = columnName
        break
      }
    }
    
    // If no specific column mentioned, try common patterns
    if (!targetColumn) {
      if (promptLower.includes('amount') || promptLower.includes('total')) {
        targetColumn = columns.find(col => 
          col.name.toLowerCase().includes('amount') || 
          col.name.toLowerCase().includes('total')
        )?.name || null
      } else if (promptLower.includes('name') || promptLower.includes('donor')) {
        targetColumn = columns.find(col => 
          col.name.toLowerCase().includes('name') || 
          col.name.toLowerCase().includes('donor')
        )?.name || null
      } else if (promptLower.includes('date') || promptLower.includes('year')) {
        targetColumn = columns.find(col => 
          col.name.toLowerCase().includes('date') || 
          col.name.toLowerCase().includes('year')
        )?.name || null
      }
    }
    
    return { targetColumn, direction }
  }, [columns])

  // Function to apply sorting based on user prompt
  const applySortFromPrompt = useCallback((prompt: string) => {
    const { targetColumn, direction } = parseSortRequest(prompt)
    
    if (targetColumn) {
      console.log('🔄 Applying sort from prompt:', { prompt, targetColumn, direction })
      sortByColumn(targetColumn, direction)
      return true
    }
    
    console.log('🔄 No valid sort request found in prompt:', prompt)
    return false
  }, [parseSortRequest, sortByColumn])

  // Example integration: This could be called from a command system or AI assistant
  // Example usage:
  // - applySortFromPrompt("sort by Total Amount in descending order")
  // - applySortFromPrompt("show results in ascending order by Full Name")
  // - applySortFromPrompt("order by Year descending")
  // - applySortFromPrompt("sort high to low by amount")
  
  // Chart column selection state - use props if provided, otherwise use local state
  const [localSelectedXColumn, setLocalSelectedXColumn] = useState<string>('')
  const [localSelectedYColumn, setLocalSelectedYColumn] = useState<string>('')
  
  const selectedXColumn = propSelectedXColumn !== undefined ? propSelectedXColumn : localSelectedXColumn;
  const setSelectedXColumn = propSetSelectedXColumn || setLocalSelectedXColumn;
  const selectedYColumn = propSelectedYColumn !== undefined ? propSelectedYColumn : localSelectedYColumn;
  const setSelectedYColumn = propSetSelectedYColumn || setLocalSelectedYColumn;
  
  // Smart column selection function
  const getSmartColumnSelection = (columns: any[], question: string, results: any[]) => {
    const questionLower = question.toLowerCase();
    
    // Define patterns for different query types
    const patterns = {
      // Donor queries
      donor: {
        keywords: ['donor', 'donors', 'contributor', 'contributors', 'giver', 'givers'],
        xPriority: ['donor', 'name', 'donor_name', 'contributor', 'giver'],
        yPriority: ['amount', 'total', 'sum', 'total_amount', 'donation_amount', 'contribution_amount']
      },
      // Date/time queries
      date: {
        keywords: ['date', 'time', 'year', 'month', 'day', 'period', 'quarter'],
        xPriority: ['date', 'year', 'month', 'day', 'period', 'quarter', 'time'],
        yPriority: ['amount', 'total', 'sum', 'count', 'total_amount', 'donation_amount']
      },
      // Category queries
      category: {
        keywords: ['category', 'type', 'group', 'classification', 'segment'],
        xPriority: ['category', 'type', 'group', 'classification', 'segment', 'name'],
        yPriority: ['amount', 'total', 'sum', 'count', 'total_amount']
      },
      // Location queries
      location: {
        keywords: ['location', 'city', 'state', 'country', 'region', 'area'],
        xPriority: ['location', 'city', 'state', 'country', 'region', 'area', 'name'],
        yPriority: ['amount', 'total', 'sum', 'count', 'total_amount']
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
    
    // Get column names in lowercase for matching
    const columnNames = columns.map(col => col.key.toLowerCase());
    const columnDisplayNames = columns.map(col => col.name.toLowerCase());
    
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
    
    // Find best Y column
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
    
    // Fallback: if we couldn't find good matches, use first two columns
    if (!xColumn || !yColumn) {
      xColumn = columns[0]?.key || '';
      yColumn = columns[1]?.key || '';
    }
    
    // Ensure X and Y are different
    if (xColumn === yColumn && columns.length > 1) {
      yColumn = columns[1]?.key || '';
    }
    
    return { xColumn, yColumn };
  };
  

  

  
  // Smart auto-select chart columns when switching to chart/pie mode for new queries
  useEffect(() => {
    // Auto-select when switching to chart/pie mode and we have columns
    // AND we're not editing a saved query
    if ((outputMode === 'chart' || outputMode === 'pie') && 
        columns.length >= 2 && 
        !selectedSavedQueryId) {
      
      const { xColumn, yColumn } = getSmartColumnSelection(columns, question, queryResults || []);
      setSelectedXColumn(xColumn)
      setSelectedYColumn(yColumn)
    }
  }, [outputMode, columns, question, queryResults, setSelectedXColumn, setSelectedYColumn, selectedSavedQueryId])
  
  // Chart configuration panel collapse state


  // Ref for textarea focus
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-select default columns when results change, but only if no chart config exists
  useEffect(() => {
    // Only auto-select if we have columns and no chart configuration is set
    // AND we're not in editing mode for a saved query (which should preserve its config)
    if (columns.length >= 2 && (!selectedXColumn || !selectedYColumn)) {
      // Check if we're editing a saved query - if so, don't auto-select
      const isEditingSavedQuery = selectedSavedQueryId !== null;
      
      if (!isEditingSavedQuery) {
        setSelectedXColumn(columns[0]?.key || '')
        setSelectedYColumn(columns[1]?.key || '')
      }
    }
  }, [columns, selectedXColumn, selectedYColumn, setSelectedXColumn, setSelectedYColumn, selectedSavedQueryId])
  
  // Auto-select chart columns when new query results come in for chart/pie mode
  useEffect(() => {
    // If we're in chart/pie mode and get new results, auto-select appropriate columns
    // Only for new queries (not saved queries being edited)
    if ((outputMode === 'chart' || outputMode === 'pie') && 
        columns.length >= 2 && 
        !selectedSavedQueryId) {
      const { xColumn, yColumn } = getSmartColumnSelection(columns, question, queryResults || []);
      setSelectedXColumn(xColumn)
      setSelectedYColumn(yColumn)
    }
  }, [queryResults, outputMode, columns, question, setSelectedXColumn, setSelectedYColumn, selectedSavedQueryId])

  // Show ghost text when charts load
  useEffect(() => {
    if ((outputMode === 'chart' || outputMode === 'pie') && queryResults && queryResults.length > 0) {
      setShowChartGhostText(true)
    } else {
      setShowChartGhostText(false)
    }
  }, [queryResults, outputMode])

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

  // Excel export function
  const handleExportToExcel = useCallback(() => {
    if (!queryResults || !columns.length) return;

    try {
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // Convert query results to worksheet format with proper date handling
      const worksheetData = queryResults.map(row => {
        const newRow: any = {};
        columns.forEach(col => {
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
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `query_results_${timestamp}.xlsx`;
      
      // Write file and trigger download
      XLSX.writeFile(workbook, filename);
      
      // Show success notification
      toast.success('Excel file exported successfully!', {
        description: `File saved as: ${filename}`
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setError('Failed to export to Excel');
      toast.error('Failed to export to Excel', {
        description: 'Please try again'
      });
    }
  }, [queryResults, columns, setError]);

  // Clear query function
  const handleClearQuery = useCallback(() => {
    setQuestion('')
    setSqlQuery(null)
    setQueryResults(null)
    setColumns([])
    setError(null)
    setShowSql(false)
    
    // If we have an onClearQuery prop (from dashboard), call it to clear saved query state
    if (onClearQuery) {
      onClearQuery()
    }
    
    // Focus the textarea after clearing
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 100)
  }, [setQuestion, setSqlQuery, setQueryResults, setColumns, setError, onClearQuery])

  
  async function handleSaveQuery() {
    setSaveStatus("saving");
    try {
      // Prepare visual config for charts
      const visualConfig = (outputMode === 'chart' || outputMode === 'pie') && selectedXColumn && selectedYColumn ? {
        selectedXColumn,
        selectedYColumn,
        outputMode
      } : null;

      const payload = {
        action: "save", // <-- This tells the backend to save, not run
        question,
        sql: sqlQuery,
        outputMode,
        columns,
        dataSample: queryResults?.slice(0, 3) || [],
        visualConfig,
        // userId, companyId, panelPosition: add if needed
      };
      // Create headers with user ID
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (currentUser) {
        headers['x-user-id'] = currentUser.id.toString()
      }

      const res = await fetch("/api/query", {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSaveStatus("success");
        
        // Update originalQueryData to reflect the newly saved state
        if (setOriginalQueryData) {
          setOriginalQueryData({
            question,
            sql: sqlQuery,
            outputMode,
            data: queryResults,
            columns,
            visualConfig: {
              selectedXColumn,
              selectedYColumn
            }
          });
        }
        
        // Show ghost indicator
        setGhostMessage("Your query has been saved successfully.");
        setShowGhostIndicator(true);
        // Dispatch event to refresh history panel
        const event = new CustomEvent('queryUpdated', { detail: { action: 'saved' } });
        window.dispatchEvent(event);
        // Hide ghost indicator after 3 seconds
        setTimeout(() => setShowGhostIndicator(false), 3000);
      } else {
        setSaveStatus("error");
      }
    } catch (err) {
      setSaveStatus("error");
    }
    setTimeout(() => setSaveStatus(null), 2000);
  }

  // Function to determine error type and icon
  const getErrorInfo = (errorMessage: string) => {
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

  
  return (
    <>
      <GhostIndicator 
        message={ghostMessage}
        isVisible={showGhostIndicator}
      />
      <div className="flex flex-col h-full bg-card  shadow-md  overflow-hidden">
      <div className="flex-shrink-0 p-4 pb-0">
        <h2 className="text-xl font-semibold mb-2">Current Query</h2>

        <Textarea
          ref={textareaRef}
          placeholder="e.g. Show me the top 10 donors of 2024"
          value={question}
          onChange={handleQuestionChange}
          onKeyDown={handleKeyDown}
          className="mb-2"
        />

                {/* Column Selector - Show all available database columns when user is typing */}
        {!selectedSavedQueryId && question.trim().length > 0 && (
          <div className="mb-4 bg-card border border-border rounded-lg shadow-sm overflow-hidden">
            {/* Header with toggle button */}
            <button
              onClick={() => setIsColumnSelectorExpanded(!isColumnSelectorExpanded)}
              className="w-full p-4 text-left flex items-center justify-between hover:bg-accent/50 transition-colors"
            >
                              <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Select columns to include in your query:
                  </span>
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-sm p-4">
                        <div className="text-sm space-y-3">
                          <div className="font-semibold text-foreground">Column Selection Guide:</div>
                          <ul className="space-y-2 text-muted-foreground">
                            <li>• <strong>Your selections:</strong> AI will prioritize your selections</li>
                            <li>• <strong>Additional columns:</strong> AI may add supporting columns for better context</li>
                            <li>• <strong>✨ Auto:</strong> Let AI choose the most relevant columns</li>
                          </ul>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              {isColumnSelectorExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            
            {/* Collapsible content */}
            {isColumnSelectorExpanded && (
              <div className="px-4 pb-4 border-t border-border">
                <div className="flex gap-2 overflow-x-auto pb-3 pt-3 scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                  {/* Auto option */}
                  <button
                    onClick={() => {
                      // Clear any specific column selections and let AI decide
                      const newQuestion = question.replace(/\s*(?:include|show|display|use)\s+(?:only\s+)?(?:columns?|fields?)\s*[:=]\s*[^.]*\.?/gi, '');
                      setQuestion(newQuestion);
                    }}
                    className={`flex-shrink-0 px-3 py-2 text-xs font-medium rounded-md border transition-all duration-200 hover:shadow-sm flex items-center gap-1.5 ${
                      !question.match(/\b(?:include|show|display|use)\s+(?:only\s+)?(?:columns?|fields?)\b/i)
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-secondary text-secondary-foreground border-border hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <Sparkles className="h-3 w-3" />
                    Auto
                  </button>
                  
                  {/* Database column bubbles - grouped by table */}
                  {DATABASE_COLUMNS.map((col) => (
                    <button
                      key={col.key}
                      onClick={() => {
                        const columnName = col.name;
                        
                        let newQuestion: string;
                        
                        // Check if we already have column-specific instructions
                        if (question.match(/\b(?:include|show|display|use)\s+(?:only\s+)?(?:columns?|fields?)\b/i)) {
                          // Add to existing column list
                          newQuestion = question.replace(
                            /(\b(?:include|show|display|use)\s+(?:only\s+)?(?:columns?|fields?)\s*[:=]\s*)([^.]*)/i,
                            (match: string, prefix: string, existingColumns: string) => {
                              const columnsList = existingColumns.trim();
                              if (columnsList.includes(columnName)) {
                                // Column already included, remove it
                                const newList = columnsList
                                  .split(/,\s*/)
                                  .filter((colName: string) => colName !== columnName)
                                  .join(', ');
                                return newList ? `${prefix}${newList}` : prefix.slice(0, -1); // Remove colon if no columns
                              } else {
                                // Add column to list
                                return `${prefix}${columnsList ? `${columnsList}, ${columnName}` : columnName}`;
                              }
                            }
                          );
                        } else {
                          // Add new column instruction
                          newQuestion = question + (question.endsWith('.') ? ' ' : '. ') + `Include only columns: ${columnName}`;
                        }
                        
                        setQuestion(newQuestion);
                      }}
                      className={`flex-shrink-0 px-3 py-2 text-xs font-medium rounded-md border transition-all duration-200 hover:shadow-sm ${
                        question.toLowerCase().includes(col.name.toLowerCase())
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : col.table === 'gifts' 
                            ? 'bg-secondary text-secondary-foreground border-border hover:bg-accent hover:text-accent-foreground'
                            : col.table === 'constituents'
                            ? 'bg-secondary text-secondary-foreground border-border hover:bg-accent hover:text-accent-foreground'
                            : col.table === 'calculated'
                            ? 'bg-secondary text-secondary-foreground border-border hover:bg-accent hover:text-accent-foreground'
                            : 'bg-secondary text-secondary-foreground border-border hover:bg-accent hover:text-accent-foreground'
                      }`}
                      title={`${col.name} (${col.table})`}
                    >
                      {col.name}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground flex gap-6 pt-2 border-t border-border">
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary"></div>
                    Active
                  </span>
                  <span className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-secondary border border-border"></div>
                    Available
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-4 mb-2">
          <TooltipProvider>
            <ToggleGroup
              type="single"
              value={outputMode}
              onValueChange={(value) => {
                if (value) setOutputMode(value)
              }}
              className="flex gap-2"
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
            disabled={isLoading || (!!selectedSavedQueryId && !isEditingSavedQuery)}
          >
            {isLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Search"}
          </Button>
        </div>

        {/* Chart Configuration Filter Button */}
        {(outputMode === 'chart' || outputMode === 'pie') && columns.length >= 2 && (
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {showChartGhostText && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md border border-border transition-opacity duration-1000 ease-in-out">
                  <span>💡</span>
                  <span>Adjust X and Y values in the Chart Configuration for better results</span>
                </div>
              )}
            </div>
            <Dialog open={isChartConfigModalOpen} onOpenChange={setIsChartConfigModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>Chart Configuration</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Chart Column Configuration</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4 py-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-2">
                      X-Axis ({outputMode === 'chart' ? 'Categories' : 'Labels'})
                    </label>
                    <Select value={selectedXColumn} onValueChange={(value) => {
  console.log('🪄 QueryPanel X Column changed from', selectedXColumn, 'to', value);
  setSelectedXColumn(value);
}}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col.key} value={col.key}>
                            {col.name.replace(/_/g, ' ').replace(/\w\S*/g, txt => 
                              txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-2">
                      Y-Axis ({outputMode === 'chart' ? 'Values' : 'Sizes'})
                    </label>
                    <Select value={selectedYColumn} onValueChange={(value) => {
  console.log('🪄 QueryPanel Y Column changed from', selectedYColumn, 'to', value);
  setSelectedYColumn(value);
}}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columns.map((col) => (
                          <SelectItem key={col.key} value={col.key}>
                            {col.name.replace(/_/g, ' ').replace(/\w\S*/g, txt => 
                              txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
                            )}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Results Title */}
      {/* <div className="font-mono font-bold text-lg mb-2 mt-2" style={{ color: "#16a34a" }}>Results:</div> */}
      
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-auto p-4 pt-0">
        {/* Results Area - Always visible with border */}
        <div className="bg-card border-2 border-dashed border-muted-foreground/30 rounded p-4 flex flex-col flex-1 h-full relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
              <div className="text-sm font-medium text-muted-foreground">Loading query results...</div>
            </div>
          </div>
        )}
        {queryResults && queryResults.length > 0 && columns.length >= 1 ? (
          <div className="flex flex-col flex-1 min-h-0">
            {outputMode === 'table' && (
              <div className="h-full w-full overflow-hidden">
                <TableView 
                  data={queryResults} 
                  columns={columns} 
                  sql={sqlQuery || undefined} 
                  readOnlyMode={readOnlyMode}
                  onColumnOrderChange={handleColumnOrderChange}
                  externalSortColumn={externalSortColumn}
                  externalSortDirection={externalSortDirection}
                  onSortChange={handleSortChange}
                />
              </div>
            )}
          
            {outputMode === 'chart' && (
              <div className="flex-1 min-h-0">
                <DraggableChart
                  data={queryResults.map((row) => ({
                    name: row[selectedXColumn] || row.donor || row._id?.name || 'Unknown',
                    value: Number(row[selectedYColumn] || row.totalAmount) || 0,
                  }))}
                  type={outputMode}
                  sql={sqlQuery || undefined}
                  columns={columns}
                />
              </div>
            )}
          
            {outputMode === 'pie' && (
              <div className="flex-1 min-h-0">
                <DraggablePieChart
                  data={queryResults.map((row) => ({
                    name: row[selectedXColumn] || row.donor || row._id?.name || 'Unknown',
                    value: Number(row[selectedYColumn] || row.totalAmount) || 0,
                  }))}
                  sql={sqlQuery || undefined}
                  columns={columns}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground font-mono p-8">
            <div className="text-center">
              <div className="text-lg mb-2">No results yet</div>
              <div className="text-sm">Run a query to see results here</div>
            </div>
          </div>
        )}
        
        {/* Show/Hide SQL -- always at the bottom of the results box */}
        {sqlQuery && (
          <div className="mt-4 border-t pt-4 flex-shrink-0">
            <button
              onClick={() => setShowSql(!showSql)}
              className="text-left text-sm font-mono font-semibold text-primary hover:underline focus:outline-none"
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

        {error && (
          <div className="mt-4">
            {(() => {
              const errorInfo = getErrorInfo(error)
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
                      {error}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setError(null)}
                    className="h-6 w-6 p-0 hover:bg-white/50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* Fixed Save/Clear Button Bar */}
      <div className="flex-shrink-0 p-4 border-t bg-card flex flex-row items-center justify-between gap-2">
        
        <div className="flex items-center gap-2">
          {selectedSavedQueryId ? (
            // Saved query in edit mode: Update, Delete, and Cancel
            <>
              <Button
                variant="default"
                className="flex items-center gap-2"
                onClick={handleUpdateSavedQuery}
                disabled={(() => {
  const hasChangesResult = hasChanges ? hasChanges() : false;
  const isDisabled = !question || !sqlQuery || !outputMode || !columns.length || !queryResults?.length || saveStatus === "saving" || !hasChangesResult;
  console.log('🪄 QueryPanel Update button disabled check:', {
  hasChangesResult,
  isDisabled,
  question: !!question,
  sqlQuery: !!sqlQuery,
  outputMode: !!outputMode,
  columnsLength: columns.length,
  queryResultsLength: queryResults?.length,
  saveStatus
});
console.log('🪄 hasChangesResult:', hasChangesResult);
console.log('🪄 isDisabled:', isDisabled);
  return isDisabled;
})()}
              >
                <Save className="h-5 w-5" />
                {saveStatus === "saving" ? "Saving..." : saveStatus === "success" ? "Saved!" : saveStatus === "error" ? "Error" : "Update"}
              </Button>
              
              <Button
                variant="destructive"
                className="flex items-center gap-2"
                onClick={handleDeleteSavedQuery}
              >
                <Trash2 className="h-5 w-5" />
                <span>Delete</span>
              </Button>
              
              <Button
                variant="outline"
                className="flex items-center gap-2"
                onClick={handleCancelEdit}
              >
                <X className="h-5 w-5" />
                <span>Clear</span>
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
                onClick={handleClearQuery}
              >
                <X className="h-4 w-4" />
                <span>Clear</span>
              </Button>
            </>
          )}
        </div>

        {/* Excel Export Button - shown when there are query results and output mode is table */}
        {queryResults && queryResults.length > 0 && columns.length > 0 && outputMode === 'table' && (
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={handleExportToExcel}
          >
            <Download className="h-4 w-4" />
            <span>Export Excel</span>
          </Button>
        )}
      </div>
    </div>
    </>
  )
}
