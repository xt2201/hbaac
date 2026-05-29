// Data layer generated from HBAAC train.csv and submission_nbeats.csv.

import datasetInfoJson from "./generated/dataset-info.json"
import productSummariesJson from "./generated/product-summaries.json"
import dailySalesSeriesJson from "./generated/daily-sales-series.json"
import dailyForecastSeriesJson from "./generated/daily-forecast-series.json"
import inventoryPlanJson from "./generated/inventory-plan.json"
import dashboardInsightsJson from "./generated/dashboard-insights.json"
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
  inventoryPlanRows?: number
  inventoryPlanSkuCount?: number
  inventoryPlanForecastMismatchRows?: number
  inventoryPlanSource?: string
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
type InventoryPolicyTuple = [
  sku: string,
  month: 1 | 2,
  unitCost: number,
  stdDaily: number,
  demand28: number,
  meanDaily: number,
  annualizedDemand: number,
  economicOrderQty: number,
  recommendedOrderTarget: number,
  safetyStock: number,
  reorderPoint: number,
  cycleTimeDays: number | null,
  annualOrderCost: number,
  annualHoldingCost: number,
  annualPurchaseCost: number,
  totalAnnualCost: number,
]

type InventoryPlanJson = {
  metadata: {
    generatedAt: string
    source: string
    forecastSource: string
    horizonDays: number
    months: number[]
    rows: number
    skuCount: number
    forecastMismatchRows: number
    summaries: InventoryOptimizationSummary[]
  }
  rows: InventoryPolicyTuple[]
}

export interface InventoryOptimizationPolicy {
  sku: string
  month: 1 | 2
  unitCost: number
  stdDaily: number
  demand28: number
  meanDaily: number
  annualizedDemand: number
  economicOrderQty: number
  recommendedOrderTarget: number
  safetyStock: number
  reorderPoint: number
  cycleTimeDays: number | null
  annualOrderCost: number
  annualHoldingCost: number
  annualPurchaseCost: number
  totalAnnualCost: number
  productId?: string
  inventoryPolicySource: "inventory_plan"
  inventoryPolicyNote: string
}

export interface InventoryOptimizationSummary {
  month: 1 | 2
  skuCount: number
  totalDemand28: number
  totalRecommendedOrderTarget: number
  totalSafetyStock: number
  totalAnnualOrderCost: number
  totalAnnualHoldingCost: number
  totalAnnualPurchaseCost: number
  totalAnnualCost: number
  averageCycleTimeDays: number | null
}

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

export type WeekdaySummary = {
  weekday: number
  label: string
  totalQuantity: number
  totalRevenue: number
  activeDays: number
  averageDailyQuantity: number
  averageDailyRevenue: number
  forecast28Quantity?: number
}

export type SaturdaySundayTrend = {
  month: string
  saturdayQuantity: number
  sundayQuantity: number
  saturdayRevenue: number
  sundayRevenue: number
}

export type ReturnMonthly = {
  month: string
  grossQuantity: number
  returnQuantity: number
  returnRate: number
  grossRevenue: number
  returnedRevenueProxy?: number
}

export type ParetoSummary = {
  top1Share: number
  top50Share: number
  top200Share: number
  longTailShare: number
  totalSkuCount: number
  rankedBuckets: Array<{
    bucket: string
    skuCount: number
    revenue: number
    revenueShare: number
    cumulativeShare: number
  }>
}

export type HolidayImpactPoint = {
  relativeDay: number
  averageQuantity: number
  averageRevenue: number
  sampleDays: number
}

export type ForecastCalendarPoint = {
  date: string
  forecastQuantity: number
  weekday: number
  weekdayLabel: string
  isSaturday: boolean
  isSunday: boolean
  isHolidayWindow: boolean
}

export type DashboardInsights = {
  generatedAt: string
  summary: {
    transactionRows: number
    trainSkuCount: number
    forecastSkuCount: number
    inventoryPlanSkuCount: number
    inventoryPlanForecastMismatchRows: number
    trainStartDate: string
    trainEndDate: string
    forecastStartDate: string
    forecastEndDate: string
  }
  weekdaySummary: WeekdaySummary[]
  saturdaySundayTrend: SaturdaySundayTrend[]
  returnMonthly: ReturnMonthly[]
  paretoSummary: ParetoSummary
  holidayImpact: HolidayImpactPoint[]
  forecastCalendarImpact: ForecastCalendarPoint[]
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
const INVENTORY_PLAN = inventoryPlanJson as unknown as InventoryPlanJson
const DASHBOARD_INSIGHTS = dashboardInsightsJson as DashboardInsights
const CALENDAR_SUMMARY = calendarSummaryJson as CalendarSummary
const DAILY_CALENDAR_FEATURES = dailyCalendarFeaturesJson as DailyCalendarFeatureTuple[]

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DEFAULT_PRICE = 100_000

export const HBAAC_DATASET_INFO = DATASET_INFO
export const HBAAC_CALENDAR_SUMMARY = CALENDAR_SUMMARY
export const dashboardInsights = DASHBOARD_INSIGHTS

export function getDashboardInsights() {
  return DASHBOARD_INSIGHTS
}

export const DATA_LAYER_LABELS = {
  competition: "Dữ liệu bán hàng, giá, chi phí và dự báo nhu cầu đã đồng bộ.",
  calendar: "Lịch vận hành và tín hiệu mùa vụ đã ghi nhận.",
  catalog: "Danh mục demo được chuẩn hóa từ mã hàng để phục vụ trình bày sản phẩm.",
  inventoryPolicy: "Chính sách tồn kho được tính từ dự báo nhu cầu: lượng mua đề xuất, tồn mục tiêu, tồn an toàn và điểm đặt hàng lại.",
} as const

export const CATEGORIES: ProductCategory[] = [
  "SourceData",
]

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  SourceData: "Danh mục phụ tùng",
  Brake: "Phanh",
  Engine: "Động cơ",
  Suspension: "Gầm treo",
  Electrical: "Điện - cảm biến",
  Cooling: "Làm mát",
  Transmission: "Truyền động",
  Tires: "Lốp - bánh xe",
  Body: "Thân vỏ",
}

const SOURCE_ONLY_SUPPLIER: Supplier = {
  id: "preferred_partner",
  name: "Nhà cung ứng ưu tiên",
  country: "VN",
  leadTimeDays: 0,
  rating: 0,
  contactEmail: "N/A",
}

export const suppliers: Supplier[] = [SOURCE_ONLY_SUPPLIER]

/*
 * The source files do not contain product category, brand, supplier, vehicle
 * fitment, current-stock or MOQ master data. Keep these constants only as
 * neutral placeholders for existing UI types; do not use them as facts.
 */
const SOURCE_CATEGORY: ProductCategory = "SourceData"
const SOURCE_SUBCATEGORY = "Phụ tùng thay thế"
const SOURCE_BRAND = "HBAAC Select"
const SOURCE_LEAD_TIME_DAYS = 0
const SOURCE_MIN_ORDER_QTY = 1

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
  return SOURCE_CATEGORY
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

function demoProductNameForSku(sku: string) {
  const skuNumber = getSkuNumber(sku)
  const productLines = [
    "Má phanh trước",
    "Lọc dầu động cơ",
    "Bugi đánh lửa",
    "Rotuyn cân bằng",
    "Cảm biến oxy",
    "Dây curoa tổng",
    "Bơm nước làm mát",
    "Bi moay-ơ trước",
    "Lọc gió động cơ",
    "Cao su chân máy",
    "Đèn pha LED",
    "Gạt mưa cao cấp",
  ]
  const vehicleLines = [
    "sedan hạng C",
    "SUV đô thị",
    "xe bán tải",
    "MPV gia đình",
    "hatchback đô thị",
    "van thương mại",
  ]
  const productLine = productLines[skuNumber % productLines.length]
  const vehicleLine = vehicleLines[Math.floor(skuNumber / productLines.length) % vehicleLines.length]

  return `${productLine} ${vehicleLine} ${sku}`
}

function productFromSummary(summary: ProductSummaryTuple): Product {
  const sku = summary[0]
  const category = categoryForSku(sku)
  const unitPrice = unitPriceFromSummary(summary)

  return {
    id: sku,
    sku,
    name: demoProductNameForSku(sku),
    category,
    subcategory: SOURCE_SUBCATEGORY,
    brand: SOURCE_BRAND,
    compatibleVehicles: [],
    unitPrice,
    unitCost: unitCostFromSummary(summary),
    leadTimeDays: SOURCE_LEAD_TIME_DAYS,
    minOrderQty: SOURCE_MIN_ORDER_QTY,
    supplierId: SOURCE_ONLY_SUPPLIER.id,
    status: getProductStatus(summary),
  }
}

export const products: Product[] = PRODUCT_SUMMARIES
  .map(productFromSummary)
  .sort((left, right) => demandScore(summaryBySku.get(right.id)!) - demandScore(summaryBySku.get(left.id)!))

const productById = new Map(products.map((product) => [product.id, product]))
const productBySku = new Map(products.map((product) => [product.sku.toLowerCase(), product]))
const INVENTORY_POLICY_NOTE = DATA_LAYER_LABELS.inventoryPolicy

function inventoryPolicyFromTuple(tuple: InventoryPolicyTuple): InventoryOptimizationPolicy {
  const product = productBySku.get(tuple[0].toLowerCase())
  return {
    sku: tuple[0],
    month: tuple[1],
    unitCost: tuple[2],
    stdDaily: tuple[3],
    demand28: tuple[4],
    meanDaily: tuple[5],
    annualizedDemand: tuple[6],
    economicOrderQty: tuple[7],
    recommendedOrderTarget: tuple[8],
    safetyStock: tuple[9],
    reorderPoint: tuple[10],
    cycleTimeDays: tuple[11],
    annualOrderCost: tuple[12],
    annualHoldingCost: tuple[13],
    annualPurchaseCost: tuple[14],
    totalAnnualCost: tuple[15],
    productId: product?.id,
    inventoryPolicySource: "inventory_plan",
    inventoryPolicyNote: INVENTORY_POLICY_NOTE,
  }
}

export const inventoryOptimizationPolicies: InventoryOptimizationPolicy[] = INVENTORY_PLAN.rows.map(inventoryPolicyFromTuple)
const inventoryPoliciesBySku = new Map<string, InventoryOptimizationPolicy[]>()
const inventoryPolicyBySkuMonth = new Map<string, InventoryOptimizationPolicy>()
const inventoryPolicyByProductMonth = new Map<string, InventoryOptimizationPolicy>()

for (const policy of inventoryOptimizationPolicies) {
  const skuKey = policy.sku.toLowerCase()
  const skuPolicies = inventoryPoliciesBySku.get(skuKey) ?? []
  skuPolicies.push(policy)
  skuPolicies.sort((left, right) => left.month - right.month)
  inventoryPoliciesBySku.set(skuKey, skuPolicies)
  inventoryPolicyBySkuMonth.set(`${skuKey}:${policy.month}`, policy)
  if (policy.productId) inventoryPolicyByProductMonth.set(`${policy.productId}:${policy.month}`, policy)
}

export function getInventoryPoliciesBySku(sku: string): InventoryOptimizationPolicy[] {
  return inventoryPoliciesBySku.get(sku.toLowerCase()) ?? []
}

export function getInventoryPolicyBySkuMonth(sku: string, month: 1 | 2 = 1): InventoryOptimizationPolicy | null {
  return inventoryPolicyBySkuMonth.get(`${sku.toLowerCase()}:${month}`) ?? null
}

export function getInventoryPolicyByProduct(productId: string, month: 1 | 2 = 1): InventoryOptimizationPolicy | null {
  const product = productById.get(productId) ?? productBySku.get(productId.toLowerCase())
  if (!product) return null
  return inventoryPolicyByProductMonth.get(`${product.id}:${month}`) ?? getInventoryPolicyBySkuMonth(product.sku, month)
}

export function getInventoryOptimizationSummary(month: 1 | 2 = 1): InventoryOptimizationSummary {
  return INVENTORY_PLAN.metadata.summaries.find((summary) => summary.month === month) ?? {
    month,
    skuCount: 0,
    totalDemand28: 0,
    totalRecommendedOrderTarget: 0,
    totalSafetyStock: 0,
    totalAnnualOrderCost: 0,
    totalAnnualHoldingCost: 0,
    totalAnnualPurchaseCost: 0,
    totalAnnualCost: 0,
    averageCycleTimeDays: null,
  }
}


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
  const policy = getInventoryPolicyByProduct(product.id)
  const fallbackSafetyStock = Math.ceil(dailyDemand * 7)
  const fallbackReorderPoint = Math.max(product.minOrderQty, Math.ceil(dailyDemand * product.leadTimeDays + fallbackSafetyStock))
  const safetyStock = policy ? Math.ceil(policy.safetyStock) : fallbackSafetyStock
  const reorderPoint = policy ? Math.ceil(policy.reorderPoint) : fallbackReorderPoint
  const availableQty = 0
  const reservedQty = 0

  return {
    productId: product.id,
    warehouseId: "not_available_in_source",
    quantity: 0,
    reservedQty,
    availableQty,
    reorderPoint,
    safetyStock,
    targetStock: policy?.recommendedOrderTarget,
    demand28: policy?.demand28,
    economicOrderQty: policy?.economicOrderQty,
    recommendedOrderTarget: policy?.recommendedOrderTarget,
    inventoryPolicyMonth: policy?.month,
    inventoryPolicySource: policy ? "inventory_plan" : "fallback",
    inventoryPolicyNote: policy?.inventoryPolicyNote ?? DATA_LAYER_LABELS.catalog,
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
    const policy = getInventoryPolicyByProduct(product.id, 1)
    if (!summary) continue

    const forecast56 = Math.max(0, summary[17])
    const forecast28 = Math.max(0, policy?.demand28 ?? summary[15])
    const policyCycleDays = Math.max(0, Math.round(policy?.cycleTimeDays ?? 0))

    if (policy && policy.recommendedOrderTarget > 0) {
      alerts.push({
        id: `alert_stockout_${product.sku}`,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        category: product.category,
        type: "stockout_risk",
        severity: policy.recommendedOrderTarget >= 100 || policy.totalAnnualCost >= 100_000_000 ? "critical" : policy.recommendedOrderTarget >= 20 ? "warning" : "info",
        currentStock: 0,
        projectedDays: policyCycleDays,
        recommendation: `Đặt ${Math.ceil(policy.recommendedOrderTarget).toLocaleString("vi-VN")} đơn vị theo kế hoạch mua hiện tại`,
        estimatedImpact: Math.round(forecast28 * grossMarginPerUnit(product)),
        createdAt: toDate(DATASET_INFO.maxTrainDate),
      })
    }

    if (policy && policy.annualHoldingCost > 0 && policy.safetyStock > Math.max(1, policy.demand28)) {
      alerts.push({
        id: `alert_overstock_${product.sku}`,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        category: product.category,
        type: "overstock",
        severity: policy.annualHoldingCost >= 50_000_000 ? "warning" : "info",
        currentStock: 0,
        projectedDays: policyCycleDays,
        recommendation: "Tồn an toàn hoặc chi phí lưu kho cao; rà soát kế hoạch trước khi mua thêm.",
        estimatedImpact: Math.round(policy.annualHoldingCost),
        createdAt: toDate(DATASET_INFO.maxTrainDate),
      })
    }

    if (Math.max(0, summary[10]) <= 2 && summary[4] >= 10 && forecast56 <= 1) {
      alerts.push({
        id: `alert_slow_${product.sku}`,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        category: product.category,
        type: "slow_moving",
        severity: "info",
        currentStock: 0,
        projectedDays: 0,
        recommendation: "Mã hàng có giao dịch lịch sử nhưng dự báo thấp; chưa ưu tiên mua thêm trong kỳ này.",
        estimatedImpact: Math.round(Math.max(0, summary[3])),
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
  const stockoutAlertByProductId = new Map(
    stockAlerts
      .filter((alert) => alert.type === "stockout_risk")
      .map((alert) => [alert.productId, alert])
  )
  const replenishmentPriorityRank: Record<ReplenishmentSuggestion["priority"], number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  }

  return products
    .map<ReplenishmentSuggestion | null>((product) => {
      const inv = inventoryByProductId.get(product.id)
      const alert = stockoutAlertByProductId.get(product.id)
      if (!inv) return null

      const supplier = suppliers.find((item) => item.id === product.supplierId) ?? suppliers[0]
      const summary = summaryBySku.get(product.sku)!
      const policy = getInventoryPolicyByProduct(product.id)
      if (!policy) return null

      const rawPurchaseQty = Math.max(0, policy.recommendedOrderTarget)
      if (rawPurchaseQty <= 0) return null

      const suggestedQty = rawPurchaseQty > 0
        ? Math.ceil(rawPurchaseQty)
        : 0
      const unitCost = policy?.unitCost && policy.unitCost > 0 ? policy.unitCost : product.unitCost
      const margin = grossMarginPerUnit(product)
      const forecast56 = getForecast56(summary)
      const quantityAtRisk = Math.max(0, Math.ceil(forecast56 - inv.availableQty))
      const protectedQty = Math.min(suggestedQty, Math.max(0, quantityAtRisk))
      const expectedProfitSaved = Math.round(protectedQty * margin)
      const estimatedCost = Math.round(suggestedQty * unitCost)
      const purchaseGapRatio = rawPurchaseQty / Math.max(1, policy.recommendedOrderTarget)
      const priority: ReplenishmentSuggestion["priority"] = alert
        ? alert.severity === "critical" ? "urgent" : alert.severity === "warning" ? "high" : "medium"
        : purchaseGapRatio >= 0.5 ? "high" : "medium"
      const inventoryPolicySource: ReplenishmentSuggestion["inventoryPolicySource"] = policy ? "inventory_plan" : "fallback"

      return {
        id: `repl_${product.sku}`,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        category: product.category,
        suggestedQty,
        estimatedCost,
        priority,
        reason: policy
          ? `Đặt ${Math.round(policy.recommendedOrderTarget).toLocaleString("vi-VN")} đơn vị theo kế hoạch mua hiện tại`
          : alert?.recommendation ?? "Cần bổ sung hàng theo kế hoạch nhu cầu",
        expectedDeliveryDate: toDate(DATASET_INFO.maxTrainDate),
        supplierId: supplier.id,
        supplierName: supplier.name,
        currentStock: inv.availableQty,
        reorderPoint: inv.reorderPoint,
        purchaseQty: suggestedQty,
        demand28: policy?.demand28,
        economicOrderQty: policy?.economicOrderQty,
        recommendedOrderTarget: policy?.recommendedOrderTarget,
        targetStock: policy?.recommendedOrderTarget,
        safetyStock: inv.safetyStock,
        unitCost,
        leadTimeDays: undefined,
        minOrderQty: undefined,
        cycleTimeDays: policy?.cycleTimeDays,
        grossMarginPerUnit: margin,
        expectedProfitSaved,
        roi: estimatedCost > 0 ? Math.round((expectedProfitSaved / estimatedCost) * 100) : 0,
        inventoryPolicyMonth: policy?.month,
        inventoryPolicySource,
        inventoryPolicyNote: policy?.inventoryPolicyNote ?? DATA_LAYER_LABELS.catalog,
      }
    })
    .filter((suggestion): suggestion is ReplenishmentSuggestion => suggestion !== null)
    .filter((suggestion) => (suggestion.purchaseQty ?? suggestion.suggestedQty) > 0)
    .sort((left, right) => (
      replenishmentPriorityRank[left.priority] - replenishmentPriorityRank[right.priority]
      || (right.expectedProfitSaved ?? 0) - (left.expectedProfitSaved ?? 0)
      || right.estimatedCost - left.estimatedCost
    ))
}

export const replenishmentSuggestions: ReplenishmentSuggestion[] = generateReplenishmentSuggestions()

const decisionPriorityRank: Record<DecisionQueueItem["priority"], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

const decisionDataSource = `${DATA_LAYER_LABELS.competition} ${DATA_LAYER_LABELS.catalog} ${DATA_LAYER_LABELS.inventoryPolicy}`
const decisionAssumptions = [
  DATA_LAYER_LABELS.catalog,
  DATA_LAYER_LABELS.inventoryPolicy,
  "Hạn xử lý, độ tin cậy và tác động tài chính là ước tính vận hành để ưu tiên quyết định.",
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
      deadline: suggestion.expectedDeliveryDate,
      estimatedFinancialImpact: relatedStockoutImpact.get(suggestion.productId) ?? suggestion.estimatedCost,
      reason: suggestion.reason,
      recommendation: `Mua ${suggestion.suggestedQty.toLocaleString("vi-VN")} đơn vị để tiến tới tồn kho mục tiêu`,
      confidence: confidenceFromPriority(suggestion.priority, forecast.length > 0),
      dataSource: decisionDataSource,
      assumptions: decisionAssumptions,
      currentStock: suggestion.currentStock,
      projectedDays: Math.round(suggestion.cycleTimeDays ?? 0),
      suggestedQty: suggestion.suggestedQty,
      estimatedCost: suggestion.estimatedCost,
      demand28: suggestion.demand28,
      economicOrderQty: suggestion.economicOrderQty,
      recommendedOrderTarget: suggestion.recommendedOrderTarget,
      targetStock: suggestion.targetStock,
      safetyStock: suggestion.safetyStock,
      inventoryPolicyMonth: suggestion.inventoryPolicyMonth,
      inventoryPolicySource: suggestion.inventoryPolicySource,
      inventoryPolicyNote: suggestion.inventoryPolicyNote,
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
    Math.max(0, quantityAtRisk || Math.ceil(forecast56 * 0.3))
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
    sourceLabel: "Thông tin danh mục và dự báo nhu cầu",
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
        issueLabel: "Khuyến nghị mua theo forecast",
        priority,
        priorityLabel: PRIORITY_LABELS[priority],
        currentStock: inv.availableQty,
        daysOfStock: alert.projectedDays,
        suggestedQty,
        financialImpact: getLostProfitRisk(alert),
        recommendation: `Đặt ${suggestedQty} đơn vị theo kế hoạch mua hiện tại.`,
        sourceLabel: "Kế hoạch nhu cầu và tồn kho",
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

  const policySummary = getInventoryOptimizationSummary(1)
  const lostProfitRisk = stockoutAlerts.reduce((sum, alert) => sum + getLostProfitRisk(alert), 0)
  const lockedCapital = policySummary.totalAnnualHoldingCost
  const estimatedHoldingCost = policySummary.totalAnnualHoldingCost
  const expectedProfitFromRecommendations = replenishmentSuggestions.reduce((sum, suggestion) => sum + getExpectedProfitSaved(suggestion), 0)
  const actionSkuNext7Days = replenishmentSuggestions.length
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
