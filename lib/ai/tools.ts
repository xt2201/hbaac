// AutoParts Intelligence Platform - AI Tools for AnalyticsBot

import { tool } from "ai"
import { z } from "zod"
import {
  products,
  stockAlerts,
  replenishmentSuggestions,
  inventory,
  getForecastsByProduct,
  getSalesByProduct,
  getProductsByCategory,
  searchProducts,
  getDashboardKPIs,
  getCategorySalesSummary,
  getTopSellingProducts,
  getProductById,
  getInventoryByProduct,
  CATEGORY_LABELS,
  CATEGORIES,
} from "@/lib/mock-data"
import type { ProductCategory } from "@/types"

// Tool 1: Get Product Forecast
export const getProductForecastTool = tool({
  description: "Lấy dự báo nhu cầu cho một sản phẩm cụ thể trong khoảng thời gian nhất định. Sử dụng khi người dùng hỏi về dự báo, xu hướng nhu cầu của sản phẩm.",
  inputSchema: z.object({
    productIdOrSku: z.string().describe("ID hoặc SKU của sản phẩm cần xem dự báo"),
    days: z.number().default(30).describe("Số ngày dự báo (mặc định 30)"),
  }),
  execute: async ({ productIdOrSku, days }) => {
    // Find product
    let product = products.find(
      (p) => p.id === productIdOrSku || p.sku.toLowerCase() === productIdOrSku.toLowerCase()
    )
    
    if (!product) {
      // Try partial match
      const matches = searchProducts(productIdOrSku)
      if (matches.length > 0) {
        product = matches[0]
      }
    }

    if (!product) {
      return { error: `Không tìm thấy sản phẩm với ID/SKU: ${productIdOrSku}` }
    }

    const forecasts = getForecastsByProduct(product.id, days)
    const inv = getInventoryByProduct(product.id)
    const recentSales = getSalesByProduct(product.id, 30)
    
    const totalForecast = forecasts.reduce((sum, f) => sum + f.forecastQty, 0)
    const avgDaily = totalForecast / days
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
      },
      forecast: {
        days,
        totalForecastQty: Math.round(totalForecast),
        avgDailyDemand: avgDaily.toFixed(1),
        method: forecasts[0]?.method || "ml_ensemble",
      },
      inventory: {
        currentStock,
        reorderPoint: inv?.reorderPoint || 0,
        daysOfStock,
        status: daysOfStock < 7 ? "low" : daysOfStock > 90 ? "high" : "normal",
      },
      recentSales: {
        last30Days: totalRecentSales,
        avgDaily: (totalRecentSales / 30).toFixed(1),
      },
    }
  },
})

// Tool 2: Get Stock Alerts
export const getStockAlertsTool = tool({
  description: "Lấy danh sách cảnh báo tồn kho (hết hàng, tồn kho quá mức, hàng bán chậm). Sử dụng khi người dùng hỏi về sản phẩm có nguy cơ, cảnh báo, hoặc vấn đề tồn kho.",
  inputSchema: z.object({
    type: z.enum(["stockout_risk", "overstock", "slow_moving", "all"]).default("all")
      .describe("Loại cảnh báo: stockout_risk (hết hàng), overstock (tồn kho quá mức), slow_moving (bán chậm), all (tất cả)"),
    severity: z.enum(["critical", "warning", "info", "all"]).default("all")
      .describe("Mức độ nghiêm trọng"),
    category: z.string().optional().describe("Danh mục sản phẩm (Brake, Engine, Suspension, etc.)"),
    limit: z.number().default(10).describe("Số lượng kết quả tối đa"),
  }),
  execute: async ({ type, severity, category, limit }) => {
    let alerts = [...stockAlerts]

    if (type !== "all") {
      alerts = alerts.filter((a) => a.type === type)
    }
    if (severity !== "all") {
      alerts = alerts.filter((a) => a.severity === severity)
    }
    if (category) {
      const normalizedCategory = category.toLowerCase()
      alerts = alerts.filter((a) => 
        a.category.toLowerCase() === normalizedCategory ||
        CATEGORY_LABELS[a.category].toLowerCase().includes(normalizedCategory)
      )
    }

    alerts = alerts.slice(0, limit)

    const summary = {
      total: alerts.length,
      bySeverity: {
        critical: alerts.filter((a) => a.severity === "critical").length,
        warning: alerts.filter((a) => a.severity === "warning").length,
        info: alerts.filter((a) => a.severity === "info").length,
      },
      totalEstimatedImpact: alerts.reduce((sum, a) => sum + a.estimatedImpact, 0),
    }

    return {
      summary,
      alerts: alerts.map((a) => ({
        productSku: a.productSku,
        productName: a.productName,
        category: CATEGORY_LABELS[a.category],
        type: a.type === "stockout_risk" ? "Nguy cơ hết hàng" 
          : a.type === "overstock" ? "Tồn kho quá mức" 
          : "Hàng bán chậm",
        severity: a.severity === "critical" ? "Nghiêm trọng" 
          : a.severity === "warning" ? "Cảnh báo" 
          : "Thông tin",
        currentStock: a.currentStock,
        projectedDays: a.projectedDays,
        recommendation: a.recommendation,
        estimatedImpact: a.estimatedImpact,
      })),
    }
  },
})

// Tool 3: Get Replenishment Suggestions
export const getReplenishmentSuggestionsTool = tool({
  description: "Lấy đề xuất bổ sung hàng. Sử dụng khi người dùng hỏi về đề xuất đặt hàng, nên mua gì, hoặc cần bổ sung sản phẩm nào.",
  inputSchema: z.object({
    priority: z.enum(["urgent", "high", "medium", "low", "all"]).default("all")
      .describe("Mức độ ưu tiên của đề xuất"),
    category: z.string().optional().describe("Danh mục sản phẩm"),
    limit: z.number().default(10).describe("Số lượng đề xuất tối đa"),
  }),
  execute: async ({ priority, category, limit }) => {
    let suggestions = [...replenishmentSuggestions]

    if (priority !== "all") {
      suggestions = suggestions.filter((s) => s.priority === priority)
    }
    if (category) {
      const normalizedCategory = category.toLowerCase()
      suggestions = suggestions.filter((s) =>
        s.category.toLowerCase() === normalizedCategory ||
        CATEGORY_LABELS[s.category].toLowerCase().includes(normalizedCategory)
      )
    }

    suggestions = suggestions.slice(0, limit)

    const summary = {
      total: suggestions.length,
      byPriority: {
        urgent: suggestions.filter((s) => s.priority === "urgent").length,
        high: suggestions.filter((s) => s.priority === "high").length,
        medium: suggestions.filter((s) => s.priority === "medium").length,
        low: suggestions.filter((s) => s.priority === "low").length,
      },
      totalEstimatedCost: suggestions.reduce((sum, s) => sum + s.estimatedCost, 0),
    }

    return {
      summary,
      suggestions: suggestions.map((s) => ({
        productSku: s.productSku,
        productName: s.productName,
        category: CATEGORY_LABELS[s.category],
        priority: s.priority === "urgent" ? "Khẩn cấp"
          : s.priority === "high" ? "Cao"
          : s.priority === "medium" ? "Trung bình"
          : "Thấp",
        suggestedQty: s.suggestedQty,
        estimatedCost: s.estimatedCost,
        currentStock: s.currentStock,
        reorderPoint: s.reorderPoint,
        supplierName: s.supplierName,
        reason: s.reason,
      })),
    }
  },
})

// Tool 4: Get Sales Analytics
export const getSalesAnalyticsTool = tool({
  description: "Lấy phân tích doanh số bán hàng. Sử dụng khi người dùng hỏi về doanh số, bán được bao nhiêu, sản phẩm bán chạy, hoặc so sánh doanh thu.",
  inputSchema: z.object({
    groupBy: z.enum(["category", "product", "channel"]).default("category")
      .describe("Nhóm theo: category (danh mục), product (sản phẩm bán chạy), channel (kênh bán)"),
    days: z.number().default(30).describe("Số ngày phân tích"),
    limit: z.number().default(10).describe("Số lượng kết quả"),
  }),
  execute: async ({ groupBy, days, limit }) => {
    if (groupBy === "category") {
      const categorySales = getCategorySalesSummary(days)
      return {
        period: `${days} ngày gần nhất`,
        groupBy: "Danh mục",
        data: categorySales
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, limit)
          .map((c) => ({
            category: c.categoryLabel,
            revenue: c.revenue,
            quantity: c.quantity,
          })),
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

    // groupBy === "channel"
    const kpis = getDashboardKPIs()
    return {
      period: `${days} ngày gần nhất`,
      groupBy: "Kênh bán hàng",
      data: [
        { channel: "Bán lẻ (Retail)", percentage: 45 },
        { channel: "Bán buôn (Wholesale)", percentage: 35 },
        { channel: "Online", percentage: 20 },
      ],
      totalRevenue: kpis.monthlyRevenue,
    }
  },
})

// Tool 5: Get Inventory Summary
export const getInventorySummaryTool = tool({
  description: "Lấy tổng quan tồn kho. Sử dụng khi người dùng hỏi về tình trạng tồn kho, số lượng hàng, giá trị kho.",
  inputSchema: z.object({
    category: z.string().optional().describe("Danh mục cần xem (nếu không có thì xem tất cả)"),
  }),
  execute: async ({ category }) => {
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
      healthStatus: lowStock > 10 ? "Cần chú ý - nhiều sản phẩm sắp hết hàng" 
        : overstock > 20 ? "Cần tối ưu - nhiều sản phẩm tồn kho quá mức"
        : "Tốt",
    }
  },
})

// Tool 6: Compare Products
export const compareProductsTool = tool({
  description: "So sánh nhiều sản phẩm với nhau. Sử dụng khi người dùng muốn so sánh doanh số, tồn kho giữa các sản phẩm hoặc thương hiệu.",
  inputSchema: z.object({
    productSkus: z.array(z.string()).describe("Danh sách SKU hoặc tên sản phẩm cần so sánh"),
    days: z.number().default(30).describe("Số ngày phân tích"),
  }),
  execute: async ({ productSkus, days }) => {
    const comparisonData = []

    for (const query of productSkus) {
      const matches = searchProducts(query)
      if (matches.length === 0) continue

      const product = matches[0]
      const inv = getInventoryByProduct(product.id)
      const sales = getSalesByProduct(product.id, days)
      const totalSales = sales.reduce((sum, s) => sum + s.quantity, 0)
      const totalRevenue = sales.reduce((sum, s) => sum + s.revenue, 0)

      comparisonData.push({
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        category: CATEGORY_LABELS[product.category],
        currentStock: inv?.availableQty || 0,
        salesQuantity: totalSales,
        revenue: totalRevenue,
        unitPrice: product.unitPrice,
      })
    }

    if (comparisonData.length === 0) {
      return { error: "Không tìm thấy sản phẩm nào phù hợp để so sánh" }
    }

    return {
      period: `${days} ngày gần nhất`,
      productsCompared: comparisonData.length,
      comparison: comparisonData,
      bestSeller: comparisonData.reduce((best, curr) => 
        curr.revenue > best.revenue ? curr : best
      ).sku,
    }
  },
})

// Tool 7: Get Dashboard KPIs
export const getDashboardKPIsTool = tool({
  description: "Lấy các chỉ số KPI tổng quan của dashboard. Sử dụng khi người dùng hỏi về tình hình kinh doanh chung, tổng quan.",
  inputSchema: z.object({}),
  execute: async () => {
    const kpis = getDashboardKPIs()
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
  },
})

// Export all tools
export const analyticsTools = {
  getProductForecast: getProductForecastTool,
  getStockAlerts: getStockAlertsTool,
  getReplenishmentSuggestions: getReplenishmentSuggestionsTool,
  getSalesAnalytics: getSalesAnalyticsTool,
  getInventorySummary: getInventorySummaryTool,
  compareProducts: compareProductsTool,
  getDashboardKPIs: getDashboardKPIsTool,
}
