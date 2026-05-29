"use client"

import { useMemo, useState } from "react"
import { Activity, CheckCircle2, ChevronDown, Database, GitBranch, Play, UploadCloud } from "lucide-react"

import { Header } from "@/components/dashboard/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { HBAAC_DATASET_INFO, getInventoryOptimizationSummary } from "@/lib/project-data"

type PilotStage = "idle" | "uploading" | "validating" | "retraining" | "evaluating" | "ready"

const stageMeta: Record<PilotStage, { label: string; progress: number; helper: string }> = {
  idle: { label: "Chờ dữ liệu", progress: 10, helper: "Chọn model và nạp file để bắt đầu." },
  uploading: { label: "Đang nạp dữ liệu", progress: 28, helper: "Nhận file dữ liệu mới." },
  validating: { label: "Đang kiểm định", progress: 48, helper: "Kiểm schema, SKU coverage và forecast-plan." },
  retraining: { label: "Đang retrain", progress: 72, helper: "Warm-start retrain cho model đã chọn." },
  evaluating: { label: "Đang so sánh", progress: 88, helper: "So champion/challenger trước khi trình duyệt." },
  ready: { label: "Sẵn sàng duyệt", progress: 100, helper: "Kết quả đã sẵn sàng cho bước promote." },
}

const stageOrder: PilotStage[] = ["uploading", "validating", "retraining", "evaluating", "ready"]

const models = [
  { id: "nbeats-v5", name: "N-BEATS v5", role: "Champion", wrmsse: "0.504" },
  { id: "lightgbm", name: "LightGBM global", role: "Challenger", wrmsse: "0.527" },
  { id: "external", name: "N-BEATS + dữ liệu ngoài", role: "Candidate", wrmsse: "TBD" },
]

function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(value))
}

function nextStage(stage: PilotStage): PilotStage {
  if (stage === "ready") return "ready"
  if (stage === "idle") return "uploading"
  const index = stageOrder.indexOf(stage)
  return stageOrder[Math.min(index + 1, stageOrder.length - 1)]
}

export default function MLOpsPage() {
  const inventorySummary = getInventoryOptimizationSummary(1)
  const mismatchRows = HBAAC_DATASET_INFO.inventoryPlanForecastMismatchRows ?? 0
  const inventoryPlanRows = HBAAC_DATASET_INFO.inventoryPlanRows ?? 0
  const [stage, setStage] = useState<PilotStage>("idle")
  const [modelId, setModelId] = useState(models[0].id)
  const [fileName, setFileName] = useState("")
  const activeModel = models.find((model) => model.id === modelId) ?? models[0]
  const currentStage = stageMeta[stage]
  const files = useMemo(
    () => [
      ...(fileName ? [{ name: fileName, detail: "File người dùng vừa chọn", tone: "text-emerald-700" }] : []),
      { name: "train.csv", detail: `${formatNumber(HBAAC_DATASET_INFO.trainRows)} dòng giao dịch`, tone: "text-blue-700" },
      { name: "submission_nbeats.csv", detail: `${formatNumber(HBAAC_DATASET_INFO.forecastRows)} dòng forecast`, tone: "text-violet-700" },
      { name: "inventory_plan.csv", detail: `${formatNumber(inventoryPlanRows)} dòng EOQ`, tone: "text-amber-700" },
    ],
    [fileName, inventoryPlanRows],
  )

  const gates = [
    { label: "Coverage SKU", value: `${formatNumber(HBAAC_DATASET_INFO.forecastSkuCount)} SKU`, status: "Đạt" },
    { label: "Forecast-plan mismatch", value: `${mismatchRows} dòng lệch`, status: mismatchRows === 0 ? "Đạt" : "Chặn" },
    { label: "Actual sales mới", value: "Chờ dữ liệu mới", status: "Chờ" },
    { label: "Model registry", value: "Chờ cấu hình", status: "Chờ" },
  ]

  return (
    <div className="flex flex-col">
      <Header title="MLOps" description="Theo dõi model, dữ liệu đầu vào và gate kiểm định trước khi promote." />

      <div className="flex-1 space-y-5 p-4 md:p-6">
        <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white shadow-sm">
          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-7">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-cyan-200 text-slate-950 hover:bg-cyan-200">MLOps</Badge>
                <Badge variant="outline" className="border-white/25 text-white">Model control</Badge>
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Bàn điều khiển retrain Pilot</h2>
                <p className="max-w-2xl text-sm text-slate-300 md:text-base">
                  Theo dõi champion/challenger, nạp dữ liệu mới, kiểm định gate và chuẩn bị promote model.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/10 p-4">
                  <div className="text-xs text-slate-400">Model đang chọn</div>
                  <div className="mt-1 text-lg font-semibold">{activeModel.name}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/10 p-4">
                  <div className="text-xs text-slate-400">WRMSSE</div>
                  <div className="mt-1 font-mono text-lg font-semibold">{activeModel.wrmsse}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/10 p-4">
                  <div className="text-xs text-slate-400">Plan validation</div>
                  <div className="mt-1 text-lg font-semibold">{mismatchRows} lệch</div>
                </div>
              </div>
            </div>

            <Card className="border-white/10 bg-white/10 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Activity className="h-5 w-5 text-cyan-200" />
                  Trạng thái lượt chạy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{currentStage.label}</div>
                    <p className="mt-1 text-xs text-slate-300">{currentStage.helper}</p>
                  </div>
                  <div className="font-mono text-2xl font-semibold text-cyan-100">{currentStage.progress}%</div>
                </div>
                <Progress value={currentStage.progress} className="mt-4 h-2" />
                <Button className="mt-4 w-full bg-cyan-200 text-slate-950 hover:bg-cyan-100" onClick={() => setStage(nextStage(stage))}>
                  <Play className="h-4 w-4" />
                  {stage === "ready" ? "Đã sẵn sàng" : "Chạy bước tiếp"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-violet-600" />
                Thiết lập lượt Pilot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Model</label>
                <div className="relative mt-2">
                  <select
                    value={modelId}
                    onChange={(event) => setModelId(event.target.value)}
                    className="h-10 w-full appearance-none rounded-md border bg-background px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring/50"
                  >
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>{model.name} · {model.role}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Nạp dữ liệu Pilot</label>
                <Input
                  type="file"
                  accept=".csv,.xlsx,.json"
                  className="mt-2"
                  onChange={(event) => {
                    setFileName(event.target.files?.[0]?.name ?? "")
                    setStage("uploading")
                  }}
                />
                <p className="mt-2 text-xs text-muted-foreground">Chọn file dữ liệu mới để cập nhật hàng đợi kiểm định.</p>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {models.map((model) => (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => setModelId(model.id)}
                    className={`rounded-lg border p-3 text-left text-sm transition ${model.id === modelId ? "border-primary bg-primary/10" : "hover:bg-muted/60"}`}
                  >
                    <div className="font-medium">{model.role}</div>
                    <div className="text-xs text-muted-foreground">{model.wrmsse}</div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  Hàng đợi dữ liệu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {files.map((file) => (
                  <div key={file.name} className="rounded-lg border p-3">
                    <div className="font-mono text-sm">{file.name}</div>
                    <div className={`mt-1 text-xs font-medium ${file.tone}`}>{file.detail}</div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Gate trước khi promote
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {gates.map((gate) => (
                  <div key={gate.label} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                    <div>
                      <div className="font-medium">{gate.label}</div>
                      <div className="text-xs text-muted-foreground">{gate.value}</div>
                    </div>
                    <Badge variant={gate.status === "Đạt" ? "default" : "secondary"}>{gate.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  )
}
