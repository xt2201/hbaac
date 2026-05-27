"use client"

import { useState, useMemo } from "react"
import { Header } from "@/components/dashboard/header"
import { ReplenishmentCards } from "@/components/dashboard/replenishment-cards"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { CheckCircle2, FileText, Package, ShoppingCart, Truck, AlertTriangle } from "lucide-react"
import { replenishmentSuggestions, CATEGORIES, CATEGORY_LABELS, suppliers } from "@/lib/project-data"
import type { ProductCategory, ReplenishmentSuggestion } from "@/types"

type Priority = "all" | "urgent" | "high" | "medium" | "low"

export default function ReplenishmentPage() {
  const [selectedPriority, setSelectedPriority] = useState<Priority>("all")
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory | "all">("all")
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set())
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set())
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [lastApproved, setLastApproved] = useState<ReplenishmentSuggestion | null>(null)

  // Filter suggestions
  const filteredSuggestions = useMemo(() => {
    return replenishmentSuggestions.filter((suggestion) => {
      if (approvedIds.has(suggestion.id) || skippedIds.has(suggestion.id)) return false
      if (selectedPriority !== "all" && suggestion.priority !== selectedPriority) return false
      if (selectedCategory !== "all" && suggestion.category !== selectedCategory) return false
      return true
    })
  }, [selectedPriority, selectedCategory, approvedIds, skippedIds])

  // Calculate summary
  const summary = useMemo(() => {
    const active = replenishmentSuggestions.filter(
      (s) => !approvedIds.has(s.id) && !skippedIds.has(s.id)
    )
    const approved = replenishmentSuggestions.filter((s) => approvedIds.has(s.id))

    return {
      total: active.length,
      urgent: active.filter((s) => s.priority === "urgent").length,
      high: active.filter((s) => s.priority === "high").length,
      medium: active.filter((s) => s.priority === "medium").length,
      low: active.filter((s) => s.priority === "low").length,
      totalCost: active.reduce((sum, s) => sum + s.estimatedCost, 0),
      approvedCount: approved.length,
      approvedCost: approved.reduce((sum, s) => sum + s.estimatedCost, 0),
    }
  }, [approvedIds, skippedIds])

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)}B VND`
    }
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M VND`
    }
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value)
  }

  const handleApprove = (id: string) => {
    const suggestion = replenishmentSuggestions.find((s) => s.id === id)
    if (suggestion) {
      setApprovedIds((prev) => new Set([...prev, id]))
      setLastApproved(suggestion)
      setShowSuccessDialog(true)
    }
  }

  const handleSkip = (id: string) => {
    setSkippedIds((prev) => new Set([...prev, id]))
  }

  const handleApproveAll = () => {
    const newApproved = new Set(approvedIds)
    filteredSuggestions.forEach((s) => newApproved.add(s.id))
    setApprovedIds(newApproved)
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Đề xuất đặt hàng"
        description="Gợi ý bổ sung hàng dựa trên dự báo nhu cầu và mức tồn kho"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Đề xuất chờ xử lý</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.total}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {summary.urgent > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {summary.urgent} khẩn cấp
                  </Badge>
                )}
                {summary.high > 0 && (
                  <Badge className="text-xs">{summary.high} cao</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Chi phí ước tính</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalCost)}</div>
              <p className="text-xs text-muted-foreground">
                cho {summary.total} sản phẩm
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
              <p className="text-xs text-muted-foreground">
                {formatCurrency(summary.approvedCost)} tổng giá trị
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Nhà cung cấp</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{suppliers.length}</div>
              <p className="text-xs text-muted-foreground">đối tác đang hoạt động</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Danh sách đề xuất</CardTitle>
                <CardDescription>
                  {filteredSuggestions.length} đề xuất đang chờ xử lý
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

                {filteredSuggestions.length > 0 && (
                  <Button onClick={handleApproveAll}>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Duyệt tất cả ({filteredSuggestions.length})
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ReplenishmentCards
              suggestions={filteredSuggestions}
              onApprove={handleApprove}
              onSkip={handleSkip}
            />
          </CardContent>
        </Card>
      </div>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Đã tạo đơn hàng
            </DialogTitle>
            <DialogDescription>
              Đơn hàng đã được tạo và gửi đến nhà cung cấp.
            </DialogDescription>
          </DialogHeader>
          {lastApproved && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Sản phẩm</span>
                <span className="font-medium">{lastApproved.productSku}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Số lượng</span>
                <span className="font-medium">{lastApproved.suggestedQty} đơn vị</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Nhà cung cấp</span>
                <span className="font-medium">{lastApproved.supplierName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Chi phí</span>
                <span className="font-bold text-primary">
                  {formatCurrency(lastApproved.estimatedCost)}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuccessDialog(false)}>
              Đóng
            </Button>
            <Button onClick={() => setShowSuccessDialog(false)}>
              <FileText className="mr-2 h-4 w-4" />
              Xem đơn hàng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
