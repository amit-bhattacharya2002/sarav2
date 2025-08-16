"use client"

import { useState, useEffect } from "react"
import { Check, Copy, Link } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { encryptDashboardId } from "@/lib/encryption"

interface ShareLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dashboardId?: number
  dashboardTitle?: string
}

export function ShareLinkDialog({ open, onOpenChange, dashboardId, dashboardTitle }: ShareLinkDialogProps) {
  const [copied, setCopied] = useState(false)
  const [shareableLink, setShareableLink] = useState("")

  // Generate encrypted shareable link using dashboard ID
  useEffect(() => {
    if (dashboardId && typeof window !== 'undefined') {
      try {
        const encryptedId = encryptDashboardId(dashboardId)
        setShareableLink(`${window.location.origin}/share/${encryptedId}`)
      } catch (error) {
        console.error('Failed to generate share URL:', error)
        setShareableLink("")
      }
    } else {
      setShareableLink("https://dashboard-tool.vercel.app/share/d123456789")
    }
  }, [dashboardId])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000) // Reset copied state after 2 seconds
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share dashboard</DialogTitle>
          <DialogDescription>
            Anyone with this link will be able to view this dashboard configuration.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Link className="h-4 w-4" />
            <span>Dashboard link</span>
          </div>
          <div className="flex items-center space-x-2">
            <Input readOnly value={shareableLink} className="font-mono text-sm flex-1" />
            <Button size="icon" onClick={copyToClipboard} className="flex-shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span className="sr-only">Copy link</span>
            </Button>
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
