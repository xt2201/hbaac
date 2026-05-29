import { StoryDashboardClient } from "./story-dashboard-client"
import {
  HBAAC_CALENDAR_SUMMARY,
  HBAAC_DATASET_INFO,
  getDecisionQueueItems,
  getDemandDriversForProduct,
  getForecastChartData,
  getInventoryOptimizationSummary,
  getProfitCommandCenter,
  replenishmentSuggestions,
} from "@/lib/project-data"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCompactCurrency(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} triệu`
  return formatCurrency(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(value))
}

const priorityColors: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f59e0b",
  medium: "#3b82f6",
  low: "#64748b",
}

export type StoryDashboardData = ReturnType<typeof getStoryDashboardData>

function getStoryDashboardData() {
  const commandCenter = getProfitCommandCenter()
  const decisionItems = getDecisionQueueItems()
  const inventorySummary = getInventoryOptimizationSummary(1)
  const topAction = commandCenter.immediateActions[0]
  const topProductId = topAction?.productId ?? replenishmentSuggestions[0]?.productId
  const forecastData = topProductId ? getForecastChartData(topProductId, 21, 28) : []
  const demandDrivers = topProductId ? getDemandDriversForProduct(topProductId, 28) : null

  const totalDecisionImpact = decisionItems.reduce((sum, item) => sum + item.estimatedFinancialImpact, 0)
  const highPrioritySuggestions = replenishmentSuggestions.filter((item) => item.priority === "urgent" || item.priority === "high")
  const suggestedBudget = replenishmentSuggestions.reduce((sum, item) => sum + item.estimatedCost, 0)
  const inventoryPlanRows = HBAAC_DATASET_INFO.inventoryPlanRows ?? 0
  const inventoryPlanSkuCount = HBAAC_DATASET_INFO.inventoryPlanSkuCount ?? inventorySummary.skuCount
  const inventoryPlanMismatchRows = HBAAC_DATASET_INFO.inventoryPlanForecastMismatchRows ?? 0
  const inventoryPlanSource = HBAAC_DATASET_INFO.inventoryPlanSource ?? "inventory_plan.csv"

  return {
    topSku: topAction?.productSku ?? "Chưa có SKU",
    kpis: [
      {
        title: "Lợi nhuận có thể bảo vệ",
        value: formatCompactCurrency(commandCenter.kpis.expectedProfitFromRecommendations),
        helper: "Từ khuyến nghị đặt hàng",
        icon: "Sparkles",
        className: "border-emerald-200 bg-emerald-50/60",
        iconClass: "text-emerald-600",
      },
      {
        title: "Rủi ro lợi nhuận",
        value: formatCompactCurrency(commandCenter.kpis.lostProfitRisk),
        helper: "Ước tính từ forecast và margin",
        icon: "Target",
        className: "border-red-200 bg-red-50/60",
        iconClass: "text-red-600",
      },
      {
        title: "Ngân sách đề xuất",
        value: formatCompactCurrency(suggestedBudget),
        helper: "Mô phỏng ROI-first",
        icon: "WalletCards",
        className: "border-violet-200 bg-violet-50/60",
        iconClass: "text-violet-600",
      },
      {
        title: "Kiểm định inventory-plan",
        value: `${inventoryPlanMismatchRows} lệch`,
        helper: `${formatNumber(inventorySummary.skuCount)} SKU có chính sách`,
        icon: "CheckCircle2",
        className: "border-blue-200 bg-blue-50/60",
        iconClass: "text-blue-600",
      },
    ],
    riskChartData: commandCenter.immediateActions.slice(0, 7).map((item, index) => ({
      sku: item.productSku.replace("SKU-", ""),
      fullSku: item.productSku,
      impact: item.financialImpact,
      impactLabel: formatCompactCurrency(item.financialImpact),
      fill: index < 2 ? "#ef4444" : index < 5 ? "#f97316" : "#22c55e",
    })),
    budgetMixData: commandCenter.priorityBudgetMix
      .filter((item) => item.amount > 0)
      .map((item) => ({ ...item, amountLabel: formatCompactCurrency(item.amount), fill: priorityColors[item.priority] ?? "#64748b" })),
    categoryBudgetData: commandCenter.categoryBudget.slice(0, 5).map((item) => ({
      category: item.categoryLabel,
      amount: item.estimatedCost,
      amountLabel: formatCompactCurrency(item.estimatedCost),
      share: item.share,
    })),
    funnelSteps: [
      {
        label: "SKU có forecast",
        value: HBAAC_DATASET_INFO.forecastSkuCount,
        valueLabel: formatNumber(HBAAC_DATASET_INFO.forecastSkuCount),
        progress: 100,
        icon: "TrendingUp",
        tone: "text-blue-600",
      },
      {
        label: "Hàng chờ quyết định",
        value: decisionItems.length,
        valueLabel: formatNumber(decisionItems.length),
        progress: Math.min(100, (decisionItems.length / Math.max(1, HBAAC_DATASET_INFO.forecastSkuCount)) * 100),
        icon: "Target",
        tone: "text-red-600",
      },
      {
        label: "Khuyến nghị mua",
        value: replenishmentSuggestions.length,
        valueLabel: formatNumber(replenishmentSuggestions.length),
        progress: Math.min(100, (replenishmentSuggestions.length / Math.max(1, HBAAC_DATASET_INFO.forecastSkuCount)) * 100),
        icon: "WalletCards",
        tone: "text-emerald-600",
      },
      {
        label: "Ưu tiên cao",
        value: highPrioritySuggestions.length,
        valueLabel: formatNumber(highPrioritySuggestions.length),
        progress: Math.min(100, (highPrioritySuggestions.length / Math.max(1, replenishmentSuggestions.length)) * 100),
        icon: "ShieldCheck",
        tone: "text-violet-600",
      },
    ],
    totalDecisionImpact: formatCompactCurrency(totalDecisionImpact),
    forecastData,
    demandDrivers,
    trustCards: [
      { label: "Dòng giao dịch", value: formatNumber(HBAAC_DATASET_INFO.trainRows), helper: "sales history", icon: "Database" },
      { label: "SKU forecast", value: formatNumber(HBAAC_DATASET_INFO.forecastSkuCount), helper: "N-BEATS output", icon: "BarChart3" },
      { label: "Feature lịch", value: formatNumber(HBAAC_CALENDAR_SUMMARY.rowCount), helper: "weekend/holiday/proxy", icon: "Layers3" },
      { label: "Sai lệch plan", value: String(inventoryPlanMismatchRows), helper: "validation proxy", icon: "ShieldCheck" },
    ],
    mlopsConsole: {
      summary: {
        model: "N-BEATS v5",
        mode: "Artifact tĩnh",
        dataWindow: `${HBAAC_DATASET_INFO.minTrainDate} → ${HBAAC_DATASET_INFO.maxTrainDate}`,
        forecastWindow: `${HBAAC_DATASET_INFO.validationStartDate} → ${HBAAC_DATASET_INFO.evaluationEndDate}`,
        scope: "Replay offline từ dữ liệu cuộc thi",
      },
      runCards: [
        {
          title: "Build dữ liệu dashboard",
          status: "Đã chạy offline",
          statusTone: "bg-emerald-100 text-emerald-700 border-emerald-200",
          value: formatNumber(HBAAC_DATASET_INFO.trainRows),
          label: "dòng giao dịch",
          evidence: `${formatNumber(HBAAC_DATASET_INFO.trainSkuCount)} SKU · ${HBAAC_DATASET_INFO.minTrainDate} → ${HBAAC_DATASET_INFO.maxTrainDate}`,
          source: "train.csv → generated JSON",
        },
        {
          title: "Nạp forecast N-BEATS",
          status: "Artifact sẵn sàng",
          statusTone: "bg-blue-100 text-blue-700 border-blue-200",
          value: formatNumber(HBAAC_DATASET_INFO.forecastRows),
          label: "dòng forecast",
          evidence: `${formatNumber(HBAAC_DATASET_INFO.forecastSkuCount)} SKU · validation/evaluation horizon`,
          source: "submission_nbeats.csv",
        },
        {
          title: "Kiểm định kế hoạch EOQ",
          status: inventoryPlanMismatchRows === 0 ? "Gate đạt" : "Cần xử lý",
          statusTone:
            inventoryPlanMismatchRows === 0
              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
              : "bg-red-100 text-red-700 border-red-200",
          value: `${inventoryPlanMismatchRows} lệch`,
          label: "forecast-plan mismatch",
          evidence: `${formatNumber(inventoryPlanRows)} dòng plan · ${formatNumber(inventorySummary.skuCount)} SKU`,
          source: "inventory_plan.csv",
        },
        {
          title: "Đồng bộ story dashboard",
          status: "Đang phục vụ demo",
          statusTone: "bg-violet-100 text-violet-700 border-violet-200",
          value: "4 khối",
          label: "forecast → quyết định → tiền → MLOps",
          evidence: `${formatNumber(decisionItems.length)} quyết định · ${formatNumber(replenishmentSuggestions.length)} khuyến nghị`,
          source: "lib/project-data",
        },
      ],
      validationChecks: [
        {
          check: "Schema giao dịch",
          result: "Đạt",
          tone: "bg-emerald-100 text-emerald-700 border-emerald-200",
          evidence: `20 trường summary · ${formatNumber(HBAAC_DATASET_INFO.trainRows)} dòng`,
          nextAction: "Giữ contract dữ liệu khi có nguồn vận hành thật",
        },
        {
          check: "Coverage SKU forecast",
          result: "Đạt",
          tone: "bg-emerald-100 text-emerald-700 border-emerald-200",
          evidence: `${formatNumber(HBAAC_DATASET_INFO.forecastSkuCount)} / ${formatNumber(HBAAC_DATASET_INFO.trainSkuCount)} SKU`,
          nextAction: "Cảnh báo SKU mới khi có dữ liệu mới",
        },
        {
          check: "Forecast khớp inventory-plan",
          result: inventoryPlanMismatchRows === 0 ? "Đạt" : "Chặn",
          tone:
            inventoryPlanMismatchRows === 0
              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
              : "bg-red-100 text-red-700 border-red-200",
          evidence: `${inventoryPlanMismatchRows} dòng lệch demand forecast-plan`,
          nextAction: "Chặn publish nếu mismatch > 0",
        },
        {
          check: "Feature lịch",
          result: "Đạt proxy",
          tone: "bg-blue-100 text-blue-700 border-blue-200",
          evidence: `${formatNumber(HBAAC_CALENDAR_SUMMARY.rowCount)} ngày lịch · weekend/holiday/proxy`,
          nextAction: "Bổ sung sự kiện thật khi có dữ liệu vận hành",
        },
        {
          check: "Theo dõi sai lệch forecast",
          result: "Chưa mở",
          tone: "bg-amber-100 text-amber-700 border-amber-200",
          evidence: "Cần actual sales sau kỳ dự báo",
          nextAction: "Đối chiếu forecast với sales mới khi có dữ liệu vận hành",
        },
      ],
      artifactManifest: [
        {
          name: "Lịch sử bán hàng",
          source: "train.csv",
          size: `${formatNumber(HBAAC_DATASET_INFO.trainRows)} dòng`,
          consumer: "Data build, dashboard KPI, AnalyticsBot",
          limitation: "Không có tồn kho hiện tại/nhà cung cấp/lead time thật",
        },
        {
          name: "Forecast N-BEATS",
          source: "submission_nbeats.csv",
          size: `${formatNumber(HBAAC_DATASET_INFO.forecastRows)} dòng`,
          consumer: "Forecast chart, decision queue, EOQ plan",
          limitation: "Output tĩnh, không phải job dự báo live",
        },
        {
          name: "Kế hoạch EOQ",
          source: inventoryPlanSource,
          size: `${formatNumber(inventoryPlanRows)} dòng`,
          consumer: "Replenishment, watchlist, profit command center",
          limitation: "Không trừ tồn kho hiện tại vì chưa có dữ liệu tồn kho thật",
        },
        {
          name: "Dataset info",
          source: "lib/project-data/generated/dataset-info.json",
          size: `${formatNumber(inventoryPlanSkuCount)} SKU plan`,
          consumer: "Validation gate, story MLOps console",
          limitation: "Snapshot sinh từ artifact cục bộ",
        },
        {
          name: "Feature lịch",
          source: "daily-calendar-features.json",
          size: `${formatNumber(HBAAC_CALENDAR_SUMMARY.rowCount)} ngày`,
          consumer: "Demand drivers, model-health proxy",
          limitation: "Một số retail event là proxy, chưa phải lịch marketing nội bộ",
        },
      ],
      promotionGates: [
        { gate: "Forecast artifact tồn tại", state: "Đạt", tone: "text-emerald-700", evidence: `${formatNumber(HBAAC_DATASET_INFO.forecastSkuCount)} SKU có forecast` },
        { gate: "Inventory-plan consistency", state: "Đạt", tone: "text-emerald-700", evidence: `${inventoryPlanMismatchRows} mismatch` },
        { gate: "Business review", state: "Cần duyệt", tone: "text-amber-700", evidence: "Demo chỉ lưu workflow phía client" },
        { gate: "Production deployment", state: "Chưa mở", tone: "text-red-700", evidence: "Chưa có live job/checkpoint registry" },
      ],
      blockers: [
        "Chưa có luồng dữ liệu vận hành live để ghi nhận actual sales mới.",
        "Chưa có checkpoint registry hoặc metadata model thật trong repo.",
        "Chưa có job tự động retrain/promote/rollback.",
        "Theo dõi sai lệch forecast cần actual sales sau kỳ dự báo.",
      ],
      runLog: [
        { time: "Offline", event: "Đọc train.csv và chuẩn hóa summary giao dịch", status: `${formatNumber(HBAAC_DATASET_INFO.trainRows)} dòng` },
        { time: "Offline", event: "Nạp forecast N-BEATS cho validation/evaluation horizon", status: `${formatNumber(HBAAC_DATASET_INFO.forecastRows)} dòng` },
        { time: "Offline", event: "Kiểm tra inventory-plan khớp forecast demand", status: `${inventoryPlanMismatchRows} mismatch` },
        { time: "Khi có dữ liệu mới", event: "Bật drift monitor khi có actual sales mới", status: "Đang chờ dữ liệu vận hành" },
      ],
      modelRegistryRows: [
        { version: "Naive baseline", role: "Mốc so sánh", wrmsse: "Proxy", status: "Lưu trữ", action: "So sánh baseline" },
        { version: "LightGBM global", role: "Challenger", wrmsse: "Proxy", status: "Lưu trữ", action: "Xem lại khi cần" },
        { version: "N-BEATS v5", role: "Champion", wrmsse: "Demo", status: "Demo active", action: "Phục vụ forecast tĩnh" },
        { version: "N-BEATS + external data", role: "Candidate", wrmsse: "TBD", status: "Roadmap", action: "Thử nghiệm sau" },
      ],
    },
    topRiskySkuRows: commandCenter.immediateActions.slice(0, 5).map((item) => ({
      sku: item.productSku,
      action: item.recommendation,
      priority: item.priorityLabel,
      impact: formatCompactCurrency(item.financialImpact),
      protectedProfit: formatCompactCurrency(Math.max(0, item.financialImpact)),
    })),
  }
}

export default function StoryDashboardPage() {
  return <StoryDashboardClient data={getStoryDashboardData()} />
}
