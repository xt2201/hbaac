"use client"

import { useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import type { AnalyticsBotMessage } from "@/app/api/chat/route"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Bot,
  Send,
  User,
  Loader2,
  TrendingUp,
  AlertTriangle,
  Package,
  BarChart3,
  Sparkles,
  CalendarDays,
  WalletCards,
} from "lucide-react"

type SuggestedQuestion = {
  icon: React.ElementType
  text: string
  color: string
}

const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  {
    icon: WalletCards,
    text: "Nếu ngân sách mua hàng là 500 triệu, nên ưu tiên SKU nào?",
    color: "text-emerald-600",
  },
  {
    icon: AlertTriangle,
    text: "Mã hàng nào có lợi nhuận có nguy cơ mất cao nhất?",
    color: "text-red-600",
  },
  {
    icon: Package,
    text: "Giải thích vì sao SKU cần đặt hàng ngay.",
    color: "text-amber-600",
  },
  {
    icon: BarChart3,
    text: "Độ tin cậy dự báo hiện có điểm nào cần chú ý?",
    color: "text-blue-600",
  },
]

type ChatInterfaceProps = {
  variant?: "page" | "widget"
  className?: string
  contextPrompts?: string[]
  initialPrompt?: string
}

export function ChatInterface({ variant = "page", className, contextPrompts = [], initialPrompt }: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState(initialPrompt ?? "")
  const isWidget = variant === "widget"

  const { messages, sendMessage, status } = useChat<AnalyticsBotMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  const isLoading = status === "streaming" || status === "submitted"
  const quickQuestions: SuggestedQuestion[] = [
    ...contextPrompts.map((text) => ({ icon: Sparkles, text, color: "text-violet-600" })),
    ...SUGGESTED_QUESTIONS,
  ].slice(0, isWidget ? 4 : 6)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return
    sendMessage({ text: inputValue })
    setInputValue("")
  }

  const handleSuggestedQuestion = (question: string) => {
    if (isLoading) return
    sendMessage({ text: question })
  }

  const formatCurrency = (value: unknown) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) return "Chưa có"

    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(numericValue)
  }

  const formatDriverType = (type: string) => {
    const labels: Record<string, string> = {
      weekend: "cuối tuần",
      month_boundary: "đầu/cuối tháng",
      public_holiday: "ngày lễ",
      lunar_event: "âm lịch",
      retail_event: "bán lẻ",
    }
    return labels[type] ?? type.replace("_", " ")
  }

  const formatDriverSource = (source: unknown) => {
    const labels: Record<string, string> = {
      "date-derived": "theo lịch vận hành",
      factual_external_calendar: "lịch vận hành",
      assumption: "cơ sở tính toán",
    }
    return labels[String(source)] ?? String(source)
  }

  const renderMetaWarning = (data: Record<string, unknown>) => {
    return null
  }

  const renderToolCard = (data: Record<string, unknown>, content: React.ReactNode) => (
    <div className="space-y-2">
      {renderMetaWarning(data)}
      {content}
    </div>
  )

  const renderToolResult = (toolName: string, output: unknown) => {
    const data = output as Record<string, unknown>
    
    if (data.error) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {String(data.error)}
        </div>
      )
    }

    // Render based on tool type
    if (toolName === "getDashboardKPIs" && data.overview) {
      const overview = data.overview as Record<string, number>
      const alerts = data.alerts as Record<string, number>
      const sales = data.sales as Record<string, unknown>
      return renderToolCard(data,
        <div className="space-y-3 rounded-lg border bg-muted/50 p-3">
          <p className="text-sm font-medium">KPI vận hành</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">Tổng mã hàng:</span>{" "}
              <span className="font-medium">{overview.totalSKUs}</span>
            </div>
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">Doanh thu tháng:</span>{" "}
              <span className="font-medium">{formatCurrency(sales.monthlyRevenue)}</span>
            </div>
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">Rủi ro thiếu hàng:</span>{" "}
              <span className="font-medium text-red-600">{alerts.stockoutRisk}</span>
            </div>
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">Tồn kho dư:</span>{" "}
              <span className="font-medium text-amber-600">{alerts.overstock}</span>
            </div>
          </div>
        </div>
      )
    }

    if (toolName === "getStockAlerts" && data.alerts) {
      const alerts = data.alerts as Array<Record<string, unknown>>
      const summary = data.summary as Record<string, unknown>
      return renderToolCard(data,
        <div className="space-y-2 rounded-lg border bg-muted/50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Rủi ro tồn kho</p>
            <Badge variant="secondary">{summary.total as number} mục</Badge>
          </div>
          <div className="space-y-1">
            {alerts.slice(0, 5).map((alert, i) => (
              <div key={i} className="flex items-center justify-between rounded bg-background p-2 text-xs">
                <div>
                  <span className="font-mono">{alert.productSku as string}</span>
                  <span className="ml-2 text-muted-foreground">{alert.productName as string}</span>
                </div>
                <Badge
                  variant={alert.severity === "Nghiêm trọng" ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {alert.currentStock as number} đơn vị
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (toolName === "getReplenishmentSuggestions" && data.suggestions) {
      const suggestions = data.suggestions as Array<Record<string, unknown>>
      const summary = data.summary as Record<string, unknown>
      return renderToolCard(data,
        <div className="space-y-2 rounded-lg border bg-muted/50 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Khuyến nghị đặt hàng</p>
            <Badge variant="secondary">{summary.total as number} mục</Badge>
          </div>
          <div className="space-y-1">
            {suggestions.slice(0, 5).map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded bg-background p-2 text-xs">
                <div>
                  <span className="font-mono">{s.productSku as string}</span>
                  <Badge
                    variant={s.priority === "Khẩn cấp" ? "destructive" : "outline"}
                    className="ml-2 text-xs"
                  >
                    {s.priority as string}
                  </Badge>
                </div>
                <span className="font-medium">{s.purchaseQty as number ?? s.suggestedQty as number} đơn vị</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {suggestions.slice(0, 2).map((s, i) => (
              <div key={`policy-${i}`} className="rounded bg-background p-2">
                <div className="font-mono">{s.productSku as string}</div>
                <div className="text-muted-foreground">Lượng mua {String(s.recommendedOrder ?? s.suggestedQty ?? "Không có dữ liệu")} · Điểm đặt hàng {String(s.reorderPoint ?? "Không có dữ liệu")}</div>
                <div className="text-muted-foreground">Lô mua tối ưu {String(s.economicOrderQty ?? "Không có dữ liệu")} · Tồn an toàn {String(s.safetyStock ?? "Không có dữ liệu")}</div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (toolName === "getInventoryPolicy" && (data.rows || data.policy || data.summaries)) {
      const rows = ((data.rows as Array<Record<string, unknown>> | undefined) ?? (data.policy ? [data.policy as Record<string, unknown>] : [])).slice(0, 5)
      const summaries = (data.summaries as Array<Record<string, unknown>> | undefined) ?? []
      const monthSummary = summaries.find((summary) => summary.month === data.month) ?? summaries[0]
      return renderToolCard(data,
        <div className="space-y-3 rounded-lg border bg-muted/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">Kế hoạch tồn kho</p>
            <Badge variant="outline">Kỳ {String(data.month ?? (data.policy as Record<string, unknown> | undefined)?.month ?? 1)}</Badge>
          </div>
          {monthSummary ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded bg-background p-2">
                <span className="text-muted-foreground">Mã hàng có kế hoạch:</span>{" "}
                <span className="font-medium">{String(monthSummary.skuCount ?? "0")}</span>
              </div>
              <div className="rounded bg-background p-2">
                <span className="text-muted-foreground">Chi phí vận hành năm:</span>{" "}
                <span className="font-medium">{formatCurrency(monthSummary.totalAnnualCost)}</span>
              </div>
            </div>
          ) : null}
          <div className="space-y-1">
            {rows.map((row, i) => (
              <div key={i} className="rounded bg-background p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono">{String(row.productSku ?? "SKU")}</span>
                  <span className="font-medium">Mua {String(row.purchaseQty ?? 0)}</span>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-1 text-muted-foreground">
                  <span>Lượng mua: {String(row.recommendedOrder ?? row.targetStock ?? "Không có dữ liệu")}</span>
                  <span>Điểm đặt hàng: {String(row.reorderPoint ?? "Không có dữ liệu")}</span>
                  <span>Tồn an toàn: {String(row.safetyStock ?? "Không có dữ liệu")}</span>
                  <span>Lô mua tối ưu: {String(row.economicOrderQty ?? "Không có dữ liệu")}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Lượng mua đề xuất là mức ưu tiên vận hành theo kế hoạch nhu cầu hiện tại.</p>
        </div>
      )
    }

    if (toolName === "getSalesAnalytics" && data.data) {
      const salesData = data.data as Array<Record<string, unknown>>
      return renderToolCard(data,
        <div className="space-y-2 rounded-lg border bg-muted/50 p-3">
          <p className="text-sm font-medium">Phân tích doanh số - {data.period as string}</p>
          <div className="space-y-1">
            {salesData.slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded bg-background p-2 text-xs">
                <span>{String(item.category ?? item.productName ?? item.channel ?? "Chưa có")}</span>
                <span className="font-medium">
                  {typeof item.revenue === "number" ? formatCurrency(item.revenue) : `${item.percentage ?? "Chưa có"}%`}
                </span>
              </div>
            ))}
          </div>
          {data.sourceNote ? <p className="text-xs text-muted-foreground">{String(data.sourceNote)}</p> : null}
        </div>
      )
    }

    if (toolName === "getProductForecast" && data.product) {
      const product = data.product as Record<string, unknown>
      const forecast = data.forecast as Record<string, unknown>
      const inv = data.inventory as Record<string, unknown>
      const drivers = data.drivers as Record<string, unknown> | undefined
      const driverCounts = drivers?.driverCounts as Record<string, number> | undefined
      const driverDates =
        ((drivers?.spikeAlignedDates as Array<Record<string, unknown>> | undefined) ?? [])
          .concat((drivers?.notableDates as Array<Record<string, unknown>> | undefined) ?? [])
          .slice(0, 3)
      return renderToolCard(data,
        <div className="space-y-3 rounded-lg border bg-muted/50 p-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">Dự báo: {product.name as string}</p>
              <Badge variant="outline">Thông tin danh mục</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">Dự báo {forecast.days as number} ngày:</span>{" "}
              <span className="font-medium">{forecast.totalForecastQty as number} đơn vị</span>
            </div>
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">Trung bình/ngày:</span>{" "}
              <span className="font-medium">{forecast.avgDailyDemand as string}</span>
            </div>
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">Tồn kho ERP:</span>{" "}
              <span className="font-medium">Không có trong nguồn</span>
            </div>
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">Mức phủ dữ liệu:</span>{" "}
              <span className="font-medium">Không có dữ liệu</span>
            </div>
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">Lượng mua đề xuất:</span>{" "}
              <span className="font-medium">{String(inv.recommendedOrder ?? inv.purchaseQty ?? "Không có dữ liệu")}</span>
            </div>
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">Số lượng mua:</span>{" "}
              <span className="font-medium">{String(inv.purchaseQty ?? 0)}</span>
            </div>
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">Điểm đặt hàng / Tồn an toàn:</span>{" "}
              <span className="font-medium">{String(inv.reorderPoint ?? 0)} / {String(inv.safetyStock ?? "Không có dữ liệu")}</span>
            </div>
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">EOQ:</span>{" "}
              <span className="font-medium">{String(inv.economicOrderQty ?? "Không có dữ liệu")}</span>
            </div>
          </div>
          {drivers ? (
            <div className="space-y-2 rounded bg-background p-2 text-xs">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CalendarDays className="h-4 w-4 text-blue-600" />
                Yếu tố nhu cầu
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground">Ngày đỉnh:</span>{" "}
                  <span className="font-medium">{String(drivers.peakForecastDate ?? "Chưa có")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">SL đỉnh:</span>{" "}
                  <span className="font-medium">{String(drivers.peakForecastQty ?? "Chưa có")}</span>
                </div>
              </div>
              {driverCounts ? (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(driverCounts).map(([type, count]) => (
                    <Badge key={type} variant={count > 0 ? "secondary" : "outline"} className="text-[10px]">
                      {formatDriverType(type)}: {count}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {driverDates.length > 0 ? (
                <div className="space-y-1">
                  {driverDates.map((driver, index) => (
                    <div key={`${driver.date}-${driver.label}-${index}`} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {String(driver.date)} | {String(driver.label)}
                      </span>
                      <Badge variant={driver.source === "assumption" ? "outline" : "secondary"} className="text-[10px]">
                        {formatDriverSource(driver.source)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">Không có yếu tố lịch ngoài cuối tuần trong cửa sổ này.</p>
              )}
            </div>
          ) : null}
        </div>
      )
    }

    // Default: show JSON summary
    return renderToolCard(data,
      <div className="rounded-lg border bg-muted/50 p-3">
        <p className="text-xs text-muted-foreground">Kết quả dữ liệu</p>
        <pre className="mt-1 max-h-40 max-w-full overflow-auto whitespace-pre-wrap break-words text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    )
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <ScrollArea className={cn("min-h-0 flex-1", isWidget ? "p-3" : "p-4")}>
        {messages.length === 0 ? (
          <div className={cn("flex h-full flex-col items-center justify-center", isWidget ? "space-y-4 py-6" : "space-y-6 py-12")}>
            <div className={cn("flex items-center justify-center rounded-full bg-primary/10", isWidget ? "h-12 w-12" : "h-16 w-16")}>
              <Sparkles className={cn("text-primary", isWidget ? "h-6 w-6" : "h-8 w-8")} />
            </div>
            <div className="text-center">
              <h3 className={cn("font-semibold", isWidget ? "text-base" : "text-lg")}>Xin chào! Tôi là Trợ lý phân tích</h3>
              <p className={cn("mt-1 text-muted-foreground", isWidget ? "text-xs" : "text-sm")}>
                Tôi có thể giúp phân tích rủi ro thiếu hàng, vốn bị khóa, dự báo nhu cầu và kế hoạch mua hàng.
              </p>
            </div>

            <div className={cn("w-full space-y-2", isWidget ? "max-w-sm" : "max-w-lg")}>
              <p className="text-center text-sm text-muted-foreground">Thử hỏi:</p>
              <div className="grid gap-2">
                {quickQuestions.map((q, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className={cn("h-auto justify-start text-left", isWidget ? "px-3 py-2" : "px-4 py-3")}
                    onClick={() => handleSuggestedQuestion(q.text)}
                  >
                    <q.icon className={cn("mr-3 h-4 w-4 shrink-0", q.color)} />
                    <span className={cn(isWidget ? "text-xs" : "text-sm")}>{q.text}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}

                <div
                  className={cn(
                    "min-w-0 max-w-[80%] space-y-2",
                    message.role === "user" ? "items-end" : "items-start"
                  )}
                >
                  {message.parts.map((part, index) => {
                    if (part.type === "text") {
                      return (
                        <div
                          key={index}
                          className={cn(
                            "rounded-lg px-4 py-2",
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          )}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm">{part.text}</p>
                        </div>
                      )
                    }

                    // Handle tool parts
                    if (part.type.startsWith("tool-")) {
                      const toolName = part.type.replace("tool-", "")
                      const toolPart = part as typeof part & {
                        state?: string
                        output?: unknown
                        errorText?: string
                      }
                      
                      if (toolPart.state === "input-streaming" || toolPart.state === "input-available") {
                        return (
                          <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Đang lấy dữ liệu...</span>
                          </div>
                        )
                      }

                      if (toolPart.state === "output-available" && toolPart.output) {
                        return (
                          <div key={index}>
                            {renderToolResult(toolName, toolPart.output)}
                          </div>
                        )
                      }

                      if (toolPart.state === "output-error") {
                        return (
                          <div key={index} className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            Lỗi: {toolPart.errorText}
                          </div>
                        )
                      }
                    }

                    return null
                  })}
                </div>

                {message.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Đang suy nghĩ...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className={cn("border-t bg-background", isWidget ? "p-3" : "p-4")}>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Hỏi về dữ liệu tồn kho, doanh số, dự báo..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !inputValue.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
