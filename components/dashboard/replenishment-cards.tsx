"use client"

import { useState } from "react"
import { Check, Clock, ShoppingCart, Truck, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import type { ReplenishmentSuggestion } from "@/types"
import { CATEGORY_LABELS } from "@/lib/mock-data"

interface ReplenishmentCardsProps {
  suggestions: ReplenishmentSuggestion[]
  onApprove: (id: string) => void
  onSkip: (id: string) => void
}

export function ReplenishmentCards({ suggestions, onApprove, onSkip }: ReplenishmentCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  const getPriorityConfig = (priority: ReplenishmentSuggestion["priority"]) => {
    switch (priority) {
      case "urgent":
        return {
          label: "Khẩn cấp",
          variant: "destructive" as const,
          bgColor: "bg-red-50 border-red-200",
          iconColor: "text-red-600",
        }
      case "high":
        return {
          label: "Cao",
          variant: "default" as const,
          bgColor: "bg-amber-50 border-amber-200",
          iconColor: "text-amber-600",
        }
      case "medium":
        return {
          label: "Trung bình",
          variant: "secondary" as const,
          bgColor: "bg-blue-50 border-blue-200",
          iconColor: "text-blue-600",
        }
      case "low":
        return {
          label: "Thấp",
          variant: "outline" as const,
          bgColor: "bg-slate-50 border-slate-200",
          iconColor: "text-slate-600",
        }
    }
  }

  if (suggestions.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-12">
        <Check className="h-12 w-12 text-emerald-500" />
        <h3 className="mt-4 text-lg font-semibold">Tuyệt vời!</h3>
        <p className="mt-2 text-muted-foreground">
          Không có đề xuất bổ sung hàng nào cần xử lý.
        </p>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {suggestions.map((suggestion) => {
        const priorityConfig = getPriorityConfig(suggestion.priority)
        const stockPercentage = Math.min(
          100,
          Math.round((suggestion.currentStock / suggestion.reorderPoint) * 100)
        )

        return (
          <Card
            key={suggestion.id}
            className={cn("transition-all hover:shadow-md", priorityConfig.bgColor)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <Badge variant={priorityConfig.variant}>{priorityConfig.label}</Badge>
                <Badge variant="outline" className="text-xs">
                  {CATEGORY_LABELS[suggestion.category]}
                </Badge>
              </div>
              <CardTitle className="mt-2 line-clamp-2 text-base">
                {suggestion.productName}
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                {suggestion.productSku}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Stock Level */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tồn kho hiện tại</span>
                  <span className="font-medium">
                    {suggestion.currentStock} / {suggestion.reorderPoint}
                  </span>
                </div>
                <Progress
                  value={stockPercentage}
                  className={cn(
                    "h-2",
                    stockPercentage < 30 && "[&>div]:bg-red-500",
                    stockPercentage >= 30 && stockPercentage < 70 && "[&>div]:bg-amber-500",
                    stockPercentage >= 70 && "[&>div]:bg-emerald-500"
                  )}
                />
              </div>

              {/* Suggestion Details */}
              <div className="space-y-2 rounded-lg bg-background/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Số lượng đề xuất</span>
                  <span className="text-lg font-bold">{suggestion.suggestedQty} đơn vị</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Chi phí ước tính</span>
                  <span className="font-semibold text-primary">
                    {formatCurrency(suggestion.estimatedCost)}
                  </span>
                </div>
              </div>

              {/* Supplier & Delivery */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Truck className={cn("h-4 w-4", priorityConfig.iconColor)} />
                  <span className="text-muted-foreground">{suggestion.supplierName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className={cn("h-4 w-4", priorityConfig.iconColor)} />
                  <span className="text-muted-foreground">
                    Giao hàng dự kiến: {formatDate(suggestion.expectedDeliveryDate)}
                  </span>
                </div>
              </div>

              {/* Reason */}
              <p className="text-xs text-muted-foreground italic">{suggestion.reason}</p>
            </CardContent>

            <CardFooter className="gap-2 pt-0">
              <Button
                className="flex-1"
                onClick={() => onApprove(suggestion.id)}
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Duyệt
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onSkip(suggestion.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
