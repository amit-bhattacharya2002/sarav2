"use client"

import type React from "react"

import { useRef } from "react"
import { useDrag } from "react-dnd"

interface DraggableItemProps {
  id: string
  type: string
  metadata?: any
  children: React.ReactNode
}

export function DraggableItem({ id, type, metadata = {}, children }: DraggableItemProps) {
  const ref = useRef<HTMLDivElement>(null)

  const [{ isDragging }, drag] = useDrag(() => ({
    type,
    item: () => {
      // Create a complete item object with all necessary data
      const item = {
        id,
        ...metadata,
        // Ensure the visualization type is explicitly set
        type: metadata.type || "unknown",
      }
      console.log("Dragging item:", item) // Debug log
      return item
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }))

  drag(ref)

  return (
    <div
      ref={ref}
      className={`${isDragging ? "opacity-50" : "opacity-100"} transition-opacity h-full flex flex-col`}
      data-graph-id={id}
      data-visualization-type={metadata.type || "unknown"}
    >
      {children}
    </div>
  )
}
