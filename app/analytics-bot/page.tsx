import { Header } from "@/components/dashboard/header"
import { ChatInterface } from "@/components/analytics-bot/chat-interface"
import { Card } from "@/components/ui/card"

export default function AnalyticsBotPage() {
  return (
    <div className="flex h-full flex-col">
      <Header
        title="AnalyticsBot"
        description="Trợ lý AI phân tích dữ liệu thông minh"
      />

      <div className="flex-1 overflow-hidden p-6">
        <Card className="h-full overflow-hidden">
          <ChatInterface />
        </Card>
      </div>
    </div>
  )
}
