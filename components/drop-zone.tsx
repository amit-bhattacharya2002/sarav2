'use client'

import React from 'react'
import { useDrop } from 'react-dnd'
import { X } from 'lucide-react'

interface DropZoneProps {
  id: string
  onDrop: (item: any) => void
  onRemove: () => void
  children: React.ReactNode
  className?: string
  readOnlyMode?: boolean // Add this prop to control remove button visibility
}

function ReadOnlyDropZone({ id, children, className = '' }: Pick<DropZoneProps, 'id' | 'children' | 'className'>) {
  return (
    <div
      className={`
        relative border rounded-lg transition-colors overflow-hidden flex-1 flex flex-col
        border-border bg-card/60 cursor-default
        ${className}
      `}
      style={{
        minHeight: id === 'bottom' ? '120px' : '100px',
        padding: '12px',
      }}
    >
      <div className={`h-full w-full overflow-auto ${
        children ? 'flex flex-col' : 'flex items-center justify-center'
      }`}>
        {children}
      </div>
    </div>
  )
}

function EditableDropZone({ id, onDrop, onRemove, children, className = '' }: Omit<DropZoneProps, 'readOnlyMode'>) {
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
  }), [onDrop, id])

  const isActive = isOver && canDrop

  return (
    <div
      ref={drop}
      className={`
        relative border rounded-lg transition-colors overflow-hidden flex-1 flex flex-col
        ${isActive ? 'border-primary bg-primary/20' : 'border-border bg-card/60'}
        cursor-pointer
        ${className}
      `}
      style={{
        minHeight: id === 'bottom' ? '120px' : '180px',
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
      <div className={`h-full w-full overflow-auto ${
        children ? 'flex flex-col' : 'flex items-center justify-center'
      }`}>
        {children}
      </div>
    </div>
  )
}

export function DropZone({ id, onDrop, onRemove, children, className = '', readOnlyMode }: DropZoneProps) {
  if (readOnlyMode) {
    return <ReadOnlyDropZone id={id} className={className}>{children}</ReadOnlyDropZone>
  }
  
  return <EditableDropZone id={id} onDrop={onDrop} onRemove={onRemove} className={className}>{children}</EditableDropZone>
}
