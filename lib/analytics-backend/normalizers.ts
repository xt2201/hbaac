function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function stringValue(value: unknown, fallback = "Chưa có") {
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
  const drivers = isRecord(data.drivers) ? data.drivers : undefined
  const dataLineage = isRecord(data.dataLineage) ? data.dataLineage : undefined
  const inventory = isRecord(data.inventory) ? data.inventory : data
  const recentSales = isRecord(data.recentSales) ? data.recentSales : data

  return {
    product: {
      id: stringValue(product.id ?? product.productId),
      sku: stringValue(product.sku ?? product.productSku),
      name: stringValue(product.name ?? product.productName),
      category: stringValue(product.category),
      brand: stringValue(product.brand),
      catalogSource: stringValue(product.catalogSource, "Thông tin danh mục vận hành"),
      sourceNote: stringValue(product.sourceNote, "Thông tin danh mục, tồn kho và điểm đặt hàng phục vụ vận hành."),
    },
    forecast: {
      days: numberValue(forecast.days, input.days),
      totalForecastQty: numberValue(forecast.totalForecastQty ?? forecast.totalQuantity ?? forecast.quantity),
      avgDailyDemand: String(forecast.avgDailyDemand ?? forecast.averageDailyDemand ?? (numberValue(forecast.totalForecastQty) / input.days || "0")),
      method: stringValue(forecast.method, "Mô hình dự báo nhu cầu"),
    },
    drivers,
    inventory: {
      currentStock: numberValue(inventory.currentStock ?? inventory.availableQty ?? inventory.quantity),
      reorderPoint: numberValue(inventory.reorderPoint),
      daysOfStock: numberValue(inventory.daysOfStock, 0),
      status: stringValue(inventory.status, "normal"),
      targetStock: numberValue(inventory.targetStock ?? inventory.recommendedOrderTarget),
      purchaseQty: numberValue(inventory.purchaseQty ?? inventory.suggestedQty),
      demand28: numberValue(inventory.demand28 ?? inventory.forecastDemand28),
      economicOrderQty: numberValue(inventory.economicOrderQty ?? inventory.eoq),
      safetyStock: numberValue(inventory.safetyStock),
      leadTimeDays: numberValue(inventory.leadTimeDays),
      minOrderQty: numberValue(inventory.minOrderQty),
      cycleTimeDays: "cycleTimeDays" in inventory ? numberValue(inventory.cycleTimeDays) : undefined,
      policySource: stringValue(inventory.policySource ?? inventory.inventoryPolicySource, "fallback"),
      policyNote: stringValue(inventory.policyNote ?? inventory.inventoryPolicyNote, "Thông tin tồn kho vận hành."),
    },
    recentSales: {
      last30Days: numberValue(recentSales.last30Days ?? recentSales.quantity),
      avgDaily: String(recentSales.avgDaily ?? "0"),
    },
    dataLineage,
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
      purchaseQty: numberValue(suggestion.purchaseQty ?? suggestion.suggestedQty ?? suggestion.quantity),
      estimatedCost: numberValue(suggestion.estimatedCost ?? suggestion.cost),
      currentStock: numberValue(suggestion.currentStock ?? suggestion.stock),
      reorderPoint: numberValue(suggestion.reorderPoint),
      targetStock: numberValue(suggestion.targetStock ?? suggestion.recommendedOrderTarget),
      demand28: numberValue(suggestion.demand28 ?? suggestion.forecastDemand28),
      economicOrderQty: numberValue(suggestion.economicOrderQty ?? suggestion.eoq),
      safetyStock: numberValue(suggestion.safetyStock),
      leadTimeDays: numberValue(suggestion.leadTimeDays),
      minOrderQty: numberValue(suggestion.minOrderQty),
      cycleTimeDays: "cycleTimeDays" in suggestion ? numberValue(suggestion.cycleTimeDays) : undefined,
      unitCost: numberValue(suggestion.unitCost),
      grossMarginPerUnit: numberValue(suggestion.grossMarginPerUnit),
      expectedProfitSaved: numberValue(suggestion.expectedProfitSaved),
      roi: numberValue(suggestion.roi),
      policySource: stringValue(suggestion.policySource ?? suggestion.inventoryPolicySource, "fallback"),
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
    healthStatus: stringValue(data.healthStatus, "Chưa có"),
    policySummary: isRecord(data.policySummary) ? data.policySummary : undefined,
    fieldExplanations: isRecord(data.fieldExplanations) ? data.fieldExplanations : undefined,
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
    bestSeller: stringValue(data.bestSeller, comparison.reduce((best, current) => current.revenue > best.revenue ? current : best, comparison[0] ?? { sku: "Chưa có", revenue: 0 }).sku),
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
