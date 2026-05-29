"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState, useMemo } from "react"
import { Header } from "@/components/dashboard/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  Wallet,
} from "lucide-react"
import {
  replenishmentSuggestions,
  products,
  CATEGORIES,
  CATEGORY_LABELS,
} from "@/lib/project-data"
import type { ProductCategory, ReplenishmentSuggestion } from "@/types"

type Priority = "all" | "urgent" | "high" | "medium" | "low"
type SortField = "roi" | "profitSaved" | "purchaseCost" | "daysUntilStockout" | "grossMargin" | "priority"
type SortDir = "asc" | "desc"

function formatCurrency(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString("vi-VN")
}

function fullCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value)
}

const ANNUAL_HOLDING_RATE = 0.22
const PLANNING_HORIZON = 56
const INITIAL_VISIBLE_COUNT = 50
const LOAD_MORE_COUNT = 50
const productById = new Map(products.map((product) => [product.id, product]))

type EnrichedSuggestion = ReplenishmentSuggestion & {
  grossMargin: number
  grossMarginPct: number
  dailyDemand: number
  daysUntilStockout: number
  lostSalesRiskQty: number
  lostSalesRiskValue: number
  holdingCost: number
  expectedProfitSaved: number
  roi: number
}

function enrichSuggestion(s: ReplenishmentSuggestion): EnrichedSuggestion {
  const product = productById.get(s.productId)
    const totalForecast = Math.max(0, Math.round((s.demand28 ?? 0) * (PLANNING_HORIZON / 28)))

  const unitPrice = product?.unitPrice ?? 100_000
  const unitCost = s.unitCost ?? product?.unitCost ?? 65_000
  const grossMargin = s.grossMarginPerUnit ?? Math.max(1, unitPrice - unitCost)
  const grossMarginPct = Math.round((grossMargin / Math.max(1, unitPrice)) * 100)
  const dailyDemand = Math.max(0.05, totalForecast / PLANNING_HORIZON)
  const daysUntilStockout = Math.round(s.cycleTimeDays ?? 0)
  const lostSalesRiskQty = Math.max(0, Math.ceil(totalForecast))
  const lostSalesRiskValue = Math.round(lostSalesRiskQty * grossMargin)
  const holdingCost = 0
  const protectedQty = Math.min(s.purchaseQty ?? s.suggestedQty, Math.max(0, Math.ceil(totalForecast)))
  const expectedProfitSaved = s.expectedProfitSaved ?? Math.round(protectedQty * grossMargin)
  const roi = s.roi ?? (s.estimatedCost > 0 ? Math.round((expectedProfitSaved / s.estimatedCost) * 100) : 0)

  return {
    ...s,
    grossMargin,
    grossMarginPct,
    dailyDemand,
    daysUntilStockout,
    lostSalesRiskQty,
    lostSalesRiskValue,
    holdingCost,
    expectedProfitSaved,
    roi,
  }
}

const enrichedCache = new Map<string, EnrichedSuggestion>()

function getEnriched(s: ReplenishmentSuggestion): EnrichedSuggestion {
  if (!enrichedCache.has(s.id)) {
    enrichedCache.set(s.id, enrichSuggestion(s))
  }
  return enrichedCache.get(s.id)!
}

const PRIORITY_RANK: Record<ReplenishmentSuggestion["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const PRIORITY_LABELS: Record<ReplenishmentSuggestion["priority"], string> = {
  urgent: "Khẩn cấp",
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
}

const APPROVED_DECISION_STORAGE_KEY = "hbaac-approved-decision-ids"

function readApprovedDecisionIds() {
  if (typeof window === "undefined") return new Set<string>()
  try {
    const parsed = JSON.parse(window.localStorage.getItem(APPROVED_DECISION_STORAGE_KEY) ?? "[]")
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [])
  } catch {
    return new Set<string>()
  }
}

function ReplenishmentPageContent() {
  const searchParams = useSearchParams()
  const focusedProductId = searchParams.get("productId")
  const [selectedPriority, setSelectedPriority] = useState<Priority>("all")
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | "all">("all")
  const [approvedIds, setApprovedIds] = useState<Set<string>>(() => readApprovedDecisionIds())
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [lastApproved, setLastApproved] = useState<ReplenishmentSuggestion | null>(null)
  const [sortField, setSortField] = useState<SortField>("roi")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [budget, setBudget] = useState<number | null>(null)
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT)

  const allSuggestions = replenishmentSuggestions

  useEffect(() => {
    window.localStorage.setItem(APPROVED_DECISION_STORAGE_KEY, JSON.stringify([...approvedIds]))
  }, [approvedIds])

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT)
  }, [selectedPriority, selectedCategory, sortField, sortDir, focusedProductId])

  // Filter suggestions
  const filteredSuggestions = useMemo(() => {
    return allSuggestions
      .filter((s) => {
        if (approvedIds.has(s.id) || skippedIds.has(s.id)) return false
        if (selectedPriority !== "all" && s.priority !== selectedPriority) return false
        if (selectedCategory !== "all" && s.category !== selectedCategory) return false
        return true
      })
      .map(getEnriched)
      .sort((a, b) => {
        if (a.productId === focusedProductId) return -1
        if (b.productId === focusedProductId) return 1
        return 0
      })
  }, [selectedPriority, selectedCategory, approvedIds, skippedIds, focusedProductId])

  // Sort
  const sortedSuggestions = useMemo(() => {
    const sorted = [...filteredSuggestions]
    sorted.sort((a, b) => {
      let cmp = 0
      if (a.productId === focusedProductId) return -1
      if (b.productId === focusedProductId) return 1
      switch (sortField) {
        case "roi":
          cmp = b.roi - a.roi
          break
        case "profitSaved":
          cmp = b.expectedProfitSaved - a.expectedProfitSaved
          break
        case "purchaseCost":
          cmp = b.estimatedCost - a.estimatedCost
          break
        case "daysUntilStockout":
          cmp = a.daysUntilStockout - b.daysUntilStockout
          break
        case "grossMargin":
          cmp = b.grossMargin - a.grossMargin
          break
        case "priority":
          cmp = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
          break
      }
      return sortDir === "asc" ? -cmp : cmp
    })
    return sorted
  }, [filteredSuggestions, sortField, sortDir, focusedProductId])

  const totalBudget = useMemo(
    () => sortedSuggestions.reduce((sum, s) => sum + s.estimatedCost, 0),
    [sortedSuggestions]
  )

  const hasBudgetLimit = budget !== null
  const effectiveBudget = budget ?? totalBudget

  const budgetSelection = useMemo(() => {
    const byROI = [...sortedSuggestions].sort((a, b) => b.roi - a.roi)
    let remaining = effectiveBudget
    const included: EnrichedSuggestion[] = []
    for (const s of byROI) {
      const purchaseQty = s.purchaseQty ?? s.suggestedQty
      if (purchaseQty > 0 && remaining >= s.estimatedCost) {
        included.push(s)
        remaining -= s.estimatedCost
      }
    }
    const excluded = byROI.filter((s) => !included.includes(s))
    return {
      included,
      excluded,
      remainingBudget: remaining,
      profitProtected: included.reduce((sum, s) => sum + s.expectedProfitSaved, 0),
      totalCost: included.reduce((sum, s) => sum + s.estimatedCost, 0),
      skuCount: included.length,
      excludedProfitAtRisk: excluded.reduce((sum, s) => sum + s.lostSalesRiskValue, 0),
    }
  }, [sortedSuggestions, effectiveBudget])
  const budgetIncludedIds = useMemo(
    () => new Set(budgetSelection.included.map((s) => s.id)),
    [budgetSelection]
  )
  const visibleSuggestions = useMemo(
    () => sortedSuggestions.slice(0, visibleCount),
    [sortedSuggestions, visibleCount]
  )
  const hasMoreSuggestions = visibleSuggestions.length < sortedSuggestions.length

  // Summary KPIs (based on all filtered, not just budget selection)
  const summary = useMemo(() => {
    const active = sortedSuggestions
    const totalProfitSaved = active.reduce((sum, s) => sum + s.expectedProfitSaved, 0)
    const totalCost = active.reduce((sum, s) => sum + s.estimatedCost, 0)
    const avgROI = active.length > 0 ? Math.round(totalCost > 0 ? (totalProfitSaved / totalCost) * 100 : 0) : 0
    const urgentCount = active.filter((s) => s.priority === "urgent").length
    const criticalStockout = active.filter((s) => s.daysUntilStockout <= 7).length
    const totalLostRisk = active.reduce((sum, s) => sum + s.lostSalesRiskValue, 0)

    return {
      total: active.length,
      totalCost,
      totalProfitSaved,
      avgROI,
      urgentCount,
      criticalStockout,
      totalLostRisk,
      approvedCount: approvedIds.size,
    }
  }, [sortedSuggestions, approvedIds])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"))
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />
    return sortDir === "desc" ? (
      <ArrowDown className="ml-1 h-3 w-3" />
    ) : (
      <ArrowUp className="ml-1 h-3 w-3" />
    )
  }

  const canApproveSuggestion = (suggestion: Pick<ReplenishmentSuggestion, "id" | "purchaseQty" | "suggestedQty">) => {
    const purchaseQty = suggestion.purchaseQty ?? suggestion.suggestedQty
    if (purchaseQty <= 0) return false
    return !hasBudgetLimit || budgetIncludedIds.has(suggestion.id)
  }

  const handleApprove = (id: string) => {
    const suggestion = allSuggestions.find((s) => s.id === id)
    const enrichedSuggestion = sortedSuggestions.find((s) => s.id === id) ?? (suggestion ? getEnriched(suggestion) : null)
    if (suggestion && enrichedSuggestion && canApproveSuggestion(enrichedSuggestion)) {
      setApprovedIds((prev) => new Set([...prev, id]))
      setLastApproved(suggestion)
      setShowSuccessDialog(true)
    }
  }

  const handleSkip = (id: string) => {
    setSkippedIds((prev) => new Set([...prev, id]))
  }

  const handleApproveAll = () => {
    const targets = (hasBudgetLimit ? budgetSelection.included : sortedSuggestions).filter(canApproveSuggestion)
    const newApproved = new Set(approvedIds)
    targets.forEach((s) => newApproved.add(s.id))
    setApprovedIds(newApproved)
  }

  const budgetStep = Math.max(1, Math.round(totalBudget / 100_000_000))

  return (
    <div className="flex flex-col">
      <Header
        title="Kế hoạch mua hàng"
        description="Mô phỏng ngân sách và ưu tiên các mã hàng bảo vệ lợi nhuận cao nhất"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Profit-Focused Summary */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Chờ xử lý</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
              <p className="text-xs text-muted-foreground">
                {summary.urgentCount} khẩn cấp · {summary.criticalStockout} sắp hết
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ngân sách đề xuất</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalCost)}đ</div>
              <p className="text-xs text-muted-foreground">
                cho {summary.total} SKU
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">LN kỳ vọng bảo vệ</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(summary.totalProfitSaved)}đ
              </div>
              <p className="text-xs text-muted-foreground">
                nếu duyệt tất cả khuyến nghị
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Hiệu quả vốn TB</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{summary.avgROI}%</div>
              <p className="text-xs text-muted-foreground">
                LN bảo vệ / chi phí mua hàng
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">LN có nguy cơ mất</CardTitle>
              <ShoppingCart className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(summary.totalLostRisk)}đ
              </div>
              <p className="text-xs text-muted-foreground">
                nếu không hành động kịp
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Đã duyệt</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">
                {summary.approvedCount}
              </div>
              <p className="text-xs text-muted-foreground">đơn đã xác nhận</p>
            </CardContent>
          </Card>
        </div>

        {/* Scenario bar */}
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
            <div className="min-w-[210px]">
              <p className="text-sm font-medium">Kịch bản ngân sách</p>
              <p className="text-2xl font-bold">
                {hasBudgetLimit ? `${formatCurrency(effectiveBudget)}đ` : "Không giới hạn"}
              </p>
            </div>
            <Slider
              value={[effectiveBudget]}
              onValueChange={([v]) => setBudget(v >= totalBudget ? null : v)}
              min={0}
              max={totalBudget}
              step={budgetStep}
              className="flex-1"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setBudget(0)}>
                Không phân bổ
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBudget(null)}>
                Không giới hạn
              </Button>
              <Button
                size="sm"
                onClick={handleApproveAll}
                disabled={budgetSelection.skuCount === 0}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Duyệt {budgetSelection.skuCount}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,1fr)]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Danh sách mua đề xuất</CardTitle>
              <CardDescription>
                {budgetSelection.skuCount} SKU được chọn theo hiệu quả vốn.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Chi phí mua</p>
                  <p className="text-xl font-bold">{formatCurrency(budgetSelection.totalCost)}đ</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">LN bảo vệ</p>
                  <p className="text-xl font-bold text-emerald-600">
                    {formatCurrency(budgetSelection.profitProtected)}đ
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Hiệu quả vốn</p>
                  <p className="text-xl font-bold text-blue-600">
                    {budgetSelection.totalCost > 0
                      ? Math.round((budgetSelection.profitProtected / budgetSelection.totalCost) * 100)
                      : 0}%
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Còn lại</p>
                  <p className="text-xl font-bold">{formatCurrency(budgetSelection.remainingBudget)}đ</p>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">SL cần mua</TableHead>
                      <TableHead className="text-right">Chi phí</TableHead>
                      <TableHead className="text-right">LN bảo vệ</TableHead>
                      <TableHead className="text-right">Hiệu quả vốn</TableHead>
                      <TableHead className="text-right">Thời gian chu kỳ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgetSelection.included.slice(0, 8).map((s) => (
                      <TableRow key={s.id} className={s.productId === focusedProductId ? "bg-blue-50/60" : undefined}>
                        <TableCell>
                          <p className="font-medium">{s.productSku}</p>
                          <p className="max-w-[180px] truncate text-xs text-muted-foreground">{s.productName}</p>
                        </TableCell>
                        <TableCell className="text-right">{s.purchaseQty ?? s.suggestedQty}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.estimatedCost)}đ</TableCell>
                        <TableCell className="text-right text-emerald-600">{formatCurrency(s.expectedProfitSaved)}đ</TableCell>
                        <TableCell className="text-right">{s.roi}%</TableCell>
                        <TableCell className="text-right">{s.daysUntilStockout > 0 ? `${s.daysUntilStockout} ngày` : "Chưa ước tính"}</TableCell>
                      </TableRow>
                    ))}
                    {budgetSelection.included.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          Ngân sách hiện tại chưa mua được SKU nào.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Phần lợi nhuận còn rủi ro</CardTitle>
              <CardDescription>SKU bị bỏ lại nếu không tăng ngân sách.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-700">Lợi nhuận còn rủi ro</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(budgetSelection.excludedProfitAtRisk)}đ
                </p>
                <p className="text-xs text-red-700">{budgetSelection.excluded.length} SKU chưa được mua</p>
              </div>
              <div className="space-y-2">
                {budgetSelection.excluded.slice(0, 3).map((s) => (
                  <div key={s.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{s.productSku}</p>
                        <p className="text-xs text-muted-foreground">{s.daysUntilStockout} ngày · Hiệu quả vốn {s.roi}%</p>
                      </div>
                      <p className="text-sm font-semibold text-red-600">
                        {formatCurrency(s.lostSalesRiskValue)}đ
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Hệ thống ưu tiên mã hàng có tỷ lệ lợi nhuận được bảo vệ trên chi phí mua cao hơn; đây là ước tính vận hành, không phải tối ưu tuyệt đối.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Decision Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Danh sách ưu tiên đặt hàng</CardTitle>
                <CardDescription>
                  Đang hiển thị {visibleSuggestions.length}/{sortedSuggestions.length} khuyến nghị — sắp xếp theo hiệu quả vốn, tác động lợi nhuận và độ khẩn cấp
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={selectedPriority}
                  onValueChange={(value) => setSelectedPriority(value as Priority)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Mức độ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả</SelectItem>
                    <SelectItem value="urgent">Khẩn cấp</SelectItem>
                    <SelectItem value="high">Cao</SelectItem>
                    <SelectItem value="medium">Trung bình</SelectItem>
                    <SelectItem value="low">Thấp</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={selectedCategory}
                  onValueChange={(value) =>
                    setSelectedCategory(value as ProductCategory | "all")
                  }
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Danh mục" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả danh mục</SelectItem>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBudget(null)
                  }}
                >
                  Đặt lại ngân sách
                </Button>

                {sortedSuggestions.length > 0 && (
                  <Button
                    onClick={handleApproveAll}
                    disabled={budgetSelection.skuCount === 0}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Duyệt {budgetSelection.skuCount} đề xuất
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sortedSuggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <h3 className="mt-4 text-lg font-semibold">Tuyệt vời!</h3>
                <p className="mt-2 text-muted-foreground">
                  Không có khuyến nghị đặt hàng nào cần xử lý.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">#</TableHead>
                      <TableHead>SKU / Sản phẩm</TableHead>
                      <TableHead>Nguồn</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSort("priority")}>
                        <span className="flex items-center">
                          Ưu tiên <SortIcon field="priority" />
                        </span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("daysUntilStockout")}>
                        <span className="flex items-center justify-end">
                          Thời gian chu kỳ <SortIcon field="daysUntilStockout" />
                        </span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("grossMargin")}>
                        <span className="flex items-center justify-end">
                          Biên lợi nhuận <SortIcon field="grossMargin" />
                        </span>
                      </TableHead>
                      <TableHead className="text-right">SL cần mua</TableHead>
                      <TableHead className="text-right">Tồn mục tiêu</TableHead>
                      <TableHead className="text-right">Điểm đặt hàng / Tồn an toàn</TableHead>
                      <TableHead>Nguồn</TableHead>
                      <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("purchaseCost")}>
                        <span className="flex items-center justify-end">
                          Chi phí <SortIcon field="purchaseCost" />
                        </span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("profitSaved")}>
                        <span className="flex items-center justify-end">
                          LN bảo vệ <SortIcon field="profitSaved" />
                        </span>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("roi")}>
                        <span className="flex items-center justify-end">
                          Hiệu quả vốn <SortIcon field="roi" />
                        </span>
                      </TableHead>
                      <TableHead className="text-right">Hành động</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleSuggestions.map((s, index) => {
                      const isInBudget = !hasBudgetLimit || budgetSelection.included.includes(s)
                      const isExcluded = hasBudgetLimit && !isInBudget
                      const canApproveRow = canApproveSuggestion(s)
                      const stockPct = Math.min(100, Math.round(((s.purchaseQty ?? s.suggestedQty) / Math.max(1, s.reorderPoint)) * 100))

                      const isFocused = s.productId === focusedProductId

                      return (
                        <TableRow
                          key={s.id}
                          className={
                            isFocused
                              ? "border-l-4 border-l-blue-500 bg-blue-50/50"
                              : isExcluded
                              ? "opacity-40"
                              : undefined
                          }
                        >
                          <TableCell className="text-xs text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {s.productSku}
                                {isFocused && (
                                  <Badge variant="secondary" className="ml-2 align-middle">Đang xem</Badge>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                                {s.productName}
                              </p>
                              <div className="mt-1">
                                <Progress
                                  value={stockPct}
                                  className={`h-1 w-16 ${
                                    stockPct < 30 ? "[&>div]:bg-red-500" :
                                    stockPct < 70 ? "[&>div]:bg-amber-500" :
                                    "[&>div]:bg-emerald-500"
                                  }`}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            Kế hoạch mua
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                s.priority === "urgent" ? "destructive" :
                                s.priority === "high" ? "default" :
                                "secondary"
                              }
                            >
                              {PRIORITY_LABELS[s.priority]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                s.daysUntilStockout <= 7
                                  ? "font-medium text-red-600"
                                  : s.daysUntilStockout <= 14
                                  ? "text-amber-600"
                                  : ""
                              }
                            >
                              {s.daysUntilStockout > 0 ? `${s.daysUntilStockout} ngày` : "Chưa ước tính"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>
                              <p>{formatCurrency(s.grossMargin)}đ</p>
                              <p className="text-xs text-muted-foreground">{s.grossMarginPct}%</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {s.purchaseQty ?? s.suggestedQty}
                          </TableCell>
                          <TableCell className="text-right">
                            {Math.round(s.targetStock ?? s.recommendedOrderTarget ?? s.reorderPoint).toLocaleString("vi-VN")}
                            <p className="text-xs text-muted-foreground">Nhu cầu 28n {Math.round(s.demand28 ?? 0).toLocaleString("vi-VN")}</p>
                          </TableCell>
                          <TableCell className="text-right">
                            {Math.round(s.reorderPoint).toLocaleString("vi-VN")} / {Math.round(s.safetyStock ?? 0).toLocaleString("vi-VN")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {s.inventoryPolicySource === "inventory_plan" ? "Kế hoạch tối ưu" : "Ước tính vận hành"}
                            </Badge>
                            <p className="mt-1 text-[10px] text-muted-foreground">
                              Kế hoạch nhu cầu · ưu tiên lợi nhuận
                            </p>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(s.estimatedCost)}đ
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-medium text-emerald-600">
                              {formatCurrency(s.expectedProfitSaved)}đ
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={s.roi >= 50 ? "default" : s.roi >= 20 ? "secondary" : "outline"}
                              className={
                                s.roi >= 50 ? "bg-emerald-100 text-emerald-700" :
                                s.roi >= 20 ? "" : ""
                              }
                            >
                              {s.roi}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant={canApproveRow ? "default" : "outline"}
                                className="h-8"
                                onClick={() => handleApprove(s.id)}
                                disabled={!canApproveRow}
                              >
                                <ShoppingCart className="mr-1 h-3 w-3" />
                                Duyệt
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2"
                                asChild
                              >
                                <Link href={`/analytics-bot?prompt=${encodeURIComponent(`Giải thích vì sao ${s.productSku} được ưu tiên theo hiệu quả vốn và ngân sách mua hàng.`)}`}>
                                  Hỏi trợ lý
                                </Link>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => handleSkip(s.id)}
                              >
                                <span className="text-xs text-muted-foreground">Bỏ</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
                </div>
                {hasMoreSuggestions && (
                  <div className="flex items-center justify-center border-t pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setVisibleCount((count) => count + LOAD_MORE_COUNT)}
                    >
                      Hiển thị thêm {Math.min(LOAD_MORE_COUNT, sortedSuggestions.length - visibleSuggestions.length)} khuyến nghị
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Đã duyệt khuyến nghị
            </DialogTitle>
            <DialogDescription>
              Khuyến nghị đặt hàng đã được ghi nhận trong phiên làm việc hiện tại.
            </DialogDescription>
          </DialogHeader>
          {lastApproved && (() => {
            const enriched = getEnriched(lastApproved)
            return (
              <div className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Sản phẩm</span>
                  <span className="font-medium">{lastApproved.productSku}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Số lượng</span>
                  <span className="font-medium">{lastApproved.purchaseQty ?? lastApproved.suggestedQty} đơn vị</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Nguồn</span>
                  <span className="font-medium">Theo chính sách tồn kho</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Chi phí</span>
                  <span className="font-bold">{fullCurrency(lastApproved.estimatedCost)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">LN kỳ vọng bảo vệ</span>
                  <span className="font-bold text-emerald-600">
                    {fullCurrency(enriched.expectedProfitSaved)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">ROI</span>
                  <Badge variant="default" className="bg-emerald-100 text-emerald-700">
                    {enriched.roi}%
                  </Badge>
                </div>
              </div>
            )
          })()}
          <DialogFooter>
            <Button onClick={() => setShowSuccessDialog(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ReplenishmentPage() {
  return (
    <Suspense fallback={null}>
      <ReplenishmentPageContent />
    </Suspense>
  )
}
