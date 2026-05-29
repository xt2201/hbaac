"use client"

import { useState } from "react"
import { Bot, BotMessageSquare, Sparkles, X } from "lucide-react"
import { ChatInterface } from "@/components/analytics-bot/chat-interface"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="fixed right-4 bottom-4 z-50 sm:right-6 sm:bottom-6">
      {isOpen && (
        <Card className="animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 fixed inset-x-3 bottom-20 flex h-[75dvh] overflow-hidden p-0 shadow-2xl duration-200 sm:right-6 sm:bottom-24 sm:left-auto sm:h-[560px] sm:w-[380px]">
          <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b bg-card px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                  <Bot className="h-5 w-5" />
                  <Sparkles className="absolute -top-1 -right-1 h-3.5 w-3.5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Trợ lý phân tích</p>
                  <p className="text-xs text-muted-foreground">Trợ lý phân tích dữ liệu</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsOpen(false)}
                aria-label="Đóng trợ lý phân tích"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ChatInterface variant="widget" />
          </div>
        </Card>
      )}

      <Button
        type="button"
        size="icon-lg"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? "Đóng trợ lý phân tích" : "Mở trợ lý phân tích"}
        className={cn(
          "chatbot-float relative h-14 w-14 rounded-full shadow-xl transition-transform hover:scale-105 active:scale-95",
          isOpen && "bg-secondary text-secondary-foreground hover:bg-secondary/90"
        )}
      >
        <span className="absolute inset-0 rounded-full bg-primary/30 blur-md" />
        {isOpen ? <X className="relative h-6 w-6" /> : <BotMessageSquare className="relative h-7 w-7" />}
      </Button>
    </div>
  )
}
