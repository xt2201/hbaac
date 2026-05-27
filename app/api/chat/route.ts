import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  UIMessage,
  validateUIMessages,
  InferUITools,
  UIDataTypes,
} from "ai"
import { analyticsTools } from "@/lib/ai/tools"
import { ANALYTICS_BOT_SYSTEM_PROMPT } from "@/lib/ai/system-prompt"
import { getAnalyticsModel } from "@/lib/ai/model-provider"

export const maxDuration = 60

export type AnalyticsBotMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<typeof analyticsTools>
>

export async function POST(req: Request) {
  const body = await req.json()

  const messages = await validateUIMessages<AnalyticsBotMessage>({
    messages: body.messages,
    tools: analyticsTools,
  })

  const result = streamText({
    model: getAnalyticsModel(),
    system: ANALYTICS_BOT_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: analyticsTools,
    stopWhen: stepCountIs(10),
  })

  return result.toUIMessageStreamResponse()
}
