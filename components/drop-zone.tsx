'use client'

import type React from 'react'
import { useDrop } from 'react-dnd'
import { X } from 'lucide-react'

interface DropZoneProps {
  id: string
  onDrop: (item: any) => void
  onRemove: () => void
  children: React.ReactNode
  className?: string
}

export function DropZone({ id, onDrop, onRemove, children, className = '' }: DropZoneProps) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'visualization', // ✅ MUST match TableView's drag type
    drop: (item) => {
      console.log('🔽 Dropping item into zone:', item)
      onDrop(item)
      return { id }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }))

  const isActive = isOver && canDrop

  return (
    <div
      ref={drop}
      className={`
        relative border rounded-lg transition-colors overflow-hidden flex-1 flex flex-col
        ${isActive ? 'border-primary bg-primary/20' : 'border-border bg-card/60'}
        ${className}
      `}
      style={{
        minHeight: id === 'bottom' ? '220px' : '180px',
        padding: '12px',
      }}
    >
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 p-1 rounded-full hover:bg-muted z-10"
        aria-label="Remove visualization"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="h-full w-full flex items-center justify-center overflow-hidden">{children}</div>
    </div>
  )
}
