"use client"

import { useState } from "react"
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

interface ShareLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dashboardState?: any // This would contain the actual dashboard state in a real implementation
}

export function ShareLinkDialog({ open, onOpenChange, dashboardState }: ShareLinkDialogProps) {
  const [copied, setCopied] = useState(false)

  // In a real implementation, this would be a unique URL that encodes the dashboard state
  // For now, we'll use a sample URL
  const shareableLink = "https://dashboard-tool.vercel.app/share/d123456789"

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
        <div className="flex items-center space-x-2 mt-2">
          <div className="grid flex-1 gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link className="h-4 w-4" />
              <span>Dashboard link</span>
            </div>
            <Input readOnly value={shareableLink} className="font-mono text-sm" />
          </div>
          <Button size="icon" onClick={copyToClipboard} className="flex-shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span className="sr-only">Copy link</span>
          </Button>
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
