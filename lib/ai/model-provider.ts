import { createOpenAI } from "@ai-sdk/openai"

function getGatewayBaseURL() {
  const baseURL = process.env.AI_GATEWAY_BASE_URL?.trim().replace(/\/+$/, "")
  if (!baseURL) return undefined

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

export function getAnalyticsModel() {
  return modelProvider.chat(process.env.ANALYTICS_BOT_MODEL ?? "gpt-4o-mini")
}
