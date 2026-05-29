"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Header } from "@/components/dashboard/header"
import { ChatInterface } from "@/components/analytics-bot/chat-interface"
import { Card } from "@/components/ui/card"

const WORKFLOW_PROMPTS = [
  "Nếu ngân sách mua hàng là 500 triệu, nên ưu tiên mã hàng nào?",
  "Giải thích quyết định có lợi nhuận rủi ro cao nhất trong 5 gạch đầu dòng.",
  "Độ tin cậy dự báo hiện tại có điểm nào cần chú ý?",
  "Tóm tắt lộ trình triển khai trong 60 giây.",
]

function AnalyticsBotPageContent() {
  const searchParams = useSearchParams()
  const initialPrompt = searchParams.get("prompt") ?? undefined

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <Header
        title="Trợ lý phân tích"
        description="Hỗ trợ phân tích quyết định, ngân sách mua hàng, độ tin cậy dự báo và lộ trình triển khai."
      />

      <div className="min-h-0 flex-1 overflow-hidden p-6">
        <Card className="h-full overflow-hidden p-0">
          <ChatInterface contextPrompts={WORKFLOW_PROMPTS} initialPrompt={initialPrompt} />
        </Card>
      </div>
    </div>
  )
}

export default function AnalyticsBotPage() {
  return (
    <Suspense fallback={null}>
      <AnalyticsBotPageContent />
    </Suspense>
  )
}
