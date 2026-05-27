"use client"

import { useState, useMemo } from "react"
import { Header } from "@/components/dashboard/header"
import { ForecastChart } from "@/components/dashboard/forecast-chart"
import { ProductSelector } from "@/components/dashboard/product-selector"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Download, RefreshCw } from "lucide-react"
import {
  products,
  getForecastChartData,
  getSalesByProduct,
  getForecastsByProduct,
  getInventoryByProduct,
  CATEGORY_LABELS,
} from "@/lib/mock-data"
import type { Product } from "@/types"

type DateRange = "7d" | "30d" | "90d"

export default function ForecastPage() {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(products[0])
  const [dateRange, setDateRange] = useState<DateRange>("30d")

  const historicalDays = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90
  const forecastDays = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90

  // Get chart data for selected product
  const chartData = useMemo(() => {
    if (!selectedProduct) return []
    return getForecastChartData(selectedProduct.id, historicalDays, forecastDays)
  }, [selectedProduct, historicalDays, forecastDays])

  // Get metrics for selected product
  const metrics = useMemo(() => {
    if (!selectedProduct) return null

    const sales = getSalesByProduct(selectedProduct.id, historicalDays)
    const forecasts = getForecastsByProduct(selectedProduct.id, forecastDays)
    const inventory = getInventoryByProduct(selectedProduct.id)

    const totalSales = sales.reduce((sum, s) => sum + s.quantity, 0)
    const avgDaily = totalSales / historicalDays
    const totalForecast = forecasts.reduce((sum, f) => sum + f.forecastQty, 0)
    const avgForecastDaily = totalForecast / forecastDays

    const daysOfStock = inventory ? inventory.availableQty / Math.max(avgDaily, 0.1) : 0

    return {
      totalSales,
      avgDaily: avgDaily.toFixed(1),
      totalForecast: totalForecast.toFixed(0),
      avgForecastDaily: avgForecastDaily.toFixed(1),
      currentStock: inventory?.availableQty || 0,
      reorderPoint: inventory?.reorderPoint || 0,
      daysOfStock: daysOfStock.toFixed(0),
      forecastMethod: forecasts[0]?.method || "ml_ensemble",
    }
  }, [selectedProduct, historicalDays, forecastDays])

  // Get comparison table data
  const comparisonData = useMemo(() => {
    if (!selectedProduct) return []

    const sales = getSalesByProduct(selectedProduct.id, historicalDays)
    const forecasts = getForecastsByProduct(selectedProduct.id, forecastDays)

    // Group by week for comparison
    const weeks: { week: string; actual: number; forecast: number; variance: number }[] = []

    // Historical weeks
    for (let i = 0; i < Math.min(4, Math.floor(historicalDays / 7)); i++) {
      const weekSales = sales.filter((s) => {
        const daysAgo = Math.floor((Date.now() - s.date.getTime()) / (1000 * 60 * 60 * 24))
        return daysAgo >= i * 7 && daysAgo < (i + 1) * 7
      })
      const actual = weekSales.reduce((sum, s) => sum + s.quantity, 0)
      weeks.push({
        week: `Tuần -${i + 1}`,
        actual,
        forecast: actual, // For historical, forecast = actual
        variance: 0,
      })
    }

    // Forecast weeks
    for (let i = 0; i < Math.min(4, Math.floor(forecastDays / 7)); i++) {
      const weekForecasts = forecasts.filter((f) => {
        const daysAhead = Math.floor((f.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        return daysAhead >= i * 7 && daysAhead < (i + 1) * 7
      })
      const forecast = weekForecasts.reduce((sum, f) => sum + f.forecastQty, 0)
      weeks.push({
        week: `Tuần +${i + 1}`,
        actual: 0,
        forecast: Math.round(forecast),
        variance: 0,
      })
    }

    return weeks.reverse()
  }, [selectedProduct, historicalDays, forecastDays])

  return (
    <div className="flex flex-col">
      <Header
        title="Dự báo nhu cầu"
        description="Phân tích xu hướng và dự báo nhu cầu sản phẩm"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Controls */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <ProductSelector
            products={products.filter((p) => p.status === "active")}
            selectedProduct={selectedProduct}
            onSelect={setSelectedProduct}
          />

          <div className="flex items-center gap-3">
            <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <TabsList>
                <TabsTrigger value="7d">7 ngày</TabsTrigger>
                <TabsTrigger value="30d">30 ngày</TabsTrigger>
                <TabsTrigger value="90d">90 ngày</TabsTrigger>
              </TabsList>
            </Tabs>

            <Button variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Xuất CSV
            </Button>
          </div>
        </div>

        {selectedProduct && metrics && (
          <>
            {/* Product Info */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedProduct.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {selectedProduct.sku} | {CATEGORY_LABELS[selectedProduct.category]} | {selectedProduct.brand}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{selectedProduct.status === "active" ? "Đang bán" : selectedProduct.status}</Badge>
                </div>
              </CardHeader>
            </Card>

            {/* Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Doanh số {historicalDays} ngày</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.totalSales}</div>
                  <p className="text-xs text-muted-foreground">
                    Trung bình {metrics.avgDaily} đơn vị/ngày
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Dự báo {forecastDays} ngày tới</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.totalForecast}</div>
                  <p className="text-xs text-muted-foreground">
                    Trung bình {metrics.avgForecastDaily} đơn vị/ngày
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Tồn kho hiện tại</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics.currentStock}</div>
                  <p className="text-xs text-muted-foreground">
                    Đủ cho {metrics.daysOfStock} ngày | Điểm đặt hàng: {metrics.reorderPoint}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Phương pháp dự báo</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold uppercase">{metrics.forecastMethod}</div>
                  <p className="text-xs text-muted-foreground">
                    Độ chính xác: 92.5%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Forecast Chart */}
            <ForecastChart data={chartData} productName={selectedProduct.name} />

            {/* Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle>So sánh theo tuần</CardTitle>
                <CardDescription>Dữ liệu thực tế vs dự báo</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Thời gian</TableHead>
                      <TableHead className="text-right">Thực tế</TableHead>
                      <TableHead className="text-right">Dự báo</TableHead>
                      <TableHead className="text-right">Chênh lệch</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonData.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{row.week}</TableCell>
                        <TableCell className="text-right">
                          {row.actual > 0 ? row.actual : "-"}
                        </TableCell>
                        <TableCell className="text-right">{row.forecast}</TableCell>
                        <TableCell className="text-right">
                          {row.actual > 0 ? (
                            <span
                              className={
                                row.forecast - row.actual > 0
                                  ? "text-emerald-600"
                                  : row.forecast - row.actual < 0
                                  ? "text-red-600"
                                  : ""
                              }
                            >
                              {row.forecast - row.actual > 0 ? "+" : ""}
                              {row.forecast - row.actual}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
