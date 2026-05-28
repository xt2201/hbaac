const DEFAULT_ENDPOINTS = {
  productForecast: "/analytics/product-forecast",
  stockAlerts: "/analytics/stock-alerts",
  replenishment: "/analytics/replenishment-suggestions",
  sales: "/analytics/sales",
  inventorySummary: "/analytics/inventory-summary",
  compareProducts: "/analytics/compare-products",
  dashboardKpis: "/analytics/dashboard-kpis",
}

const PLACEHOLDER_VALUES = new Set([
  "",
  "https://your-backend.example.com",
  "replace-with-your-token",
])

function normalizePath(path: string) {
  const trimmed = path.trim()
  if (!trimmed) return "/"
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "")
}

function parseTimeout(value: string | undefined) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15000
}

function parseBoolean(value: string | undefined) {
  return value?.trim().toLowerCase() === "true"
}

export function getAnalyticsBackendConfig() {
  return {
    baseUrl: normalizeBaseUrl(process.env.ANALYTICS_BACKEND_BASE_URL ?? ""),
    authToken: process.env.ANALYTICS_BACKEND_AUTH_TOKEN?.trim() ?? "",
    timeoutMs: parseTimeout(process.env.ANALYTICS_BACKEND_TIMEOUT_MS),
    useLocalDatasetFallback: parseBoolean(
      process.env.ANALYTICS_BACKEND_USE_LOCAL_FALLBACK ??
      process.env.ANALYTICS_BACKEND_USE_MOCK_FALLBACK
    ),
    endpoints: {
      productForecast: normalizePath(process.env.ANALYTICS_BACKEND_PRODUCT_FORECAST_PATH ?? DEFAULT_ENDPOINTS.productForecast),
      stockAlerts: normalizePath(process.env.ANALYTICS_BACKEND_STOCK_ALERTS_PATH ?? DEFAULT_ENDPOINTS.stockAlerts),
      replenishment: normalizePath(process.env.ANALYTICS_BACKEND_REPLENISHMENT_PATH ?? DEFAULT_ENDPOINTS.replenishment),
      sales: normalizePath(process.env.ANALYTICS_BACKEND_SALES_PATH ?? DEFAULT_ENDPOINTS.sales),
      inventorySummary: normalizePath(process.env.ANALYTICS_BACKEND_INVENTORY_SUMMARY_PATH ?? DEFAULT_ENDPOINTS.inventorySummary),
      compareProducts: normalizePath(process.env.ANALYTICS_BACKEND_COMPARE_PRODUCTS_PATH ?? DEFAULT_ENDPOINTS.compareProducts),
      dashboardKpis: normalizePath(process.env.ANALYTICS_BACKEND_DASHBOARD_KPIS_PATH ?? DEFAULT_ENDPOINTS.dashboardKpis),
    },
  }
}

export function hasAnalyticsBackendConfig() {
  const config = getAnalyticsBackendConfig()
  return !PLACEHOLDER_VALUES.has(config.baseUrl) && !PLACEHOLDER_VALUES.has(config.authToken)
}

export function shouldUseLocalDatasetFallback() {
  return getAnalyticsBackendConfig().useLocalDatasetFallback
}
