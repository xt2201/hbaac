"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ForecastChartData } from "@/types"

interface ForecastChartProps {
  data: ForecastChartData[]
  productName: string
}

export function ForecastChart({ data, productName }: ForecastChartProps) {
  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })
  }

  // Find today's index to show dividing line
  const today = new Date().toISOString().split("T")[0]
  const todayIndex = data.findIndex((d) => d.date >= today)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Biểu đồ dự báo nhu cầu</CardTitle>
        <CardDescription>
          {productName} - Dữ liệu lịch sử và dự báo 30 ngày
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const isHistorical = payload[0]?.payload?.actual !== null
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-md">
                        <p className="mb-2 font-medium">
                          {new Date(label).toLocaleDateString("vi-VN", {
                            weekday: "short",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })}
                        </p>
                        {isHistorical ? (
                          <p className="text-sm">
                            <span className="text-muted-foreground">Thực tế: </span>
                            <span className="font-medium">{payload[0]?.payload?.actual} đơn vị</span>
                          </p>
                        ) : (
                          <>
                            <p className="text-sm">
                              <span className="text-muted-foreground">Dự báo: </span>
                              <span className="font-medium">{payload[0]?.payload?.forecast} đơn vị</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Khoảng tin cậy: {payload[0]?.payload?.confidenceLower} - {payload[0]?.payload?.confidenceUpper}
                            </p>
                          </>
                        )}
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    actual: "Thực tế",
                    forecast: "Dự báo",
                    confidenceUpper: "Khoảng tin cậy (trên)",
                    confidenceLower: "Khoảng tin cậy (dưới)",
                  }
                  return labels[value] || value
                }}
              />
              {/* Confidence interval area */}
              <Area
                type="monotone"
                dataKey="confidenceUpper"
                stroke="transparent"
                fill="url(#colorConfidence)"
                fillOpacity={1}
                name="confidenceUpper"
              />
              <Area
                type="monotone"
                dataKey="confidenceLower"
                stroke="transparent"
                fill="transparent"
                name="confidenceLower"
              />
              {/* Actual sales line */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={false}
                name="actual"
                connectNulls={false}
              />
              {/* Forecast line */}
              <Line
                type="monotone"
                dataKey="forecast"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="forecast"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend explanation */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-6 bg-[hsl(var(--chart-1))]" />
            <span className="text-muted-foreground">Dữ liệu thực tế</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-6 border-t-2 border-dashed border-[hsl(var(--chart-2))]" />
            <span className="text-muted-foreground">Dự báo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-6 rounded bg-[hsl(var(--chart-2))]/10" />
            <span className="text-muted-foreground">Khoảng tin cậy 95%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
