'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface PieGraphProps {
  data: Array<{ name: string; value: number }>
  compact?: boolean
  legendScale?: number
}

const COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7f50",
  "#ffbb28", "#8dd1e1", "#d0ed57", "#a4de6c"
]

// Helper function to format numbers with commas and no decimals
const formatNumber = (value: number): string => {
  const rounded = Math.round(value)
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function PieGraph({ data, compact = false, legendScale = 1 }: PieGraphProps) {
  // Debug: Log the data being passed to PieGraph
  console.log("🔍 PieGraph received data:", data);
  
  const safeData = Array.isArray(data)
    ? data.filter(
        d =>
          d &&
          typeof d.name === 'string' &&
          typeof d.value === 'number' &&
          !isNaN(d.value)
      )
    : []

  console.log("🔍 PieGraph safeData:", safeData);

  if (safeData.length === 0) {
    console.log("❌ PieGraph: No valid data, not rendering");
    if (process.env.NODE_ENV === "development") {
      console.warn("⚠️ PieGraph received invalid or empty data:", data)
    }
    return null // Do not render anything
  }

  return (
    <div className="w-full h-full flex flex-row">
      {/* Chart Area - takes up 60% of width */}
      <div className="flex-1 min-h-0" style={{ width: '60%' }}>
        <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={safeData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius="80%"
            fill="#8884d8"
            isAnimationActive={false}
            labelLine={false}
            label={({ cx, cy, midAngle, outerRadius, index, value, name }) => {
              const RADIAN = Math.PI / 180
              const radius = outerRadius + 10
              const x = cx + radius * Math.cos(-midAngle * RADIAN)
              const y = cy + radius * Math.sin(-midAngle * RADIAN)
              
              // Format the value: round to nearest integer and add commas
              const formattedValue = formatNumber(value)
              
              // Truncate long names to prevent overlap
              const truncatedName = name && name.length > 15 ? `${name.slice(0, 15)}...` : name
              
              return (
                <text
                  x={x}
                  y={y}
                  fill={COLORS[index % COLORS.length]}
                  textAnchor={x > cx ? "start" : "end"}
                  dominantBaseline="central"
                  fontSize={compact ? 10 : 12}
                >
                  {truncatedName} ({formattedValue})
                </text>
              )
            }}
          >
            {safeData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>

          <Tooltip 
            formatter={(value: any) => {
              // Format the value: round to nearest integer and add commas
              return [formatNumber(value), 'Value']
            }}
          />
        </PieChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend Area - takes up 40% of width with proper margins */}
      <div className="flex flex-col justify-center" style={{ width: '40%', paddingLeft: '16px', paddingRight: '8px' }}>
        <div className="space-y-2">
          {safeData.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span 
                className="text-sm text-foreground truncate"
                style={{ fontSize: `${legendScale * 0.875}rem` }}
                title={item.name}
              >
                {item.name}
              </span>
              <span 
                className="text-sm text-muted-foreground ml-auto flex-shrink-0"
                style={{ fontSize: `${legendScale * 0.875}rem` }}
              >
                {formatNumber(item.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
