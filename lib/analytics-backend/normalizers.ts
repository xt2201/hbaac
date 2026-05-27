function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function stringValue(value: unknown, fallback = "N/A") {
  return typeof value === "string" && value.trim() ? value : fallback
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : []
}

function unwrap(raw: unknown) {
  if (!isRecord(raw)) return raw
  if ("data" in raw) return raw.data
  if ("result" in raw) return raw.result
  return raw
}

function severitySummary(alerts: Array<Record<string, unknown>>) {
  return {
    critical: alerts.filter((alert) => stringValue(alert.severity, "").toLowerCase().includes("critical") || stringValue(alert.severity, "").toLowerCase().includes("nghiêm")).length,
    warning: alerts.filter((alert) => stringValue(alert.severity, "").toLowerCase().includes("warning") || stringValue(alert.severity, "").toLowerCase().includes("cảnh")).length,
    info: alerts.filter((alert) => stringValue(alert.severity, "").toLowerCase().includes("info") || stringValue(alert.severity, "").toLowerCase().includes("thông")).length,
  }
}

function prioritySummary(suggestions: Array<Record<string, unknown>>) {
  return {
    urgent: suggestions.filter((item) => ["urgent", "khẩn cấp"].includes(stringValue(item.priority, "").toLowerCase())).length,
    high: suggestions.filter((item) => ["high", "cao"].includes(stringValue(item.priority, "").toLowerCase())).length,
    medium: suggestions.filter((item) => ["medium", "trung bình"].includes(stringValue(item.priority, "").toLowerCase())).length,
    low: suggestions.filter((item) => ["low", "thấp"].includes(stringValue(item.priority, "").toLowerCase())).length,
  }
}

export function normalizeProductForecastResponse(raw: unknown, input: { days: number }) {
  const data = unwrap(raw)
  if (!isRecord(data)) return null
  const product = isRecord(data.product) ? data.product : data
  const forecast = isRecord(data.forecast) ? data.forecast : data
  const inventory = isRecord(data.inventory) ? data.inventory : data
  const recentSales = isRecord(data.recentSales) ? data.recentSales : data

  return {
    product: {
      id: stringValue(product.id ?? product.productId),
      sku: stringValue(product.sku ?? product.productSku),
      name: stringValue(product.name ?? product.productName),
      category: stringValue(product.category),
      brand: stringValue(product.brand),
    },
    forecast: {
      days: numberValue(forecast.days, input.days),
      totalForecastQty: numberValue(forecast.totalForecastQty ?? forecast.totalQuantity ?? forecast.quantity),
      avgDailyDemand: String(forecast.avgDailyDemand ?? forecast.averageDailyDemand ?? (numberValue(forecast.totalForecastQty) / input.days || "0")),
      method: stringValue(forecast.method, "backend"),
    },
    inventory: {
      currentStock: numberValue(inventory.currentStock ?? inventory.availableQty ?? inventory.quantity),
      reorderPoint: numberValue(inventory.reorderPoint),
      daysOfStock: numberValue(inventory.daysOfStock, 0),
      status: stringValue(inventory.status, "normal"),
    },
    recentSales: {
      last30Days: numberValue(recentSales.last30Days ?? recentSales.quantity),
      avgDaily: String(recentSales.avgDaily ?? "0"),
    },
  }
}

export function normalizeStockAlertsResponse(raw: unknown) {
  const data = unwrap(raw)
  if (!isRecord(data)) return null
  const alerts = arrayValue(data.alerts ?? data.items).map((item) => {
    const alert = isRecord(item) ? item : {}
    return {
      productSku: stringValue(alert.productSku ?? alert.sku),
      productName: stringValue(alert.productName ?? alert.name),
      category: stringValue(alert.category),
      type: stringValue(alert.type),
      severity: stringValue(alert.severity),
      currentStock: numberValue(alert.currentStock ?? alert.stock),
      projectedDays: numberValue(alert.projectedDays ?? alert.daysRemaining),
      recommendation: stringValue(alert.recommendation),
      estimatedImpact: numberValue(alert.estimatedImpact ?? alert.impact),
    }
  })
  const summary = isRecord(data.summary) ? data.summary : {}

  return {
    summary: {
      total: numberValue(summary.total, alerts.length),
      bySeverity: isRecord(summary.bySeverity) ? summary.bySeverity : severitySummary(alerts),
      totalEstimatedImpact: numberValue(summary.totalEstimatedImpact, alerts.reduce((sum, alert) => sum + alert.estimatedImpact, 0)),
    },
    alerts,
  }
}

export function normalizeReplenishmentResponse(raw: unknown) {
  const data = unwrap(raw)
  if (!isRecord(data)) return null
  const suggestions = arrayValue(data.suggestions ?? data.items).map((item) => {
    const suggestion = isRecord(item) ? item : {}
    return {
      productSku: stringValue(suggestion.productSku ?? suggestion.sku),
      productName: stringValue(suggestion.productName ?? suggestion.name),
      category: stringValue(suggestion.category),
      priority: stringValue(suggestion.priority),
      suggestedQty: numberValue(suggestion.suggestedQty ?? suggestion.quantity),
      estimatedCost: numberValue(suggestion.estimatedCost ?? suggestion.cost),
      currentStock: numberValue(suggestion.currentStock ?? suggestion.stock),
      reorderPoint: numberValue(suggestion.reorderPoint),
      supplierName: stringValue(suggestion.supplierName ?? suggestion.supplier),
      reason: stringValue(suggestion.reason),
    }
  })
  const summary = isRecord(data.summary) ? data.summary : {}

  return {
    summary: {
      total: numberValue(summary.total, suggestions.length),
      byPriority: isRecord(summary.byPriority) ? summary.byPriority : prioritySummary(suggestions),
      totalEstimatedCost: numberValue(summary.totalEstimatedCost, suggestions.reduce((sum, item) => sum + item.estimatedCost, 0)),
    },
    suggestions,
  }
}

export function normalizeSalesAnalyticsResponse(raw: unknown, input: { days: number; groupBy: string }) {
  const data = unwrap(raw)
  if (!isRecord(data)) return null
  const rows = arrayValue(data.data ?? data.items).map((item) => {
    const row = isRecord(item) ? item : {}
    return {
      ...row,
      revenue: "revenue" in row ? numberValue(row.revenue) : undefined,
      quantity: "quantity" in row ? numberValue(row.quantity) : undefined,
      percentage: "percentage" in row ? numberValue(row.percentage) : undefined,
    }
  })

  return {
    period: stringValue(data.period, `${input.days} ngày gần nhất`),
    groupBy: stringValue(data.groupBy, input.groupBy),
    data: rows,
    totalRevenue: numberValue(data.totalRevenue, rows.reduce((sum, item) => sum + numberValue(item.revenue), 0)),
  }
}

export function normalizeInventorySummaryResponse(raw: unknown, input: { category?: string }) {
  const data = unwrap(raw)
  if (!isRecord(data)) return null

  return {
    category: stringValue(data.category, input.category ?? "Tất cả danh mục"),
    totalSKUs: numberValue(data.totalSKUs ?? data.totalSkus),
    totalQuantity: numberValue(data.totalQuantity),
    totalValue: numberValue(data.totalValue),
    lowStockCount: numberValue(data.lowStockCount),
    overstockCount: numberValue(data.overstockCount),
    healthStatus: stringValue(data.healthStatus, "N/A"),
  }
}

export function normalizeCompareProductsResponse(raw: unknown, input: { days: number }) {
  const data = unwrap(raw)
  if (!isRecord(data)) return null
  const comparison = arrayValue(data.comparison ?? data.products ?? data.items).map((item) => {
    const product = isRecord(item) ? item : {}
    return {
      sku: stringValue(product.sku ?? product.productSku),
      name: stringValue(product.name ?? product.productName),
      brand: stringValue(product.brand),
      category: stringValue(product.category),
      currentStock: numberValue(product.currentStock ?? product.stock),
      salesQuantity: numberValue(product.salesQuantity ?? product.quantity),
      revenue: numberValue(product.revenue),
      unitPrice: numberValue(product.unitPrice ?? product.price),
    }
  })

  return {
    period: stringValue(data.period, `${input.days} ngày gần nhất`),
    productsCompared: numberValue(data.productsCompared, comparison.length),
    comparison,
    bestSeller: stringValue(data.bestSeller, comparison.reduce((best, current) => current.revenue > best.revenue ? current : best, comparison[0] ?? { sku: "N/A", revenue: 0 }).sku),
  }
}

export function normalizeDashboardKPIsResponse(raw: unknown) {
  const data = unwrap(raw)
  if (!isRecord(data)) return null
  const overview = isRecord(data.overview) ? data.overview : data
  const alerts = isRecord(data.alerts) ? data.alerts : data
  const sales = isRecord(data.sales) ? data.sales : data
  const pendingActions = isRecord(data.pendingActions) ? data.pendingActions : data

  return {
    overview: {
      totalSKUs: numberValue(overview.totalSKUs ?? overview.totalSkus),
      activeSKUs: numberValue(overview.activeSKUs ?? overview.activeSkus),
      totalInventoryValue: numberValue(overview.totalInventoryValue),
    },
    alerts: {
      stockoutRisk: numberValue(alerts.stockoutRisk ?? alerts.stockoutRiskCount),
      overstock: numberValue(alerts.overstock ?? alerts.overstockCount),
      slowMoving: numberValue(alerts.slowMoving ?? alerts.slowMovingCount),
    },
    sales: {
      monthlyRevenue: numberValue(sales.monthlyRevenue),
      revenueChange: String(sales.revenueChange ?? "0%"),
    },
    pendingActions: {
      replenishmentSuggestions: numberValue(pendingActions.replenishmentSuggestions ?? pendingActions.pendingOrders),
    },
  }
}
