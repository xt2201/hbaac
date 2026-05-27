// AutoParts Intelligence Platform - AI Tools for AnalyticsBot

import { tool } from "ai"
import { z } from "zod"
import { analyticsBackendClient } from "@/lib/analytics-backend/client"
import { shouldUseLocalDatasetFallback } from "@/lib/analytics-backend/config"
import type { AnalyticsBackendResult } from "@/lib/analytics-backend/types"
import {
  products,
  stockAlerts,
  replenishmentSuggestions,
  inventory,
  getForecastsByProduct,
  getDemandDriversForProduct,
  getSalesByProduct,
  searchProducts,
  getDashboardKPIs as getLocalDashboardKPIs,
  getCategorySalesSummary,
  getTopSellingProducts,
  getInventoryByProduct,
  CATEGORY_LABELS,
  DATA_LAYER_LABELS,
} from "@/lib/project-data"

function withFallback<T extends object>(result: AnalyticsBackendResult<T>, fallback: () => object) {
  if (result.ok) {
    return {
      ...result.data,
      _meta: { source: "backend" as const },
    }
  }

  return {
    ...fallback(),
    _meta: {
      source: "local_dataset" as const,
      warning: shouldUseLocalDatasetFallback()
        ? `${result.error.message} Dang dung du lieu cuoc thi tu train.csv va submission_nbeats.csv.`
        : "Chatbot dang dung du lieu cuoc thi cuc bo vi chua cau hinh backend analytics rieng.",
    },
  }
}

function localProductForecast(productIdOrSku: string, days: number) {
  let product = products.find(
    (p) => p.id === productIdOrSku || p.sku.toLowerCase() === productIdOrSku.toLowerCase()
  )

  if (!product) {
    const matches = searchProducts(productIdOrSku)
    if (matches.length > 0) product = matches[0]
  }

  if (!product) {
    return { error: `Không tìm thấy sản phẩm với ID/SKU: ${productIdOrSku}` }
  }

  const forecasts = getForecastsByProduct(product.id, days)
  const driverSummary = getDemandDriversForProduct(product.id, days)
  const inv = getInventoryByProduct(product.id)
  const recentSales = getSalesByProduct(product.id, 28)
  const totalForecast = forecasts.reduce((sum, f) => sum + f.forecastQty, 0)
  const avgDaily = totalForecast / Math.max(1, forecasts.length)
  const totalRecentSales = recentSales.reduce((sum, s) => sum + s.quantity, 0)
  const currentStock = inv?.availableQty || 0
  const daysOfStock = avgDaily > 0 ? Math.round(currentStock / avgDaily) : 999

  return {
    product: {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: CATEGORY_LABELS[product.category],
      brand: product.brand,
      catalogSource: "danh_muc_bo_sung",
      sourceNote: DATA_LAYER_LABELS.catalog,
    },
    forecast: {
      days,
      totalForecastQty: Math.round(totalForecast),
      avgDailyDemand: avgDaily.toFixed(1),
      method: forecasts[0]?.method || "ml_ensemble",
    },
    drivers: {
      windowStartDate: driverSummary.windowStartDate,
      windowEndDate: driverSummary.windowEndDate,
      averageForecastQty: driverSummary.averageForecastQty,
      peakForecastQty: driverSummary.peakForecastQty,
      peakForecastDate: driverSummary.peakForecastDate,
      spikeThresholdQty: driverSummary.spikeThresholdQty,
      driverCounts: driverSummary.driverCounts,
      notableDates: driverSummary.drivers
        .filter((driver) => driver.type !== "weekend" || driver.alignsWithSpike)
        .slice(0, 10)
        .map((driver) => ({
          date: driver.date,
          label: driver.label,
          type: driver.type,
          source: driver.source,
          forecastQty: driver.forecastQty,
          liftVsAveragePct: driver.liftVsAveragePct,
          alignsWithSpike: driver.alignsWithSpike,
          sourceNote: driver.sourceNote,
        })),
      spikeAlignedDates: driverSummary.spikeAlignedDrivers.slice(0, 5).map((driver) => ({
        date: driver.date,
        label: driver.label,
        type: driver.type,
        source: driver.source,
        forecastQty: driver.forecastQty,
        liftVsAveragePct: driver.liftVsAveragePct,
        sourceNote: driver.sourceNote,
      })),
    },
    inventory: {
      currentStock,
      reorderPoint: inv?.reorderPoint || 0,
      daysOfStock,
      status: daysOfStock < 7 ? "low" : daysOfStock > 90 ? "high" : "normal",
    },
    recentSales: {
      last28Days: totalRecentSales,
      avgDaily: (totalRecentSales / 28).toFixed(1),
    },
    dataLineage: DATA_LAYER_LABELS,
  }
}

function localStockAlerts(type: string, severity: string, category: string | undefined, limit: number) {
  let alerts = [...stockAlerts]

  if (type !== "all") alerts = alerts.filter((a) => a.type === type)
  if (severity !== "all") alerts = alerts.filter((a) => a.severity === severity)
  if (category) {
    const normalizedCategory = category.toLowerCase()
    alerts = alerts.filter((a) =>
      a.category.toLowerCase() === normalizedCategory ||
      CATEGORY_LABELS[a.category].toLowerCase().includes(normalizedCategory)
    )
  }

  alerts = alerts.slice(0, limit)

  return {
    summary: {
      total: alerts.length,
      bySeverity: {
        critical: alerts.filter((a) => a.severity === "critical").length,
        warning: alerts.filter((a) => a.severity === "warning").length,
        info: alerts.filter((a) => a.severity === "info").length,
      },
      totalEstimatedImpact: alerts.reduce((sum, a) => sum + a.estimatedImpact, 0),
    },
    alerts: alerts.map((a) => ({
      productSku: a.productSku,
      productName: a.productName,
      category: CATEGORY_LABELS[a.category],
      type: a.type === "stockout_risk" ? "Rủi ro thiếu hàng" : a.type === "overstock" ? "Tồn kho dư" : "Hàng bán chậm",
      severity: a.severity === "critical" ? "Nghiêm trọng" : a.severity === "warning" ? "Cảnh báo" : "Thông tin",
      currentStock: a.currentStock,
      projectedDays: a.projectedDays,
      recommendation: a.recommendation,
      estimatedImpact: a.estimatedImpact,
    })),
  }
}

function localReplenishmentSuggestions(priority: string, category: string | undefined, limit: number) {
  let suggestions = [...replenishmentSuggestions]

  if (priority !== "all") suggestions = suggestions.filter((s) => s.priority === priority)
  if (category) {
    const normalizedCategory = category.toLowerCase()
    suggestions = suggestions.filter((s) =>
      s.category.toLowerCase() === normalizedCategory ||
      CATEGORY_LABELS[s.category].toLowerCase().includes(normalizedCategory)
    )
  }

  suggestions = suggestions.slice(0, limit)

  return {
    summary: {
      total: suggestions.length,
      byPriority: {
        urgent: suggestions.filter((s) => s.priority === "urgent").length,
        high: suggestions.filter((s) => s.priority === "high").length,
        medium: suggestions.filter((s) => s.priority === "medium").length,
        low: suggestions.filter((s) => s.priority === "low").length,
      },
      totalEstimatedCost: suggestions.reduce((sum, s) => sum + s.estimatedCost, 0),
    },
    suggestions: suggestions.map((s) => ({
      productSku: s.productSku,
      productName: s.productName,
      category: CATEGORY_LABELS[s.category],
      priority: s.priority === "urgent" ? "Khẩn cấp" : s.priority === "high" ? "Cao" : s.priority === "medium" ? "Trung bình" : "Thấp",
      suggestedQty: s.suggestedQty,
      estimatedCost: s.estimatedCost,
      currentStock: s.currentStock,
      reorderPoint: s.reorderPoint,
      supplierName: s.supplierName,
      reason: s.reason,
    })),
  }
}

function localSalesAnalytics(groupBy: string, days: number, limit: number) {
  if (groupBy === "category") {
    const categorySales = getCategorySalesSummary(days)
    return {
      period: `${days} ngày gần nhất`,
      groupBy: "Danh mục",
      data: categorySales
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit)
        .map((c) => ({ category: c.categoryLabel, revenue: c.revenue, quantity: c.quantity })),
      totalRevenue: categorySales.reduce((sum, c) => sum + c.revenue, 0),
    }
  }

  if (groupBy === "product") {
    const topProducts = getTopSellingProducts(days, limit)
    return {
      period: `${days} ngày gần nhất`,
      groupBy: "Sản phẩm bán chạy",
      data: topProducts.map((p) => ({
        productSku: p.productSku,
        productName: p.productName,
        category: p.category ? CATEGORY_LABELS[p.category] : "N/A",
        revenue: p.revenue,
        quantity: p.quantity,
      })),
      totalRevenue: topProducts.reduce((sum, p) => sum + p.revenue, 0),
    }
  }

  const kpis = getLocalDashboardKPIs()
  return {
    period: `${days} ngày gần nhất`,
    groupBy: "Kênh bán hàng",
    data: [
      { channel: "Bán lẻ (Retail)", percentage: 45, revenue: kpis.monthlyRevenue * 0.45 },
      { channel: "Bán buôn (Wholesale)", percentage: 35, revenue: kpis.monthlyRevenue * 0.35 },
      { channel: "Online", percentage: 20, revenue: kpis.monthlyRevenue * 0.2 },
    ],
    totalRevenue: kpis.monthlyRevenue,
  }
}

function localInventorySummary(category?: string) {
  let filteredProducts = products
  let filteredInventory = inventory

  if (category) {
    const normalizedCategory = category.toLowerCase()
    filteredProducts = products.filter((p) =>
      p.category.toLowerCase() === normalizedCategory ||
      CATEGORY_LABELS[p.category].toLowerCase().includes(normalizedCategory)
    )
    const productIds = new Set(filteredProducts.map((p) => p.id))
    filteredInventory = inventory.filter((i) => productIds.has(i.productId))
  }

  const totalQuantity = filteredInventory.reduce((sum, i) => sum + i.quantity, 0)
  const totalValue = filteredInventory.reduce((sum, i) => {
    const product = products.find((p) => p.id === i.productId)
    return sum + (product ? i.quantity * product.unitCost : 0)
  }, 0)
  const lowStock = filteredInventory.filter((i) => i.availableQty < i.reorderPoint).length
  const overstock = filteredInventory.filter((i) => i.availableQty > i.reorderPoint * 3).length

  return {
    category: category ? category : "Tất cả danh mục",
    totalSKUs: filteredProducts.length,
    totalQuantity,
    totalValue,
    lowStockCount: lowStock,
    overstockCount: overstock,
    healthStatus: lowStock > 10 ? "Cần chú ý - nhiều sản phẩm sắp hết hàng" : overstock > 20 ? "Cần tối ưu - nhiều sản phẩm tồn kho quá mức" : "Tốt",
  }
}

function localCompareProducts(productSkus: string[], days: number) {
  const comparison = productSkus.flatMap((query) => {
    const product = searchProducts(query)[0]
    if (!product) return []
    const inv = getInventoryByProduct(product.id)
    const sales = getSalesByProduct(product.id, days)
    const salesQuantity = sales.reduce((sum, s) => sum + s.quantity, 0)
    const revenue = sales.reduce((sum, s) => sum + s.revenue, 0)

    return [{
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      category: CATEGORY_LABELS[product.category],
      currentStock: inv?.availableQty || 0,
      salesQuantity,
      revenue,
      unitPrice: product.unitPrice,
    }]
  })

  if (comparison.length === 0) {
    return { error: "Không tìm thấy sản phẩm nào phù hợp để so sánh" }
  }

  return {
    period: `${days} ngày gần nhất`,
    productsCompared: comparison.length,
    comparison,
    bestSeller: comparison.reduce((best, curr) => curr.revenue > best.revenue ? curr : best).sku,
  }
}

function localDashboardKPIs() {
  const kpis = getLocalDashboardKPIs()
  return {
    overview: {
      totalSKUs: kpis.totalSKUs,
      activeSKUs: kpis.activeSKUs,
      totalInventoryValue: kpis.totalInventoryValue,
    },
    alerts: {
      stockoutRisk: kpis.stockoutRiskCount,
      overstock: kpis.overstockCount,
      slowMoving: kpis.slowMovingCount,
    },
    sales: {
      monthlyRevenue: kpis.monthlyRevenue,
      revenueChange: `${kpis.revenueChange >= 0 ? "+" : ""}${kpis.revenueChange}%`,
    },
    pendingActions: {
      replenishmentSuggestions: kpis.pendingOrders,
    },
  }
}

export const getProductForecastTool = tool({
  description: "Lấy dự báo nhu cầu cho một sản phẩm cụ thể trong khoảng thời gian nhất định. Sử dụng khi người dùng hỏi về dự báo, xu hướng nhu cầu của sản phẩm.",
  inputSchema: z.object({
    productIdOrSku: z.string().describe("ID hoặc SKU của sản phẩm cần xem dự báo"),
    days: z.number().default(28).describe("Số ngày dự báo (mặc định 28)"),
  }),
  execute: async ({ productIdOrSku, days }) => withFallback(
    await analyticsBackendClient.getProductForecast({ productIdOrSku, days }),
    () => localProductForecast(productIdOrSku, days)
  ),
})

export const getStockAlertsTool = tool({
  description: "Lấy danh sách cảnh báo tồn kho (hết hàng, tồn kho quá mức, hàng bán chậm). Sử dụng khi người dùng hỏi về sản phẩm có nguy cơ, cảnh báo, hoặc vấn đề tồn kho.",
  inputSchema: z.object({
    type: z.enum(["stockout_risk", "overstock", "slow_moving", "all"]).default("all").describe("Loại cảnh báo"),
    severity: z.enum(["critical", "warning", "info", "all"]).default("all").describe("Mức độ nghiêm trọng"),
    category: z.string().optional().describe("Danh mục sản phẩm"),
    limit: z.number().default(10).describe("Số lượng kết quả tối đa"),
  }),
  execute: async ({ type, severity, category, limit }) => withFallback(
    await analyticsBackendClient.getStockAlerts({ type, severity, category, limit }),
    () => localStockAlerts(type, severity, category, limit)
  ),
})

export const getReplenishmentSuggestionsTool = tool({
  description: "Lấy khuyến nghị đặt hàng. Sử dụng khi người dùng hỏi về khuyến nghị đặt hàng, nên mua gì, hoặc cần bổ sung sản phẩm nào.",
  inputSchema: z.object({
    priority: z.enum(["urgent", "high", "medium", "low", "all"]).default("all").describe("Mức độ ưu tiên của đề xuất"),
    category: z.string().optional().describe("Danh mục sản phẩm"),
    limit: z.number().default(10).describe("Số lượng khuyến nghị tối đa"),
  }),
  execute: async ({ priority, category, limit }) => withFallback(
    await analyticsBackendClient.getReplenishmentSuggestions({ priority, category, limit }),
    () => localReplenishmentSuggestions(priority, category, limit)
  ),
})

export const getSalesAnalyticsTool = tool({
  description: "Lấy phân tích doanh số bán hàng. Sử dụng khi người dùng hỏi về doanh số, bán được bao nhiêu, sản phẩm bán chạy, hoặc so sánh doanh thu.",
  inputSchema: z.object({
    groupBy: z.enum(["category", "product", "channel"]).default("category").describe("Nhóm theo"),
    days: z.number().default(28).describe("Số ngày phân tích"),
    limit: z.number().default(10).describe("Số lượng kết quả"),
  }),
  execute: async ({ groupBy, days, limit }) => withFallback(
    await analyticsBackendClient.getSalesAnalytics({ groupBy, days, limit }),
    () => localSalesAnalytics(groupBy, days, limit)
  ),
})

export const getInventorySummaryTool = tool({
  description: "Lấy tổng quan tồn kho. Sử dụng khi người dùng hỏi về tình trạng tồn kho, số lượng hàng, giá trị kho.",
  inputSchema: z.object({
    category: z.string().optional().describe("Danh mục cần xem (nếu không có thì xem tất cả)"),
  }),
  execute: async ({ category }) => withFallback(
    await analyticsBackendClient.getInventorySummary({ category }),
    () => localInventorySummary(category)
  ),
})

export const compareProductsTool = tool({
  description: "So sánh nhiều sản phẩm với nhau. Sử dụng khi người dùng muốn so sánh doanh số, tồn kho giữa các sản phẩm hoặc thương hiệu.",
  inputSchema: z.object({
    productSkus: z.array(z.string()).describe("Danh sách SKU hoặc tên sản phẩm cần so sánh"),
    days: z.number().default(28).describe("Số ngày phân tích"),
  }),
  execute: async ({ productSkus, days }) => withFallback(
    await analyticsBackendClient.compareProducts({ productSkus, days }),
    () => localCompareProducts(productSkus, days)
  ),
})

export const getDashboardKPIsTool = tool({
  description: "Lấy các chỉ số KPI tổng quan của dashboard. Sử dụng khi người dùng hỏi về tình hình kinh doanh chung, tổng quan.",
  inputSchema: z.object({}),
  execute: async () => withFallback(
    await analyticsBackendClient.getDashboardKPIs(),
    localDashboardKPIs
  ),
})

export const analyticsTools = {
  getProductForecast: getProductForecastTool,
  getStockAlerts: getStockAlertsTool,
  getReplenishmentSuggestions: getReplenishmentSuggestionsTool,
  getSalesAnalytics: getSalesAnalyticsTool,
  getInventorySummary: getInventorySummaryTool,
  compareProducts: compareProductsTool,
  getDashboardKPIs: getDashboardKPIsTool,
}
