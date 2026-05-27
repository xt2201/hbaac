import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  UIMessage,
  validateUIMessages,
  InferUITools,
  UIDataTypes,
} from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { analyticsTools } from "@/lib/ai/tools"
import { ANALYTICS_BOT_SYSTEM_PROMPT } from "@/lib/ai/system-prompt"

function getGatewayBaseURL() {
  const baseURL = process.env.AI_GATEWAY_BASE_URL?.trim().replace(/\/+$/, "")
  if (!baseURL) return undefined

  // Claude Code-style gateway URLs are often configured as just the host.
  // The OpenAI-compatible provider needs the API root, e.g. /v1/chat/completions.
  return /\/v\d+$/i.test(baseURL) ? baseURL : `${baseURL}/v1`
}

function getGatewayApiKey() {
  return process.env.AI_GATEWAY_API_KEY || process.env.AI_GATEWAY_AUTH_TOKEN
}

const defaultModelProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const gatewayModelProvider = createOpenAI({
  baseURL: getGatewayBaseURL(),
  apiKey: getGatewayApiKey(),
})

const modelProvider = process.env.AI_GATEWAY_BASE_URL ? gatewayModelProvider : defaultModelProvider

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
    model: modelProvider.chat(process.env.ANALYTICS_BOT_MODEL ?? "gpt-4o-mini"),
    system: ANALYTICS_BOT_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: analyticsTools,
    stopWhen: stepCountIs(10),
  })

  return result.toUIMessageStreamResponse()
}
