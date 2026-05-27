import { Header } from "@/components/dashboard/header"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, AlertTriangle, TrendingUp, Package } from "lucide-react"
import {
  getDashboardKPIs,
  stockAlerts,
  getCategorySalesSummary,
  getTopSellingProducts,
  CATEGORY_LABELS,
} from "@/lib/mock-data"

export default function DashboardPage() {
  const kpis = getDashboardKPIs()
  const recentAlerts = stockAlerts.slice(0, 5)
  const categorySales = getCategorySalesSummary(30)
  const topProducts = getTopSellingProducts(30, 5)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="flex flex-col">
      <Header
        title="Dashboard"
        description="Tổng quan tình hình kinh doanh và tồn kho"
      />

      <div className="flex-1 space-y-6 p-6">
        {/* KPI Stats */}
        <StatsCards kpis={kpis} />

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Alerts */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Cảnh báo gần đây
                </CardTitle>
                <CardDescription>
                  {recentAlerts.length} cảnh báo cần xử lý
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/watchlist">
                  Xem tất cả
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          alert.severity === "critical"
                            ? "destructive"
                            : alert.severity === "warning"
                            ? "default"
                            : "secondary"
                        }
                        className="w-20 justify-center"
                      >
                        {alert.severity === "critical"
                          ? "Nghiêm trọng"
                          : alert.severity === "warning"
                          ? "Cảnh báo"
                          : "Thông tin"}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium">{alert.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {alert.productSku} - {CATEGORY_LABELS[alert.category]}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {alert.currentStock} đơn vị
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {alert.projectedDays} ngày tồn kho
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Truy cập nhanh</CardTitle>
              <CardDescription>Các tính năng chính</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <Link href="/dashboard/forecast">
                  <TrendingUp className="mr-2 h-4 w-4 text-blue-600" />
                  Dự báo nhu cầu
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <Link href="/dashboard/watchlist">
                  <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" />
                  Cảnh báo tồn kho
                </Link>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <Link href="/dashboard/replenishment">
                  <Package className="mr-2 h-4 w-4 text-emerald-600" />
                  Đề xuất đặt hàng
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Category Sales */}
          <Card>
            <CardHeader>
              <CardTitle>Doanh số theo danh mục</CardTitle>
              <CardDescription>30 ngày gần nhất</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categorySales
                  .sort((a, b) => b.revenue - a.revenue)
                  .slice(0, 6)
                  .map((cat) => {
                    const maxRevenue = Math.max(...categorySales.map((c) => c.revenue))
                    const percentage = (cat.revenue / maxRevenue) * 100
                    return (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{cat.categoryLabel}</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(cat.revenue)}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>

          {/* Top Selling Products */}
          <Card>
            <CardHeader>
              <CardTitle>Sản phẩm bán chạy</CardTitle>
              <CardDescription>Top 5 theo doanh thu - 30 ngày</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div
                    key={product.productId}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium line-clamp-1">
                          {product.productName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {product.productSku}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {formatCurrency(product.revenue)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product.quantity} đơn vị
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
