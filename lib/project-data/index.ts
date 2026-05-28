// Data layer generated from HBAAC train.csv and submission_nbeats.csv.

import datasetInfoJson from "./generated/dataset-info.json"
import productSummariesJson from "./generated/product-summaries.json"
import dailySalesSeriesJson from "./generated/daily-sales-series.json"
import dailyForecastSeriesJson from "./generated/daily-forecast-series.json"
import calendarSummaryJson from "./generated/calendar-summary.json"
import dailyCalendarFeaturesJson from "./generated/daily-calendar-features.json"
import type {
  DashboardKPIs,
  DecisionQueueItem,
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
  calendarRows: number
  calendarStartDate: string
  calendarEndDate: string
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
type DailyCalendarFeatureTuple = [
  date: string,
  isWeekend: number,
  dayOfWeek: number,
  isMonthStart: number,
  isMonthEnd: number,
  isPublicHoliday: number,
  holidayName: string,
  isLunarEvent: number,
  lunarEventName: string,
  isRetailEvent: number,
  retailEventName: string,
  sourceNote: string,
]

type CalendarSummary = {
  rowCount: number
  minDate: string
  maxDate: string
  weekendDays: number
  monthBoundaryDays: number
  publicHolidayDays: number
  lunarEventDays: number
  retailEventDays: number
  sourceNotes: string[]
}

export type CalendarFeature = {
  date: string
  isWeekend: boolean
  dayOfWeek: number
  isMonthStart: boolean
  isMonthEnd: boolean
  isPublicHoliday: boolean
  holidayName: string
  isLunarEvent: boolean
  lunarEventName: string
  isRetailEvent: boolean
  retailEventName: string
  sourceNote: string
}

export type ForecastDriverSource = "date-derived" | "factual_external_calendar" | "assumption"
export type ForecastDriverType = "weekend" | "month_boundary" | "public_holiday" | "lunar_event" | "retail_event"

export type ForecastDriver = {
  date: string
  label: string
  type: ForecastDriverType
  source: ForecastDriverSource
  sourceNote: string
  forecastQty: number
  liftVsAveragePct: number
  alignsWithSpike: boolean
}

export type ForecastDriverSummary = {
  windowStartDate: string
  windowEndDate: string
  days: number
  averageForecastQty: number
  peakForecastQty: number
  peakForecastDate: string
  spikeThresholdQty: number
  driverCounts: Record<ForecastDriverType, number>
  drivers: ForecastDriver[]
  spikeAlignedDrivers: ForecastDriver[]
  sourceLabels: typeof DATA_LAYER_LABELS
}

const DATASET_INFO = datasetInfoJson as DatasetInfo
const PRODUCT_SUMMARIES = productSummariesJson as ProductSummaryTuple[]
const DAILY_SALES_SERIES = dailySalesSeriesJson as DailySalesSeriesTuple[]
const DAILY_FORECAST_SERIES = dailyForecastSeriesJson as DailyForecastSeriesTuple[]
const CALENDAR_SUMMARY = calendarSummaryJson as CalendarSummary
const DAILY_CALENDAR_FEATURES = dailyCalendarFeaturesJson as DailyCalendarFeatureTuple[]

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DEFAULT_PRICE = 100_000

export const HBAAC_DATASET_INFO = DATASET_INFO
export const HBAAC_CALENDAR_SUMMARY = CALENDAR_SUMMARY

export const DATA_LAYER_LABELS = {
  competition: "Dữ liệu cuộc thi thực: bán hàng, giá, chi phí trong train.csv và dự báo trong submission_nbeats.csv.",
  calendar: "Dữ liệu lịch ngoài hoặc đặc trưng suy ra từ ngày trong data/external_calendar.csv.",
  catalog: "Danh mục bổ sung/metadata suy luận: tên sản phẩm, ngành hàng, thương hiệu, nhà cung cấp, tồn kho và điểm đặt hàng là dữ liệu làm giàu cho demo.",
} as const

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
  Electrical: "Điện và điện tử",
  Cooling: "Hệ thống làm mát",
  Transmission: "Hộp số",
  Tires: "Lốp và mâm xe",
  Body: "Thân vỏ xe",
}

const SUBCATEGORIES: Record<ProductCategory, string[]> = {
  Brake: ["Má phanh", "Đĩa phanh", "Bộ thắng", "Tổng phanh", "Dầu phanh"],
  Engine: ["Lọc dầu", "Lọc gió", "Bugi", "Dây curoa", "Bơm dầu"],
  Suspension: ["Giảm xóc", "Lò xo", "Thanh cân bằng", "Rotuyn", "Cao su chân máy"],
  Electrical: ["Ắc quy", "Máy phát điện", "Đèn pha", "Đèn hậu", "Cảm biến"],
  Cooling: ["Két nước", "Bơm nước", "Quạt làm mát", "Ống nước", "Van hằng nhiệt"],
  Transmission: ["Bộ ly hợp", "Dầu hộp số", "Vòng bi", "Khớp các đăng", "Phớt"],
  Tires: ["Lốp xe", "Mâm xe", "Van lốp", "Cân mâm", "Lốp dự phòng"],
  Body: ["Gương chiếu hậu", "Cản trước", "Cản sau", "Đèn xi nhan", "Cốp xe"],
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
const calendarByDate = new Map(DAILY_CALENDAR_FEATURES.map((feature) => [feature[0], calendarFeatureFromTuple(feature)]))

function calendarFeatureFromTuple(feature: DailyCalendarFeatureTuple): CalendarFeature {
  return {
    date: feature[0],
    isWeekend: feature[1] === 1,
    dayOfWeek: feature[2],
    isMonthStart: feature[3] === 1,
    isMonthEnd: feature[4] === 1,
    isPublicHoliday: feature[5] === 1,
    holidayName: feature[6],
    isLunarEvent: feature[7] === 1,
    lunarEventName: feature[8],
    isRetailEvent: feature[9] === 1,
    retailEventName: feature[10],
    sourceNote: feature[11],
  }
}

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
        recommendation: `Đặt bổ sung tối thiểu ${Math.max(product.minOrderQty, inv.reorderPoint - inv.availableQty)} đơn vị theo forecast N-BEATS`,
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
        recommendation: "Xem lại tồn kho mục tiêu so với forecast 56 ngày",
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
        recommendation: "SKU bán chậm trong 90 ngày gần nhất, cần xem lại chính sách tồn kho",
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

const decisionPriorityRank: Record<DecisionQueueItem["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const decisionDataSource = `${DATA_LAYER_LABELS.competition} ${DATA_LAYER_LABELS.catalog}`
const decisionAssumptions = [
  DATA_LAYER_LABELS.catalog,
  "Deadline, confidence và tác động tài chính là ước tính vận hành để ưu tiên demo workflow.",
]

function addCalendarDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY)
}

function confidenceFromPriority(priority: DecisionQueueItem["priority"], hasForecast: boolean) {
  const base = priority === "urgent" ? 92 : priority === "high" ? 86 : priority === "medium" ? 76 : 66
  return hasForecast ? base : Math.max(55, base - 10)
}

function priorityFromAlert(alert: StockAlert): DecisionQueueItem["priority"] {
  if (alert.severity === "critical") return "urgent"
  if (alert.severity === "warning") return "high"
  return "medium"
}

function generateDecisionQueueItems(): DecisionQueueItem[] {
  const relatedStockoutImpact = new Map(
    stockAlerts
      .filter((alert) => alert.type === "stockout_risk")
      .map((alert) => [alert.productId, alert.estimatedImpact])
  )

  const orderItems: DecisionQueueItem[] = replenishmentSuggestions.map((suggestion) => {
    const forecast = getForecastsByProduct(suggestion.productId, 28)
    return {
      id: `decision_order_${suggestion.productSku}`,
      productId: suggestion.productId,
      productName: suggestion.productName,
      productSku: suggestion.productSku,
      category: suggestion.category,
      supplierId: suggestion.supplierId,
      supplierName: suggestion.supplierName,
      actionType: "order",
      priority: suggestion.priority,
      urgency: suggestion.priority === "urgent" ? "Cần duyệt trong 24 giờ" : suggestion.priority === "high" ? "Cần xử lý trong tuần này" : "Theo dõi trong chu kỳ đặt hàng kế tiếp",
      deadline: addCalendarDays(suggestion.expectedDeliveryDate, -Math.max(1, Math.round((suppliers.find((supplier) => supplier.id === suggestion.supplierId)?.leadTimeDays ?? 7) / 2))),
      estimatedFinancialImpact: relatedStockoutImpact.get(suggestion.productId) ?? suggestion.estimatedCost,
      reason: suggestion.reason,
      recommendation: `Đặt ${suggestion.suggestedQty.toLocaleString("vi-VN")} đơn vị để giảm rủi ro thiếu hàng`,
      confidence: confidenceFromPriority(suggestion.priority, forecast.length > 0),
      dataSource: decisionDataSource,
      assumptions: decisionAssumptions,
      currentStock: suggestion.currentStock,
      projectedDays: Math.max(1, Math.round((suggestion.currentStock / Math.max(1, getAverageDailySales(suggestion.productId))) || 1)),
      suggestedQty: suggestion.suggestedQty,
      estimatedCost: suggestion.estimatedCost,
    }
  })

  const alertItems: DecisionQueueItem[] = stockAlerts
    .filter((alert) => alert.type !== "stockout_risk")
    .map((alert) => {
      const product = productById.get(alert.productId)
      const supplier = product ? suppliers.find((item) => item.id === product.supplierId) ?? suppliers[0] : suppliers[0]
      const actionType = alert.type === "overstock" ? "reduce" : "clearance"
      const priority = priorityFromAlert(alert)
      const forecast = getForecastsByProduct(alert.productId, 28)

      return {
        id: `decision_${actionType}_${alert.productSku}`,
        productId: alert.productId,
        productName: alert.productName,
        productSku: alert.productSku,
        category: alert.category,
        supplierId: supplier.id,
        supplierName: supplier.name,
        actionType,
        priority,
        urgency: actionType === "reduce" ? "Giảm mua trong kỳ đặt hàng kế tiếp" : "Xem xét xả hàng trong 30 ngày",
        deadline: addCalendarDays(alert.createdAt, actionType === "reduce" ? 14 : 30),
        estimatedFinancialImpact: alert.estimatedImpact,
        reason: alert.recommendation,
        recommendation: actionType === "reduce" ? "Tạm giảm mua hoặc hạ tồn kho mục tiêu cho SKU này" : "Xả hàng có kiểm soát qua khuyến mãi hoặc bundle",
        confidence: confidenceFromPriority(priority, forecast.length > 0),
        dataSource: decisionDataSource,
        assumptions: decisionAssumptions,
        currentStock: alert.currentStock,
        projectedDays: alert.projectedDays,
      }
    })

  return [...orderItems, ...alertItems]
    .sort((left, right) => right.estimatedFinancialImpact - left.estimatedFinancialImpact || decisionPriorityRank[left.priority] - decisionPriorityRank[right.priority] || left.deadline.getTime() - right.deadline.getTime())
    .slice(0, 200)
}

export const decisionQueueItems: DecisionQueueItem[] = generateDecisionQueueItems()

export function getDecisionQueueItems(): DecisionQueueItem[] {
  return decisionQueueItems
}

export type ProfitPriority = ReplenishmentSuggestion["priority"]

export type ProfitCommandKpis = {
  lostProfitRisk: number
  lockedCapital: number
  estimatedHoldingCost: number
  expectedProfitFromRecommendations: number
  actionSkuNext7Days: number
  proposedBudget: number
  highPriorityBudgetShare: number
}

export type ProfitActionRow = {
  productId: string
  productSku: string
  productName: string
  categoryLabel: string
  supplierName: string
  issueLabel: string
  priority: ProfitPriority
  priorityLabel: string
  currentStock: number
  daysOfStock: number
  suggestedQty: number
  financialImpact: number
  recommendation: string
  sourceLabel: string
}

export type CapitalOpportunityRow = {
  productId: string
  productSku: string
  productName: string
  categoryLabel: string
  supplierName: string
  excessQty: number
  currentStock: number
  targetStock: number
  capitalLocked: number
  holdingCost: number
  recommendation: string
  sourceLabel: string
}

export type BudgetMixRow = {
  priority: ProfitPriority
  label: string
  amount: number
  share: number
  skuCount: number
}

export type SupplierBudgetRow = {
  supplierId: string
  supplierName: string
  skuCount: number
  urgentCount: number
  estimatedCost: number
  expectedProfitSaved: number
}

export type CategoryBudgetRow = {
  category: ProductCategory
  categoryLabel: string
  skuCount: number
  estimatedCost: number
  share: number
}

export type ProfitCommandCenter = {
  kpis: ProfitCommandKpis
  immediateActions: ProfitActionRow[]
  capitalOpportunities: CapitalOpportunityRow[]
  priorityBudgetMix: BudgetMixRow[]
  supplierBudget: SupplierBudgetRow[]
  categoryBudget: CategoryBudgetRow[]
  sourceLabels: typeof DATA_LAYER_LABELS
}

const PROFIT_PLANNING_HORIZON_DAYS = 56
const ANNUAL_HOLDING_COST_RATE = 0.22
const PRIORITY_ORDER: ProfitPriority[] = ["urgent", "high", "medium", "low"]
const PRIORITY_LABELS: Record<ProfitPriority, string> = {
  urgent: "Khẩn cấp",
  high: "Cao",
  medium: "Trung bình",
  low: "Thấp",
}

function priorityFromSeverity(severity: StockAlert["severity"]): ProfitPriority {
  if (severity === "critical") return "urgent"
  if (severity === "warning") return "high"
  return "medium"
}

function grossMarginPerUnit(product: Product) {
  return Math.max(1, product.unitPrice - product.unitCost, product.unitPrice * 0.18)
}

function getForecast56(summary: ProductSummaryTuple | undefined) {
  return Math.max(0, summary?.[17] ?? 0)
}

function getLostProfitRisk(alert: StockAlert) {
  const product = productById.get(alert.productId)
  if (!product) return 0

  const marginRate = grossMarginPerUnit(product) / Math.max(1, product.unitPrice)
  return Math.round(alert.estimatedImpact * marginRate)
}

function getExpectedProfitSaved(suggestion: ReplenishmentSuggestion) {
  const product = productById.get(suggestion.productId)
  const summary = product ? summaryBySku.get(product.sku) : undefined
  const inv = inventoryByProductId.get(suggestion.productId)
  if (!product || !summary || !inv) return 0

  const forecast56 = getForecast56(summary)
  const quantityAtRisk = Math.max(0, Math.ceil(forecast56 - inv.availableQty))
  const protectedQty = Math.min(
    suggestion.suggestedQty,
    Math.max(product.minOrderQty, quantityAtRisk || Math.ceil(forecast56 * 0.3))
  )

  return Math.round(protectedQty * grossMarginPerUnit(product))
}

function getCapitalOpportunity(alert: StockAlert): CapitalOpportunityRow | null {
  const product = productById.get(alert.productId)
  const inv = inventoryByProductId.get(alert.productId)
  const summary = product ? summaryBySku.get(product.sku) : undefined
  if (!product || !inv) return null

  const supplier = suppliers.find((item) => item.id === product.supplierId) ?? suppliers[0]
  const forecast56 = getForecast56(summary)
  const targetStock = Math.ceil(Math.max(product.minOrderQty, inv.reorderPoint * 1.5, forecast56 * 1.1))
  const excessQty = Math.max(0, inv.availableQty - targetStock)
  const capitalLocked = Math.round(excessQty * product.unitCost)
  if (capitalLocked <= 0) return null

  return {
    productId: product.id,
    productSku: product.sku,
    productName: product.name,
    categoryLabel: CATEGORY_LABELS[product.category],
    supplierName: supplier.name,
    excessQty,
    currentStock: inv.availableQty,
    targetStock,
    capitalLocked,
    holdingCost: Math.round(capitalLocked * ANNUAL_HOLDING_COST_RATE * (PROFIT_PLANNING_HORIZON_DAYS / 365)),
    recommendation: "Giảm mua mới, rà soát xả hàng hoặc chuyển tồn sang SKU/điểm bán có nhu cầu cao hơn.",
    sourceLabel: "Danh mục bổ sung + forecast cuộc thi",
  }
}

export function getProfitCommandCenter(): ProfitCommandCenter {
  const stockoutAlerts = stockAlerts.filter((alert) => alert.type === "stockout_risk")
  const overstockAlerts = stockAlerts.filter((alert) => alert.type === "overstock")
  const suggestionByProductId = new Map(replenishmentSuggestions.map((suggestion) => [suggestion.productId, suggestion]))

  const immediateActions = stockoutAlerts
    .flatMap((alert): ProfitActionRow[] => {
      const product = productById.get(alert.productId)
      const inv = inventoryByProductId.get(alert.productId)
      if (!product || !inv) return []

      const suggestion = suggestionByProductId.get(product.id)
      const supplier = suppliers.find((item) => item.id === product.supplierId) ?? suppliers[0]
      const priority = suggestion?.priority ?? priorityFromSeverity(alert.severity)
      const suggestedQty = suggestion?.suggestedQty ?? Math.max(product.minOrderQty, inv.reorderPoint - inv.availableQty)

      return [{
        productId: product.id,
        productSku: product.sku,
        productName: product.name,
        categoryLabel: CATEGORY_LABELS[product.category],
        supplierName: supplier.name,
        issueLabel: "Rủi ro thiếu hàng",
        priority,
        priorityLabel: PRIORITY_LABELS[priority],
        currentStock: inv.availableQty,
        daysOfStock: alert.projectedDays,
        suggestedQty,
        financialImpact: getLostProfitRisk(alert),
        recommendation: `Duyệt khuyến nghị đặt hàng ${suggestedQty} đơn vị trước khi còn dưới ${Math.max(1, Math.min(7, alert.projectedDays))} ngày tồn kho.`,
        sourceLabel: "Dữ liệu cuộc thi + danh mục bổ sung",
      }]
    })
    .sort((left, right) => right.financialImpact - left.financialImpact)

  const capitalOpportunities = overstockAlerts
    .map(getCapitalOpportunity)
    .filter((item): item is CapitalOpportunityRow => Boolean(item))
    .sort((left, right) => right.capitalLocked - left.capitalLocked)

  const proposedBudget = replenishmentSuggestions.reduce((sum, suggestion) => sum + suggestion.estimatedCost, 0)
  const priorityTotals = new Map<ProfitPriority, { amount: number; skuCount: number }>(
    PRIORITY_ORDER.map((priority) => [priority, { amount: 0, skuCount: 0 }])
  )
  const supplierTotals = new Map<string, SupplierBudgetRow>()
  const categoryTotals = new Map<ProductCategory, { skuCount: number; estimatedCost: number }>()

  for (const suggestion of replenishmentSuggestions) {
    const priorityTotal = priorityTotals.get(suggestion.priority)!
    priorityTotal.amount += suggestion.estimatedCost
    priorityTotal.skuCount += 1

    const supplierTotal = supplierTotals.get(suggestion.supplierId) ?? {
      supplierId: suggestion.supplierId,
      supplierName: suggestion.supplierName,
      skuCount: 0,
      urgentCount: 0,
      estimatedCost: 0,
      expectedProfitSaved: 0,
    }
    supplierTotal.skuCount += 1
    supplierTotal.urgentCount += suggestion.priority === "urgent" ? 1 : 0
    supplierTotal.estimatedCost += suggestion.estimatedCost
    supplierTotal.expectedProfitSaved += getExpectedProfitSaved(suggestion)
    supplierTotals.set(suggestion.supplierId, supplierTotal)

    const categoryTotal = categoryTotals.get(suggestion.category) ?? { skuCount: 0, estimatedCost: 0 }
    categoryTotal.skuCount += 1
    categoryTotal.estimatedCost += suggestion.estimatedCost
    categoryTotals.set(suggestion.category, categoryTotal)
  }

  const priorityBudgetMix = PRIORITY_ORDER.map((priority) => {
    const total = priorityTotals.get(priority)!
    return {
      priority,
      label: PRIORITY_LABELS[priority],
      amount: Math.round(total.amount),
      share: proposedBudget > 0 ? Math.round((total.amount / proposedBudget) * 1000) / 10 : 0,
      skuCount: total.skuCount,
    }
  })

  const supplierBudget = [...supplierTotals.values()]
    .map((row) => ({
      ...row,
      estimatedCost: Math.round(row.estimatedCost),
      expectedProfitSaved: Math.round(row.expectedProfitSaved),
    }))
    .sort((left, right) => right.estimatedCost - left.estimatedCost)

  const categoryBudget = [...categoryTotals.entries()]
    .map(([category, total]) => ({
      category,
      categoryLabel: CATEGORY_LABELS[category],
      skuCount: total.skuCount,
      estimatedCost: Math.round(total.estimatedCost),
      share: proposedBudget > 0 ? Math.round((total.estimatedCost / proposedBudget) * 1000) / 10 : 0,
    }))
    .sort((left, right) => right.estimatedCost - left.estimatedCost)

  const lostProfitRisk = stockoutAlerts.reduce((sum, alert) => sum + getLostProfitRisk(alert), 0)
  const lockedCapital = capitalOpportunities.reduce((sum, item) => sum + item.capitalLocked, 0)
  const estimatedHoldingCost = capitalOpportunities.reduce((sum, item) => sum + item.holdingCost, 0)
  const expectedProfitFromRecommendations = replenishmentSuggestions.reduce((sum, suggestion) => sum + getExpectedProfitSaved(suggestion), 0)
  const actionSkuNext7Days = new Set(
    stockoutAlerts
      .filter((alert) => alert.projectedDays <= 7 || alert.severity === "critical")
      .map((alert) => alert.productId)
  ).size
  const highPriorityBudget = priorityBudgetMix
    .filter((row) => row.priority === "urgent" || row.priority === "high")
    .reduce((sum, row) => sum + row.amount, 0)

  return {
    kpis: {
      lostProfitRisk: Math.round(lostProfitRisk),
      lockedCapital: Math.round(lockedCapital),
      estimatedHoldingCost: Math.round(estimatedHoldingCost),
      expectedProfitFromRecommendations: Math.round(expectedProfitFromRecommendations),
      actionSkuNext7Days,
      proposedBudget: Math.round(proposedBudget),
      highPriorityBudgetShare: proposedBudget > 0 ? Math.round((highPriorityBudget / proposedBudget) * 1000) / 10 : 0,
    },
    immediateActions: immediateActions.slice(0, 10),
    capitalOpportunities: capitalOpportunities.slice(0, 8),
    priorityBudgetMix,
    supplierBudget: supplierBudget.slice(0, 8),
    categoryBudget: categoryBudget.slice(0, 8),
    sourceLabels: DATA_LAYER_LABELS,
  }
}

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

function emptyDriverCounts(): Record<ForecastDriverType, number> {
  return {
    weekend: 0,
    month_boundary: 0,
    public_holiday: 0,
    lunar_event: 0,
    retail_event: 0,
  }
}

function normalizeForecastDate(date: string | Date) {
  return typeof date === "string" ? date : toIsoDate(date)
}

function driverLiftPct(forecastQty: number, averageForecastQty: number) {
  if (averageForecastQty <= 0) return 0
  return Math.round(((forecastQty - averageForecastQty) / averageForecastQty) * 100)
}

function addDriver(
  drivers: ForecastDriver[],
  counts: Record<ForecastDriverType, number>,
  input: Omit<ForecastDriver, "liftVsAveragePct" | "alignsWithSpike">,
  averageForecastQty: number,
  spikeThresholdQty: number
) {
  const alignsWithSpike = input.forecastQty >= spikeThresholdQty && input.forecastQty > averageForecastQty
  drivers.push({
    ...input,
    liftVsAveragePct: driverLiftPct(input.forecastQty, averageForecastQty),
    alignsWithSpike,
  })
  counts[input.type] += 1
}

export function getCalendarFeaturesByDate(date: string): CalendarFeature | undefined {
  return calendarByDate.get(date)
}

export function getForecastDrivers(
  forecastPoints: Array<{ date: string | Date; forecastQty: number }>
): ForecastDriverSummary {
  const points = forecastPoints
    .map((point) => ({
      date: normalizeForecastDate(point.date),
      forecastQty: Math.max(0, point.forecastQty),
    }))
    .sort((left, right) => left.date.localeCompare(right.date))

  const counts = emptyDriverCounts()
  if (points.length === 0) {
    return {
      windowStartDate: "",
      windowEndDate: "",
      days: 0,
      averageForecastQty: 0,
      peakForecastQty: 0,
      peakForecastDate: "",
      spikeThresholdQty: 0,
      driverCounts: counts,
      drivers: [],
      spikeAlignedDrivers: [],
      sourceLabels: DATA_LAYER_LABELS,
    }
  }

  const totalForecast = points.reduce((sum, point) => sum + point.forecastQty, 0)
  const averageForecastQty = Math.round((totalForecast / points.length) * 10) / 10
  const peakPoint = points.reduce((peak, point) => point.forecastQty > peak.forecastQty ? point : peak, points[0])
  const spikeThresholdQty = Math.round(Math.max(averageForecastQty * 1.2, averageForecastQty + (peakPoint.forecastQty - averageForecastQty) * 0.35) * 10) / 10
  const drivers: ForecastDriver[] = []

  for (const point of points) {
    const feature = getCalendarFeaturesByDate(point.date)
    if (!feature) continue

    const base = {
      date: point.date,
      forecastQty: point.forecastQty,
      sourceNote: feature.sourceNote,
    }

    if (feature.isWeekend) {
      addDriver(drivers, counts, {
        ...base,
        label: "Cuối tuần",
        type: "weekend",
        source: "date-derived",
      }, averageForecastQty, spikeThresholdQty)
    }

    if (feature.isMonthStart || feature.isMonthEnd) {
      addDriver(drivers, counts, {
        ...base,
        label: feature.isMonthStart && feature.isMonthEnd
          ? "Mốc đầu/cuối tháng"
          : feature.isMonthStart
            ? "Đầu tháng"
            : "Cuối tháng",
        type: "month_boundary",
        source: "date-derived",
      }, averageForecastQty, spikeThresholdQty)
    }

    if (feature.isPublicHoliday) {
      addDriver(drivers, counts, {
        ...base,
        label: feature.holidayName || "Ngày lễ",
        type: "public_holiday",
        source: "factual_external_calendar",
      }, averageForecastQty, spikeThresholdQty)
    }

    if (feature.isLunarEvent) {
      addDriver(drivers, counts, {
        ...base,
        label: feature.lunarEventName || "Sự kiện âm lịch",
        type: "lunar_event",
        source: "factual_external_calendar",
      }, averageForecastQty, spikeThresholdQty)
    }

    if (feature.isRetailEvent) {
      addDriver(drivers, counts, {
        ...base,
        label: feature.retailEventName || "Sự kiện bán lẻ",
        type: "retail_event",
        source: "assumption",
      }, averageForecastQty, spikeThresholdQty)
    }
  }

  const spikeAlignedDrivers = drivers
    .filter((driver) => driver.alignsWithSpike)
    .sort((left, right) => right.forecastQty - left.forecastQty || left.date.localeCompare(right.date))

  return {
    windowStartDate: points[0].date,
    windowEndDate: points[points.length - 1].date,
    days: points.length,
    averageForecastQty,
    peakForecastQty: peakPoint.forecastQty,
    peakForecastDate: peakPoint.date,
    spikeThresholdQty,
    driverCounts: counts,
    drivers,
    spikeAlignedDrivers,
    sourceLabels: DATA_LAYER_LABELS,
  }
}

export function getDemandDriversForProduct(productId: string, days = 28): ForecastDriverSummary {
  return getForecastDrivers(getForecastsByProduct(productId, days))
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
