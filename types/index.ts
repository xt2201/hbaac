// AutoParts Intelligence Platform - Type Definitions

export interface Product {
  id: string
  sku: string
  name: string
  category: ProductCategory
  subcategory: string
  brand: string
  compatibleVehicles: string[]
  unitPrice: number
  unitCost: number
  leadTimeDays: number
  minOrderQty: number
  supplierId: string
  status: "active" | "discontinued" | "seasonal"
}

export type ProductCategory =
  | "SourceData"
  | "Brake"
  | "Engine"
  | "Suspension"
  | "Electrical"
  | "Cooling"
  | "Transmission"
  | "Tires"
  | "Body"

export interface Supplier {
  id: string
  name: string
  country: string
  leadTimeDays: number
  rating: number
  contactEmail: string
}

export type InventoryPolicySource = "inventory_plan" | "fallback"

export interface InventoryLevel {
  productId: string
  warehouseId: string
  quantity: number
  reservedQty: number
  availableQty: number
  reorderPoint: number
  safetyStock: number
  targetStock?: number
  demand28?: number
  economicOrderQty?: number
  recommendedOrderTarget?: number
  inventoryPolicyMonth?: 1 | 2
  inventoryPolicySource: InventoryPolicySource
  inventoryPolicyNote?: string
  lastUpdated: Date
}

export interface SalesRecord {
  id: string
  productId: string
  date: Date
  quantity: number
  revenue: number
  channel: "retail" | "wholesale" | "online"
  customerId: string
}

export interface DemandForecast {
  productId: string
  date: Date
  forecastQty: number
  confidenceLower: number
  confidenceUpper: number
  method: "arima" | "prophet" | "ml_ensemble" | "nbeats"
}

export interface StockAlert {
  id: string
  productId: string
  productName: string
  productSku: string
  category: ProductCategory
  type: "stockout_risk" | "overstock" | "slow_moving"
  severity: "critical" | "warning" | "info"
  currentStock: number
  projectedDays: number
  recommendation: string
  estimatedImpact: number
  createdAt: Date
}

export interface ReplenishmentSuggestion {
  id: string
  productId: string
  productName: string
  productSku: string
  category: ProductCategory
  suggestedQty: number
  estimatedCost: number
  priority: "urgent" | "high" | "medium" | "low"
  reason: string
  expectedDeliveryDate: Date
  supplierId: string
  supplierName: string
  currentStock: number
  reorderPoint: number
  purchaseQty?: number
  demand28?: number
  economicOrderQty?: number
  recommendedOrderTarget?: number
  targetStock?: number
  safetyStock?: number
  unitCost?: number
  leadTimeDays?: number
  minOrderQty?: number
  cycleTimeDays?: number | null
  grossMarginPerUnit?: number
  expectedProfitSaved?: number
  roi?: number
  inventoryPolicyMonth?: 1 | 2
  inventoryPolicySource: InventoryPolicySource
  inventoryPolicyNote?: string
}

export type DecisionActionType = "order" | "reduce" | "clearance" | "watch"

export type DecisionPriority = "urgent" | "high" | "medium" | "low"

export interface DecisionQueueItem {
  id: string
  productId: string
  productName: string
  productSku: string
  category: ProductCategory
  supplierId: string
  supplierName: string
  actionType: DecisionActionType
  priority: DecisionPriority
  urgency: string
  deadline: Date
  estimatedFinancialImpact: number
  reason: string
  recommendation: string
  confidence: number
  dataSource: string
  assumptions: string[]
  currentStock: number
  projectedDays: number
  suggestedQty?: number
  estimatedCost?: number
  demand28?: number
  economicOrderQty?: number
  recommendedOrderTarget?: number
  targetStock?: number
  safetyStock?: number
  inventoryPolicyMonth?: 1 | 2
  inventoryPolicySource?: InventoryPolicySource
  inventoryPolicyNote?: string
}

export interface PurchaseOrder {
  id: string
  supplierId: string
  status: "draft" | "pending" | "approved" | "shipped" | "received"
  items: PurchaseOrderItem[]
  totalAmount: number
  createdAt: Date
  expectedDelivery: Date
}

export interface PurchaseOrderItem {
  productId: string
  quantity: number
  unitCost: number
  totalCost: number
}

// Dashboard KPI types
export interface DashboardKPIs {
  totalSKUs: number
  activeSKUs: number
  stockoutRiskCount: number
  overstockCount: number
  slowMovingCount: number
  pendingOrders: number
  totalInventoryValue: number
  monthlyRevenue: number
  revenueChange: number
}

// Chart data types
export interface ForecastChartData {
  date: string
  actual: number | null
  forecast: number
  confidenceLower: number
  confidenceUpper: number
}

export interface SalesChartData {
  date: string
  revenue: number
  quantity: number
}

// Filter types
export interface DashboardFilters {
  category?: ProductCategory
  brand?: string
  dateRange: "7d" | "30d" | "90d" | "custom"
  startDate?: Date
  endDate?: Date
}

// AnalyticsBot types
export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  toolResults?: ToolResult[]
}

export interface ToolResult {
  toolName: string
  data: unknown
  visualizationType?: "chart" | "table" | "card"
}

// API Response types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}
