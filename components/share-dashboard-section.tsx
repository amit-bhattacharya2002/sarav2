'use client'

import { useState, useEffect } from 'react'
import { Copy, Share, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { encryptDashboardId } from '@/lib/encryption'

interface ShareDashboardSectionProps {
  dashboardId: number
  dashboardTitle: string
  readOnlyMode?: boolean
}

export function ShareDashboardSection({ dashboardId, dashboardTitle, readOnlyMode = false }: ShareDashboardSectionProps) {
  const [copied, setCopied] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true) // Start collapsed by default
  const [shareUrl, setShareUrl] = useState('')

  // Set shareUrl after component mounts on client side to avoid SSR issues
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const encryptedId = encryptDashboardId(dashboardId)
        setShareUrl(`${window.location.origin}/share/${encryptedId}`)
      } catch (error) {
        console.error('Failed to generate share URL:', error)
        setShareUrl('')
      }
    }
  }, [dashboardId])

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: dashboardTitle,
          text: `Check out this dashboard: ${dashboardTitle}`,
          url: shareUrl,
        })
      } catch (err) {
        console.error('Failed to share:', err)
        // Fallback to copy
        handleCopyLink()
      }
    } else {
      // Fallback to copy for browsers that don't support Web Share API
      handleCopyLink()
    }
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10 border-t bg-card shadow-lg">
      {/* Header with toggle button */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
      >
        <h3 className="text-sm font-mono font-semibold text-foreground">Share Dashboard</h3>
        {isCollapsed ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* Collapsible content - show in both read-only and edit mode */}
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isCollapsed ? 'max-h-0' : 'max-h-32'
        }`}
      >
        <div className="px-4 pb-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={shareUrl}
              readOnly
              className="flex-1 px-3 py-2 text-sm bg-muted border border-border rounded-md font-mono text-muted-foreground"
            />
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLink}
              className="flex items-center gap-2"
              disabled={!shareUrl} // Disable until shareUrl is set
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="flex items-center gap-2"
              disabled={!shareUrl} // Disable until shareUrl is set
            >
              <Share className="h-4 w-4" />
              Share
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            Anyone with this link can view the dashboard in read-only mode.
          </p>
        </div>
      </div>
    </div>
  )
} 