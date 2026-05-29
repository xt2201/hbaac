"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ForecastChartData } from "@/types"

const ACTUAL_COLOR = "#0f766e"
const FORECAST_COLOR = "#2563eb"
const CONFIDENCE_COLOR = "#60a5fa"

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
          {productName} - Dữ liệu lịch sử và dự báo theo kỳ đã chọn
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ACTUAL_COLOR} stopOpacity={0.32} />
                  <stop offset="95%" stopColor={ACTUAL_COLOR} stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={FORECAST_COLOR} stopOpacity={0.38} />
                  <stop offset="95%" stopColor={FORECAST_COLOR} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CONFIDENCE_COLOR} stopOpacity={0.24} />
                  <stop offset="95%" stopColor={CONFIDENCE_COLOR} stopOpacity={0.08} />
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
                              Dải tham chiếu ±20%: {payload[0]?.payload?.confidenceLower} - {payload[0]?.payload?.confidenceUpper}
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
                    confidenceUpper: "Dải tham chiếu (trên)",
                    confidenceLower: "Dải tham chiếu (dưới)",
                    actualArea: "",
                    forecastArea: "",
                  }
                  return labels[value] || value
                }}
              />
              {/* Reference scenario band */}
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
              <Area
                type="monotone"
                dataKey="actual"
                stroke="transparent"
                fill="url(#colorActual)"
                fillOpacity={1}
                name="actualArea"
                connectNulls={false}
                legendType="none"
              />
              <Area
                type="monotone"
                dataKey="forecast"
                stroke="transparent"
                fill="url(#colorForecast)"
                fillOpacity={1}
                name="forecastArea"
                connectNulls={false}
                legendType="none"
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke={ACTUAL_COLOR}
                strokeWidth={3}
                dot={false}
                name="actual"
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                stroke={FORECAST_COLOR}
                strokeWidth={3}
                dot={false}
                name="forecast"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Legend explanation */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-6 bg-[#0f766e]" />
            <span className="text-muted-foreground">Dữ liệu thực tế</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-0.5 w-6 bg-[#2563eb]" />
            <span className="text-muted-foreground">Dự báo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-6 rounded bg-[#60a5fa]/25" />
            <span className="text-muted-foreground">Dải tham chiếu ±20%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
