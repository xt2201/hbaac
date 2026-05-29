// Công cụ dữ liệu cho Trợ lý phân tích

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
  getInventoryPoliciesBySku,
  getInventoryPolicyByProduct,
  getInventoryPolicyBySkuMonth,
  getInventoryOptimizationSummary,
  inventoryOptimizationPolicies,
  getDecisionQueueItems,
  getProfitCommandCenter,
  HBAAC_DATASET_INFO,
  HBAAC_CALENDAR_SUMMARY,
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
  const policy = getInventoryPolicyByProduct(product.id)
  const purchaseQty = policy ? Math.max(0, Math.ceil(policy.recommendedOrderTarget)) : 0

  return {
    product: {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: CATEGORY_LABELS[product.category],
      brand: product.brand,
      catalogSource: "Không có master catalog trong 3 file nguồn",
      sourceNote: "Product identity là SKU; category/brand/supplier/current stock/MOQ không có trong nguồn.",
    },
    forecast: {
      days,
      totalForecastQty: Math.round(totalForecast),
      avgDailyDemand: avgDaily.toFixed(1),
      method: forecasts[0]?.method || "Mô hình dự báo nhu cầu",
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
      currentStock: null,
      reorderPoint: inv?.reorderPoint || 0,
      daysOfStock: null,
      status: "source_policy",
      recommendedOrder: policy?.recommendedOrderTarget,
      purchaseQty,
      demand28: policy?.demand28,
      economicOrderQty: policy?.economicOrderQty,
      safetyStock: policy?.safetyStock ?? inv?.safetyStock,
      leadTimeDays: null,
      minOrderQty: null,
      cycleTimeDays: policy?.cycleTimeDays,
      policySource: policy ? "inventory_plan" : "fallback",
      policyNote: policy?.inventoryPolicyNote ?? DATA_LAYER_LABELS.catalog,
    },
    recentSales: {
      last28Days: totalRecentSales,
      avgDaily: (totalRecentSales / 28).toFixed(1),
    },
    dataLineage: {
      sales: DATA_LAYER_LABELS.competition,
      calendar: DATA_LAYER_LABELS.calendar,
      catalog: DATA_LAYER_LABELS.catalog,
      inventoryPolicy: DATA_LAYER_LABELS.inventoryPolicy,
    },
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
      purchaseQty: s.purchaseQty ?? s.suggestedQty,
      estimatedCost: s.estimatedCost,
      currentStock: null,
      reorderPoint: s.reorderPoint,
      recommendedOrder: s.recommendedOrderTarget ?? s.suggestedQty,
      demand28: s.demand28,
      economicOrderQty: s.economicOrderQty,
      safetyStock: s.safetyStock,
      leadTimeDays: null,
      minOrderQty: null,
      cycleTimeDays: s.cycleTimeDays,
      grossMarginPerUnit: s.grossMarginPerUnit,
      expectedProfitSaved: s.expectedProfitSaved,
      roi: s.roi,
      policySource: s.inventoryPolicySource,
      supplierName: "Nhà cung ứng ưu tiên",
      reason: s.reason,
      sourceNote: "Dựa trên dữ liệu bán hàng, dự báo nhu cầu và chính sách tồn kho; nguồn hiện tại chưa có ERP stock/MOQ/supplier thật.",
    })),
  }
}

function localInventoryPolicy(productIdOrSku: string | undefined, month: 1 | 2, view: string, limit: number) {
  const summaries = [getInventoryOptimizationSummary(1), getInventoryOptimizationSummary(2)]
  const fieldExplanations = {
    EOQ: "Economic Order Quantity: lot size kinh tế từ demand và chi phí đặt/tồn kho.",
    ROP: "Reorder Point: ngưỡng đặt hàng lại theo chính sách tồn kho.",
    safetyStock: "Tồn kho an toàn để buffer biến động demand.",
    recommendedOrder: "Recommended_Order là số lượng đề xuất theo chính sách tồn kho.",
    purchaseQty: "Purchase Qty trong demo nguồn-dữ-liệu này bằng Recommended_Order vì chưa có ERP stock feed.",
    month1Month2: "Month 1 là 28 ngày forecast đầu; Month 2 là 28 ngày forecast kế tiếp.",
  }

  const policyRow = (policy: (typeof inventoryOptimizationPolicies)[number]) => {
    const product = products.find((item) => item.sku.toLowerCase() === policy.sku.toLowerCase())
    const inv = product ? getInventoryByProduct(product.id) : null
    const suggestion = product ? replenishmentSuggestions.find((item) => item.productId === product.id) : undefined
    const purchaseQty = suggestion?.purchaseQty ?? Math.max(0, Math.ceil(policy.recommendedOrderTarget))
    const unitCost = suggestion?.unitCost ?? policy.unitCost
    return {
      productId: product?.id,
      productSku: policy.sku,
      productName: product?.name ?? policy.sku,
      category: product ? CATEGORY_LABELS[product.category] : "Chưa có",
      month: policy.month,
      demand28: policy.demand28,
      avgDailyDemand: policy.meanDaily,
      economicOrderQty: policy.economicOrderQty,
      safetyStock: policy.safetyStock,
      reorderPoint: policy.reorderPoint,
      recommendedOrder: policy.recommendedOrderTarget,
      currentStock: null,
      purchaseQty,
      unitCost,
      estimatedCost: Math.round(purchaseQty * unitCost),
      cycleTimeDays: policy.cycleTimeDays,
      totalAnnualCost: policy.totalAnnualCost,
      policySource: policy.inventoryPolicySource,
      sourceNote: "Nguồn hiện tại chưa có ERP stock/supplier/MOQ thật; chính sách tồn kho được tính từ dự báo nhu cầu.",
    }
  }

  if (productIdOrSku) {
    const product = products.find((item) => item.id === productIdOrSku || item.sku.toLowerCase() === productIdOrSku.toLowerCase()) ?? searchProducts(productIdOrSku)[0]
    const policy = product ? getInventoryPolicyByProduct(product.id, month) : getInventoryPolicyBySkuMonth(productIdOrSku, month)
    if (!policy) {
      return {
        error: `Chưa có inventory policy cho ${productIdOrSku}. Dashboard đang dùng fallback rule.`,
        summaries,
        fieldExplanations,
        source: DATA_LAYER_LABELS.inventoryPolicy,
      }
    }
    return {
      mode: "sku",
      policy: policyRow(policy),
      allMonths: getInventoryPoliciesBySku(policy.sku).map(policyRow),
      summaries,
      fieldExplanations,
      source: DATA_LAYER_LABELS.inventoryPolicy,
    }
  }

  const rows = inventoryOptimizationPolicies
    .filter((policy) => policy.month === month)
    .map(policyRow)

  const ranked = [...rows].sort((left, right) => {
    if (view === "top_cost") return right.totalAnnualCost - left.totalAnnualCost
    return right.purchaseQty - left.purchaseQty || right.totalAnnualCost - left.totalAnnualCost
  }).slice(0, limit)

  return {
    mode: view,
    month,
    summaries,
    rows: ranked,
    fieldExplanations,
    source: DATA_LAYER_LABELS.inventoryPolicy,
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
        category: p.category ? CATEGORY_LABELS[p.category] : "Chưa có",
        revenue: p.revenue,
        quantity: p.quantity,
      })),
      totalRevenue: topProducts.reduce((sum, p) => sum + p.revenue, 0),
    }
  }

  const topProducts = getTopSellingProducts(days, limit)
  return {
    period: `${days} ngày gần nhất`,
    groupBy: "Sản phẩm bán chạy",
    data: topProducts.map((p) => ({
      productSku: p.productSku,
      productName: p.productName,
      category: p.category ? CATEGORY_LABELS[p.category] : "Chưa có",
      revenue: p.revenue,
      quantity: p.quantity,
    })),
    totalRevenue: topProducts.reduce((sum, p) => sum + p.revenue, 0),
    sourceNote: "Theo dữ liệu bán hàng; nguồn hiện tại không có kênh bán hàng thật.",
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

  const policySummary = getInventoryOptimizationSummary(1)

  return {
    category: category ? category : "Tất cả danh mục",
    totalSKUs: filteredProducts.length,
    totalQuantity,
    totalValue,
    lowStockCount: lowStock,
    overstockCount: overstock,
    healthStatus: lowStock > 10 ? "Cần chú ý - nhiều sản phẩm sắp hết hàng" : overstock > 20 ? "Cần tối ưu - nhiều sản phẩm tồn kho quá mức" : "Tốt",
    policySummary: {
      month: policySummary.month,
      skuCount: policySummary.skuCount,
      demand28: policySummary.totalDemand28,
      targetStock: policySummary.totalRecommendedOrderTarget,
      safetyStock: policySummary.totalSafetyStock,
      annualizedCost: policySummary.totalAnnualCost,
      averageCycleTimeDays: policySummary.averageCycleTimeDays,
      source: DATA_LAYER_LABELS.inventoryPolicy,
    },
    fieldExplanations: {
      EOQ: "Economic Order Quantity: lot size kinh tế từ demand và chi phí đặt/tồn kho.",
      ROP: "Reorder Point: ngưỡng đặt hàng lại theo chính sách tồn kho.",
      safetyStock: "Tồn kho an toàn để buffer biến động demand.",
      targetStock: "Tồn kho mục tiêu từ optimizer; không phải số lượng cần mua trực tiếp.",
      purchaseQty: "SL cần mua trong demo nguồn-dữ-liệu này bằng Recommended_Order vì chưa có ERP stock feed.",
    },
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

function expectedProfitSaved(suggestion: (typeof replenishmentSuggestions)[number]) {
  const product = products.find((p) => p.id === suggestion.productId)
  const inv = getInventoryByProduct(suggestion.productId)
  const forecasts = getForecastsByProduct(suggestion.productId, 56)
  const totalForecast = forecasts.reduce((sum, forecast) => sum + forecast.forecastQty, 0)
  const margin = Math.max(1, (product?.unitPrice ?? 0) - (product?.unitCost ?? 0))
  const protectedQty = Math.min(suggestion.suggestedQty, Math.max(0, Math.ceil(totalForecast - (inv?.availableQty ?? suggestion.currentStock))))

  return Math.round(protectedQty * margin)
}

function localDecisionQueue(limit: number, priority: string, productIdOrSku?: string) {
  let items = getDecisionQueueItems()

  if (priority !== "all") items = items.filter((item) => item.priority === priority)
  if (productIdOrSku) {
    const query = productIdOrSku.toLowerCase()
    items = items.filter(
      (item) => item.productId === productIdOrSku || item.productSku.toLowerCase() === query || item.productName.toLowerCase().includes(query)
    )
  }

  const rows = items
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      productId: item.productId,
      productSku: item.productSku,
      productName: item.productName,
      actionType: item.actionType,
      priority: item.priority,
      urgency: item.urgency,
      deadline: item.deadline.toISOString().slice(0, 10),
      estimatedFinancialImpact: item.estimatedFinancialImpact,
      recommendation: item.recommendation,
      confidence: item.confidence,
      currentStock: item.currentStock,
      projectedDays: item.projectedDays,
      suggestedQty: item.suggestedQty,
      purchaseQty: item.suggestedQty,
      estimatedCost: item.estimatedCost,
      targetStock: item.targetStock,
      safetyStock: item.safetyStock,
      policySource: item.inventoryPolicySource,
      sourceDetail: item.dataSource,
      calculationBasis: item.assumptions,
    }))

  return {
    summary: {
      total: items.length,
      urgent: items.filter((item) => item.priority === "urgent").length,
      high: items.filter((item) => item.priority === "high").length,
      totalFinancialImpact: items.reduce((sum, item) => sum + item.estimatedFinancialImpact, 0),
    },
    decisions: rows,
  }
}

function localBudgetSimulation(budgetVnd: number | null, limit: number) {
  const enriched = replenishmentSuggestions
    .map((suggestion) => ({
      ...suggestion,
      expectedProfitSaved: expectedProfitSaved(suggestion),
      roi: suggestion.estimatedCost > 0 ? expectedProfitSaved(suggestion) / suggestion.estimatedCost : 0,
    }))
    .sort((left, right) => right.roi - left.roi)

  let remaining = budgetVnd ?? Number.POSITIVE_INFINITY
  const selected = [] as typeof enriched
  const excluded = [] as typeof enriched

  for (const suggestion of enriched) {
    if (suggestion.estimatedCost <= remaining) {
      selected.push(suggestion)
      remaining -= suggestion.estimatedCost
    } else {
      excluded.push(suggestion)
    }
  }

  const selectedCost = selected.reduce((sum, item) => sum + item.estimatedCost, 0)
  const protectedProfit = selected.reduce((sum, item) => sum + item.expectedProfitSaved, 0)
  const excludedProfitRisk = excluded.reduce((sum, item) => sum + item.expectedProfitSaved, 0)

  return {
    method: "Mô phỏng ưu tiên hiệu quả vốn",
    budgetVnd,
    summary: {
      selectedSkuCount: selected.length,
      selectedCost,
      protectedProfit,
      remainingBudget: budgetVnd === null ? null : Math.max(0, budgetVnd - selectedCost),
      excludedSkuCount: excluded.length,
      excludedProfitRisk,
    },
    selected: selected.slice(0, limit).map((item) => ({
      productSku: item.productSku,
      productName: item.productName,
      priority: item.priority,
      suggestedQty: item.suggestedQty,
      purchaseQty: item.purchaseQty ?? item.suggestedQty,
      estimatedCost: item.estimatedCost,
      targetStock: item.targetStock,
      policySource: item.inventoryPolicySource,
      protectedProfit: item.expectedProfitSaved,
      roiPct: Math.round(item.roi * 100),
    })),
    excluded: excluded.slice(0, 3).map((item) => ({
      productSku: item.productSku,
      productName: item.productName,
      estimatedCost: item.estimatedCost,
      profitLeftAtRisk: item.expectedProfitSaved,
    })),
  }
}

function localModelHealth() {
  return {
    status: "Ổn định, cần theo dõi định kỳ",
    caveat: "Các chỉ số hiện tại dùng để theo dõi độ ổn định và cần rà soát thêm khi vận hành thực tế biến động mạnh.",
    metrics: {
      forecastCoverage: `${products.length} SKU`,
      forecastMethod: "Mô hình dự báo nhu cầu",
      stockoutAlerts: stockAlerts.filter((alert) => alert.type === "stockout_risk").length,
      sparseSkuRisk: "Theo dõi trên trang độ tin cậy dự báo",
      calendarRows: HBAAC_CALENDAR_SUMMARY.rowCount,
      dataThrough: HBAAC_DATASET_INFO.maxTrainDate,
    },
    dataLineage: {
      sales: DATA_LAYER_LABELS.competition,
      calendar: DATA_LAYER_LABELS.calendar,
      catalog: DATA_LAYER_LABELS.catalog,
      inventoryPolicy: DATA_LAYER_LABELS.inventoryPolicy,
    },
  }
}

function localImplementationRoadmap() {
  return {
    phases: [
      { phase: "Thử nghiệm POC", duration: "4-6 tuần", scope: "1-2 danh mục, 500-1.000 SKU", goal: "thiết lập mức tham chiếu dự báo và độ chính xác cảnh báo" },
      { phase: "Thí điểm vận hành", duration: "8-12 tuần", scope: "3-5 danh mục, quy trình nhà cung cấp, cập nhật dự báo hằng tuần", goal: "giảm thiếu hàng và chi phí lưu kho" },
      { phase: "Triển khai toàn hệ thống", duration: "3-6 tháng", scope: "toàn bộ SKU, tích hợp ERP/WMS, giám sát vận hành", goal: "giảm vốn bị khóa và rút ngắn thời gian lập kế hoạch mua hàng" },
    ],
    risks: ["Thiếu dữ liệu tồn kho hoặc thời gian cung ứng", "Hoàn trả làm nhiễu nhu cầu", "Mã hàng ít dữ liệu hoặc mới phát sinh", "Tích hợp ERP chậm tiến độ"],
    calculationBasis: "Chi phí, nguồn lực và phạm vi tích hợp là cơ sở tính toán cho kế hoạch triển khai.",
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

export const getInventoryPolicyTool = tool({
  description: "Lấy chính sách tồn kho EOQ theo SKU hoặc tổng quan: demand 28 ngày, EOQ, safety stock, reorder point, target stock, purchase qty và chi phí annualized.",
  inputSchema: z.object({
    productIdOrSku: z.string().optional().describe("ID hoặc SKU cần xem chính sách tồn kho"),
    month: z.union([z.literal(1), z.literal(2)]).default(1).describe("Kỳ forecast 28 ngày: 1 là kỳ hiện tại, 2 là kỳ kế tiếp"),
    view: z.enum(["summary", "sku", "top_purchase_qty", "top_cost"]).default("summary"),
    limit: z.number().default(10),
  }),
  execute: async ({ productIdOrSku, month, view, limit }) => localInventoryPolicy(productIdOrSku, month, view, limit),
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

export const getDecisionQueueTool = tool({
  description: "Lấy hàng chờ quyết định ưu tiên theo tác động tài chính, hạn xử lý, độ tin cậy và khuyến nghị hành động.",
  inputSchema: z.object({
    priority: z.enum(["urgent", "high", "medium", "low", "all"]).default("all"),
    productIdOrSku: z.string().optional().describe("ID, SKU hoặc tên sản phẩm cần giải thích"),
    limit: z.number().default(10),
  }),
  execute: async ({ priority, productIdOrSku, limit }) => localDecisionQueue(limit, priority, productIdOrSku),
})

export const optimizeReplenishmentBudgetTool = tool({
  description: "Mô phỏng ngân sách mua hàng theo hiệu quả vốn để chọn SKU nên ưu tiên đặt hàng.",
  inputSchema: z.object({
    budgetVnd: z.number().nullable().default(null).describe("Ngân sách VND; null nghĩa là không giới hạn, 0 nghĩa là không chi"),
    limit: z.number().default(10),
  }),
  execute: async ({ budgetVnd, limit }) => localBudgetSimulation(budgetVnd, limit),
})

export const explainRecommendationTool = tool({
  description: "Giải thích một khuyến nghị cho SKU theo dự báo nhu cầu, tồn kho, tác động tài chính, nguồn dữ liệu và cơ sở tính toán.",
  inputSchema: z.object({
    productIdOrSku: z.string().describe("ID, SKU hoặc tên sản phẩm cần giải thích"),
  }),
  execute: async ({ productIdOrSku }) => {
    const queue = localDecisionQueue(1, "all", productIdOrSku)
    const decision = queue.decisions[0]
    if (!decision) return { error: `Không tìm thấy khuyến nghị cho ${productIdOrSku}` }

    return {
      decision,
      forecast: localProductForecast(decision.productId, 28),
      replenishment: localReplenishmentSuggestions("all", undefined, 50).suggestions.find((item) => item.productSku === decision.productSku),
    }
  },
})

export const getModelHealthTool = tool({
  description: "Lấy tình trạng độ tin cậy dự báo: độ phủ, mức ổn định, biến động nhu cầu, mã hàng ít dữ liệu, hoàn trả và nguồn dữ liệu vận hành.",
  inputSchema: z.object({}),
  execute: async () => localModelHealth(),
})

export const getImplementationRoadmapTool = tool({
  description: "Lấy lộ trình triển khai POC, thí điểm, triển khai toàn hệ thống kèm KPI, rủi ro và cơ sở tính toán.",
  inputSchema: z.object({}),
  execute: async () => localImplementationRoadmap(),
})

export const analyticsTools = {
  getProductForecast: getProductForecastTool,
  getStockAlerts: getStockAlertsTool,
  getReplenishmentSuggestions: getReplenishmentSuggestionsTool,
  getSalesAnalytics: getSalesAnalyticsTool,
  getInventorySummary: getInventorySummaryTool,
  getInventoryPolicy: getInventoryPolicyTool,
  compareProducts: compareProductsTool,
  getDashboardKPIs: getDashboardKPIsTool,
  getDecisionQueue: getDecisionQueueTool,
  optimizeReplenishmentBudget: optimizeReplenishmentBudgetTool,
  explainRecommendation: explainRecommendationTool,
  getModelHealth: getModelHealthTool,
  getImplementationRoadmap: getImplementationRoadmapTool,
}
