// Data layer generated from HBAAC train.csv and submission_nbeats.csv.

import datasetInfoJson from "./generated/dataset-info.json"
import productSummariesJson from "./generated/product-summaries.json"
import dailySalesSeriesJson from "./generated/daily-sales-series.json"
import dailyForecastSeriesJson from "./generated/daily-forecast-series.json"
import type {
  DashboardKPIs,
  DemandForecast,
  ForecastChartData,
  InventoryLevel,
  Product,
  ProductCategory,
  ReplenishmentSuggestion,
  SalesRecord,
  StockAlert,
  Supplier,
} from "@/types"

type DatasetInfo = {
  trainRows: number
  trainSkuCount: number
  forecastRows: number
  forecastSkuCount: number
  minTrainDate: string
  maxTrainDate: string
  validationStartDate: string
  validationEndDate: string
  evaluationStartDate: string
  evaluationEndDate: string
  seriesSkuCount: number
}

type ProductSummaryTuple = [
  sku: string,
  totalQuantity: number,
  totalRevenue: number,
  totalCost: number,
  transactionCount: number,
  avgUnitPrice: number,
  avgUnitCost: number,
  recent7Quantity: number,
  recent28Quantity: number,
  recent56Quantity: number,
  recent90Quantity: number,
  recent28Revenue: number,
  prev28Revenue: number,
  firstDate: string,
  lastDate: string,
  validationForecastTotal: number,
  evaluationForecastTotal: number,
  forecast56Total: number,
  positiveSalesDays: number,
  returnQuantity: number,
]

type DailySalesPointTuple = [date: string, quantity: number, revenue: number]
type DailySalesSeriesTuple = [sku: string, points: DailySalesPointTuple[]]
type DailyForecastSeriesTuple = [sku: string, validation: number[], evaluation: number[]]

const DATASET_INFO = datasetInfoJson as DatasetInfo
const PRODUCT_SUMMARIES = productSummariesJson as ProductSummaryTuple[]
const DAILY_SALES_SERIES = dailySalesSeriesJson as DailySalesSeriesTuple[]
const DAILY_FORECAST_SERIES = dailyForecastSeriesJson as DailyForecastSeriesTuple[]

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DEFAULT_PRICE = 100_000

export const HBAAC_DATASET_INFO = DATASET_INFO

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
  Brake: "He thong phanh",
  Engine: "Dong co",
  Suspension: "He thong treo",
  Electrical: "Dien va dien tu",
  Cooling: "He thong lam mat",
  Transmission: "Hop so",
  Tires: "Lop va mam xe",
  Body: "Than vo xe",
}

const SUBCATEGORIES: Record<ProductCategory, string[]> = {
  Brake: ["Ma phanh", "Dia phanh", "Bo thang", "Tong phanh", "Dau phanh"],
  Engine: ["Loc dau", "Loc gio", "Bugi", "Day curoa", "Bom dau"],
  Suspension: ["Giam xoc", "Lo xo", "Thanh can bang", "Rotuyn", "Cao su chan may"],
  Electrical: ["Ac quy", "May phat dien", "Den pha", "Den hau", "Cam bien"],
  Cooling: ["Ket nuoc", "Bom nuoc", "Quat lam mat", "Ong nuoc", "Van hang nhiet"],
  Transmission: ["Bo ly hop", "Dau hop so", "Vong bi", "Khop cac dang", "Phot"],
  Tires: ["Lop xe", "Mam xe", "Van lop", "Can mam", "Lop du phong"],
  Body: ["Guong chieu hau", "Can truoc", "Can sau", "Den xi nhan", "Cop xe"],
}

const BRANDS = ["Toyota", "Honda", "Hyundai", "Kia", "Mazda", "Ford", "Mitsubishi", "Suzuki", "VinFast", "Bosch"]

const VEHICLES = [
  "Toyota Vios 2020-2024",
  "Toyota Camry 2019-2024",
  "Toyota Fortuner 2018-2024",
  "Honda City 2020-2024",
  "Honda CR-V 2019-2024",
  "Hyundai Accent 2020-2024",
  "Hyundai Tucson 2019-2024",
  "Kia Seltos 2020-2024",
  "Mazda CX-5 2018-2024",
  "Ford Ranger 2018-2024",
  "VinFast VF8 2022-2024",
]

export const suppliers: Supplier[] = [
  { id: "sup_001", name: "Toyota Genuine Parts", country: "Japan", leadTimeDays: 14, rating: 4.9, contactEmail: "parts@toyota.com" },
  { id: "sup_002", name: "Honda Parts Vietnam", country: "Vietnam", leadTimeDays: 7, rating: 4.7, contactEmail: "supply@honda.vn" },
  { id: "sup_003", name: "Hyundai Mobis", country: "Korea", leadTimeDays: 10, rating: 4.6, contactEmail: "mobis@hyundai.kr" },
  { id: "sup_004", name: "Bosch Auto Parts", country: "Germany", leadTimeDays: 21, rating: 4.8, contactEmail: "auto@bosch.de" },
  { id: "sup_005", name: "Denso Corporation", country: "Japan", leadTimeDays: 14, rating: 4.7, contactEmail: "parts@denso.jp" },
  { id: "sup_006", name: "Continental AG", country: "Germany", leadTimeDays: 21, rating: 4.5, contactEmail: "auto@continental.de" },
  { id: "sup_007", name: "Aisin Seiki", country: "Japan", leadTimeDays: 14, rating: 4.6, contactEmail: "supply@aisin.jp" },
  { id: "sup_008", name: "Bridgestone Vietnam", country: "Vietnam", leadTimeDays: 5, rating: 4.4, contactEmail: "tires@bridgestone.vn" },
]

const summaryBySku = new Map(PRODUCT_SUMMARIES.map((summary) => [summary[0], summary]))
const dailySalesBySku = new Map(DAILY_SALES_SERIES)
const dailyForecastBySku = new Map(DAILY_FORECAST_SERIES.map(([sku, validation, evaluation]) => [sku, [...validation, ...evaluation]]))

function toDate(isoDate: string) {
  return new Date(`${isoDate}T00:00:00Z`)
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(isoDate: string, days: number) {
  const date = toDate(isoDate)
  date.setUTCDate(date.getUTCDate() + days)
  return toIsoDate(date)
}

function subDays(isoDate: string, days: number) {
  return addDays(isoDate, -days)
}

function daysBetween(startIso: string, endIso: string) {
  return Math.max(1, Math.round((toDate(endIso).getTime() - toDate(startIso).getTime()) / MS_PER_DAY) + 1)
}

function getSkuNumber(sku: string) {
  const match = sku.match(/\d+/)
  return match ? Number(match[0]) : Math.abs(hashString(sku))
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return hash
}

function categoryForSku(sku: string): ProductCategory {
  return CATEGORIES[getSkuNumber(sku) % CATEGORIES.length]
}

function unitPriceFromSummary(summary: ProductSummaryTuple) {
  return Math.max(DEFAULT_PRICE, Math.round(summary[5] || summary[2] / Math.max(1, Math.abs(summary[1])) || DEFAULT_PRICE))
}

function unitCostFromSummary(summary: ProductSummaryTuple) {
  const unitPrice = unitPriceFromSummary(summary)
  return Math.max(1, Math.round(summary[6] || unitPrice * 0.65))
}

function demandScore(summary: ProductSummaryTuple) {
  return Math.max(0, summary[11]) + Math.max(0, summary[17]) * unitPriceFromSummary(summary)
}

function getProductStatus(summary: ProductSummaryTuple): Product["status"] {
  const stale = summary[14] < subDays(DATASET_INFO.maxTrainDate, 365)
  if (stale && summary[17] < 0.1) return "discontinued"
  if (summary[4] < 8 || (summary[10] <= 0 && summary[17] > 0)) return "seasonal"
  return "active"
}

function productFromSummary(summary: ProductSummaryTuple): Product {
  const sku = summary[0]
  const skuNumber = getSkuNumber(sku)
  const category = categoryForSku(sku)
  const subcategory = SUBCATEGORIES[category][skuNumber % SUBCATEGORIES[category].length]
  const supplier = suppliers[skuNumber % suppliers.length]
  const unitPrice = unitPriceFromSummary(summary)

  return {
    id: sku,
    sku,
    name: `${subcategory} ${sku}`,
    category,
    subcategory,
    brand: BRANDS[skuNumber % BRANDS.length],
    compatibleVehicles: [
      VEHICLES[skuNumber % VEHICLES.length],
      VEHICLES[(skuNumber + 3) % VEHICLES.length],
      VEHICLES[(skuNumber + 7) % VEHICLES.length],
    ],
    unitPrice,
    unitCost: unitCostFromSummary(summary),
    leadTimeDays: supplier.leadTimeDays,
    minOrderQty: Math.max(1, Math.ceil(Math.max(summary[8] / 4, summary[17] / 8))),
    supplierId: supplier.id,
    status: getProductStatus(summary),
  }
}

export const products: Product[] = PRODUCT_SUMMARIES
  .map(productFromSummary)
  .sort((left, right) => demandScore(summaryBySku.get(right.id)!) - demandScore(summaryBySku.get(left.id)!))

const productById = new Map(products.map((product) => [product.id, product]))
const productBySku = new Map(products.map((product) => [product.sku.toLowerCase(), product]))

function getSummary(productIdOrSku: string) {
  const product = productById.get(productIdOrSku) ?? productBySku.get(productIdOrSku.toLowerCase())
  return product ? summaryBySku.get(product.sku) : summaryBySku.get(productIdOrSku)
}

function getRecentQuantity(summary: ProductSummaryTuple, days: number) {
  if (days <= 7) return Math.max(0, summary[7])
  if (days <= 30) return Math.max(0, summary[8])
  if (days <= 56) return Math.max(0, summary[9])
  if (days <= 90) return Math.max(0, summary[10])

  const activeDays = daysBetween(summary[13], DATASET_INFO.maxTrainDate)
  return Math.max(0, (summary[1] / activeDays) * days)
}

function getRecentRevenue(summary: ProductSummaryTuple, days: number) {
  if (days <= 30) return Math.max(0, summary[11])
  return getRecentQuantity(summary, days) * unitPriceFromSummary(summary)
}

function averageDailyDemand(summary: ProductSummaryTuple) {
  const historicalDaily = Math.max(0, summary[10]) / 90
  const forecastDaily = Math.max(0, summary[17]) / 56
  const longTermDaily = Math.max(0, summary[1]) / daysBetween(summary[13], summary[14])
  return Math.max(0.05, forecastDaily, historicalDaily, longTermDaily * 0.4)
}

function inventoryFromProduct(product: Product): InventoryLevel {
  const summary = summaryBySku.get(product.sku)!
  const dailyDemand = averageDailyDemand(summary)
  const safetyStock = Math.ceil(dailyDemand * 7)
  const reorderPoint = Math.max(product.minOrderQty, Math.ceil(dailyDemand * product.leadTimeDays + safetyStock))
  const forecast56 = Math.max(0, summary[17])
  const recent90 = Math.max(0, summary[10])
  const staleDemand = recent90 <= 1 && forecast56 <= 0.25 && Math.max(0, summary[1]) > 10
  const risingDemand = forecast56 > Math.max(10, Math.max(0, summary[8]) * 1.25)

  let availableQty: number
  if (risingDemand) {
    availableQty = Math.max(0, Math.floor(reorderPoint * 0.55))
  } else if (staleDemand) {
    availableQty = Math.ceil(reorderPoint * 4 + Math.min(250, Math.max(0, summary[1]) * 0.08))
  } else {
    availableQty = Math.ceil(Math.max(reorderPoint * 1.2, forecast56 * 0.45, Math.max(0, summary[8])))
  }

  const reservedQty = Math.floor(availableQty * 0.08)

  return {
    productId: product.id,
    warehouseId: "WH_HCM_01",
    quantity: availableQty + reservedQty,
    reservedQty,
    availableQty,
    reorderPoint,
    safetyStock,
    lastUpdated: toDate(DATASET_INFO.maxTrainDate),
  }
}

export const inventory: InventoryLevel[] = products.map(inventoryFromProduct)
const inventoryByProductId = new Map(inventory.map((item) => [item.productId, item]))

function salesRecordFromPoint(productId: string, point: DailySalesPointTuple): SalesRecord {
  return {
    id: `sale_${productId}_${point[0]}`,
    productId,
    date: toDate(point[0]),
    quantity: point[1],
    revenue: point[2],
    channel: "wholesale",
    customerId: "hbaac_dataset",
  }
}

export const salesHistory: SalesRecord[] = DAILY_SALES_SERIES.flatMap(([sku, points]) =>
  points.map((point) => salesRecordFromPoint(sku, point))
)

function buildForecasts(productId: string, days = 56): DemandForecast[] {
  const product = getProductById(productId)
  const summary = getSummary(productId)
  if (!product || !summary) return []

  const storedValues = dailyForecastBySku.get(product.sku)
  const maxDays = Math.min(56, Math.max(1, days))
  const values = storedValues
    ? storedValues.slice(0, maxDays)
    : [
        ...Array(28).fill(summary[15] / 28),
        ...Array(28).fill(summary[16] / 28),
      ].slice(0, maxDays)

  return values.map((forecastQty, index) => {
    const roundedForecast = Math.max(0, Math.round(forecastQty * 10) / 10)
    return {
      productId,
      date: toDate(addDays(DATASET_INFO.maxTrainDate, index + 1)),
      forecastQty: roundedForecast,
      confidenceLower: Math.max(0, Math.round(roundedForecast * 0.8 * 10) / 10),
      confidenceUpper: Math.round(roundedForecast * 1.2 * 10) / 10,
      method: "nbeats",
    }
  })
}

export const forecasts: DemandForecast[] = products
  .slice(0, DATASET_INFO.seriesSkuCount)
  .flatMap((product) => buildForecasts(product.id, 56))

function alertSeverity(daysOfStock: number): StockAlert["severity"] {
  if (daysOfStock < 7) return "critical"
  if (daysOfStock < 14) return "warning"
  return "info"
}

function generateStockAlerts(): StockAlert[] {
  const alerts: StockAlert[] = []

  for (const product of products) {
    const summary = summaryBySku.get(product.sku)
    const inv = inventoryByProductId.get(product.id)
    if (!summary || !inv) continue

    const forecastDaily = Math.max(0.05, summary[17] / 56)
    const daysOfStock = Math.round(inv.availableQty / forecastDaily)

    if (summary[17] >= 1 && inv.availableQty < inv.reorderPoint) {
      alerts.push({
        id: `alert_stockout_${product.sku}`,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        category: product.category,
        type: "stockout_risk",
        severity: alertSeverity(daysOfStock),
        currentStock: inv.availableQty,
        projectedDays: daysOfStock,
        recommendation: `Dat bo sung toi thieu ${Math.max(product.minOrderQty, inv.reorderPoint - inv.availableQty)} don vi theo forecast N-BEATS`,
        estimatedImpact: Math.round(summary[17] * product.unitPrice),
        createdAt: toDate(DATASET_INFO.maxTrainDate),
      })
    }

    if (inv.availableQty > Math.max(inv.reorderPoint * 3, summary[17] * 2) && Math.max(0, summary[10]) > 0) {
      alerts.push({
        id: `alert_overstock_${product.sku}`,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        category: product.category,
        type: "overstock",
        severity: inv.availableQty > inv.reorderPoint * 5 ? "warning" : "info",
        currentStock: inv.availableQty,
        projectedDays: daysOfStock,
        recommendation: "Xem lai ton kho muc tieu so voi forecast 56 ngay",
        estimatedImpact: Math.round(product.unitCost * inv.availableQty * 0.1),
        createdAt: toDate(DATASET_INFO.maxTrainDate),
      })
    }

    if (Math.max(0, summary[10]) <= 2 && summary[4] >= 10 && inv.availableQty > inv.reorderPoint) {
      alerts.push({
        id: `alert_slow_${product.sku}`,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        category: product.category,
        type: "slow_moving",
        severity: "info",
        currentStock: inv.availableQty,
        projectedDays: daysOfStock,
        recommendation: "SKU ban cham trong 90 ngay gan nhat, can xem lai chinh sach ton kho",
        estimatedImpact: Math.round(product.unitCost * inv.availableQty * 0.05),
        createdAt: toDate(DATASET_INFO.maxTrainDate),
      })
    }
  }

  const severityRank: Record<StockAlert["severity"], number> = { critical: 0, warning: 1, info: 2 }
  return alerts
    .sort((left, right) => severityRank[left.severity] - severityRank[right.severity] || right.estimatedImpact - left.estimatedImpact)
    .slice(0, 500)
}

export const stockAlerts: StockAlert[] = generateStockAlerts()

function generateReplenishmentSuggestions(): ReplenishmentSuggestion[] {
  return stockAlerts
    .filter((alert) => alert.type === "stockout_risk")
    .map((alert) => {
      const product = productById.get(alert.productId)!
      const inv = inventoryByProductId.get(alert.productId)!
      const supplier = suppliers.find((item) => item.id === product.supplierId) ?? suppliers[0]
      const summary = summaryBySku.get(product.sku)!
      const leadTimeDemand = Math.ceil((summary[17] / 56) * product.leadTimeDays)
      const suggestedQty = Math.max(product.minOrderQty, inv.reorderPoint + leadTimeDemand - inv.availableQty)

      return {
        id: `repl_${product.sku}`,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        category: product.category,
        suggestedQty,
        estimatedCost: suggestedQty * product.unitCost,
        priority: alert.severity === "critical" ? "urgent" : alert.severity === "warning" ? "high" : "medium",
        reason: alert.recommendation,
        expectedDeliveryDate: toDate(addDays(DATASET_INFO.maxTrainDate, supplier.leadTimeDays)),
        supplierId: supplier.id,
        supplierName: supplier.name,
        currentStock: inv.availableQty,
        reorderPoint: inv.reorderPoint,
      }
    })
}

export const replenishmentSuggestions: ReplenishmentSuggestion[] = generateReplenishmentSuggestions()

export function getAverageDailySales(productId: string): number {
  const summary = getSummary(productId)
  if (!summary) return 0
  return Math.max(0, summary[10]) / 90
}

export function getProductById(productId: string): Product | undefined {
  return productById.get(productId)
}

export function getProductBySku(sku: string): Product | undefined {
  return productBySku.get(sku.toLowerCase())
}

export function getProductsByCategory(category: ProductCategory): Product[] {
  return products.filter((product) => product.category === category)
}

export function getInventoryByProduct(productId: string): InventoryLevel | undefined {
  return inventoryByProductId.get(productId)
}

export function getAlertsByType(type: StockAlert["type"]): StockAlert[] {
  return stockAlerts.filter((alert) => alert.type === type)
}

export function getAlertsBySeverity(severity: StockAlert["severity"]): StockAlert[] {
  return stockAlerts.filter((alert) => alert.severity === severity)
}

export function getSalesByProduct(productId: string, days = 28): SalesRecord[] {
  const product = getProductById(productId)
  const summary = getSummary(productId)
  if (!product || !summary) return []

  const startDate = subDays(DATASET_INFO.maxTrainDate, Math.max(1, days) - 1)
  const points = dailySalesBySku.get(product.sku)

  if (points) {
    return points
      .filter((point) => point[0] >= startDate && point[0] <= DATASET_INFO.maxTrainDate)
      .map((point) => salesRecordFromPoint(product.id, point))
  }

  const quantity = getRecentQuantity(summary, days)
  if (quantity <= 0) return []

  return [{
    id: `sale_${product.id}_aggregate_${days}`,
    productId: product.id,
    date: toDate(DATASET_INFO.maxTrainDate),
    quantity,
    revenue: getRecentRevenue(summary, days),
    channel: "wholesale",
    customerId: "hbaac_dataset",
  }]
}

export function getForecastsByProduct(productId: string, days = 28): DemandForecast[] {
  return buildForecasts(productId, days)
}

export function getForecastChartData(productId: string, historicalDays = 28, forecastDays = 28): ForecastChartData[] {
  const data: ForecastChartData[] = []
  const startDate = subDays(DATASET_INFO.maxTrainDate, Math.max(1, historicalDays) - 1)
  const salesByDate = new Map(
    getSalesByProduct(productId, historicalDays).map((sale) => [toIsoDate(sale.date), sale.quantity])
  )

  for (let offset = 0; offset < historicalDays; offset += 1) {
    const date = addDays(startDate, offset)
    const actual = Math.max(0, salesByDate.get(date) ?? 0)
    data.push({
      date,
      actual,
      forecast: actual,
      confidenceLower: actual,
      confidenceUpper: actual,
    })
  }

  for (const forecast of getForecastsByProduct(productId, forecastDays)) {
    data.push({
      date: toIsoDate(forecast.date),
      actual: null,
      forecast: forecast.forecastQty,
      confidenceLower: forecast.confidenceLower,
      confidenceUpper: forecast.confidenceUpper,
    })
  }

  return data
}

export function getDashboardKPIs(): DashboardKPIs {
  const totalSKUs = products.length
  const activeSKUs = products.filter((product) => product.status === "active").length
  const stockoutRiskCount = stockAlerts.filter((alert) => alert.type === "stockout_risk").length
  const overstockCount = stockAlerts.filter((alert) => alert.type === "overstock").length
  const slowMovingCount = stockAlerts.filter((alert) => alert.type === "slow_moving").length
  const pendingOrders = replenishmentSuggestions.length
  const totalInventoryValue = inventory.reduce((sum, item) => {
    const product = productById.get(item.productId)
    return sum + (product ? item.quantity * product.unitCost : 0)
  }, 0)
  const monthlyRevenue = PRODUCT_SUMMARIES.reduce((sum, summary) => sum + Math.max(0, summary[11]), 0)
  const prevMonthlyRevenue = PRODUCT_SUMMARIES.reduce((sum, summary) => sum + Math.max(0, summary[12]), 0)
  const revenueChange = prevMonthlyRevenue > 0 ? ((monthlyRevenue - prevMonthlyRevenue) / prevMonthlyRevenue) * 100 : 0

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

export function searchProducts(query: string): Product[] {
  const lowerQuery = query.toLowerCase()
  return products
    .filter(
      (product) =>
        product.name.toLowerCase().includes(lowerQuery) ||
        product.sku.toLowerCase().includes(lowerQuery) ||
        product.brand.toLowerCase().includes(lowerQuery) ||
        product.category.toLowerCase().includes(lowerQuery)
    )
    .slice(0, 25)
}

export function filterAlerts(
  type?: StockAlert["type"],
  severity?: StockAlert["severity"],
  category?: ProductCategory
): StockAlert[] {
  return stockAlerts.filter((alert) => {
    if (type && alert.type !== type) return false
    if (severity && alert.severity !== severity) return false
    if (category && alert.category !== category) return false
    return true
  })
}

export function getCategorySalesSummary(days = 28) {
  const summary: Record<ProductCategory, { revenue: number; quantity: number }> = {} as Record<ProductCategory, { revenue: number; quantity: number }>

  for (const category of CATEGORIES) {
    summary[category] = { revenue: 0, quantity: 0 }
  }

  for (const product of products) {
    const productSummary = summaryBySku.get(product.sku)
    if (!productSummary) continue
    summary[product.category].quantity += getRecentQuantity(productSummary, days)
    summary[product.category].revenue += getRecentRevenue(productSummary, days)
  }

  return Object.entries(summary).map(([category, data]) => ({
    category: category as ProductCategory,
    categoryLabel: CATEGORY_LABELS[category as ProductCategory],
    revenue: Math.round(data.revenue),
    quantity: Math.round(data.quantity),
  }))
}

export function getTopSellingProducts(days = 28, limit = 10) {
  return products
    .map((product) => {
      const summary = summaryBySku.get(product.sku)!
      return {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        category: product.category,
        quantity: Math.round(getRecentQuantity(summary, days)),
        revenue: Math.round(getRecentRevenue(summary, days)),
      }
    })
    .filter((item) => item.quantity > 0 || item.revenue > 0)
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, limit)
}
