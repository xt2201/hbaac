"use client"

import { useState, useMemo } from "react"
import { Header } from "@/components/dashboard/header"
import { WatchlistTable } from "@/components/dashboard/watchlist-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AlertTriangle, Archive, Clock, TrendingDown } from "lucide-react"
import { stockAlerts, CATEGORIES, CATEGORY_LABELS } from "@/lib/project-data"
import type { ProductCategory } from "@/types"

type AlertType = "stockout_risk" | "overstock" | "slow_moving"

export default function WatchlistPage() {
  const [selectedType, setSelectedType] = useState<AlertType>("stockout_risk")
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | "all">("all")

  const filteredAlerts = useMemo(() => {
    return stockAlerts.filter((alert) => {
      if (alert.type !== selectedType) return false
      if (selectedCategory !== "all" && alert.category !== selectedCategory) return false
      return true
    })
  }, [selectedType, selectedCategory])

  const summary = useMemo(() => {
    const stockoutRisk = stockAlerts.filter((a) => a.type === "stockout_risk")
    const overstock = stockAlerts.filter((a) => a.type === "overstock")
    const slowMoving = stockAlerts.filter((a) => a.type === "slow_moving")

    return {
      stockoutRisk: {
        total: stockoutRisk.length,
        critical: stockoutRisk.filter((a) => a.severity === "critical").length,
        impact: stockoutRisk.reduce((sum, a) => sum + a.estimatedImpact, 0),
        label: "LN có nguy cơ mất",
      },
      overstock: {
        total: overstock.length,
        warning: overstock.filter((a) => a.severity === "warning").length,
        impact: overstock.reduce((sum, a) => sum + a.estimatedImpact, 0),
        label: "Vốn bị khóa",
      },
      slowMoving: {
        total: slowMoving.length,
        impact: slowMoving.reduce((sum, a) => sum + a.estimatedImpact, 0),
        label: "Chi phí lưu kho",
      },
    }
  }, [])

  function formatCurrency(value: number) {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
    return value.toLocaleString("vi-VN")
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Giám sát rủi ro tồn kho"
        description="Theo dõi rủi ro nhu cầu, chi phí giữ hàng và mã hàng bán chậm theo tác động tài chính"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Summary Cards — financial framing */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Stockout Risk */}
          <Card
            className={`cursor-pointer transition-all ${
              selectedType === "stockout_risk" ? "ring-2 ring-red-500" : ""
            }`}
            onClick={() => setSelectedType("stockout_risk")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Nhu cầu cao — Lợi nhuận cần bảo vệ
              </CardTitle>
              <div className="rounded-lg bg-red-100 p-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-red-600">
                  {summary.stockoutRisk.total}
                </span>
                <span className="text-sm text-muted-foreground">mã hàng</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                  {summary.stockoutRisk.critical} nghiêm trọng
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {summary.stockoutRisk.label}: ~{formatCurrency(summary.stockoutRisk.impact)}đ
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Overstock */}
          <Card
            className={`cursor-pointer transition-all ${
              selectedType === "overstock" ? "ring-2 ring-blue-500" : ""
            }`}
            onClick={() => setSelectedType("overstock")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Chi phí lưu kho — Vốn cần tối ưu
              </CardTitle>
              <div className="rounded-lg bg-blue-100 p-2">
                <Archive className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600">
                  {summary.overstock.total}
                </span>
                <span className="text-sm text-muted-foreground">mã hàng</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {summary.overstock.warning} cảnh báo
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {summary.overstock.label}: ~{formatCurrency(summary.overstock.impact)}đ
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Slow Moving */}
          <Card
            className={`cursor-pointer transition-all ${
              selectedType === "slow_moving" ? "ring-2 ring-slate-500" : ""
            }`}
            onClick={() => setSelectedType("slow_moving")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Bán chậm — Chi phí lưu kho
              </CardTitle>
              <div className="rounded-lg bg-slate-100 p-2">
                <Clock className="h-4 w-4 text-slate-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-600">
                  {summary.slowMoving.total}
                </span>
                <span className="text-sm text-muted-foreground">mã hàng</span>
              </div>
              <div className="mt-2">
                <span className="text-xs text-muted-foreground">
                  {summary.slowMoving.label}: ~{formatCurrency(summary.slowMoving.impact)}đ
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>
                  {selectedType === "stockout_risk"
                    ? "Dự báo cần mua — Tác động đến lợi nhuận"
                    : selectedType === "overstock"
                    ? "Chi phí lưu kho cao — Theo chính sách"
                    : "Dự báo thấp — Theo lịch sử bán hàng"}
                </CardTitle>
                <CardDescription>
                  {filteredAlerts.length} mã hàng · Sắp xếp mặc định theo tác động tài chính
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedCategory}
                  onValueChange={(value) =>
                    setSelectedCategory(value as ProductCategory | "all")
                  }
                >
                  <SelectTrigger className="w-[180px]">
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
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <WatchlistTable data={filteredAlerts} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
