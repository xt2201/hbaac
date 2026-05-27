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
} from "lucide-react"

const SUGGESTED_QUESTIONS = [
  {
    icon: AlertTriangle,
    text: "Sản phẩm nào đang có nguy cơ hết hàng?",
    color: "text-red-600",
  },
  {
    icon: TrendingUp,
    text: "Dự báo nhu cầu má phanh Toyota 28 ngày tới",
    color: "text-blue-600",
  },
  {
    icon: Package,
    text: "Đề xuất đặt hàng khẩn cấp có những gì?",
    color: "text-amber-600",
  },
  {
    icon: BarChart3,
    text: "Top 5 sản phẩm bán chạy nhất tháng này",
    color: "text-emerald-600",
  },
]

type ChatInterfaceProps = {
  variant?: "page" | "widget"
  className?: string
}

export function ChatInterface({ variant = "page", className }: ChatInterfaceProps) {
  const [inputValue, setInputValue] = useState("")
  const isWidget = variant === "widget"

  const { messages, sendMessage, status } = useChat<AnalyticsBotMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  })

  const isLoading = status === "streaming" || status === "submitted"

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
    if (!Number.isFinite(numericValue)) return "N/A"

    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(numericValue)
  }

  const renderMetaWarning = (data: Record<string, unknown>) => {
    const meta = data._meta as Record<string, unknown> | undefined
    if (!meta?.warning) return null

    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
        {String(meta.warning)}
      </div>
    )
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
          <p className="text-sm font-medium">KPI Tổng quan</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">Tổng SKU:</span>{" "}
              <span className="font-medium">{overview.totalSKUs}</span>
            </div>
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">Doanh thu tháng:</span>{" "}
              <span className="font-medium">{formatCurrency(sales.monthlyRevenue)}</span>
            </div>
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">Nguy cơ hết hàng:</span>{" "}
              <span className="font-medium text-red-600">{alerts.stockoutRisk}</span>
            </div>
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">Tồn kho quá mức:</span>{" "}
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
            <p className="text-sm font-medium">Cảnh báo tồn kho</p>
            <Badge variant="secondary">{summary.total as number} items</Badge>
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
            <p className="text-sm font-medium">Đề xuất bổ sung hàng</p>
            <Badge variant="secondary">{summary.total as number} items</Badge>
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
                <span className="font-medium">{s.suggestedQty as number} đơn vị</span>
              </div>
            ))}
          </div>
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
                <span>{String(item.category ?? item.productName ?? item.channel ?? "N/A")}</span>
                <span className="font-medium">
                  {typeof item.revenue === "number" ? formatCurrency(item.revenue) : `${item.percentage ?? "N/A"}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (toolName === "getProductForecast" && data.product) {
      const product = data.product as Record<string, unknown>
      const forecast = data.forecast as Record<string, unknown>
      const inv = data.inventory as Record<string, unknown>
      return renderToolCard(data,
        <div className="space-y-2 rounded-lg border bg-muted/50 p-3">
          <p className="text-sm font-medium">Dự báo: {product.name as string}</p>
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
              <span className="text-muted-foreground">Tồn kho:</span>{" "}
              <span className="font-medium">{inv.currentStock as number}</span>
            </div>
            <div className="rounded bg-background p-2">
              <span className="text-muted-foreground">Đủ cho:</span>{" "}
              <span className={cn("font-medium", (inv.daysOfStock as number) < 14 && "text-red-600")}>
                {inv.daysOfStock as number} ngày
              </span>
            </div>
          </div>
        </div>
      )
    }

    // Default: show JSON summary
    return renderToolCard(data,
      <div className="rounded-lg border bg-muted/50 p-3">
        <p className="text-xs text-muted-foreground">Tool: {toolName}</p>
        <pre className="mt-1 max-h-40 overflow-auto text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    )
  }

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <ScrollArea className={cn("flex-1", isWidget ? "p-3" : "p-4")}>
        {messages.length === 0 ? (
          <div className={cn("flex h-full flex-col items-center justify-center", isWidget ? "space-y-4 py-6" : "space-y-6 py-12")}>
            <div className={cn("flex items-center justify-center rounded-full bg-primary/10", isWidget ? "h-12 w-12" : "h-16 w-16")}>
              <Sparkles className={cn("text-primary", isWidget ? "h-6 w-6" : "h-8 w-8")} />
            </div>
            <div className="text-center">
              <h3 className={cn("font-semibold", isWidget ? "text-base" : "text-lg")}>Xin chào! Tôi là AnalyticsBot</h3>
              <p className={cn("mt-1 text-muted-foreground", isWidget ? "text-xs" : "text-sm")}>
                Tôi có thể giúp bạn phân tích dữ liệu tồn kho, doanh số và dự báo nhu cầu.
              </p>
            </div>

            <div className={cn("w-full space-y-2", isWidget ? "max-w-sm" : "max-w-lg")}>
              <p className="text-center text-sm text-muted-foreground">Thử hỏi:</p>
              <div className="grid gap-2">
                {SUGGESTED_QUESTIONS.map((q, i) => (
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
                    "max-w-[80%] space-y-2",
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
                          <p className="whitespace-pre-wrap text-sm">{part.text}</p>
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
