// AutoParts Intelligence Platform - Mock Data Generator

import type {
  Product,
  ProductCategory,
  Supplier,
  InventoryLevel,
  SalesRecord,
  DemandForecast,
  StockAlert,
  ReplenishmentSuggestion,
  DashboardKPIs,
  ForecastChartData,
} from "@/types"

// ============================================
// CONSTANTS
// ============================================

export const CATEGORIES: ProductCategory[] = [
  "Brake",
  "Engine",
  "Suspension",
  "Electrical",
  "Cooling",
  "Transmission",
  "Tires",
  "Body",
]

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  Brake: "Hệ thống phanh",
  Engine: "Động cơ",
  Suspension: "Hệ thống treo",
  Electrical: "Điện & Điện tử",
  Cooling: "Hệ thống làm mát",
  Transmission: "Hộp số",
  Tires: "Lốp & Mâm xe",
  Body: "Thân vỏ xe",
}

const SUBCATEGORIES: Record<ProductCategory, string[]> = {
  Brake: ["Má phanh", "Đĩa phanh", "Bố thắng", "Tổng phanh", "Dầu phanh"],
  Engine: ["Lọc dầu", "Lọc gió", "Bugi", "Dây curoa", "Bơm dầu"],
  Suspension: ["Giảm xóc", "Lò xo", "Thanh cân bằng", "Cao su chân máy", "Rotuyn"],
  Electrical: ["Ắc quy", "Máy phát điện", "Đèn pha", "Đèn hậu", "Còi"],
  Cooling: ["Két nước", "Bơm nước", "Quạt làm mát", "Ống nước", "Van hằng nhiệt"],
  Transmission: ["Bộ ly hợp", "Dầu hộp số", "Vòng bi", "Khớp các đăng", "Phớt"],
  Tires: ["Lốp xe", "Mâm xe", "Van lốp", "Cân mâm", "Lốp dự phòng"],
  Body: ["Gương chiếu hậu", "Cản trước", "Cản sau", "Đèn xi nhan", "Cốp xe"],
}

const BRANDS = [
  "Toyota",
  "Honda",
  "Hyundai",
  "Kia",
  "Mazda",
  "Ford",
  "Mitsubishi",
  "Suzuki",
  "VinFast",
  "Chevrolet",
]

const VEHICLES = [
  "Toyota Vios 2020-2024",
  "Toyota Camry 2019-2024",
  "Toyota Fortuner 2018-2024",
  "Honda City 2020-2024",
  "Honda CR-V 2019-2024",
  "Honda Civic 2018-2024",
  "Hyundai Accent 2020-2024",
  "Hyundai Tucson 2019-2024",
  "Hyundai Santa Fe 2018-2024",
  "Kia Morning 2019-2024",
  "Kia Seltos 2020-2024",
  "Mazda CX-5 2018-2024",
  "Mazda 3 2019-2024",
  "Ford Ranger 2018-2024",
  "VinFast Fadil 2019-2024",
  "VinFast VF8 2022-2024",
]

// ============================================
// HELPER FUNCTIONS
// ============================================

function randomId(): string {
  return Math.random().toString(36).substring(2, 11)
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number, decimals: number = 2): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomElements<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function subDays(date: Date, days: number): Date {
  return addDays(date, -days)
}

// ============================================
// SUPPLIERS DATA
// ============================================

export const suppliers: Supplier[] = [
  { id: "sup_001", name: "Toyota Genuine Parts", country: "Japan", leadTimeDays: 14, rating: 4.9, contactEmail: "parts@toyota.com" },
  { id: "sup_002", name: "Honda Parts Vietnam", country: "Vietnam", leadTimeDays: 7, rating: 4.7, contactEmail: "supply@honda.vn" },
  { id: "sup_003", name: "Hyundai Mobis", country: "Korea", leadTimeDays: 10, rating: 4.6, contactEmail: "mobis@hyundai.kr" },
  { id: "sup_004", name: "Bosch Auto Parts", country: "Germany", leadTimeDays: 21, rating: 4.8, contactEmail: "auto@bosch.de" },
  { id: "sup_005", name: "Denso Corporation", country: "Japan", leadTimeDays: 14, rating: 4.7, contactEmail: "parts@denso.jp" },
  { id: "sup_006", name: "Continental AG", country: "Germany", leadTimeDays: 21, rating: 4.5, contactEmail: "auto@continental.de" },
  { id: "sup_007", name: "Aisin Seiki", country: "Japan", leadTimeDays: 14, rating: 4.6, contactEmail: "supply@aisin.jp" },
  { id: "sup_008", name: "Bridgestone Vietnam", country: "Vietnam", leadTimeDays: 5, rating: 4.4, contactEmail: "tires@bridgestone.vn" },
  { id: "sup_009", name: "Michelin Southeast Asia", country: "Thailand", leadTimeDays: 7, rating: 4.7, contactEmail: "fleet@michelin.th" },
  { id: "sup_010", name: "VinFast Parts", country: "Vietnam", leadTimeDays: 3, rating: 4.3, contactEmail: "parts@vinfast.vn" },
]

// ============================================
// PRODUCTS DATA (500 SKUs)
// ============================================

function generateProducts(): Product[] {
  const products: Product[] = []
  let skuCounter = 1

  for (const category of CATEGORIES) {
    const subcats = SUBCATEGORIES[category]
    const productsPerCategory = Math.floor(500 / CATEGORIES.length)

    for (let i = 0; i < productsPerCategory; i++) {
      const subcategory = subcats[i % subcats.length]
      const brand = randomElement(BRANDS)
      const supplier = randomElement(suppliers)
      const basePrice = randomBetween(50000, 5000000)

      products.push({
        id: `prod_${String(skuCounter).padStart(4, "0")}`,
        sku: `AP${category.substring(0, 2).toUpperCase()}${String(skuCounter).padStart(5, "0")}`,
        name: `${subcategory} ${brand} - ${randomElement(["OEM", "Aftermarket", "Premium"])}`,
        category,
        subcategory,
        brand,
        compatibleVehicles: randomElements(VEHICLES, randomBetween(2, 6)),
        unitPrice: basePrice,
        unitCost: Math.floor(basePrice * randomFloat(0.5, 0.7)),
        leadTimeDays: supplier.leadTimeDays + randomBetween(-2, 5),
        minOrderQty: randomElement([1, 5, 10, 20, 50]),
        supplierId: supplier.id,
        status: randomElement(["active", "active", "active", "active", "seasonal", "discontinued"]) as Product["status"],
      })
      skuCounter++
    }
  }

  return products
}

export const products: Product[] = generateProducts()

// ============================================
// INVENTORY DATA
// ============================================

function generateInventory(): InventoryLevel[] {
  return products.map((product) => {
    const quantity = randomBetween(0, 500)
    const reservedQty = Math.floor(quantity * randomFloat(0, 0.3))
    const reorderPoint = randomBetween(20, 100)
    const safetyStock = Math.floor(reorderPoint * 0.5)

    return {
      productId: product.id,
      warehouseId: "WH_HCM_01",
      quantity,
      reservedQty,
      availableQty: quantity - reservedQty,
      reorderPoint,
      safetyStock,
      lastUpdated: subDays(new Date(), randomBetween(0, 7)),
    }
  })
}

export const inventory: InventoryLevel[] = generateInventory()

// ============================================
// SALES HISTORY (Last 12 months)
// ============================================

function generateSalesHistory(): SalesRecord[] {
  const records: SalesRecord[] = []
  const today = new Date()
  const startDate = subDays(today, 365)

  for (const product of products) {
    // Random number of sales per product (0-50 per month avg)
    const salesCount = randomBetween(12, 50)

    for (let i = 0; i < salesCount; i++) {
      const daysAgo = randomBetween(0, 365)
      const saleDate = subDays(today, daysAgo)
      const quantity = randomBetween(1, 20)

      records.push({
        id: `sale_${randomId()}`,
        productId: product.id,
        date: saleDate,
        quantity,
        revenue: quantity * product.unitPrice,
        channel: randomElement(["retail", "wholesale", "online"]),
        customerId: `cust_${randomBetween(1, 200).toString().padStart(4, "0")}`,
      })
    }
  }

  return records.sort((a, b) => b.date.getTime() - a.date.getTime())
}

export const salesHistory: SalesRecord[] = generateSalesHistory()

// ============================================
// DEMAND FORECASTS (Next 90 days)
// ============================================

function generateForecasts(): DemandForecast[] {
  const forecasts: DemandForecast[] = []
  const today = new Date()

  for (const product of products) {
    // Get historical average for this product
    const productSales = salesHistory.filter((s) => s.productId === product.id)
    const avgDaily = productSales.length > 0
      ? productSales.reduce((sum, s) => sum + s.quantity, 0) / 365
      : randomFloat(0.5, 5)

    for (let day = 1; day <= 90; day++) {
      const forecastDate = addDays(today, day)
      // Add some seasonality and randomness
      const seasonalFactor = 1 + Math.sin((day / 30) * Math.PI) * 0.2
      const forecastQty = Math.max(0, avgDaily * seasonalFactor * randomFloat(0.8, 1.2))
      const variance = forecastQty * 0.3

      forecasts.push({
        productId: product.id,
        date: forecastDate,
        forecastQty: Math.round(forecastQty * 10) / 10,
        confidenceLower: Math.max(0, Math.round((forecastQty - variance) * 10) / 10),
        confidenceUpper: Math.round((forecastQty + variance) * 10) / 10,
        method: randomElement(["arima", "prophet", "ml_ensemble"]),
      })
    }
  }

  return forecasts
}

export const forecasts: DemandForecast[] = generateForecasts()

// ============================================
// STOCK ALERTS
// ============================================

function generateStockAlerts(): StockAlert[] {
  const alerts: StockAlert[] = []

  for (const product of products) {
    const inv = inventory.find((i) => i.productId === product.id)
    if (!inv) continue

    const daysOfStock = inv.availableQty / Math.max(1, getAverageDailySales(product.id))

    // Stockout risk
    if (daysOfStock < 14 && inv.availableQty < inv.reorderPoint) {
      alerts.push({
        id: `alert_${randomId()}`,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        category: product.category,
        type: "stockout_risk",
        severity: daysOfStock < 3 ? "critical" : daysOfStock < 7 ? "warning" : "info",
        currentStock: inv.availableQty,
        projectedDays: Math.round(daysOfStock),
        recommendation: `Đặt hàng ngay ${Math.ceil(inv.reorderPoint * 1.5)} đơn vị từ nhà cung cấp`,
        estimatedImpact: Math.round(product.unitPrice * inv.reorderPoint * 0.5),
        createdAt: subDays(new Date(), randomBetween(0, 3)),
      })
    }

    // Overstock
    if (daysOfStock > 90) {
      alerts.push({
        id: `alert_${randomId()}`,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        category: product.category,
        type: "overstock",
        severity: daysOfStock > 180 ? "warning" : "info",
        currentStock: inv.availableQty,
        projectedDays: Math.round(daysOfStock),
        recommendation: "Xem xét giảm giá hoặc chương trình khuyến mãi để giảm tồn kho",
        estimatedImpact: Math.round(product.unitCost * inv.availableQty * 0.1),
        createdAt: subDays(new Date(), randomBetween(0, 7)),
      })
    }

    // Slow moving (low sales velocity)
    const monthlySales = salesHistory.filter(
      (s) => s.productId === product.id && s.date > subDays(new Date(), 30)
    ).length
    if (monthlySales < 2 && inv.availableQty > 50) {
      alerts.push({
        id: `alert_${randomId()}`,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        category: product.category,
        type: "slow_moving",
        severity: "info",
        currentStock: inv.availableQty,
        projectedDays: Math.round(daysOfStock),
        recommendation: "Sản phẩm bán chậm - xem xét điều chỉnh giá hoặc kết hợp combo",
        estimatedImpact: Math.round(product.unitCost * inv.availableQty * 0.05),
        createdAt: subDays(new Date(), randomBetween(0, 14)),
      })
    }
  }

  return alerts.slice(0, 60) // Limit to ~60 alerts
}

export const stockAlerts: StockAlert[] = generateStockAlerts()

// ============================================
// REPLENISHMENT SUGGESTIONS
// ============================================

function generateReplenishmentSuggestions(): ReplenishmentSuggestion[] {
  const suggestions: ReplenishmentSuggestion[] = []

  const stockoutAlerts = stockAlerts.filter((a) => a.type === "stockout_risk")

  for (const alert of stockoutAlerts) {
    const product = products.find((p) => p.id === alert.productId)
    const inv = inventory.find((i) => i.productId === alert.productId)
    const supplier = suppliers.find((s) => s.id === product?.supplierId)

    if (!product || !inv || !supplier) continue

    const suggestedQty = Math.max(
      product.minOrderQty,
      Math.ceil((inv.reorderPoint - inv.availableQty) * 1.5)
    )

    suggestions.push({
      id: `repl_${randomId()}`,
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      category: product.category,
      suggestedQty,
      estimatedCost: suggestedQty * product.unitCost,
      priority: alert.severity === "critical" ? "urgent" : alert.severity === "warning" ? "high" : "medium",
      reason: alert.recommendation,
      expectedDeliveryDate: addDays(new Date(), supplier.leadTimeDays),
      supplierId: supplier.id,
      supplierName: supplier.name,
      currentStock: inv.availableQty,
      reorderPoint: inv.reorderPoint,
    })
  }

  return suggestions.sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
    return priorityOrder[a.priority] - priorityOrder[b.priority]
  })
}

export const replenishmentSuggestions: ReplenishmentSuggestion[] = generateReplenishmentSuggestions()

// ============================================
// HELPER FUNCTIONS FOR QUERIES
// ============================================

export function getAverageDailySales(productId: string): number {
  const productSales = salesHistory.filter((s) => s.productId === productId)
  if (productSales.length === 0) return 0.5
  const totalQty = productSales.reduce((sum, s) => sum + s.quantity, 0)
  return totalQty / 365
}

export function getProductById(productId: string): Product | undefined {
  return products.find((p) => p.id === productId)
}

export function getProductBySku(sku: string): Product | undefined {
  return products.find((p) => p.sku === sku)
}

export function getProductsByCategory(category: ProductCategory): Product[] {
  return products.filter((p) => p.category === category)
}

export function getInventoryByProduct(productId: string): InventoryLevel | undefined {
  return inventory.find((i) => i.productId === productId)
}

export function getAlertsByType(type: StockAlert["type"]): StockAlert[] {
  return stockAlerts.filter((a) => a.type === type)
}

export function getAlertsBySeverity(severity: StockAlert["severity"]): StockAlert[] {
  return stockAlerts.filter((a) => a.severity === severity)
}

export function getSalesByProduct(productId: string, days: number = 30): SalesRecord[] {
  const cutoffDate = subDays(new Date(), days)
  return salesHistory.filter((s) => s.productId === productId && s.date >= cutoffDate)
}

export function getForecastsByProduct(productId: string, days: number = 30): DemandForecast[] {
  const today = new Date()
  const endDate = addDays(today, days)
  return forecasts.filter(
    (f) => f.productId === productId && f.date >= today && f.date <= endDate
  )
}

export function getForecastChartData(productId: string, historicalDays: number = 30, forecastDays: number = 30): ForecastChartData[] {
  const today = new Date()
  const data: ForecastChartData[] = []

  // Historical data
  for (let i = historicalDays; i >= 1; i--) {
    const date = subDays(today, i)
    const dateStr = date.toISOString().split("T")[0]
    const daySales = salesHistory.filter(
      (s) => s.productId === productId && s.date.toISOString().split("T")[0] === dateStr
    )
    const totalQty = daySales.reduce((sum, s) => sum + s.quantity, 0)

    data.push({
      date: dateStr,
      actual: totalQty,
      forecast: totalQty,
      confidenceLower: totalQty,
      confidenceUpper: totalQty,
    })
  }

  // Forecast data
  const productForecasts = getForecastsByProduct(productId, forecastDays)
  for (const fc of productForecasts) {
    data.push({
      date: fc.date.toISOString().split("T")[0],
      actual: null,
      forecast: fc.forecastQty,
      confidenceLower: fc.confidenceLower,
      confidenceUpper: fc.confidenceUpper,
    })
  }

  return data
}

// ============================================
// DASHBOARD KPIs
// ============================================

export function getDashboardKPIs(): DashboardKPIs {
  const totalSKUs = products.length
  const activeSKUs = products.filter((p) => p.status === "active").length
  const stockoutRiskCount = stockAlerts.filter((a) => a.type === "stockout_risk").length
  const overstockCount = stockAlerts.filter((a) => a.type === "overstock").length
  const slowMovingCount = stockAlerts.filter((a) => a.type === "slow_moving").length
  const pendingOrders = replenishmentSuggestions.length

  const totalInventoryValue = inventory.reduce((sum, inv) => {
    const product = products.find((p) => p.id === inv.productId)
    return sum + (product ? inv.quantity * product.unitCost : 0)
  }, 0)

  const last30DaysSales = salesHistory.filter((s) => s.date >= subDays(new Date(), 30))
  const monthlyRevenue = last30DaysSales.reduce((sum, s) => sum + s.revenue, 0)

  const prev30DaysSales = salesHistory.filter(
    (s) => s.date >= subDays(new Date(), 60) && s.date < subDays(new Date(), 30)
  )
  const prevMonthlyRevenue = prev30DaysSales.reduce((sum, s) => sum + s.revenue, 0)
  const revenueChange = prevMonthlyRevenue > 0
    ? ((monthlyRevenue - prevMonthlyRevenue) / prevMonthlyRevenue) * 100
    : 0

  return {
    totalSKUs,
    activeSKUs,
    stockoutRiskCount,
    overstockCount,
    slowMovingCount,
    pendingOrders,
    totalInventoryValue,
    monthlyRevenue,
    revenueChange: Math.round(revenueChange * 10) / 10,
  }
}

// ============================================
// SEARCH & FILTER
// ============================================

export function searchProducts(query: string): Product[] {
  const lowerQuery = query.toLowerCase()
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.sku.toLowerCase().includes(lowerQuery) ||
      p.brand.toLowerCase().includes(lowerQuery) ||
      p.category.toLowerCase().includes(lowerQuery)
  )
}

export function filterAlerts(
  type?: StockAlert["type"],
  severity?: StockAlert["severity"],
  category?: ProductCategory
): StockAlert[] {
  return stockAlerts.filter((a) => {
    if (type && a.type !== type) return false
    if (severity && a.severity !== severity) return false
    if (category && a.category !== category) return false
    return true
  })
}

// ============================================
// ANALYTICS SUMMARIES
// ============================================

export function getCategorySalesSummary(days: number = 30) {
  const cutoffDate = subDays(new Date(), days)
  const recentSales = salesHistory.filter((s) => s.date >= cutoffDate)

  const summary: Record<ProductCategory, { revenue: number; quantity: number }> = {} as Record<ProductCategory, { revenue: number; quantity: number }>

  for (const category of CATEGORIES) {
    summary[category] = { revenue: 0, quantity: 0 }
  }

  for (const sale of recentSales) {
    const product = products.find((p) => p.id === sale.productId)
    if (product) {
      summary[product.category].revenue += sale.revenue
      summary[product.category].quantity += sale.quantity
    }
  }

  return Object.entries(summary).map(([category, data]) => ({
    category: category as ProductCategory,
    categoryLabel: CATEGORY_LABELS[category as ProductCategory],
    ...data,
  }))
}

export function getTopSellingProducts(days: number = 30, limit: number = 10) {
  const cutoffDate = subDays(new Date(), days)
  const recentSales = salesHistory.filter((s) => s.date >= cutoffDate)

  const productSales: Record<string, { quantity: number; revenue: number }> = {}

  for (const sale of recentSales) {
    if (!productSales[sale.productId]) {
      productSales[sale.productId] = { quantity: 0, revenue: 0 }
    }
    productSales[sale.productId].quantity += sale.quantity
    productSales[sale.productId].revenue += sale.revenue
  }

  return Object.entries(productSales)
    .map(([productId, data]) => {
      const product = products.find((p) => p.id === productId)
      return {
        productId,
        productName: product?.name || "Unknown",
        productSku: product?.sku || "Unknown",
        category: product?.category,
        ...data,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}
