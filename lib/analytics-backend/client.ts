import { getAnalyticsBackendConfig, hasAnalyticsBackendConfig } from "./config"
import type { AnalyticsBackendResult } from "./types"
import {
  normalizeCompareProductsResponse,
  normalizeDashboardKPIsResponse,
  normalizeInventorySummaryResponse,
  normalizeProductForecastResponse,
  normalizeReplenishmentResponse,
  normalizeSalesAnalyticsResponse,
  normalizeStockAlertsResponse,
} from "./normalizers"

function buildUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`
}

function errorResult<T>(code: AnalyticsBackendResult<T> extends infer _ ? never : never, message: string): AnalyticsBackendResult<T> {
  return {
    ok: false,
    source: "backend",
    error: {
      code: code as never,
      message,
    },
  }
}

function backendError<T>(code: "missing_config" | "unauthorized" | "not_found" | "timeout" | "backend_error" | "network_error" | "invalid_response", message: string, status?: number, details?: unknown): AnalyticsBackendResult<T> {
  return {
    ok: false,
    source: "backend",
    error: { code, message, status, details },
  }
}

function unwrapResponse(raw: unknown) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw
  const record = raw as Record<string, unknown>
  if (record.success === false) {
    throw new Error(typeof record.message === "string" ? record.message : "Backend báo xử lý thất bại.")
  }
  return raw
}

async function requestBackend<T>(path: string, body: unknown, normalize: (raw: unknown) => T | null): Promise<AnalyticsBackendResult<T>> {
  const config = getAnalyticsBackendConfig()

  if (!hasAnalyticsBackendConfig()) {
    return backendError(
      "missing_config",
      "Thiếu cấu hình backend. Vui lòng thiết lập ANALYTICS_BACKEND_BASE_URL và ANALYTICS_BACKEND_AUTH_TOKEN trong .env.local."
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)

  try {
    const response = await fetch(buildUrl(config.baseUrl, path), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.authToken}`,
      },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
      signal: controller.signal,
    })

    if (response.status === 401 || response.status === 403) {
      return backendError("unauthorized", "Backend từ chối xác thực. Vui lòng kiểm tra ANALYTICS_BACKEND_AUTH_TOKEN.", response.status)
    }

    if (response.status === 404) {
      return backendError("not_found", "Không tìm thấy endpoint backend. Vui lòng kiểm tra endpoint path trong cấu hình môi trường.", response.status)
    }

    if (!response.ok) {
      return backendError("backend_error", `Backend trả về lỗi HTTP ${response.status}.`, response.status)
    }

    let raw: unknown
    try {
      raw = unwrapResponse(await response.json())
    } catch (error) {
      return backendError("invalid_response", "Backend trả về dữ liệu không đúng định dạng JSON mong đợi.", response.status, error)
    }

    try {
      const data = normalize(raw)
      if (!data) {
        return backendError("invalid_response", "Backend trả về dữ liệu không đúng định dạng mong đợi.", response.status, raw)
      }
      return { ok: true, source: "backend", data }
    } catch (error) {
      return backendError("invalid_response", "Không thể chuẩn hoá dữ liệu backend để hiển thị trong chatbot.", response.status, error)
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return backendError("timeout", "Backend phản hồi quá lâu. Vui lòng thử lại hoặc tăng ANALYTICS_BACKEND_TIMEOUT_MS.")
    }
    return backendError("network_error", "Không thể kết nối backend phân tích. Vui lòng kiểm tra base URL hoặc mạng.", undefined, error)
  } finally {
    clearTimeout(timeout)
  }
}

export const analyticsBackendClient = {
  getProductForecast(input: { productIdOrSku: string; days: number }) {
    const config = getAnalyticsBackendConfig()
    return requestBackend(config.endpoints.productForecast, input, (raw) => normalizeProductForecastResponse(raw, input))
  },
  getStockAlerts(input: { type: string; severity: string; category?: string; limit: number }) {
    const config = getAnalyticsBackendConfig()
    return requestBackend(config.endpoints.stockAlerts, input, normalizeStockAlertsResponse)
  },
  getReplenishmentSuggestions(input: { priority: string; category?: string; limit: number }) {
    const config = getAnalyticsBackendConfig()
    return requestBackend(config.endpoints.replenishment, input, normalizeReplenishmentResponse)
  },
  getSalesAnalytics(input: { groupBy: string; days: number; limit: number }) {
    const config = getAnalyticsBackendConfig()
    return requestBackend(config.endpoints.sales, input, (raw) => normalizeSalesAnalyticsResponse(raw, input))
  },
  getInventorySummary(input: { category?: string }) {
    const config = getAnalyticsBackendConfig()
    return requestBackend(config.endpoints.inventorySummary, input, (raw) => normalizeInventorySummaryResponse(raw, input))
  },
  compareProducts(input: { productSkus: string[]; days: number }) {
    const config = getAnalyticsBackendConfig()
    return requestBackend(config.endpoints.compareProducts, input, (raw) => normalizeCompareProductsResponse(raw, input))
  },
  getDashboardKPIs() {
    const config = getAnalyticsBackendConfig()
    return requestBackend(config.endpoints.dashboardKpis, {}, normalizeDashboardKPIsResponse)
  },
}
