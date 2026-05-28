import { Header } from "@/components/dashboard/header"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clock,
  Database,
  Layers3,
  PieChart,
  Truck,
  WalletCards,
} from "lucide-react"
import { getProfitCommandCenter, HBAAC_CALENDAR_SUMMARY, HBAAC_DATASET_INFO } from "@/lib/project-data"
import type { ProfitPriority } from "@/lib/project-data"

const priorityTone: Record<ProfitPriority, string> = {
  urgent: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-blue-500",
  low: "bg-slate-500",
}

const priorityBadgeVariant = (priority: ProfitPriority) => {
  if (priority === "urgent") return "destructive"
  if (priority === "high") return "default"
  if (priority === "medium") return "secondary"
  return "outline"
}

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

export default function DashboardPage() {
  const commandCenter = getProfitCommandCenter()

  const kpiCards = [
    {
      title: "Lợi nhuận có nguy cơ mất",
      value: formatCompactCurrency(commandCenter.kpis.lostProfitRisk),
      helper: "Do rủi ro thiếu hàng trong forecast 56 ngày",
      icon: AlertTriangle,
      iconClass: "text-red-600",
      tileClass: "bg-red-50",
    },
    {
      title: "Vốn bị khóa",
      value: formatCompactCurrency(commandCenter.kpis.lockedCapital),
      helper: "Ước tính từ SKU tồn kho dư",
      icon: Archive,
      iconClass: "text-amber-600",
      tileClass: "bg-amber-50",
    },
    {
      title: "Chi phí tồn kho ước tính",
      value: formatCompactCurrency(commandCenter.kpis.estimatedHoldingCost),
      helper: "Chi phí giữ hàng trong 56 ngày",
      icon: WalletCards,
      iconClass: "text-blue-600",
      tileClass: "bg-blue-50",
    },
    {
      title: "Lợi nhuận kỳ vọng",
      value: formatCompactCurrency(commandCenter.kpis.expectedProfitFromRecommendations),
      helper: "Nếu duyệt khuyến nghị đặt hàng",
      icon: CheckCircle2,
      iconClass: "text-emerald-600",
      tileClass: "bg-emerald-50",
    },
    {
      title: "SKU cần hành động",
      value: commandCenter.kpis.actionSkuNext7Days.toLocaleString("vi-VN"),
      helper: "Trong 7 ngày tới",
      icon: Clock,
      iconClass: "text-slate-700",
      tileClass: "bg-slate-100",
    },
    {
      title: "Ngân sách ưu tiên cao",
      value: `${commandCenter.kpis.highPriorityBudgetShare.toFixed(1)}%`,
      helper: `${formatCompactCurrency(commandCenter.kpis.proposedBudget)} tổng khuyến nghị đặt hàng`,
      icon: PieChart,
      iconClass: "text-violet-600",
      tileClass: "bg-violet-50",
    },
  ]

  return (
    <div className="flex flex-col">
      <Header
        title="Điều hành lợi nhuận"
        description="Tập trung vào lợi nhuận có nguy cơ mất, vốn bị khóa và dòng tiền mua hàng cần duyệt"
      />

      <div className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {kpiCards.map((kpi) => (
            <Card key={kpi.title}>
              <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <div className={`rounded-md p-2 ${kpi.tileClass}`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.iconClass}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tracking-normal">{kpi.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{kpi.helper}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Cần hành động ngay
                  </CardTitle>
                  <CardDescription>
                    Top SKU theo tác động tài chính, ưu tiên rủi ro thiếu hàng
                  </CardDescription>
                </div>
                <Badge variant="outline">Dữ liệu cuộc thi + danh mục bổ sung</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead>Ưu tiên</TableHead>
                    <TableHead className="text-right">Tồn kho</TableHead>
                    <TableHead className="text-right">Ngày còn lại</TableHead>
                    <TableHead className="text-right">Tác động</TableHead>
                    <TableHead>Khuyến nghị đặt hàng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commandCenter.immediateActions.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-mono text-xs">{item.productSku}</TableCell>
                      <TableCell className="min-w-[220px] whitespace-normal">
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.categoryLabel} | {item.supplierName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={priorityBadgeVariant(item.priority)}>
                          {item.priorityLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.currentStock.toLocaleString("vi-VN")}</TableCell>
                      <TableCell className="text-right">{item.daysOfStock} ngày</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCompactCurrency(item.financialImpact)}
                      </TableCell>
                      <TableCell className="min-w-[260px] whitespace-normal text-sm text-muted-foreground">
                        {item.recommendation}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5 text-violet-600" />
                Tỷ lệ ngân sách đề xuất
              </CardTitle>
              <CardDescription>Theo mức ưu tiên của khuyến nghị đặt hàng</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {commandCenter.priorityBudgetMix.map((row) => (
                <div key={row.priority} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${priorityTone[row.priority]}`} />
                      <span className="font-medium">{row.label}</span>
                      <span className="text-muted-foreground">({row.skuCount} SKU)</span>
                    </div>
                    <span className="font-medium">{row.share.toFixed(1)}%</span>
                  </div>
                  <Progress value={row.share} className="h-2" />
                  <p className="text-xs text-muted-foreground">{formatCurrency(row.amount)}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5 text-amber-600" />
                Cơ hội tối ưu vốn
              </CardTitle>
              <CardDescription>SKU tồn kho dư nên giảm mua hoặc xả hàng</CardDescription>
            </CardHeader>
            <CardContent>
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead className="text-right">Tồn dư</TableHead>
                    <TableHead className="text-right">Vốn bị khóa</TableHead>
                    <TableHead className="text-right">Chi phí giữ hàng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commandCenter.capitalOpportunities.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-mono text-xs">{item.productSku}</TableCell>
                      <TableCell className="min-w-[220px] whitespace-normal">
                        <div className="font-medium">{item.productName}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.categoryLabel} | mục tiêu {item.targetStock.toLocaleString("vi-VN")} đơn vị
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.excessQty.toLocaleString("vi-VN")}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCompactCurrency(item.capitalLocked)}
                      </TableCell>
                      <TableCell className="text-right">{formatCompactCurrency(item.holdingCost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600" />
                Dòng tiền mua hàng
              </CardTitle>
              <CardDescription>Tổng chi phí đề xuất theo nhà cung cấp và danh mục</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                {commandCenter.supplierBudget.slice(0, 5).map((supplier) => (
                  <div key={supplier.supplierId} className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_auto]">
                    <div>
                      <div className="font-medium">{supplier.supplierName}</div>
                      <div className="text-xs text-muted-foreground">
                        {supplier.skuCount} SKU, {supplier.urgentCount} khẩn cấp
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <div className="font-semibold">{formatCompactCurrency(supplier.estimatedCost)}</div>
                      <div className="text-xs text-emerald-700">
                        +{formatCompactCurrency(supplier.expectedProfitSaved)} lợi nhuận kỳ vọng
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Layers3 className="h-4 w-4 text-muted-foreground" />
                  Theo danh mục
                  <Badge variant="outline">Danh mục bổ sung</Badge>
                </div>
                <div className="space-y-2">
                  {commandCenter.categoryBudget.slice(0, 5).map((category) => (
                    <div key={category.category} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span>{category.categoryLabel}</span>
                        <span className="font-medium">{formatCompactCurrency(category.estimatedCost)}</span>
                      </div>
                      <Progress value={category.share} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-slate-700" />
              Nguồn dữ liệu
            </CardTitle>
            <CardDescription>
              Nhãn dữ liệu dùng trong demo để tách dữ liệu cuộc thi khỏi enrichment
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border p-3">
              <Badge>Dữ liệu cuộc thi</Badge>
              <p className="mt-2 text-sm text-muted-foreground">
                {HBAAC_DATASET_INFO.trainSkuCount.toLocaleString("vi-VN")} SKU train, forecast N-BEATS trong submission_nbeats.csv.
              </p>
            </div>
            <div className="rounded-md border p-3">
              <Badge variant="secondary">Lịch ngoài</Badge>
              <p className="mt-2 text-sm text-muted-foreground">
                {HBAAC_CALENDAR_SUMMARY.rowCount.toLocaleString("vi-VN")} ngày, gồm cuối tuần, ngày lễ và đặc trưng theo ngày.
              </p>
            </div>
            <div className="rounded-md border p-3">
              <Badge variant="outline">Danh mục bổ sung</Badge>
              <p className="mt-2 text-sm text-muted-foreground">
                Tên sản phẩm, nhà cung cấp, tồn kho, lead time và điểm đặt hàng là enrichment để productize workflow.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
