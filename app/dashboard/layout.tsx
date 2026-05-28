import { ChatWidget } from "@/components/analytics-bot/chat-widget"
import { Sidebar } from "@/components/dashboard/sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
      <ChatWidget />
    </div>
  )
}
