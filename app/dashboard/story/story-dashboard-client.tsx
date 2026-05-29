"use client"

import Link from "next/link"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"
import {
  ArrowRight,
  BarChart3,
  BotMessageSquare,
  CheckCircle2,
  Database,
  GitBranch,
  Layers3,
  PieChart as PieChartIcon,
  Radar,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
} from "lucide-react"

import { Header } from "@/components/dashboard/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Progress } from "@/components/ui/progress"
import type { StoryDashboardData } from "./page"

const riskChartConfig = {
  impact: { label: "Tác động", color: "#ef4444" },
} satisfies ChartConfig

const budgetChartConfig = {
  amount: { label: "Ngân sách", color: "#8b5cf6" },
} satisfies ChartConfig

const forecastChartConfig = {
  actual: { label: "Bán thực tế", color: "#64748b" },
  forecast: { label: "Dự báo", color: "#2563eb" },
  confidenceUpper: { label: "Biên trên", color: "#93c5fd" },
} satisfies ChartConfig

const iconMap: Record<string, (typeof BarChart3)> = {
  BarChart3,
  CheckCircle2,
  Database,
  GitBranch,
  Layers3,
  Rocket,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
}

const roadmap = [
  {
    phase: "Insight",
    time: "Hiện tại",
    title: "Chứng minh bằng dữ liệu sẵn có",
    points: ["5 insight vận hành", "Forecast-to-action", "Ưu tiên theo lợi nhuận"],
    tone: "border-blue-200 bg-blue-50/60 text-blue-700",
  },
  {
    phase: "Workflow",
    time: "Demo",
    title: "Buyer ra quyết định trong dashboard",
    points: ["Decision queue", "Mô phỏng ngân sách", "Theo dõi rủi ro SKU"],
    tone: "border-emerald-200 bg-emerald-50/60 text-emerald-700",
  },
  {
    phase: "Scale",
    time: "Roadmap",
    title: "Mở rộng khi có dữ liệu vận hành thật",
    points: ["Actual sales mới", "Model monitoring", "Quy trình duyệt chính thức"],
    tone: "border-violet-200 bg-violet-50/60 text-violet-700",
  },
]

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(value))
}

function shortDate(value: string | Date) {
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" }).format(new Date(value))
}

export function StoryDashboardClient({ data }: { data: StoryDashboardData }) {
  const {
    kpis,
    riskChartData,
    budgetMixData,
    categoryBudgetData,
    forecastData,
    demandDrivers,
    funnelSteps,
    totalDecisionImpact,
    trustCards,
    topRiskySkuRows,
    topSku,
  } = data

  return (
    <div className="flex flex-col">
      <Header
        title="Câu chuyện demo"
        description="Một trang kể trọn luồng forecast → quyết định → ngân sách → roadmap triển khai."
      />

      <div className="flex-1 space-y-5 p-4 md:p-6">
        <section className="overflow-hidden rounded-xl border bg-slate-950 text-white shadow-sm">
          <div className="relative p-5 md:p-7">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.45),_transparent_34%),radial-gradient(circle_at_bottom_left,_rgba(16,185,129,0.24),_transparent_32%)]" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-white text-slate-950 hover:bg-white">Final demo</Badge>
                  <Badge variant="outline" className="border-white/30 text-white">Forecast-to-decision</Badge>
                  <Badge variant="outline" className="border-white/30 text-white">Roadmap triển khai</Badge>
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight md:text-4xl">
                    Từ dự báo N-BEATS đến quyết định mua hàng bảo vệ lợi nhuận.
                  </h2>
                  <p className="max-w-2xl text-sm text-slate-300 md:text-base">
                    Trang này gom phần kỹ thuật, sản phẩm dữ liệu và lộ trình để kể câu chuyện demo trong 90 giây.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild className="bg-white text-slate-950 hover:bg-slate-100">
                  <Link href="/dashboard/decision-queue">
                    Mở quyết định <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                  <Link href="/dashboard/replenishment">Mô phỏng ngân sách</Link>
                </Button>
                <Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
                  <Link href="/analytics-bot">Hỏi AnalyticsBot</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {kpis.map((kpi) => {
            const Icon = iconMap[kpi.icon]

            return (
              <Card key={kpi.title} className={kpi.className}>
                <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${kpi.iconClass}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tracking-tight md:text-3xl">{kpi.value}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{kpi.helper}</p>
                </CardContent>
              </Card>
            )
          })}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-red-600" />
                  Money-at-risk theo SKU ưu tiên
                </CardTitle>
                <Badge variant="secondary">Planning impact</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Ước tính tác động tài chính từ sales, forecast và inventory-plan; dùng để ưu tiên quyết định.
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer config={riskChartConfig} className="h-[320px] w-full">
                <BarChart data={riskChartData} margin={{ top: 24, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="sku" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis hide />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, _name, item) => (
                          <div className="grid gap-1">
                            <span className="font-mono text-xs text-muted-foreground">{item.payload.fullSku}</span>
                            <span className="font-semibold text-red-600">{item.payload.impactLabel}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="impact" radius={[8, 8, 0, 0]}>
                    {riskChartData.map((entry) => (
                      <Cell key={entry.fullSku} fill={entry.fill} />
                    ))}
                    <LabelList dataKey="impactLabel" position="top" className="fill-foreground text-[10px]" />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="border-violet-200 bg-violet-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <GitBranch className="h-5 w-5 text-violet-600" />
                Forecast-to-action funnel
              </CardTitle>
              <p className="text-sm text-muted-foreground">Một luồng demo hoàn chỉnh từ forecast tới hàng chờ duyệt.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {funnelSteps.map((step, index) => {
                const Icon = iconMap[step.icon]

                return (
                  <div key={step.label} className="rounded-lg border bg-background p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${step.tone}`} />
                        <span className="text-sm font-medium">{step.label}</span>
                      </div>
                      <span className="font-semibold">{step.valueLabel}</span>
                    </div>
                    <Progress value={Math.max(4, step.progress)} className="h-2" />
                    <p className="mt-1 text-[11px] text-muted-foreground">Bước {index + 1} trong workflow demo</p>
                  </div>
                )
              })}
              <div className="rounded-lg border bg-background p-3 text-sm">
                <div className="text-xs text-muted-foreground">Tổng tác động trong hàng chờ</div>
                <div className="mt-1 text-xl font-semibold text-red-600">{totalDecisionImpact}</div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(360px,0.75fr)_minmax(0,1.25fr)]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <PieChartIcon className="h-5 w-5 text-violet-600" />
                Phân bổ ngân sách theo ưu tiên
              </CardTitle>
              <p className="text-sm text-muted-foreground">Mô phỏng ROI-first theo ngân sách, không phải optimizer tuyệt đối.</p>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[220px_1fr] xl:grid-cols-1 2xl:grid-cols-[220px_1fr]">
              <ChartContainer config={budgetChartConfig} className="mx-auto h-[220px] w-full max-w-[260px]">
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, name) => (
                          <div className="flex min-w-[140px] items-center justify-between gap-4">
                            <span className="text-muted-foreground">{name}</span>
                            <span className="font-semibold">{String(name)}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Pie data={budgetMixData} dataKey="amount" nameKey="label" innerRadius={54} outerRadius={88} paddingAngle={3}>
                    {budgetMixData.map((entry) => (
                      <Cell key={entry.priority} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="space-y-3">
                {budgetMixData.map((item) => (
                  <div key={item.priority} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.fill }} />
                      <div>
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="text-xs text-muted-foreground">{item.skuCount} SKU · {item.share}%</div>
                      </div>
                    </div>
                    <div className="text-right text-sm font-semibold">{item.amountLabel}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
                Dòng tiền mua hàng theo nhóm SKU
              </CardTitle>
              <p className="text-sm text-muted-foreground">Top nhóm nhận ngân sách đề xuất từ chính sách tồn kho tháng 1.</p>
            </CardHeader>
            <CardContent>
              <ChartContainer config={budgetChartConfig} className="h-[300px] w-full">
                <BarChart data={categoryBudgetData} layout="vertical" margin={{ top: 8, right: 56, left: 8, bottom: 8 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="category" type="category" width={130} tickLine={false} axisLine={false} tickMargin={8} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        hideLabel
                        formatter={(value, _name, item) => (
                          <div className="grid gap-1">
                            <span className="text-muted-foreground">{item.payload.category}</span>
                            <span className="font-semibold text-emerald-700">{item.payload.amountLabel}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="amount" fill="#10b981" radius={[0, 8, 8, 0]}>
                    <LabelList dataKey="share" position="right" formatter={(value: number) => `${value}%`} className="fill-foreground text-xs" />
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Radar className="h-5 w-5 text-blue-600" />
                Bằng chứng kỹ thuật forecast
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                SKU tác động cao: <span className="font-mono">{topSku}</span> · đường dự báo và biên tin cậy proxy.
              </p>
            </CardHeader>
            <CardContent>
              <ChartContainer config={forecastChartConfig} className="h-[320px] w-full">
                <LineChart data={forecastData} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis hide />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        labelFormatter={(label) => shortDate(String(label))}
                        formatter={(value, name) => (
                          <div className="flex min-w-[160px] items-center justify-between gap-4">
                            <span className="text-muted-foreground">{name}</span>
                            <span className="font-mono font-semibold">{Number(value).toLocaleString("vi-VN")}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Area dataKey="confidenceUpper" type="monotone" fill="#bfdbfe" stroke="transparent" fillOpacity={0.28} />
                  <Line dataKey="actual" type="monotone" stroke="#64748b" strokeWidth={2} dot={false} connectNulls={false} />
                  <Line dataKey="forecast" type="monotone" stroke="#2563eb" strokeWidth={3} dot={false} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="border-blue-200 bg-blue-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Demand drivers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Peak forecast</div>
                    <div className="font-semibold">{formatNumber(demandDrivers?.peakForecastQty ?? 0)}</div>
                  </div>
                  <div className="rounded-lg border bg-background p-3">
                    <div className="text-xs text-muted-foreground">Ngày peak</div>
                    <div className="font-semibold">{demandDrivers ? shortDate(demandDrivers.peakForecastDate) : "--"}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {demandDrivers?.spikeAlignedDrivers.slice(0, 5).map((driver) => (
                    <Badge key={`${driver.date}-${driver.label}`} variant={driver.source === "assumption" ? "outline" : "secondary"}>
                      {driver.label} · +{driver.liftVsAveragePct}%
                    </Badge>
                  ))}
                  {!demandDrivers?.spikeAlignedDrivers.length && <Badge variant="outline">Không có spike driver rõ</Badge>}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Model/data trust</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {trustCards.map((item) => {
                  const Icon = iconMap[item.icon]

                  return (
                    <div key={item.label} className="rounded-lg border p-3">
                      <Icon className="mb-2 h-4 w-4 text-blue-600" />
                      <div className="text-lg font-semibold">{item.value}</div>
                      <div className="text-xs font-medium">{item.label}</div>
                      <div className="text-[11px] text-muted-foreground">{item.helper}</div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          </div>
        </section>

        <section>
          <Card className="overflow-hidden border-red-200 bg-red-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-red-600" />
                Top SKU có rủi ro trong dashboard/story
              </CardTitle>
              <p className="text-sm text-muted-foreground">Dùng ngay làm slide demo: SKU, hành động đề xuất, tác động tiền và lợi nhuận có thể bảo vệ.</p>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[720px] overflow-hidden rounded-lg border bg-background">
                <div className="grid grid-cols-[1.1fr_1.4fr_1fr_1fr_1fr] gap-3 border-b bg-muted/60 px-4 py-2 text-xs font-medium text-muted-foreground">
                  <div>SKU</div>
                  <div>Hành động</div>
                  <div>Ưu tiên</div>
                  <div>Tác động</div>
                  <div>Lợi nhuận bảo vệ</div>
                </div>
                {topRiskySkuRows.map((row) => (
                  <div key={row.sku} className="grid grid-cols-[1.1fr_1.4fr_1fr_1fr_1fr] gap-3 border-b px-4 py-3 text-sm last:border-b-0">
                    <div className="font-mono font-medium">{row.sku}</div>
                    <div>{row.action}</div>
                    <div><Badge variant="secondary">{row.priority}</Badge></div>
                    <div className="font-semibold text-red-600">{row.impact}</div>
                    <div className="font-semibold text-emerald-700">{row.protectedProfit}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {roadmap.map((item, index) => (
            <Card key={item.phase} className={item.tone}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline" className="border-current text-current">Bước {index + 1}</Badge>
                  <span className="text-xs font-medium">{item.time}</span>
                </div>
                <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                  {index === 2 ? <Rocket className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                  {item.phase}: {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-foreground/80">
                  {item.points.map((point) => (
                    <li key={point} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center rounded-xl border bg-muted/40 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <Database className="h-4 w-4 text-muted-foreground" />
              Ghi chú sự thật dữ liệu
            </div>
            <p className="text-sm text-muted-foreground">
              Sales, forecast N-BEATS và inventory-plan là nguồn dữ liệu trong dự án. Các chỉ số vận hành còn thiếu như tồn kho hiện tại, nhà cung cấp, lead time hoặc MOQ không được trình bày như dữ kiện thật.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/analytics-bot">
              Hỏi bot giải thích <BotMessageSquare className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </div>
    </div>
  )
}
