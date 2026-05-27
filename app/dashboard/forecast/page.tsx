"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { Header } from "@/components/dashboard/header"
import { ForecastChart } from "@/components/dashboard/forecast-chart"
import { ProductSelector } from "@/components/dashboard/product-selector"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  AlertTriangle,
  CalendarDays,
  Info,
  Package,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import {
  products,
  getForecastChartData,
  getSalesByProduct,
  getForecastsByProduct,
  getDemandDriversForProduct,
  getInventoryByProduct,
  getProductById,
  replenishmentSuggestions,
  stockAlerts,
  HBAAC_DATASET_INFO,
  HBAAC_CALENDAR_SUMMARY,
  CATEGORY_LABELS,
  DATA_LAYER_LABELS,
} from "@/lib/project-data"
import type { Product } from "@/types"
import type { ForecastDriver, ForecastDriverType } from "@/lib/project-data"

type DateRange = "7d" | "28d" | "56d"
type ViewMode = "manual" | "high-impact"

const DRIVER_TYPE_LABELS: Record<ForecastDriverType, string> = {
  weekend: "Cuối tuần",
  month_boundary: "Đầu/cuối tháng",
  public_holiday: "Ngày lễ",
  lunar_event: "Sự kiện âm lịch",
  retail_event: "Sự kiện bán lẻ",
}

const DRIVER_SOURCE_LABELS: Record<ForecastDriver["source"], string> = {
  "date-derived": "Dữ liệu suy ra từ ngày",
  factual_external_calendar: "Lịch ngoài có nguồn",
  assumption: "Giả định",
}

function formatCurrency(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString("vi-VN")
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

type AIRecommendation = {
  recommendation: string
}

export default function ForecastPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("manual")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(products[0])
  const [dateRange, setDateRange] = useState<DateRange>("28d")
  const [aiRecommendation, setAiRecommendation] = useState<AIRecommendation | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(false)

  const historicalDays = dateRange === "7d" ? 7 : dateRange === "28d" ? 28 : 56
  const forecastDays = dateRange === "7d" ? 7 : dateRange === "28d" ? 28 : 56

  // High-impact SKUs: stockout-risk products sorted by financial impact
  const highImpactSkus = useMemo(() => {
    const stockoutAlerts = stockAlerts
      .filter((a) => a.type === "stockout_risk")
      .sort((a, b) => b.estimatedImpact - a.estimatedImpact)
      .slice(0, 15)

    return stockoutAlerts
      .map((alert) => {
        const product = getProductById(alert.productId)
        if (!product) return null
        const inv = getInventoryByProduct(alert.productId)
        const forecasts = getForecastsByProduct(alert.productId, forecastDays)
        const totalForecast = forecasts.reduce((s, f) => s + f.forecastQty, 0)
        const avgDaily = totalForecast / forecastDays
        const daysOfStock = inv ? Math.round(inv.availableQty / Math.max(avgDaily, 0.1)) : 0
        const margin = product.unitPrice - product.unitCost
        const profitImpact = Math.round(
          Math.max(0, totalForecast - (inv?.availableQty ?? 0)) * margin
        )

        return {
          product,
          currentStock: inv?.availableQty ?? 0,
          totalForecast: Math.round(totalForecast),
          daysOfStock,
          profitImpact,
          alert,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null && item.profitImpact > 0)
  }, [forecastDays])

  // Chart data for selected product
  const chartData = useMemo(() => {
    if (!selectedProduct) return []
    return getForecastChartData(selectedProduct.id, historicalDays, forecastDays)
  }, [selectedProduct, historicalDays, forecastDays])

  // Computed recommendation + metrics for selected product
  const recommendation = useMemo(() => {
    if (!selectedProduct) return null

    const sales = getSalesByProduct(selectedProduct.id, historicalDays)
    const forecasts = getForecastsByProduct(selectedProduct.id, forecastDays)
    const inventory = getInventoryByProduct(selectedProduct.id)
    const suggestion = replenishmentSuggestions.find(
      (s) => s.productId === selectedProduct.id
    )

    const totalSales = sales.reduce((sum, s) => sum + s.quantity, 0)
    const avgDaily = totalSales / historicalDays
    const totalForecast = forecasts.reduce((sum, f) => sum + f.forecastQty, 0)
    const avgForecastDaily = totalForecast / forecastDays

    const currentStock = inventory?.availableQty ?? 0
    const reorderPoint = inventory?.reorderPoint ?? 0
    const daysOfStock = Math.round(currentStock / Math.max(avgDaily, 0.1))
    const stockoutDate =
      daysOfStock > 0 && daysOfStock < 365
        ? addDays(HBAAC_DATASET_INFO.maxTrainDate, daysOfStock)
        : null

    const margin = selectedProduct.unitPrice - selectedProduct.unitCost
    const quantityAtRisk = Math.max(0, Math.ceil(totalForecast - currentStock))
    const recommendedQty =
      suggestion?.suggestedQty ??
      Math.max(
        selectedProduct.minOrderQty,
        reorderPoint - currentStock + Math.ceil(avgForecastDaily * selectedProduct.leadTimeDays)
      )
    const profitImpact = Math.round(
      Math.min(recommendedQty, Math.max(0, quantityAtRisk)) * margin
    )

    return {
      totalSales,
      avgDaily,
      totalForecast: Math.round(totalForecast),
      avgForecastDaily,
      currentStock,
      reorderPoint,
      daysOfStock,
      stockoutDate,
      recommendedQty: Math.max(0, recommendedQty),
      profitImpact: Math.max(0, profitImpact),
      forecastMethod: forecasts[0]?.method ?? "nbeats",
    }
  }, [selectedProduct, historicalDays, forecastDays])

  // Call AI recommendation API
  const fetchAIRecommendation = useCallback(async () => {
    if (!selectedProduct || !recommendation) return

    const driverSummary = getDemandDriversForProduct(selectedProduct.id, forecastDays)
    const notableEvents = driverSummary.drivers
      .filter((d) => d.type !== "weekend" || d.alignsWithSpike)
      .slice(0, 8)
      .map((d) => ({
        date: d.date,
        label: d.label,
        type: DRIVER_TYPE_LABELS[d.type],
        forecastQty: d.forecastQty,
      }))

    setAiLoading(true)
    setAiError(false)

    try {
      const res = await fetch("/api/forecast-recommendation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: {
            sku: selectedProduct.sku,
            name: selectedProduct.name,
            category: CATEGORY_LABELS[selectedProduct.category],
            brand: selectedProduct.brand,
            unitPrice: selectedProduct.unitPrice,
            unitCost: selectedProduct.unitCost,
            leadTimeDays: selectedProduct.leadTimeDays,
            minOrderQty: selectedProduct.minOrderQty,
          },
          forecast: {
            days: forecastDays,
            totalForecastQty: recommendation.totalForecast,
            avgDailyDemand: recommendation.avgForecastDaily,
            method: recommendation.forecastMethod,
          },
          inventory: {
            currentStock: recommendation.currentStock,
            reorderPoint: recommendation.reorderPoint,
            daysOfStock: recommendation.daysOfStock,
          },
          historical: {
            totalSales: recommendation.totalSales,
            avgDaily: recommendation.avgDaily,
          },
          drivers: {
            windowStartDate: driverSummary.windowStartDate,
            windowEndDate: driverSummary.windowEndDate,
            peakForecastQty: driverSummary.peakForecastQty,
            peakForecastDate: driverSummary.peakForecastDate,
            averageForecastQty: driverSummary.averageForecastQty,
            notableEvents,
          },
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.recommendation) {
          setAiRecommendation(data)
        } else {
          setAiError(true)
        }
      } else {
        setAiError(true)
      }
    } catch {
      setAiError(true)
    } finally {
      setAiLoading(false)
    }
  }, [selectedProduct, recommendation, forecastDays])

  useEffect(() => {
    setAiRecommendation(null)
    fetchAIRecommendation()
  }, [fetchAIRecommendation])

  const driverSummary = useMemo(() => {
    if (!selectedProduct) return null
    return getDemandDriversForProduct(selectedProduct.id, forecastDays)
  }, [selectedProduct, forecastDays])

  const visibleDrivers = useMemo(() => {
    if (!driverSummary) return []
    if (driverSummary.spikeAlignedDrivers.length > 0) {
      return driverSummary.spikeAlignedDrivers.slice(0, 4)
    }
    return driverSummary.drivers
      .filter((driver) => driver.type !== "weekend")
      .slice(0, 4)
  }, [driverSummary])

  // Weekly comparison table
  const comparisonData = useMemo(() => {
    if (!selectedProduct) return []

    const sales = getSalesByProduct(selectedProduct.id, historicalDays)
    const forecasts = getForecastsByProduct(selectedProduct.id, forecastDays)

    const weeks: { week: string; actual: number; forecast: number; variance: number }[] = []
    const msPerDay = 1000 * 60 * 60 * 24
    const anchorTime = new Date(`${HBAAC_DATASET_INFO.maxTrainDate}T00:00:00Z`).getTime()
    const forecastStartTime = new Date(`${HBAAC_DATASET_INFO.validationStartDate}T00:00:00Z`).getTime()

    for (let i = 0; i < Math.min(4, Math.floor(historicalDays / 7)); i++) {
      const weekSales = sales.filter((s) => {
        const daysAgo = Math.floor((anchorTime - s.date.getTime()) / msPerDay)
        return daysAgo >= i * 7 && daysAgo < (i + 1) * 7
      })
      weeks.push({
        week: `Tuần -${i + 1}`,
        actual: weekSales.reduce((sum, s) => sum + s.quantity, 0),
        forecast: 0,
        variance: 0,
      })
    }

    for (let i = 0; i < Math.min(4, Math.floor(forecastDays / 7)); i++) {
      const weekForecasts = forecasts.filter((f) => {
        const daysAhead = Math.floor((f.date.getTime() - forecastStartTime) / msPerDay)
        return daysAhead >= i * 7 && daysAhead < (i + 1) * 7
      })
      weeks.push({
        week: `Tuần +${i + 1}`,
        actual: 0,
        forecast: Math.round(weekForecasts.reduce((sum, f) => sum + f.forecastQty, 0)),
        variance: 0,
      })
    }

    return weeks.reverse()
  }, [selectedProduct, historicalDays, forecastDays])

  return (
    <div className="flex flex-col">
      <Header
        title="Dự báo nhu cầu"
        description="Từ dự báo đến hành động — AI phân tích xu hướng và khuyến nghị đặt hàng theo tác động lợi nhuận"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Controls */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <Tabs
              value={viewMode}
              onValueChange={(v) => setViewMode(v as ViewMode)}
            >
              <TabsList>
                <TabsTrigger value="manual">Chọn sản phẩm</TabsTrigger>
                <TabsTrigger value="high-impact">SKU tác động cao</TabsTrigger>
              </TabsList>
            </Tabs>
            {viewMode === "manual" && (
              <ProductSelector
                products={products.filter((p) => p.status === "active")}
                selectedProduct={selectedProduct}
                onSelect={setSelectedProduct}
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <Tabs value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <TabsList>
                <TabsTrigger value="7d">7 ngày</TabsTrigger>
                <TabsTrigger value="28d">28 ngày</TabsTrigger>
                <TabsTrigger value="56d">56 ngày</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* High-impact SKU table */}
        {viewMode === "high-impact" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                SKU có tác động lợi nhuận cao nhất
              </CardTitle>
              <CardDescription>
                Sắp xếp theo lợi nhuận có nguy cơ mất nếu không đặt hàng kịp. Nhấn vào một dòng để xem chi tiết dự báo và khuyến nghị AI.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Tên sản phẩm</TableHead>
                      <TableHead>Ngành hàng</TableHead>
                      <TableHead className="text-right">Tồn kho</TableHead>
                      <TableHead className="text-right">Dự báo {forecastDays} ngày</TableHead>
                      <TableHead className="text-right">Ngày còn</TableHead>
                      <TableHead className="text-right">Tác động LN</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {highImpactSkus.map((item) => (
                      <TableRow
                        key={item.product.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedProduct(item.product)
                          setViewMode("manual")
                        }}
                      >
                        <TableCell className="font-medium">{item.product.sku}</TableCell>
                        <TableCell>{item.product.name}</TableCell>
                        <TableCell>{CATEGORY_LABELS[item.product.category]}</TableCell>
                        <TableCell className="text-right">{item.currentStock}</TableCell>
                        <TableCell className="text-right">{item.totalForecast}</TableCell>
                        <TableCell className="text-right">
                          <span
                            className={
                              item.daysOfStock < 7
                                ? "text-red-600 font-medium"
                                : item.daysOfStock < 14
                                ? "text-amber-600"
                                : ""
                            }
                          >
                            {item.daysOfStock}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {formatCurrency(item.profitImpact)}đ
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedProduct && recommendation && (
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
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge variant="outline">Dữ liệu cuộc thi: SKU, bán hàng, dự báo</Badge>
                      <Badge variant="outline">Lịch ngoài: {HBAAC_CALENDAR_SUMMARY.rowCount} ngày</Badge>
                      <Badge variant="outline">Danh mục bổ sung</Badge>
                    </div>
                    <p className="mt-2 max-w-3xl text-xs text-muted-foreground">
                      {DATA_LAYER_LABELS.catalog}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {selectedProduct.status === "active" ? "Đang bán" : selectedProduct.status}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            {/* AI Recommendation card — above the chart per P4 */}
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-blue-600" />
                  Khuyến nghị từ AI
                  {aiLoading && (
                    <span className="text-sm font-normal text-muted-foreground">
                      đang phân tích...
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  AI phân tích dữ liệu dự báo N-BEATS {forecastDays} ngày và tồn kho hiện tại
                  {" "}(dữ liệu đến {HBAAC_DATASET_INFO.maxTrainDate}). Các chỉ số là ước tính demo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* AI recommendation text */}
                {aiLoading && !aiRecommendation && (
                  <div className="flex items-center gap-3 rounded-md border bg-background p-4">
                    <Sparkles className="h-5 w-5 animate-pulse text-blue-500" />
                    <div className="space-y-2">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-blue-100" />
                      <div className="h-4 w-1/2 animate-pulse rounded bg-blue-50" />
                      <div className="h-4 w-2/3 animate-pulse rounded bg-blue-100" />
                    </div>
                  </div>
                )}

                {aiRecommendation && (
                  <div className="rounded-md border bg-background p-4">
                    <div className="flex items-start gap-3">
                      <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
                      <div>
                        <p className="text-sm leading-relaxed whitespace-pre-line">
                          {aiRecommendation.recommendation}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {aiError && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    Không thể kết nối đến AI (kiểm tra API key). Bên dưới là chỉ số tính toán từ dữ liệu cục bộ.
                  </div>
                )}

                {/* Computed metrics grid */}
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Dự báo {forecastDays} ngày</p>
                    <p className="text-xl font-bold">{recommendation.totalForecast}</p>
                    <p className="text-xs text-muted-foreground">
                      ~{recommendation.avgForecastDaily.toFixed(1)} đơn vị/ngày
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Nhu cầu TB/ngày</p>
                    <p className="text-xl font-bold">{recommendation.avgDaily.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">
                      {historicalDays} ngày qua
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Tồn kho hiện tại</p>
                    <p className="text-xl font-bold">{recommendation.currentStock}</p>
                    <p className="text-xs text-muted-foreground">
                      Điểm đặt hàng: {recommendation.reorderPoint}
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Ngày dự kiến hết hàng</p>
                    <p className="text-xl font-bold">
                      {recommendation.stockoutDate ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {recommendation.daysOfStock > 0
                        ? `Còn ~${recommendation.daysOfStock} ngày tồn kho`
                        : "Đã hết hàng"}
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Số lượng nên đặt</p>
                    <p className="text-xl font-bold">{recommendation.recommendedQty}</p>
                    <p className="text-xs text-muted-foreground">
                      Lead time {selectedProduct.leadTimeDays} ngày | MOQ {selectedProduct.minOrderQty}
                    </p>
                  </div>
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Tác động lợi nhuận</p>
                    <p className="text-xl font-bold text-emerald-600">
                      {formatCurrency(recommendation.profitImpact)}đ
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Margin {(selectedProduct.unitPrice - selectedProduct.unitCost).toLocaleString("vi-VN")}đ/đơn vị
                    </p>
                  </div>
                </div>

                {recommendation.daysOfStock <= 14 && recommendation.daysOfStock > 0 && (
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                    <div>
                      <span className="font-medium text-red-700">Cần hành động sớm: </span>
                      <span className="text-red-600">
                        Tồn kho chỉ đủ cho {recommendation.daysOfStock} ngày. Đặt {recommendation.recommendedQty} đơn vị
                        trong vòng {Math.max(1, recommendation.daysOfStock - selectedProduct.leadTimeDays)} ngày
                        để tránh gián đoạn, bảo vệ ~{formatCurrency(recommendation.profitImpact)}đ lợi nhuận.
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Forecast Chart */}
            <ForecastChart data={chartData} productName={selectedProduct.name} />

            {/* Compact Demand Drivers */}
            {driverSummary && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarDays className="h-4 w-4 text-blue-600" />
                    Yếu tố tác động nhu cầu
                  </CardTitle>
                  <CardDescription>
                    {driverSummary.windowStartDate} → {driverSummary.windowEndDate}
                    {" · "}
                    Đỉnh dự báo: {driverSummary.peakForecastQty.toFixed(1)} ngày {driverSummary.peakForecastDate}
                    {" · "}
                    TB: {driverSummary.averageForecastQty.toFixed(1)} đơn vị/ngày
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {visibleDrivers.length > 0 ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      {visibleDrivers.map((driver) => (
                        <div
                          key={`${driver.date}-${driver.type}-${driver.label}`}
                          className="flex items-center justify-between rounded-md border p-2.5"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-medium">{driver.label}</p>
                              <Badge variant="outline" className="shrink-0 text-xs">
                                {DRIVER_TYPE_LABELS[driver.type]}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {driver.date} · {DRIVER_SOURCE_LABELS[driver.source]}
                            </p>
                          </div>
                          <div className="ml-3 shrink-0 text-right">
                            <p className="text-sm font-medium">{driver.forecastQty.toFixed(1)}</p>
                            <p
                              className={
                                driver.liftVsAveragePct >= 0
                                  ? "text-xs text-emerald-600"
                                  : "text-xs text-red-600"
                              }
                            >
                              {driver.liftVsAveragePct > 0 ? "+" : ""}
                              {driver.liftVsAveragePct}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Không có ngày lễ, sự kiện âm lịch, sự kiện bán lẻ hoặc mốc đầu/cuối tháng trong cửa sổ dự báo này.
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Info className="h-3 w-3" />
                    <span>Lịch: dữ liệu ngoài hoặc suy ra từ ngày.</span>
                    <span>Sự kiện bán lẻ &amp; danh mục: giả định demo.</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Weekly Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle>So sánh theo tuần</CardTitle>
                <CardDescription>Dữ liệu thực tế và dự báo — ước tính demo từ N-BEATS</CardDescription>
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
                        <TableCell className="text-right">
                          {row.forecast > 0 ? row.forecast : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.actual > 0 && row.forecast > 0 ? (
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

        {!selectedProduct && viewMode === "manual" && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Package className="mx-auto mb-3 h-8 w-8 opacity-40" />
              <p>Chọn một sản phẩm để xem dự báo và khuyến nghị từ AI.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
