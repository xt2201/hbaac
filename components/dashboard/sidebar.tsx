"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  TrendingUp,
  AlertTriangle,
  Package,
  ListChecks,
  MessageSquare,
  Sparkles,
  GitBranch,
  ChevronLeft,
  ChevronRight,
  Box,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

const navItems = [
  {
    title: "Trung tâm điều hành",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Câu chuyện demo",
    href: "/dashboard/story",
    icon: Sparkles,
  },
  {
    title: "MLOps Pilot",
    href: "/dashboard/mlops",
    icon: GitBranch,
  },
  {
    title: "Quyết định",    href: "/dashboard/decision-queue",
    icon: ListChecks,
  },
  {
    title: "Dự báo nhu cầu",
    href: "/dashboard/forecast",
    icon: TrendingUp,
  },
  {
    title: "Kế hoạch mua hàng",
    href: "/dashboard/replenishment",
    icon: Package,
  },
  {
    title: "Giám sát rủi ro",
    href: "/dashboard/watchlist",
    icon: AlertTriangle,
  },
  {
    title: "Trợ lý phân tích",
    href: "/analytics-bot",
    icon: MessageSquare,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-border px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Box className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">Phụ tùng ô tô</span>
            <span className="text-xs text-muted-foreground">Hệ thống điều hành</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.title : undefined}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="ml-2">Thu gọn</span>}
        </Button>
      </div>
    </aside>
  )
}
