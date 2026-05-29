"use client"

import Link from "next/link"
import { Header } from "@/components/dashboard/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  PackageCheck,
  RotateCcw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { getDashboardInsights, getProfitCommandCenter } from "@/lib/project-data"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCompactCurrency(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} triệu`
  return formatCurrency(value)
}

function formatNumber(value: number) {
  return Math.round(value).toLocaleString("vi-VN")
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T00:00:00Z`))
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--background))",
  color: "hsl(var(--foreground))",
}

export default function DashboardPage() {
  const insights = getDashboardInsights()
  const commandCenter = getProfitCommandCenter()
  const sunday = insights.weekdaySummary.find((item) => item.weekday === 0)
  const saturday = insights.weekdaySummary.find((item) => item.weekday === 6)
  const maxReturnMonth = [...insights.returnMonthly].sort((left, right) => right.returnRate - left.returnRate)[0]
  const holidayBaseline = insights.holidayImpact.filter((item) => Math.abs(item.relativeDay) >= 5)
  const holidayCore = insights.holidayImpact.filter((item) => Math.abs(item.relativeDay) <= 1)
  const baselineHolidayQty = holidayBaseline.reduce((sum, item) => sum + item.averageQuantity, 0) / Math.max(1, holidayBaseline.length)
  const coreHolidayQty = holidayCore.reduce((sum, item) => sum + item.averageQuantity, 0) / Math.max(1, holidayCore.length)
  const holidayDropPct = baselineHolidayQty > 0 ? Math.max(0, 1 - coreHolidayQty / baselineHolidayQty) : 0
  const forecastChartData = insights.forecastCalendarImpact.slice(0, 28).map((item) => ({
    ...item,
    displayDate: formatDate(item.date),
  }))
  const saturdaySundayChartData = insights.saturdaySundayTrend.slice(-12).map((item) => ({
    ...item,
    monthLabel: item.month.slice(5),
  }))
  const actionPreview = commandCenter.immediateActions.slice(0, 5)

  const insightCards = [
    {
      title: "Chủ nhật gần như không có doanh thu",
      body: "Forecast và kế hoạch nhập hàng không nên coi Chủ nhật giống các ngày cuối tuần khác.",
      badge: "Ưu tiên cao nhất",
      action: "Giảm kỳ vọng demand Chủ nhật trong pilot.",
      metric: sunday ? formatNumber(sunday.averageDailyQuantity) : "0",
      metricLabel: "SL trung bình / ngày",
      icon: TrendingDown,
      tone: "border-blue-200 bg-blue-50/50 text-blue-700",
    },
    {
      title: "Thứ 7 vẫn bán tốt — đừng nhầm với Chủ nhật",
      body: "Thứ 7 là ngày vận hành quan trọng, cần đủ hàng trước khi bước vào cuối tuần.",
      badge: "Vận hành",
      action: "Đảm bảo hàng trước Thứ 7.",
      metric: saturday && sunday ? `${(saturday.averageDailyQuantity / Math.max(1, sunday.averageDailyQuantity)).toFixed(1)}x` : "—",
      metricLabel: "so với Chủ nhật",
      icon: PackageCheck,
      tone: "border-emerald-200 bg-emerald-50/50 text-emerald-700",
    },
    {
      title: maxReturnMonth?.month === "2025-10" ? "Tỷ lệ hoàn trả tăng mạnh — đáng lo tháng 10" : "Tỷ lệ hoàn trả cần theo dõi sát",
      body: "Return phải được tính vào net demand, không chỉ nhìn doanh số gộp.",
      badge: "Rủi ro doanh thu",
      action: "Theo dõi SKU có return risk.",
      metric: maxReturnMonth ? formatPercent(maxReturnMonth.returnRate) : "0%",
      metricLabel: maxReturnMonth ? `cao nhất ${maxReturnMonth.month}` : "return rate",
      icon: RotateCcw,
      tone: "border-amber-200 bg-amber-50/50 text-amber-700",
    },
    {
      title: `Top 200 SKU chiếm ${formatPercent(insights.paretoSummary.top200Share)} doanh số`,
      body: "Doanh thu tập trung ở nhóm SKU nhỏ; forecast và ngân sách nên ưu tiên nhóm tác động lớn.",
      badge: "Tập trung nguồn lực",
      action: "Tách chiến lược top SKU và long-tail SKU.",
      metric: formatNumber(200),
      metricLabel: `trên ${formatNumber(insights.paretoSummary.totalSkuCount)} SKU`,
      icon: Target,
      tone: "border-violet-200 bg-violet-50/50 text-violet-700",
    },
    {
      title: "Nghỉ lễ + trước lễ làm sản lượng giảm rõ",
      body: "Nhu cầu quanh kỳ nghỉ cần được điều chỉnh bằng calendar proxy thay vì nhập đều.",
      badge: "Kế hoạch nhập hàng",
      action: "Điều chỉnh forecast và thời điểm nhập quanh lễ.",
      metric: formatPercent(holidayDropPct),
      metricLabel: "giảm quanh D-1..D+1",
      icon: CalendarDays,
      tone: "border-orange-200 bg-orange-50/50 text-orange-700",
    },
  ]

  const impactRows = [
    ["Chủ nhật gần 0", "Giảm kỳ vọng demand Chủ nhật", "Không overstock cho Chủ nhật"],
    ["Thứ 7 bán tốt", "Không gộp Thứ 7 với Chủ nhật", "Chuẩn bị hàng trước Thứ 7"],
    ["Return tăng", "Theo dõi net demand", "Ưu tiên SKU return risk"],
    ["Top SKU tập trung", "Forecast kỹ nhóm A", "Ưu tiên ngân sách cho SKU tác động lớn"],
    ["Holiday giảm", "Điều chỉnh demand quanh lễ", "Nhập hàng sớm hơn trước kỳ lễ"],
  ]

  return (
    <div className="flex flex-col">
      <Header
        title="Insight Command Center"
        description="Dữ liệu lịch sử phát hiện pattern vận hành, forecast N-BEATS chuyển thành quyết định nhập hàng."
      />

      <div className="flex-1 space-y-5 p-4 md:p-6">
        <section className="rounded-2xl border bg-gradient-to-r from-slate-950 via-slate-900 to-slate-800 p-5 text-white md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-white text-slate-950 hover:bg-white">Insight-first</Badge>
                <Badge variant="outline" className="border-white/30 text-white">Dự báo N-BEATS</Badge>
                <Badge variant="outline" className="border-white/30 text-white">Calendar proxy</Badge>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">5 insight vận hành quan trọng nhất</h1>
              <p className="text-sm text-slate-300 md:text-base">
                Từ lịch sử bán hàng và forecast N-BEATS, hệ thống chỉ ra các pattern ảnh hưởng trực tiếp tới kế hoạch nhập hàng.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[520px]">
              <div className="rounded-xl border border-white/15 bg-white/10 p-3">
                <p className="text-xs text-slate-300">Dòng giao dịch</p>
                <p className="text-xl font-semibold">{formatNumber(insights.summary.transactionRows)}</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 p-3">
                <p className="text-xs text-slate-300">SKU forecast</p>
                <p className="text-xl font-semibold">{formatNumber(insights.summary.forecastSkuCount)}</p>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 p-3">
                <p className="text-xs text-slate-300">Mismatch forecast-plan</p>
                <p className="text-xl font-semibold">{formatNumber(insights.summary.inventoryPlanForecastMismatchRows)}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3">
          {insightCards.map((insight) => (
            <Card key={insight.title} className="rounded-2xl">
              <CardContent className="grid gap-4 p-5 md:grid-cols-[72px_1fr_auto] md:items-center">
                <div className={`flex h-[72px] w-[72px] items-center justify-center rounded-xl border ${insight.tone}`}>
                  <insight.icon className="h-8 w-8" />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold tracking-tight">{insight.title}</h2>
                    <Badge variant="outline">{insight.badge}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{insight.body}</p>
                  <p className="text-sm font-medium">{insight.action}</p>
                </div>
                <div className="rounded-xl border bg-muted/30 p-4 text-right md:min-w-[180px]">
                  <p className="text-2xl font-semibold">{insight.metric}</p>
                  <p className="text-xs text-muted-foreground">{insight.metricLabel}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Bằng chứng dữ liệu</h2>
            <p className="text-sm text-muted-foreground">Các chart dưới đây dùng lịch sử bán hàng và forecast để kiểm chứng từng insight.</p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Sản lượng trung bình theo thứ</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={insights.weekdaySummary}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(Number(value))} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatNumber(Number(value))} />
                    <Bar dataKey="averageDailyQuantity" name="SL TB/ngày" radius={[6, 6, 0, 0]}>
                      {insights.weekdaySummary.map((entry) => (
                        <Cell
                          key={entry.label}
                          fill={entry.weekday === 0 ? "#93c5fd" : entry.weekday === 6 ? "#10b981" : "#2563eb"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pareto SKU revenue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {insights.paretoSummary.rankedBuckets.map((bucket) => (
                  <div key={bucket.bucket} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{bucket.bucket}</span>
                      <span className="text-muted-foreground">{formatPercent(bucket.cumulativeShare)} lũy kế</span>
                    </div>
                    <Progress value={bucket.cumulativeShare * 100} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatNumber(bucket.skuCount)} SKU</span>
                      <span>{formatCompactCurrency(bucket.revenue)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Thứ 7 vs Chủ nhật theo 12 tháng gần nhất</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={saturdaySundayChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="monthLabel" tickLine={false} axisLine={false} minTickGap={18} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(Number(value))} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatNumber(Number(value))} />
                    <Line type="monotone" dataKey="saturdayQuantity" name="Thứ 7" stroke="#10b981" strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="sundayQuantity" name="Chủ nhật" stroke="#93c5fd" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Holiday impact window</CardTitle>
              </CardHeader>
              <CardContent className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={insights.holidayImpact}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="relativeDay" tickLine={false} axisLine={false} tickFormatter={(value) => Number(value) === 0 ? "D0" : `D${Number(value) > 0 ? "+" : ""}${value}`} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(Number(value))} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatNumber(Number(value))} labelFormatter={(value) => Number(value) === 0 ? "D0" : `D${Number(value) > 0 ? "+" : ""}${value}`} />
                    <Bar dataKey="averageQuantity" name="SL TB" radius={[6, 6, 0, 0]}>
                      {insights.holidayImpact.map((entry) => (
                        <Cell
                          key={entry.relativeDay}
                          fill={entry.relativeDay === 0 ? "#f97316" : Math.abs(entry.relativeDay) <= 2 ? "#fb923c" : "#fed7aa"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Forecast 28 ngày có highlight lịch</CardTitle>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastChartData}>
                  <defs>
                    <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="displayDate" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => formatNumber(Number(value))} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatNumber(Number(value))} labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""} />
                  <Area type="monotone" dataKey="forecastQuantity" name="Forecast quantity" stroke="#2563eb" fill="url(#forecastGradient)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Từ insight tới quyết định</h2>
            <p className="text-sm text-muted-foreground">Mỗi insight được chuyển thành rule vận hành hoặc ưu tiên trong forecast-to-action workflow.</p>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insight</TableHead>
                    <TableHead>Forecast impact</TableHead>
                    <TableHead>Quyết định</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {impactRows.map(([insight, impact, decision]) => (
                    <TableRow key={insight}>
                      <TableCell className="font-medium">{insight}</TableCell>
                      <TableCell className="text-muted-foreground">{impact}</TableCell>
                      <TableCell>{decision}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Forecast-to-action preview</h2>
              <p className="text-sm text-muted-foreground">Các SKU forecast 56 ngày cần ưu tiên theo tác động lợi nhuận.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm"><Link href="/dashboard/decision-queue">Decision queue</Link></Button>
              <Button asChild variant="outline" size="sm"><Link href="/dashboard/replenishment">Replenishment</Link></Button>
              <Button asChild size="sm"><Link href="/dashboard/forecast">Forecast <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            </div>
          </div>
          <div className="grid gap-3 xl:grid-cols-5">
            {actionPreview.map((item) => (
              <Card key={item.productId}>
                <CardContent className="space-y-3 p-4">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">{item.productSku}</div>
                    <div className="line-clamp-2 font-medium">{item.productName}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-xs text-muted-foreground">Tác động</p>
                      <p className="font-semibold text-emerald-700">{formatCompactCurrency(item.financialImpact)}</p>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-2">
                      <p className="text-xs text-muted-foreground">SL đề xuất</p>
                      <p className="font-semibold">{formatNumber(item.suggestedQty)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span>{item.recommendation}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
