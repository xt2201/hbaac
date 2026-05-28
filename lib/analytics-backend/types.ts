export type AnalyticsBackendErrorCode =
  | "missing_config"
  | "unauthorized"
  | "not_found"
  | "timeout"
  | "backend_error"
  | "network_error"
  | "invalid_response"

export type AnalyticsBackendError = {
  code: AnalyticsBackendErrorCode
  message: string
  status?: number
  details?: unknown
}

export type AnalyticsBackendResult<T> =
  | {
      ok: true
      data: T
      source: "backend"
    }
  | {
      ok: false
      error: AnalyticsBackendError
      source: "backend"
    }

export type BackendMeta = {
  source: "backend" | "local_dataset"
  warning?: string
}

export type ToolOutput<T> = T & {
  _meta?: BackendMeta
}
