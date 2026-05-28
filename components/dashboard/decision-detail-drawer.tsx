"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CATEGORY_LABELS } from "@/lib/project-data"
import type { DecisionActionType, DecisionPriority, DecisionQueueItem } from "@/types"

interface DecisionDetailDrawerProps {
  item: DecisionQueueItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onApprove: (id: string) => void
}

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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

function priorityVariant(priority: DecisionPriority) {
  if (priority === "urgent") return "destructive" as const
  if (priority === "high") return "default" as const
  return "secondary" as const
}

export function DecisionDetailDrawer({ item, open, onOpenChange, onApprove }: DecisionDetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        {item && (
          <>
            <SheetHeader>
              <SheetTitle>{item.productName}</SheetTitle>
              <SheetDescription>
                <span className="font-mono">{item.productSku}</span> · {CATEGORY_LABELS[item.category]} · {item.supplierName}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-6 px-4">
              <section className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant={priorityVariant(item.priority)}>{priorityLabels[item.priority]}</Badge>
                  <Badge variant="outline">{actionLabels[item.actionType]}</Badge>
                  <Badge variant="secondary">Tin cậy {item.confidence}%</Badge>
                </div>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground">Khuyến nghị</p>
                  <p className="mt-1 font-medium">{item.recommendation}</p>
                  <p className="mt-3 text-sm text-muted-foreground">{item.urgency}</p>
                  <p className="text-sm">Deadline: {formatDate(item.deadline)}</p>
                </div>
              </section>

              <section className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Tác động tài chính ước tính</p>
                  <p className="text-lg font-semibold">{formatCurrency(item.estimatedFinancialImpact)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Tồn kho hiện tại</p>
                  <p className="text-lg font-semibold">{item.currentStock.toLocaleString("vi-VN")} đơn vị</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Ngày tồn kho dự kiến</p>
                  <p className="text-lg font-semibold">{item.projectedDays.toLocaleString("vi-VN")} ngày</p>
                </div>
                {item.estimatedCost !== undefined && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Chi phí mua ước tính</p>
                    <p className="text-lg font-semibold">{formatCurrency(item.estimatedCost)}</p>
                  </div>
                )}
              </section>

              {item.suggestedQty !== undefined && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Số lượng đề xuất</p>
                  <p className="text-lg font-semibold">{item.suggestedQty.toLocaleString("vi-VN")} đơn vị</p>
                </div>
              )}

              <section className="space-y-2">
                <h3 className="font-medium">Lý do</h3>
                <p className="text-sm text-muted-foreground">{item.reason}</p>
              </section>

              <Separator />

              <section className="space-y-3">
                <h3 className="font-medium">Nguồn dữ liệu và giả định</h3>
                <p className="text-sm text-muted-foreground">{item.dataSource}</p>
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  {item.assumptions.map((assumption) => (
                    <li key={assumption}>{assumption}</li>
                  ))}
                </ul>
              </section>
            </div>

            <SheetFooter>
              <Button
                onClick={() => {
                  onApprove(item.id)
                  onOpenChange(false)
                }}
              >
                Duyệt hành động này
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
