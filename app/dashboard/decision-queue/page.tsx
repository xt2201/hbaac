"use client"

import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock, ListChecks, ShieldAlert, WalletCards } from "lucide-react"
import { Header } from "@/components/dashboard/header"
import { DecisionDetailDrawer } from "@/components/dashboard/decision-detail-drawer"
import { DecisionQueueTable } from "@/components/dashboard/decision-queue-table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { CATEGORIES, CATEGORY_LABELS, decisionQueueItems } from "@/lib/project-data"
import type { DecisionActionType, DecisionPriority, DecisionQueueItem, ProductCategory } from "@/types"

type FilterValue<T extends string> = T | "all"

const actionLabels: Record<DecisionActionType, string> = {
  order: "Đặt hàng",
  reduce: "Giảm mua",
  clearance: "Xả hàng",
  watch: "Theo dõi",
}

const priorityLabels: Record<DecisionPriority, string> = {
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

function formatCurrency(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B VND`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M VND`
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value)
}

function DecisionQueuePageContent() {
  const searchParams = useSearchParams()
  const focusedProductId = searchParams.get("productId")
  const [selectedActionType, setSelectedActionType] = useState<FilterValue<DecisionActionType>>("all")
  const [selectedCategory, setSelectedCategory] = useState<FilterValue<ProductCategory>>("all")
  const [selectedPriority, setSelectedPriority] = useState<FilterValue<DecisionPriority>>("all")
  const [approvedIds, setApprovedIds] = useState<Set<string>>(() => readApprovedDecisionIds())
  const [selectedItem, setSelectedItem] = useState<DecisionQueueItem | null>(null)

  useEffect(() => {
    window.localStorage.setItem(APPROVED_DECISION_STORAGE_KEY, JSON.stringify([...approvedIds]))
  }, [approvedIds])

  const filteredItems = useMemo(() => {
    return decisionQueueItems
      .filter((item) => {
        if (approvedIds.has(item.id)) return false
        if (selectedActionType !== "all" && item.actionType !== selectedActionType) return false
        if (selectedCategory !== "all" && item.category !== selectedCategory) return false
        if (selectedPriority !== "all" && item.priority !== selectedPriority) return false
        return true
      })
      .sort((a, b) => {
        if (a.productId === focusedProductId) return -1
        if (b.productId === focusedProductId) return 1
        return 0
      })
  }, [approvedIds, selectedActionType, selectedCategory, selectedPriority, focusedProductId])

  const summary = useMemo(() => {
    const active = decisionQueueItems.filter((item) => !approvedIds.has(item.id))
    const approved = decisionQueueItems.filter((item) => approvedIds.has(item.id))
    const urgentOrHigh = active.filter((item) => item.priority === "urgent" || item.priority === "high")

    return {
      activeCount: active.length,
      activeImpact: active.reduce((sum, item) => sum + item.estimatedFinancialImpact, 0),
      urgentOrHighCount: urgentOrHigh.length,
      nextDeadline: active.reduce<Date | null>((earliest, item) => {
        if (!earliest || item.deadline < earliest) return item.deadline
        return earliest
      }, null),
      approvedCount: approved.length,
      approvedImpact: approved.reduce((sum, item) => sum + item.estimatedFinancialImpact, 0),
    }
  }, [approvedIds])

  const handleApprove = (id: string) => {
    setApprovedIds((prev) => new Set([...prev, id]))
  }

  const handleBulkApprove = (ids: string[]) => {
    setApprovedIds((prev) => new Set([...prev, ...ids]))
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Hàng chờ quyết định"
        description="Ưu tiên hành động theo tác động tài chính, hạn xử lý và điểm ưu tiên dữ liệu"
      />

      <div className="flex-1 space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Hành động chờ xử lý</CardTitle>
              <ListChecks className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.activeCount}</div>
              <p className="text-xs text-muted-foreground">đã sắp xếp theo tác động tài chính</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tác động đang chờ</CardTitle>
              <WalletCards className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.activeImpact)}</div>
              <p className="text-xs text-muted-foreground">lợi nhuận/vốn/chi phí cần xử lý</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ưu tiên cao</CardTitle>
              <ShieldAlert className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.urgentOrHighCount}</div>
              <div className="mt-1 flex gap-1">
                <Badge variant="destructive" className="text-xs">Khẩn cấp</Badge>
                <Badge className="text-xs">Cao</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Đã duyệt</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{summary.approvedCount}</div>
              <p className="text-xs text-muted-foreground">{formatCurrency(summary.approvedImpact)} tác động</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <CardTitle>Hàng chờ quyết định</CardTitle>
                <CardDescription>
                  {filteredItems.length} hành động phù hợp bộ lọc. Dữ liệu vận hành đã được đồng bộ để ưu tiên quyết định mua hàng.
                </CardDescription>
                {summary.nextDeadline && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Hạn xử lý gần nhất: {new Intl.DateTimeFormat("vi-VN").format(summary.nextDeadline)}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={selectedActionType} onValueChange={(value) => setSelectedActionType(value as FilterValue<DecisionActionType>)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Hành động" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả hành động</SelectItem>
                    {(Object.keys(actionLabels) as DecisionActionType[]).map((actionType) => (
                      <SelectItem key={actionType} value={actionType}>{actionLabels[actionType]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedPriority} onValueChange={(value) => setSelectedPriority(value as FilterValue<DecisionPriority>)}>
                  <SelectTrigger className="w-[145px]">
                    <SelectValue placeholder="Ưu tiên" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả ưu tiên</SelectItem>
                    {(Object.keys(priorityLabels) as DecisionPriority[]).map((priority) => (
                      <SelectItem key={priority} value={priority}>{priorityLabels[priority]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as FilterValue<ProductCategory>)}>
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="Danh mục" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tất cả danh mục</SelectItem>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>{CATEGORY_LABELS[category]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DecisionQueueTable
              data={filteredItems}
              onApprove={handleApprove}
              onBulkApprove={handleBulkApprove}
              onViewDetails={setSelectedItem}
            />
          </CardContent>
        </Card>
      </div>

      <DecisionDetailDrawer
        item={selectedItem}
        open={selectedItem !== null}
        onOpenChange={(open) => !open && setSelectedItem(null)}
        onApprove={handleApprove}
      />
    </div>
  )
}

export default function DecisionQueuePage() {
  return (
    <Suspense fallback={null}>
      <DecisionQueuePageContent />
    </Suspense>
  )
}
