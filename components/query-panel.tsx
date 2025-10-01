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

// Query validation function
const validateQuery = (query: string): { isValid: boolean; errors: string[]; warnings: string[] } => {
  const errors: string[] = []
  const warnings: string[] = []

  // Trim the query
  const trimmedQuery = query.trim()

  // Check if query is empty
  if (!trimmedQuery) {
    errors.push("Please enter a question or query")
    return { isValid: false, errors, warnings }
  }

  // Check minimum length
  if (trimmedQuery.length < 3) {
    errors.push("Query is too short. Please provide more details")
    return { isValid: false, errors, warnings }
  }

  // Check for potentially problematic patterns
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
    { pattern: /exec\s*\(/i, message: "EXEC commands are not allowed" },
    { pattern: /sp_/i, message: "Stored procedure calls are not allowed" },
    { pattern: /xp_/i, message: "Extended procedure calls are not allowed" },
    { pattern: /--.*drop|--.*delete|--.*truncate|--.*alter|--.*create|--.*insert|--.*update|--.*grant|--.*revoke/i, message: "Potentially dangerous SQL commands detected in comments" }
  ]

  for (const { pattern, message } of problematicPatterns) {
    if (pattern.test(trimmedQuery)) {
      errors.push(message)
    }
  }

  // Check for suspicious characters that might indicate SQL injection attempts
  const suspiciousPatterns = [
    { pattern: /union\s+select/i, message: "UNION SELECT patterns detected" },
    { pattern: /or\s+1\s*=\s*1/i, message: "SQL injection pattern detected" },
    { pattern: /';.*--/i, message: "SQL injection pattern detected" },
    { pattern: /\/\*.*\*\//i, message: "SQL comment blocks detected" },
    { pattern: /waitfor\s+delay/i, message: "Time-based SQL injection pattern detected" }
  ]

  for (const { pattern, message } of suspiciousPatterns) {
    if (pattern.test(trimmedQuery)) {
      errors.push(message)
    }
  }

  // Check for very long queries (potential DoS)
  if (trimmedQuery.length > 5000) {
    warnings.push("Query is very long. Consider breaking it into smaller parts")
  }

  // Check for repeated characters (potential DoS)
  const repeatedChars = /(.)\1{20,}/i
  if (repeatedChars.test(trimmedQuery)) {
    warnings.push("Query contains many repeated characters")
  }

  // Check for basic SQL keywords that might indicate direct SQL instead of natural language
  const sqlKeywords = /\b(select|from|where|join|group\s+by|order\s+by|having|limit|offset)\b/i
  if (sqlKeywords.test(trimmedQuery) && !trimmedQuery.toLowerCase().includes('show me') && !trimmedQuery.toLowerCase().includes('find') && !trimmedQuery.toLowerCase().includes('get')) {
    warnings.push("This looks like SQL code. Please use natural language instead (e.g., 'Show me all gifts from 2023')")
  }

  // Check for gibberish patterns - using priority order to avoid duplicates
  let gibberishDetected = false

  // Check for very short meaningless strings first
  if (/^.{1,2}$/.test(trimmedQuery)) {
    errors.push("Please provide a more detailed question")
    gibberishDetected = true
  }
  // Check for repeated single characters
  else if (/^(.)\1{4,}$/.test(trimmedQuery)) {
    errors.push("Please provide a meaningful question, not repeated characters")
    gibberishDetected = true
  }
  // Check for repeated words
  else if (/^(\w+)\s+\1\s+\1/.test(trimmedQuery)) {
    errors.push("Please provide a meaningful question, not repeated words")
    gibberishDetected = true
  }
  // Check for only numbers
  else if (/^\d+$/.test(trimmedQuery)) {
    errors.push("Please ask a question with words, not just numbers")
    gibberishDetected = true
  }
  // Check for only special characters
  else if (/^[!@#$%^&*()_+\-=\[\]{}|;':",./<>?`~]+$/.test(trimmedQuery)) {
    errors.push("Please use actual words in your question")
    gibberishDetected = true
  }
  // Check for only vowels
  else if (/^[aeiou]+$/i.test(trimmedQuery)) {
    errors.push("Please use actual words in your question")
    gibberishDetected = true
  }
  // Check for only consonants
  else if (/^[bcdfghjklmnpqrstvwxyz]+$/i.test(trimmedQuery)) {
    errors.push("Please use actual words in your question")
    gibberishDetected = true
  }
  // Check for random character sequences (no letters/spaces)
  else if (/^[^a-zA-Z\s]*$/.test(trimmedQuery)) {
    errors.push("Please use actual words, not just symbols or numbers")
    gibberishDetected = true
  }
  // Check for random keyboard mashing patterns
  else if (/^[qwertyuiopasdfghjklzxcvbnm]{8,}$/i.test(trimmedQuery) ||
    /^[asdfghjkl]{6,}$/i.test(trimmedQuery) ||
    /^[a-z]{10,}$/i.test(trimmedQuery)) {
    errors.push("This looks like random typing. Please ask a real question")
    gibberishDetected = true
  }

  // Check for meaningful content (not just random characters) - only if no gibberish detected
  if (!gibberishDetected) {
    const meaningfulContent = /[a-zA-Z]{3,}/
    if (!meaningfulContent.test(trimmedQuery)) {
      errors.push("Please provide a meaningful question with actual words")
    }
  }

  // Check for meaningful words related to data analysis
  const dataAnalysisWords = [
    'show', 'find', 'get', 'list', 'display', 'see', 'view', 'search', 'filter',
    'gift', 'donor', 'donation', 'amount', 'date', 'year', 'month', 'total', 'sum',
    'average', 'count', 'top', 'bottom', 'highest', 'lowest', 'largest', 'smallest',
    'by', 'from', 'to', 'between', 'where', 'who', 'what', 'when', 'how', 'many',
    'all', 'some', 'each', 'every', 'most', 'least', 'recent', 'oldest', 'newest',
    'name', 'email', 'phone', 'address', 'type', 'category', 'status', 'active',
    'inactive', 'deceased', 'alumni', 'graduate', 'undergraduate', 'school',
    'degree', 'class', 'year', 'appeal', 'designation', 'payment', 'method',
    'pledge', 'soft', 'credit', 'source', 'code', 'unit', 'purpose', 'giving',
    'level', 'account', 'id', 'uuid', 'lookup', 'spouse', 'married', 'volunteer',
    'wealth', 'score', 'events', 'attended', 'solicitation', 'restrictions',
    'gender', 'age', 'full', 'home', 'telephone', 'organization', 'person'
  ]

  const queryWords = trimmedQuery.toLowerCase().split(/\s+/)
  const hasDataWords = queryWords.some(word =>
    dataAnalysisWords.some(dataWord =>
      word.includes(dataWord) || dataWord.includes(word)
    )
  )

  // Check for common nonsense words
  const nonsenseWords = ['asdf', 'qwerty', 'test', 'testing', 'hello', 'hi', 'hey', 'lol', 'haha', 'blah', 'blah blah', 'random', 'stuff', 'things', 'whatever', 'idk', 'idontknow', 'nothing', 'something', 'anything']
  const hasNonsenseWords = queryWords.some(word =>
    nonsenseWords.some(nonsense =>
      word.toLowerCase().includes(nonsense.toLowerCase())
    )
  )

  if (hasNonsenseWords && trimmedQuery.length > 5) {
    errors.push("Please ask a real question about your data, not just test words")
  }

  // If query is longer than 10 characters but has no meaningful data-related words, warn
  if (trimmedQuery.length > 10 && !hasDataWords && !hasNonsenseWords) {
    warnings.push("This doesn't seem to be a data analysis question. Try asking about gifts, donors, amounts, dates, etc.")
  }

  // Check for minimum word count
  const wordCount = trimmedQuery.split(/\s+/).filter(word => word.length > 0).length
  if (wordCount < 2) {
    errors.push("Please provide a more detailed question with at least 2 words")
  }

  // Remove duplicate errors
  const uniqueErrors = [...new Set(errors)]
  const uniqueWarnings = [...new Set(warnings)]

  return {
    isValid: uniqueErrors.length === 0,
    errors: uniqueErrors,
    warnings: uniqueWarnings
  }
}

// Database schema columns - all available columns from the database (sorted alphabetically)
const DATABASE_COLUMNS = [
  // Gifts table columns
  { key: 'g.ACCOUNTID', name: 'Account ID', table: 'gifts' },
  { key: 'g.APPEAL', name: 'Appeal', table: 'gifts' },
  { key: 'g.DESIGNATION', name: 'Designation', table: 'gifts' },
  { key: 'g.GIFTDATE', name: 'Gift Date', table: 'gifts' },
  { key: 'g.GIFTAMOUNT', name: 'Gift Amount', table: 'gifts' },
  { key: 'g.GIFTID', name: 'Gift ID', table: 'gifts' },
  { key: 'g.GIFTTYPE', name: 'Gift Type', table: 'gifts' },
  { key: 'g.GIVINGLEVEL', name: 'Giving Level', table: 'gifts' },
  { key: 'g.PAYMENTMETHOD', name: 'Payment Method', table: 'gifts' },
  { key: 'g.PLEDGEID', name: 'Pledge ID', table: 'gifts' },
  { key: 'g.PURPOSECATEGORY', name: 'Purpose Category', table: 'gifts' },
  { key: 'g.SOFTCREDITAMOUNT', name: 'Soft Credit Amount', table: 'gifts' },
  { key: 'g.SOFTCREDITID', name: 'Soft Credit ID', table: 'gifts' },
  { key: 'g.SOFTCREDITINDICATOR', name: 'Soft Credit Indicator', table: 'gifts' },
  { key: 'g.SOURCECODE', name: 'Source Code', table: 'gifts' },
  { key: 'g.TRANSACTIONTYPE', name: 'Transaction Type', table: 'gifts' },
  { key: 'g.UNIT', name: 'Unit', table: 'gifts' },
  { key: 'g.UUID', name: 'UUID', table: 'gifts' },

  // Constituents table columns
  { key: 'c.AGE', name: 'Age', table: 'constituents' },
  { key: 'c.ALUMNITYPE', name: 'Alumni Type', table: 'constituents' },
  { key: 'c.ASSIGNEDACCOUNT', name: 'Assigned Account', table: 'constituents' },
  { key: 'c.DECEASED', name: 'Deceased', table: 'constituents' },
  { key: 'c.DONOTEMAIL', name: 'Do Not Email', table: 'constituents' },
  { key: 'c.DONOTMAIL', name: 'Do Not Mail', table: 'constituents' },
  { key: 'c.DONOTPHONE', name: 'Do Not Phone', table: 'constituents' },
  { key: 'c.DONORTYPE1', name: 'Donor Type', table: 'constituents' },
  { key: 'c.EMAIL', name: 'Email', table: 'constituents' },
  { key: 'c.EVENTS', name: 'Events', table: 'constituents' },
  { key: 'c.EVENTSATTENDED', name: 'Events Attended', table: 'constituents' },
  { key: 'c.FULLADDRESS', name: 'Full Address', table: 'constituents' },
  { key: 'c.FULLNAME', name: 'Full Name', table: 'constituents' },
  { key: 'c.GENDER', name: 'Gender', table: 'constituents' },
  { key: 'c.GEPSTATUS', name: 'GEP Status', table: 'constituents' },
  { key: 'c.GRADUATEDEGREE1', name: 'Graduate Degree', table: 'constituents' },
  { key: 'c.GRADUATEGRADUATIONYEAR1', name: 'Graduate Year', table: 'constituents' },
  { key: 'c.GRADUATEPREFERREDCLASSYEAR1', name: 'Graduate Preferred Class Year', table: 'constituents' },
  { key: 'c.GRADUATESCHOOL1', name: 'Graduate School', table: 'constituents' },
  { key: 'c.HOMETELEPHONE', name: 'Home Telephone', table: 'constituents' },
  { key: 'c.LOOKUPID', name: 'Lookup ID', table: 'constituents' },
  { key: 'c.MARRIEDTOALUM', name: 'Married To Alum', table: 'constituents' },
  { key: 'c.PERSONORGANIZATIONINDICATOR', name: 'Person/Organization', table: 'constituents' },
  { key: 'c.PMFULLNAME', name: 'PM Full Name', table: 'constituents' },
  { key: 'c.SOLICITATIONRESTRICTIONS', name: 'Solicitation Restrictions', table: 'constituents' },
  { key: 'c.SPOUSEID', name: 'Spouse ID', table: 'constituents' },
  { key: 'c.SPOUSELOOKUPID', name: 'Spouse Lookup ID', table: 'constituents' },
  { key: 'c.TYPE', name: 'Type', table: 'constituents' },
  { key: 'c.UNDERGRADUATEDEGREE1', name: 'Undergraduate Degree', table: 'constituents' },
  { key: 'c.UNDERGRADUATIONYEAR1', name: 'Undergraduate Year', table: 'constituents' },
  { key: 'c.UNDERGRADUATEPREFERREDCLASSYEAR1', name: 'Preferred Class Year', table: 'constituents' },
  { key: 'c.UNDERGRADUATESCHOOL1', name: 'Undergraduate School', table: 'constituents' },
  { key: 'c.VOLUNTEER', name: 'Volunteer', table: 'constituents' },
  { key: 'c.WEALTHSCORE', name: 'Wealth Score', table: 'constituents' },

  // Common calculated/aggregated columns
  { key: 'AVG(CAST(g.GIFTAMOUNT AS DECIMAL(15,2)))', name: 'Average Amount', table: 'calculated' },
  { key: 'COUNT(*)', name: 'Count', table: 'calculated' },
  { key: 'SUM(CAST(g.GIFTAMOUNT AS DECIMAL(15,2)))', name: 'Total Amount', table: 'calculated' },
  { key: 'YEAR(g.GIFTDATE)', name: 'Year', table: 'calculated' }
]



interface QueryPanelProps {
  question: string
  setQuestion: (value: string) => void
  outputMode: string
  setOutputMode: (value: string) => void
  isLoading: boolean
  processingTime?: 'fast' | 'longer' | null
  sqlQuery: string | null
  setSqlQuery: (value: string | null) => void
  queryResults: any[] | null
  setQueryResults: (value: any[] | null) => void
  columns: { key: string; name: string }[]
  setColumns: (value: { key: string; name: string }[]) => void
  error: string | null
  setError: (value: string | null) => void
  onSubmit: (comboPrompt?: string) => void
  readOnlyMode?: boolean // Add this prop
  isEditingSavedQuery?: boolean
  handleUpdateSavedQuery?: () => Promise<void>
  handleCancelEdit?: () => void
  hasChanges?: () => boolean
  onComboPromptChange?: (comboPrompt: string) => void
  selectedSavedQueryId?: number | null
  handleDeleteSavedQuery?: () => Promise<void>
  onClearQuery?: () => void
  selectedXColumn?: string
  setSelectedXColumn?: (value: string) => void
  selectedYColumn?: string
  setSelectedYColumn?: (value: string) => void
  currentUser?: any // Add currentUser prop
  setOriginalQueryData?: (data: any) => void // Add setOriginalQueryData prop
  onSortChange?: (column: string | null, direction: 'asc' | 'desc' | null) => void
  initialSortColumn?: string | null
  initialSortDirection?: 'asc' | 'desc' | null
  comboPrompt?: string // Add comboPrompt prop for saved queries
  onSelectedColumnsChange?: (selectedColumns: string[]) => void // Add callback for selected columns
  initialSelectedColumns?: string[] // Add initial selected columns for saved queries
}

export function QueryPanel({
  question,
  setQuestion,
  outputMode,
  setOutputMode,
  isLoading,
  processingTime,
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
  onSortChange: propOnSortChange,
  initialSortColumn,
  initialSortDirection,
  onComboPromptChange,
  comboPrompt: propComboPrompt,
  onSelectedColumnsChange,
  initialSelectedColumns
}: QueryPanelProps) {
  const [showSql, setShowSql] = useState(false)
  const [saveStatus, setSaveStatus] = useState<null | "success" | "error" | "saving">(null);
  const [isChartConfigModalOpen, setIsChartConfigModalOpen] = useState(false)
  const [showChartGhostText, setShowChartGhostText] = useState(false)
  const [showGhostIndicator, setShowGhostIndicator] = useState(false)
  const [ghostMessage, setGhostMessage] = useState("")
  // External sorting state
  const [externalSortColumn, setExternalSortColumn] = useState<string | null>(initialSortColumn || null)
  const [externalSortDirection, setExternalSortDirection] = useState<'asc' | 'desc' | null>(initialSortDirection || null)
  const [isColumnSelectorExpanded, setIsColumnSelectorExpanded] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
  const [showValidation, setShowValidation] = useState(false)
  const [columnSelectionFeedback, setColumnSelectionFeedback] = useState<string[]>([])
  const [comboPrompt, setComboPrompt] = useState('')
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [columnSelectionMode, setColumnSelectionMode] = useState<'auto' | 'all' | 'specific'>('auto')
  const isInitializingFromSavedQuery = useRef(false)

  // Auto-expand column selector only when user is actively typing, keep collapsed after search
  useEffect(() => {
    if (question.trim().length > 0 && validationErrors.length === 0 && !isLoading && !queryResults?.length) {
      setIsColumnSelectorExpanded(true)
    } else if (question.trim().length === 0 || validationErrors.length > 0 || isLoading) {
      setIsColumnSelectorExpanded(false)
    }
    // Don't auto-collapse when queryResults exist - let user manually control column selector
  }, [question, validationErrors, isLoading, queryResults])

  // Function to extract clean user prompt (without column selections)
  const extractUserPrompt = useCallback((fullPrompt: string) => {
    // Remove column selection text to get clean user prompt
    let cleanPrompt = fullPrompt.replace(/\s*(?:include|show|display|use)\s+(?:only\s+)?(?:columns?|fields?)\s*[:=]\s*[^.]*\.?/gi, '')
    cleanPrompt = cleanPrompt.replace(/\s*include\s+all\s+columns\.?/gi, '')
    return cleanPrompt.trim()
  }, [])

  // Function to generate combo prompt (user prompt + column selections)
  const generateComboPrompt = useCallback((userPrompt: string, columns: string[], mode: 'auto' | 'all' | 'specific') => {
    const cleanPrompt = extractUserPrompt(userPrompt)

    if (mode === 'all') {
      return cleanPrompt + (cleanPrompt ? '. Include all columns' : 'Include all columns')
    } else if (mode === 'specific' && columns.length > 0) {
      return cleanPrompt + (cleanPrompt ? '. Include only columns: ' : 'Include only columns: ') + columns.join(', ')
    } else {
      // Auto mode - just return clean prompt
      return cleanPrompt
    }
  }, [extractUserPrompt])

  // Function to handle column selection
  const handleColumnSelection = useCallback((columnName: string) => {
    // Toggle column selection
    if (selectedColumns.includes(columnName)) {
      // Remove column
      setSelectedColumns(prev => prev.filter(c => c !== columnName))
    } else {
      // Add column
      setSelectedColumns(prev => [...prev, columnName])
    }

    // Set mode to specific if we have selections
    setColumnSelectionMode('specific')
  }, [selectedColumns])

  // Function to check if selected columns appear in results
  const checkColumnSelection = useCallback((question: string, columns: any[]) => {
    const feedback: string[] = []

    // Extract selected columns from question
    const columnMatch = question.match(/\b(?:include|show|display|use)\s+(?:only\s+)?(?:columns?|fields?)\s*[:=]\s*([^.]*)/i)
    if (columnMatch) {
      const selectedColumnsText = columnMatch[1]
      const selectedColumns = selectedColumnsText.split(/[,;]/).map(col => col.trim()).filter(Boolean)

      // Check which selected columns are missing from results
      const resultColumnNames = columns.map(col => col.name)
      const missingColumns = selectedColumns.filter(selectedCol =>
        !resultColumnNames.some(resultCol =>
          resultCol.toLowerCase().includes(selectedCol.toLowerCase()) ||
          selectedCol.toLowerCase().includes(resultCol.toLowerCase())
        )
      )

      if (missingColumns.length > 0) {
        feedback.push(`Note: Some selected columns (${missingColumns.join(', ')}) were not included in the results. This might be because they're not relevant to this query type or don't exist in the database.`)
      }
    }

    setColumnSelectionFeedback(feedback)
  }, [])

  // Update external sorting state when initial values change (for saved queries)
  useEffect(() => {
    // Always update when initial values change, even if they're null
    console.log('🔄 QueryPanel: Updating external sorting state:', { initialSortColumn, initialSortDirection })
    setExternalSortColumn(initialSortColumn || null)
    setExternalSortDirection(initialSortDirection || null)
  }, [initialSortColumn, initialSortDirection])

  // Initialize column selection state from saved query
  useEffect(() => {
    // If we have initialSelectedColumns (from saved query), use them
    if (initialSelectedColumns) {
      setSelectedColumns(initialSelectedColumns)
      setColumnSelectionMode(initialSelectedColumns.length > 0 ? 'specific' : 'auto')
      isInitializingFromSavedQuery.current = true
    } else if (propComboPrompt) {
      // Fallback: parse from comboPrompt for backward compatibility
      const textToAnalyze = propComboPrompt
      
      const columnMatch = textToAnalyze.match(/\b(?:include|show|display|use)\s+(?:only\s+)?(?:columns?|fields?)\s*[:=]\s*([^.]*)/i)
      if (columnMatch) {
        const selectedColumnsText = columnMatch[1]
        const columns = selectedColumnsText.split(/[,;]/).map(col => col.trim()).filter(Boolean)
        setSelectedColumns(columns)
        setColumnSelectionMode('specific')
      } else if (textToAnalyze.toLowerCase().includes('include all columns')) {
        setColumnSelectionMode('all')
        setSelectedColumns([])
      } else {
        setColumnSelectionMode('auto')
        setSelectedColumns([])
      }
      
      // Set the flag for saved query initialization
      isInitializingFromSavedQuery.current = true
    }
  }, [initialSelectedColumns, propComboPrompt]) // Depend on both props

  // Update combo prompt whenever question, selected columns, or mode changes
  useEffect(() => {
    const combo = generateComboPrompt(question, selectedColumns, columnSelectionMode)
    setComboPrompt(combo)
    
    // Only notify parent component if we're not initializing from a saved query
    // This prevents infinite loops when loading saved queries
    if (onComboPromptChange && !isInitializingFromSavedQuery.current) {
      onComboPromptChange(combo)
    }
    
    // Notify parent component of selected columns changes
    if (onSelectedColumnsChange && !isInitializingFromSavedQuery.current) {
      onSelectedColumnsChange(selectedColumns)
    }
    
    // Reset the flag after the first update
    if (isInitializingFromSavedQuery.current) {
      isInitializingFromSavedQuery.current = false
    }
  }, [question, selectedColumns, columnSelectionMode, generateComboPrompt, onComboPromptChange, onSelectedColumnsChange])

  // Check column selection when results come in
  useEffect(() => {
    if (queryResults && queryResults.length > 0 && columns.length > 0) {
      checkColumnSelection(question, columns)
    } else {
      setColumnSelectionFeedback([])
    }
  }, [queryResults, columns, question, checkColumnSelection])

  // Memoized callback for column order changes to prevent infinite loops
  const handleColumnOrderChange = useCallback((reorderedColumns: { key: string; name: string }[]) => {
    setColumns(reorderedColumns)
  }, [setColumns])

  // Function to handle programmatic sorting
  const handleSortChange = useCallback((column: string | null, direction: 'asc' | 'desc' | null) => {
    console.log('🔄 Query panel sort change:', { column, direction })
    setExternalSortColumn(column)
    setExternalSortDirection(direction)

    // Notify parent component about sorting changes
    if (propOnSortChange) {
      console.log('🔄 Notifying parent about sorting change')
      propOnSortChange(column, direction)
    }
  }, [propOnSortChange])

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

  // Validation function that runs on query change
  const validateQueryInput = useCallback((queryText: string) => {
    const validation = validateQuery(queryText)
    setValidationErrors(validation.errors)
    setValidationWarnings(validation.warnings)
    setShowValidation(validation.errors.length > 0 || validation.warnings.length > 0)
    return validation.isValid
  }, [])

  // Stable event handlers
  const handleQuestionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setQuestion(newValue)

    // Run validation in real-time (debounced)
    if (newValue.trim().length > 0) {
      validateQueryInput(newValue)
    } else {
      setValidationErrors([])
      setValidationWarnings([])
      setShowValidation(false)
    }
  }, [setQuestion, validateQueryInput])

  // Enhanced submit handler with validation
  const handleSubmitWithValidation = useCallback(() => {
    const isValid = validateQueryInput(question)
    if (isValid) {
      setShowValidation(false)
      setIsColumnSelectorExpanded(false) // Collapse column selector immediately when search is pressed
      // Use combo prompt for execution, but keep user prompt clean in the UI
      onSubmit(comboPrompt)
    } else {
      setShowValidation(true)
      toast.error("Please fix the validation errors before submitting")
    }
  }, [question, validateQueryInput, onSubmit, comboPrompt])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmitWithValidation()
    }
  }, [handleSubmitWithValidation])

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
    setSelectedColumns([]) // Reset selected columns
    setColumnSelectionMode('auto') // Reset to auto mode

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
      // Prepare visual config for charts and sorting
      const visualConfig = {
        ...((outputMode === 'chart' || outputMode === 'pie') && selectedXColumn && selectedYColumn ? {
          selectedXColumn,
          selectedYColumn,
          outputMode
        } : {}),
        // Always include sorting state if it exists
        ...(externalSortColumn && externalSortDirection ? {
          sortColumn: externalSortColumn,
          sortDirection: externalSortDirection
        } : {})
      };

      // Only include visualConfig if it has content
      const finalVisualConfig = Object.keys(visualConfig).length > 0 ? visualConfig : null;

      console.log('🔄 QueryPanel: Saving query with sorting state:', {
        externalSortColumn,
        externalSortDirection,
        finalVisualConfig
      });

      const payload = {
        action: "save", // <-- This tells the backend to save, not run
        question,
        sql: sqlQuery,
        outputMode,
        columns,
        dataSample: queryResults?.slice(0, 3) || [],
        visualConfig: finalVisualConfig,
        selectedColumns: selectedColumns,
        filteredColumns: {}, // Empty for new queries
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
              selectedYColumn,
              sortColumn: externalSortColumn,
              sortDirection: externalSortDirection
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
            className={`mb-2 ${validationErrors.length > 0
                ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                : ''
              }`}
          />

          {/* Validation Messages - Right under textarea */}
          {showValidation && (validationErrors.length > 0 || validationWarnings.length > 0) && (
            <div className="mb-3 space-y-1.5">
              {/* Error Messages */}
              {validationErrors.length > 0 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertCircle className="h-3 w-3 text-destructive" />
                    <span className="text-xs font-medium text-destructive">Validation Errors</span>
                  </div>
                  <ul className="text-xs text-destructive space-y-0.5">
                    {validationErrors.map((error, index) => (
                      <li key={index} className="flex items-start gap-1.5">
                        <span className="text-destructive/70">•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warning Messages */}
              {validationWarnings.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="h-3 w-3 text-yellow-600" />
                    <span className="text-xs font-medium text-yellow-800">Warnings</span>
                  </div>
                  <ul className="text-xs text-yellow-700 space-y-0.5">
                    {validationWarnings.map((warning, index) => (
                      <li key={index} className="flex items-start gap-1.5">
                        <span className="text-yellow-600">•</span>
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Column Selection Feedback */}
              {columnSelectionFeedback.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Info className="h-3 w-3 text-blue-600" />
                    <span className="text-xs font-medium text-blue-800">Column Selection Info</span>
                  </div>
                  <ul className="text-xs text-blue-700 space-y-0.5">
                    {columnSelectionFeedback.map((feedback, index) => (
                      <li key={index} className="flex items-start gap-1.5">
                        <span className="text-blue-600">•</span>
                        <span>{feedback}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Column Selector - Show all available database columns when user is typing */}
          {question.trim().length > 0 && (
            <div className="mb-4 bg-card border border-border rounded-lg shadow-sm overflow-auto max-h-[60vh] flex flex-col">
              {/* Header with toggle button */}
              <button
                onClick={() => setIsColumnSelectorExpanded(!isColumnSelectorExpanded)}
                disabled={validationErrors.length > 0}
                className={`w-full p-4 text-left flex items-center justify-between transition-colors ${validationErrors.length > 0
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-accent/50'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    Select columns to include in your query:
                  </span>
                  {/* <TooltipProvider>
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
                  </TooltipProvider> */}

                </div>
                {isColumnSelectorExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {/* Collapsible content */}
              {isColumnSelectorExpanded && (
                <div className={`border-t border-border flex flex-col flex-1 ${validationErrors.length > 0 ? 'opacity-50 pointer-events-none' : ''}`}>
                  {/* Quick Actions - Fixed */}
                  <div className="px-4 pt-3 pb-2">
                    <div className="flex gap-2">
                      {/* Auto option */}
                      <button
                        onClick={() => {
                          // Clear any specific column selections and let AI decide
                          setSelectedColumns([])
                          setColumnSelectionMode('auto')
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 hover:shadow-sm flex items-center gap-1.5 ${columnSelectionMode === 'auto'
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-secondary text-secondary-foreground border-border hover:bg-accent hover:text-accent-foreground'
                          }`}
                      >
                        <Sparkles className="h-3 w-3" />
                        Auto
                      </button>

                      {/* All columns button */}
                      <button
                        onClick={() => {
                          // Use simple "include all columns" instead of listing every column name
                          setSelectedColumns([])
                          setColumnSelectionMode('all')
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all duration-200 hover:shadow-sm ${columnSelectionMode === 'all'
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-secondary text-secondary-foreground border-border hover:bg-accent hover:text-accent-foreground'
                          }`}
                      >
                        All Columns
                      </button>
                    </div>
                  </div>

                  {/* Categorized Column Grid - Scrollable */}
                  <div className="px-4 flex-1 py-2 overflow-y-scroll scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent">
                    <div className="space-y-3">
                      {/* Gifts Table */}
                      <div>
                        <h4 className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          Gifts & Donations
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {DATABASE_COLUMNS.filter(col => col.table === 'gifts').map((col) => (
                            <button
                              key={col.key}
                              onClick={() => handleColumnSelection(col.name)}
                              className={`px-2 py-1 text-xs font-medium rounded-md border transition-all duration-200 hover:shadow-sm text-left ${selectedColumns.includes(col.name)
                                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                  : 'bg-secondary text-secondary-foreground border-border hover:bg-accent hover:text-accent-foreground'
                                }`}
                              title={`${col.name} (${col.table})`}
                            >
                              {col.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Constituents Table */}
                      <div>
                        <h4 className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                          Constituents & Donors
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {DATABASE_COLUMNS.filter(col => col.table === 'constituents').map((col) => (
                            <button
                              key={col.key}
                              onClick={() => handleColumnSelection(col.name)}
                              className={`px-2 py-1 text-xs font-medium rounded-md border transition-all duration-200 hover:shadow-sm text-left ${selectedColumns.includes(col.name)
                                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                  : 'bg-secondary text-secondary-foreground border-border hover:bg-accent hover:text-accent-foreground'
                                }`}
                              title={`${col.name} (${col.table})`}
                            >
                              {col.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Calculated Columns */}
                      <div>
                        <h4 className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-500"></div>
                          Calculated Fields
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {DATABASE_COLUMNS.filter(col => col.table === 'calculated').map((col) => (
                            <button
                              key={col.key}
                              onClick={() => handleColumnSelection(col.name)}
                              className={`px-2 py-1 text-xs font-medium rounded-md border transition-all duration-200 hover:shadow-sm text-left ${selectedColumns.includes(col.name)
                                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                  : 'bg-secondary text-secondary-foreground border-border hover:bg-accent hover:text-accent-foreground'
                                }`}
                              title={`${col.name} (${col.table})`}
                            >
                              {col.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer - Fixed */}
                  <div className="px-4 pb-4 pt-2 border-t border-border">
                    <div className="text-xs text-muted-foreground flex gap-6">
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        Active
                      </span>
                      <span className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-secondary border border-border"></div>
                        Available
                      </span>
                      <span className="text-xs text-muted-foreground">
                        AI may add additional relevant columns to your results to provide better context
                      </span>
                    </div>
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
              onClick={handleSubmitWithValidation}
              disabled={isLoading || (!!selectedSavedQueryId && !isEditingSavedQuery) || validationErrors.length > 0}
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
                              {col.name}
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
                              {col.name}
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
          <div className={`bg-card border-2 border-dashed border-muted-foreground/30 rounded p-4 flex flex-col flex-1 h-full relative ${isColumnSelectorExpanded ? 'hidden' : ''}`}>
            {isLoading && (
              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
                  <div className="text-sm font-medium text-muted-foreground">Loading query results...</div>
                  {/* {processingTime === 'longer' && (
                <div className="text-xs text-muted-foreground/70">Thinking longer for more accurate results</div>
              )} */}
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
                      initialFilterColumns={{}}
                      onFilterColumnsChange={() => {}} // No-op for main query panel
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
              <div className="h-full flex items-center justify-center text-muted-foreground  p-8">
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
        <div className={`flex-shrink-0 p-4 border-t bg-card flex flex-row items-center justify-between gap-2 ${isColumnSelectorExpanded ? 'hidden' : ''}`}>

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
