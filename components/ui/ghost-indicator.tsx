"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface GhostIndicatorProps {
  message: string
  isVisible: boolean
  className?: string
}

export function GhostIndicator({ message, isVisible, className }: GhostIndicatorProps) {
  if (!isVisible) return null

  return (
    <div
      className={cn(
        "fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] flex flex-col items-center justify-center px-6 py-4 bg-green-800/90 border border-green-600/50 rounded-lg shadow-lg transition-all duration-300 ease-in-out",
        "animate-in slide-in-from-top-2 fade-in-0",
        className
      )}
    >
      <div className="flex flex-col items-center space-y-2">
        <div className="p-2 bg-green-600/30 rounded-full">
          <Check className="h-5 w-5 text-green-300" />
        </div>
        <span className="text-sm font-medium text-gray-200 text-center">
          {message}
        </span>
      </div>
    </div>
  )
}
