'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

interface PieGraphProps {
  data: Array<{ name: string; value: number }>
  height?: number
  compact?: boolean
  legendScale?: number
}

const COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff7f50",
  "#ffbb28", "#8dd1e1", "#d0ed57", "#a4de6c"
]

export function PieGraph({ data, height = 400, compact = false, legendScale = 1 }: PieGraphProps) {
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
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={safeData}
            dataKey="value"
            nameKey="name"
            cx="45%"
            cy="50%"
            outerRadius="80%"
            fill="#8884d8"
            isAnimationActive={false}
            labelLine={false}
            label={({ cx, cy, midAngle, outerRadius, index, value }) => {
              const RADIAN = Math.PI / 180
              const radius = outerRadius + 10
              const x = cx + radius * Math.cos(-midAngle * RADIAN)
              const y = cy + radius * Math.sin(-midAngle * RADIAN)
              return (
                <text
                  x={x}
                  y={y}
                  fill={COLORS[index % COLORS.length]}
                  textAnchor={x > cx ? "start" : "end"}
                  dominantBaseline="central"
                  fontSize={compact ? 10 : 12}
                >
                  {value}
                </text>
              )
            }}
          >
            {safeData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>

          <Tooltip />

          {safeData.length <= 6 && (
            <Legend
              layout="vertical"
              verticalAlign="middle"
              align="right"
              wrapperStyle={{ fontSize: `${legendScale * 0.875}rem` }}
              formatter={(value) =>
                typeof value === 'string' && value.length > (legendScale < 1 ? 30 : 50)
                  ? `${value.slice(0, legendScale < 1 ? 30 : 50)}…`
                  : value
              }
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
