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
import { AlertTriangle, Archive, Clock } from "lucide-react"
import { stockAlerts, CATEGORIES, CATEGORY_LABELS } from "@/lib/project-data"
import type { ProductCategory } from "@/types"

type AlertType = "stockout_risk" | "overstock" | "slow_moving"

export default function WatchlistPage() {
  const [selectedType, setSelectedType] = useState<AlertType>("stockout_risk")
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | "all">("all")

  // Filter alerts by type and category
  const filteredAlerts = useMemo(() => {
    return stockAlerts.filter((alert) => {
      if (alert.type !== selectedType) return false
      if (selectedCategory !== "all" && alert.category !== selectedCategory) return false
      return true
    })
  }, [selectedType, selectedCategory])

  // Calculate summary stats
  const summary = useMemo(() => {
    const stockoutRisk = stockAlerts.filter((a) => a.type === "stockout_risk")
    const overstock = stockAlerts.filter((a) => a.type === "overstock")
    const slowMoving = stockAlerts.filter((a) => a.type === "slow_moving")

    return {
      stockoutRisk: {
        total: stockoutRisk.length,
        critical: stockoutRisk.filter((a) => a.severity === "critical").length,
        impact: stockoutRisk.reduce((sum, a) => sum + a.estimatedImpact, 0),
      },
      overstock: {
        total: overstock.length,
        warning: overstock.filter((a) => a.severity === "warning").length,
        impact: overstock.reduce((sum, a) => sum + a.estimatedImpact, 0),
      },
      slowMoving: {
        total: slowMoving.length,
        impact: slowMoving.reduce((sum, a) => sum + a.estimatedImpact, 0),
      },
    }
  }, [])

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)}B VND`
    }
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M VND`
    }
    return `${(value / 1_000).toFixed(0)}K VND`
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Rủi ro & chi phí tồn kho"
        description="Theo dõi SKU có rủi ro thiếu hàng, tồn kho dư hoặc bán chậm"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card
            className={`cursor-pointer transition-all ${
              selectedType === "stockout_risk" ? "ring-2 ring-red-500" : ""
            }`}
            onClick={() => setSelectedType("stockout_risk")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Rủi ro thiếu hàng</CardTitle>
              <div className="rounded-lg bg-red-100 p-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-red-600">
                  {summary.stockoutRisk.total}
                </span>
                <span className="text-sm text-muted-foreground">sản phẩm</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="destructive" className="text-xs">
                  {summary.stockoutRisk.critical} nghiêm trọng
                </Badge>
                <span className="text-xs text-muted-foreground">
                  ~ {formatCurrency(summary.stockoutRisk.impact)} rủi ro
                </span>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${
              selectedType === "overstock" ? "ring-2 ring-blue-500" : ""
            }`}
            onClick={() => setSelectedType("overstock")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tồn kho dư</CardTitle>
              <div className="rounded-lg bg-blue-100 p-2">
                <Archive className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600">
                  {summary.overstock.total}
                </span>
                <span className="text-sm text-muted-foreground">sản phẩm</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {summary.overstock.warning} cảnh báo
                </Badge>
                <span className="text-xs text-muted-foreground">
                  ~ {formatCurrency(summary.overstock.impact)} vốn bị khóa
                </span>
              </div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all ${
              selectedType === "slow_moving" ? "ring-2 ring-slate-500" : ""
            }`}
            onClick={() => setSelectedType("slow_moving")}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Hàng bán chậm</CardTitle>
              <div className="rounded-lg bg-slate-100 p-2">
                <Clock className="h-4 w-4 text-slate-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-slate-600">
                  {summary.slowMoving.total}
                </span>
                <span className="text-sm text-muted-foreground">sản phẩm</span>
              </div>
              <div className="mt-2">
                <span className="text-xs text-muted-foreground">
                  ~ {formatCurrency(summary.slowMoving.impact)} cần xử lý
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
                    ? "SKU có rủi ro thiếu hàng"
                    : selectedType === "overstock"
                    ? "SKU tồn kho dư"
                    : "SKU bán chậm"}
                </CardTitle>
                <CardDescription>
                  {filteredAlerts.length} sản phẩm cần chú ý
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
