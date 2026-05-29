"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useState, useMemo, useEffect, useCallback } from "react"
import { Header } from "@/components/dashboard/header"
import { ForecastChart } from "@/components/dashboard/forecast-chart"
import { ProductSelector } from "@/components/dashboard/product-selector"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  Package,
  Sparkles,
  WalletCards,
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
  "date-derived": "Theo lịch vận hành",
  factual_external_calendar: "Lịch vận hành",
  assumption: "Cơ sở tính toán",
}

function formatCurrency(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString("vi-VN")
}

type AIRecommendation = {
  recommendation: string
}

function ForecastPageContent() {
  const searchParams = useSearchParams()
  const productIdParam = searchParams.get("productId")
  const initialProduct = useMemo(
    () => products.find((product) => product.id === productIdParam) ?? products[0],
    [productIdParam]
  )
  const [viewMode, setViewMode] = useState<ViewMode>(productIdParam ? "manual" : "manual")
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(initialProduct)
  const [dateRange, setDateRange] = useState<DateRange>("28d")
  const [aiRecommendation, setAiRecommendation] = useState<AIRecommendation | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(false)

  const historicalDays = dateRange === "7d" ? 7 : dateRange === "28d" ? 28 : 56
  const forecastDays = dateRange === "7d" ? 7 : dateRange === "28d" ? 28 : 56

  useEffect(() => {
    if (!productIdParam) return
    const product = products.find((p) => p.id === productIdParam)
    if (product) {
      setSelectedProduct(product)
      setViewMode("manual")
    }
  }, [productIdParam])

  // High-impact SKUs: source-data policy rows sorted by forecast profit impact.
  const highImpactSkus = useMemo(() => {
    const stockoutAlerts = stockAlerts
      .filter((a) => a.type === "stockout_risk")
      .sort((a, b) => b.estimatedImpact - a.estimatedImpact)
      .slice(0, 15)

    return stockoutAlerts
      .map((alert) => {
        const product = getProductById(alert.productId)
        if (!product) return null
        const inventory = getInventoryByProduct(alert.productId)
        const suggestion = replenishmentSuggestions.find((s) => s.productId === alert.productId)
        const forecasts = getForecastsByProduct(alert.productId, forecastDays)
        const totalForecast = forecasts.reduce((s, f) => s + f.forecastQty, 0)
        const margin = product.unitPrice - product.unitCost
        const recommendedQty = suggestion?.suggestedQty ?? Math.ceil(inventory?.recommendedOrderTarget ?? 0)
        const profitImpact = Math.round(Math.min(Math.max(0, totalForecast), recommendedQty) * margin)

        return {
          product,
          recommendedQty,
          totalForecast: Math.round(totalForecast),
          cycleTimeDays: suggestion?.cycleTimeDays ?? null,
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

    const reorderPoint = inventory?.reorderPoint ?? 0

    const margin = selectedProduct.unitPrice - selectedProduct.unitCost
    const recommendedQty =
      suggestion?.suggestedQty ??
      Math.ceil(inventory?.recommendedOrderTarget ?? totalForecast)
    const profitImpact = Math.round(Math.min(Math.max(0, totalForecast), Math.max(0, recommendedQty)) * margin)

    return {
      totalSales,
      avgDaily,
      totalForecast: Math.round(totalForecast),
      avgForecastDaily,
      reorderPoint,
      safetyStock: inventory?.safetyStock ?? 0,
      economicOrderQty: inventory?.economicOrderQty ?? 0,
      cycleTimeDays: suggestion?.cycleTimeDays ?? null,
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
          },
          forecast: {
            days: forecastDays,
            totalForecastQty: recommendation.totalForecast,
            avgDailyDemand: recommendation.avgForecastDaily,
            method: recommendation.forecastMethod,
          },
          inventoryPolicy: {
            reorderPoint: recommendation.reorderPoint,
            recommendedOrder: recommendation.recommendedQty,
            safetyStock: recommendation.safetyStock,
            economicOrderQty: recommendation.economicOrderQty,
            cycleTimeDays: recommendation.cycleTimeDays,
          },
          financial: {
            protectedProfit: recommendation.profitImpact,
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
        description="Theo dõi nhu cầu, chính sách tồn kho và khuyến nghị đặt hàng theo SKU"
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
                <TabsTrigger value="high-impact">Mã hàng tác động cao</TabsTrigger>
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
                Mã hàng có tác động lợi nhuận cao nhất
              </CardTitle>
              <CardDescription>
                Sắp xếp theo lợi nhuận có nguy cơ mất nếu không đặt hàng kịp. Nhấn vào một dòng để xem chi tiết dự báo và khuyến nghị phân tích.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã hàng</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="text-right">Lượng mua đề xuất</TableHead>
                      <TableHead className="text-right">Dự báo {forecastDays} ngày</TableHead>
                      <TableHead className="text-right">Thời gian chu kỳ</TableHead>
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
                        <TableCell>Theo kế hoạch tồn kho</TableCell>
                        <TableCell className="text-right">{item.recommendedQty}</TableCell>
                        <TableCell className="text-right">{item.totalForecast}</TableCell>
                        <TableCell className="text-right">
                          {item.cycleTimeDays ? `${Math.round(item.cycleTimeDays)} ngày` : "Chưa ước tính"}
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
            <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle>{selectedProduct.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {selectedProduct.sku} · kế hoạch theo nhu cầu dự báo và tồn kho mục tiêu
                        </CardDescription>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Badge variant="outline">Dữ liệu bán hàng</Badge>
                          <Badge variant="outline">Dự báo nhu cầu {forecastDays} ngày</Badge>
                          <Badge variant="outline">Lịch vận hành {HBAAC_CALENDAR_SUMMARY.rowCount} ngày</Badge>
                          <Badge variant="outline">Chính sách tồn kho</Badge>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {selectedProduct.status === "active" ? "Đang bán" : selectedProduct.status}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>

                <ForecastChart data={chartData} productName={selectedProduct.name} />
              </div>

              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    Dự báo thành hành động
                  </CardTitle>
                  <CardDescription>Khuyến nghị phân tích và chỉ số hành động cho SKU đang xem.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Trạng thái</p>
                    <p className="text-xl font-bold text-blue-700">Khuyến nghị đặt hàng</p>
                    <p className="text-xs text-muted-foreground">
                      Dựa trên dự báo nhu cầu và kế hoạch tồn kho hiện tại.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border bg-background p-3">
                      <p className="text-xs text-muted-foreground">Dự báo</p>
                      <p className="text-lg font-bold">{recommendation.totalForecast}</p>
                      <p className="text-xs text-muted-foreground">{forecastDays} ngày</p>
                    </div>
                    <div className="rounded-md border bg-background p-3">
                      <p className="text-xs text-muted-foreground">Điểm đặt hàng lại</p>
                      <p className="text-lg font-bold">{recommendation.reorderPoint}</p>
                      <p className="text-xs text-muted-foreground">Theo chính sách tồn kho</p>
                    </div>
                    <div className="rounded-md border bg-background p-3">
                      <p className="text-xs text-muted-foreground">Lượng mua đề xuất</p>
                      <p className="text-lg font-bold">{recommendation.recommendedQty}</p>
                      <p className="text-xs text-muted-foreground">Theo kế hoạch đặt hàng</p>
                    </div>
                    <div className="rounded-md border bg-background p-3">
                      <p className="text-xs text-muted-foreground">LN bảo vệ</p>
                      <p className="text-lg font-bold text-emerald-600">
                        {formatCurrency(recommendation.profitImpact)}đ
                      </p>
                      <p className="text-xs text-muted-foreground">Ước tính vận hành</p>
                    </div>
                  </div>

                  <div className="rounded-md border bg-background p-3">
                    {aiLoading && !aiRecommendation && (
                      <div className="space-y-2">
                        {[0, 1, 2, 3, 4].map((line) => (
                          <div key={line} className="h-3 animate-pulse rounded bg-blue-100" />
                        ))}
                      </div>
                    )}
                    {aiRecommendation && (
                      <p className="text-sm leading-relaxed whitespace-pre-line">
                        {aiRecommendation.recommendation}
                      </p>
                    )}
                    {aiError && (
                      <p className="text-sm text-amber-700">
                        Khuyến nghị chưa sẵn sàng; dùng chỉ số hiện có để ra quyết định.
                      </p>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <Button asChild>
                      <Link href={`/dashboard/replenishment?productId=${selectedProduct.id}`}>
                        <WalletCards className="mr-2 h-4 w-4" />
                        Mô phỏng mua hàng
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={`/analytics-bot?prompt=${encodeURIComponent(`Giải thích vì sao ${selectedProduct.sku} cần đặt hàng ngay trong 5 gạch đầu dòng, gồm rủi ro vận hành, tác động tài chính, tín hiệu dự báo, hành động đề xuất và điểm cần theo dõi.`)}`}>
                        Hỏi trợ lý
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link href={`/dashboard/decision-queue?productId=${selectedProduct.id}`}>Mở hàng chờ</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Evidence tabs */}
            <Tabs defaultValue="drivers">
              <TabsList>
                <TabsTrigger value="drivers">Yếu tố ảnh hưởng</TabsTrigger>
                <TabsTrigger value="data">Dữ liệu</TabsTrigger>
                <TabsTrigger value="ai">Giải thích khuyến nghị</TabsTrigger>
              </TabsList>

              <TabsContent value="drivers" className="mt-4">
                {driverSummary && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <CalendarDays className="h-4 w-4 text-blue-600" />
                        Yếu tố ảnh hưởng nhu cầu
                      </CardTitle>
                      <CardDescription>
                        {driverSummary.windowStartDate} → {driverSummary.windowEndDate} · Đỉnh {driverSummary.peakForecastQty.toFixed(1)} ngày {driverSummary.peakForecastDate}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {visibleDrivers.length > 0 ? (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Ngày</TableHead>
                                <TableHead>Yếu tố</TableHead>
                                <TableHead>Cơ sở</TableHead>
                                <TableHead className="text-right">Mức tăng</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {visibleDrivers.slice(0, 5).map((driver) => (
                                <TableRow key={`${driver.date}-${driver.type}-${driver.label}`}>
                                  <TableCell>{driver.date}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{driver.label}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {DRIVER_TYPE_LABELS[driver.type]}
                                      </Badge>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {DRIVER_SOURCE_LABELS[driver.source]}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <span className={driver.liftVsAveragePct >= 0 ? "text-emerald-600" : "text-red-600"}>
                                      {driver.liftVsAveragePct > 0 ? "+" : ""}{driver.liftVsAveragePct}%
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Không có yếu tố nổi bật trong cửa sổ dự báo.</p>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="data" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Cơ sở vận hành</CardTitle>
                    <CardDescription>Dữ liệu đã đồng bộ để phục vụ dự báo và khuyến nghị xử lý.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Dữ liệu bán hàng</Badge>
                      <Badge variant="outline">Dự báo nhu cầu 56 ngày</Badge>
                      <Badge variant="outline">Lịch vận hành</Badge>
                      <Badge variant="outline">Danh mục sản phẩm</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{DATA_LAYER_LABELS.catalog}</p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ai" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Giải thích khuyến nghị</CardTitle>
                    <CardDescription>Tối đa 5 gạch đầu dòng theo rủi ro, tài chính, tín hiệu, hành động và điểm cần theo dõi.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {aiRecommendation ? (
                      <p className="text-sm leading-relaxed whitespace-pre-line">{aiRecommendation.recommendation}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Khuyến nghị phân tích chưa sẵn sàng.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Weekly Comparison Table */}
            <Card>
              <CardHeader>
                <CardTitle>So sánh theo tuần</CardTitle>
                <CardDescription>Dữ liệu thực tế và dự báo nhu cầu theo tuần.</CardDescription>
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
              <p>Chọn một sản phẩm để xem dự báo và khuyến nghị từ hệ thống.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function ForecastPage() {
  return (
    <Suspense fallback={null}>
      <ForecastPageContent />
    </Suspense>
  )
}
