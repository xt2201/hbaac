"use client"

import {
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Archive,
  Clock,
  ShoppingCart,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { DashboardKPIs } from "@/types"

interface StatsCardsProps {
  kpis: DashboardKPIs
}

export function StatsCards({ kpis }: StatsCardsProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1_000_000_000) {
      return `${(value / 1_000_000_000).toFixed(1)}B`
    }
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1)}K`
    }
    return value.toLocaleString("vi-VN")
  }

  const stats = [
    {
      title: "Tổng SKU",
      value: kpis.totalSKUs,
      subValue: `${kpis.activeSKUs} đang hoạt động`,
      icon: Package,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Nguy cơ hết hàng",
      value: kpis.stockoutRiskCount,
      subValue: "sản phẩm cần bổ sung",
      icon: AlertTriangle,
      iconColor: "text-red-600",
      bgColor: "bg-red-50",
      highlight: kpis.stockoutRiskCount > 10,
    },
    {
      title: "Tồn kho quá mức",
      value: kpis.overstockCount,
      subValue: "sản phẩm dư thừa",
      icon: Archive,
      iconColor: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "Đang chờ xử lý",
      value: kpis.pendingOrders,
      subValue: "đề xuất đặt hàng",
      icon: ShoppingCart,
      iconColor: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Giá trị tồn kho",
      value: `${formatCurrency(kpis.totalInventoryValue)}đ`,
      subValue: "tổng giá trị",
      icon: DollarSign,
      iconColor: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Doanh thu tháng",
      value: `${formatCurrency(kpis.monthlyRevenue)}đ`,
      subValue: (
        <span className={cn("flex items-center gap-1", kpis.revenueChange >= 0 ? "text-emerald-600" : "text-red-600")}>
          {kpis.revenueChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {kpis.revenueChange >= 0 ? "+" : ""}{kpis.revenueChange}% so với tháng trước
        </span>
      ),
      icon: TrendingUp,
      iconColor: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "Hàng bán chậm",
      value: kpis.slowMovingCount,
      subValue: "sản phẩm cần xem xét",
      icon: Clock,
      iconColor: "text-slate-600",
      bgColor: "bg-slate-50",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card
          key={index}
          className={cn(
            "transition-shadow hover:shadow-md",
            stat.highlight && "border-red-200 bg-red-50/30"
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </CardTitle>
            <div className={cn("rounded-lg p-2", stat.bgColor)}>
              <stat.icon className={cn("h-4 w-4", stat.iconColor)} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.subValue}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
