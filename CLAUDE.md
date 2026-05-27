# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Use pnpm for dependency management; the repository has `pnpm-lock.yaml`.

```bash
pnpm install
pnpm dev
pnpm build:data
pnpm build
pnpm start
pnpm lint
```

Notes:
- `pnpm dev` starts the Next.js dev server, normally at `http://localhost:3000`; `/` redirects to `/dashboard`.
- `pnpm build` runs `next build`. `next.config.mjs` currently has `typescript.ignoreBuildErrors: true`, so production builds do not fail on TypeScript errors.
- `pnpm lint` runs `eslint .`, but this project currently does not declare `eslint` in `package.json`; install/configure ESLint before relying on this script.
- There is no test script or test framework configured in `package.json`, so there is no single-test command yet.

## Environment

AnalyticsBot needs an OpenAI-compatible chat provider:
- Normal gateway setup: set `AI_GATEWAY_BASE_URL`, `AI_GATEWAY_AUTH_TOKEN` or `AI_GATEWAY_API_KEY`, and optionally `ANALYTICS_BOT_MODEL` in `.env.local`.
- Without `AI_GATEWAY_BASE_URL`, `app/api/chat/route.ts` falls back to `OPENAI_API_KEY`.
- `AI_GATEWAY_BASE_URL` may be a bare host; the route appends `/v1` unless the URL already ends in `/vN`.
- `app/api/chat/route.ts` and `app/api/forecast-recommendation/route.ts` both use `lib/ai/model-provider.ts` (`getAnalyticsModel()`), so Forecast AI recommendations and AnalyticsBot share the same provider/model configuration.

AnalyticsBot analytics data can come from a separate backend:
- Set `ANALYTICS_BACKEND_BASE_URL` and `ANALYTICS_BACKEND_AUTH_TOKEN` to enable backend calls.
- `ANALYTICS_BACKEND_USE_LOCAL_FALLBACK=true` allows local HBAAC dataset fallback when backend config/calls fail. The legacy `ANALYTICS_BACKEND_USE_MOCK_FALLBACK` env var is still accepted by the config for compatibility.
- Optional endpoint env vars override the default paths in `lib/analytics-backend/config.ts`.
- `.env.example` documents the minimum local demo setup.

## Project architecture

This is a Next.js App Router application for an AutoParts Intelligence Platform dashboard. It uses React 19, TypeScript, Tailwind CSS v4, shadcn-style UI primitives, Radix components, Lucide icons, Recharts, and AI SDK v6.

Top-level app structure:
- `app/layout.tsx` is the root layout, imports `app/globals.css`, sets Vietnamese metadata, and only renders Vercel Analytics in production.
- `app/page.tsx` redirects `/` to `/dashboard`.
- `app/dashboard/*` contains the main dashboard pages.
- `app/analytics-bot/*` contains the full-page AnalyticsBot experience.
- `app/api/chat/route.ts` is the streaming chat API used by both full-page and widget chat UIs.

Dashboard shell:
- `components/dashboard/sidebar.tsx` owns the main navigation, including the `/analytics-bot` link.
- `app/dashboard/layout.tsx` renders the dashboard `Sidebar`, scrollable main content, and the floating `ChatWidget` for dashboard pages.
- `app/analytics-bot/layout.tsx` uses the same sidebar shell but does not mount the floating widget, because `/analytics-bot` already renders the full chat page.

Current P0/P1/P2 dashboard implementation:
- `/dashboard` is now the Executive Profit Command Center, focused on profit risk and purchasing decisions rather than a generic dashboard overview.
- `app/dashboard/page.tsx` renders money-first KPIs, a "Cần hành động ngay" decision table, "Cơ hội tối ưu vốn", "Dòng tiền mua hàng", and compact source labels for dữ liệu cuộc thi, lịch ngoài, and danh mục bổ sung.
- `lib/project-data/index.ts` exposes `getProfitCommandCenter()` and related `Profit*` types. It computes lost profit risk, locked capital, estimated holding cost, expected profit saved by replenishment recommendations, next-7-day action SKU count, budget mix by priority, supplier budget, and category budget.
- `/dashboard/decision-queue` is the P2 Decision Queue. It renders prioritized actions derived from stock alerts and replenishment suggestions, with filters, bulk approval, and a detail drawer explaining recommendation logic and source assumptions.
- `lib/project-data/index.ts` exports `decisionQueueItems` and `getDecisionQueueItems()`. `DecisionQueueItem` rows combine action type, financial impact, urgency/deadline, confidence, recommendation, source labels, and assumptions from real competition data plus augmented catalog/operational metadata.
- `components/dashboard/decision-queue-table.tsx` owns the selectable/sortable TanStack table; `components/dashboard/decision-detail-drawer.tsx` owns the sheet-based explanation drawer.
- The main dashboard no longer renders the old "Truy cập nhanh", decorative category chart, or top-selling-products block. Keep future dashboard changes decision/table oriented.
- Placeholder actions were removed or downgraded where no real flow exists: forecast refresh/export buttons, watchlist create-order menu actions, and replenishment "Xem đơn hàng" flow.
- Standard Vietnamese demo terminology is: "Lợi nhuận có nguy cơ mất", "Vốn bị khóa", "Rủi ro thiếu hàng", "Tồn kho dư", "Khuyến nghị đặt hàng", "Dữ liệu cuộc thi", and "Danh mục bổ sung".
- Latest verification for this implementation: `pnpm.cmd exec tsc --noEmit`, `pnpm.cmd build:data`, and `pnpm.cmd build` passed.

Forecast-to-Action implementation:
- `/dashboard/forecast` now includes the "Khuyến nghị từ AI" card above the forecast chart, high-impact SKU mode, compact demand drivers, source badges, and the core action metrics: forecast quantity, average demand, current stock, expected stockout date, suggested order quantity, and profit impact.
- `app/api/forecast-recommendation/route.ts` generates the forecast recommendation with the shared AnalyticsBot model from `getAnalyticsModel()`.
- Forecast AI output is intentionally constrained to exactly five Vietnamese bullet points from a business, finance, and data analysis perspective. Do not render token usage in the UI.
- Forecast recommendations must keep data lineage explicit: N-BEATS forecast comes from competition data; inventory/catalog/lead time fields are enriched demo assumptions.

AnalyticsBot flow:
- `components/analytics-bot/chat-interface.tsx` is the reusable chat surface. It uses `useChat<AnalyticsBotMessage>` with `DefaultChatTransport({ api: "/api/chat" })`, renders messages/tool outputs, and supports page/widget presentation via props.
- `components/analytics-bot/chat-widget.tsx` is the floating bottom-right robot launcher for dashboard pages and embeds `ChatInterface variant="widget"`.
- `app/analytics-bot/page.tsx` renders the full-page chat inside a `Card` with `ChatInterface`.
- `app/api/chat/route.ts` validates UI messages against `analyticsTools`, calls `streamText`, uses `ANALYTICS_BOT_SYSTEM_PROMPT`, and returns `toUIMessageStreamResponse()`.
- `lib/ai/tools.ts` defines the seven analytics tools exposed to the model and maps backend failures to local HBAAC dataset fallback responses.
- `lib/ai/system-prompt.ts` defines the Vietnamese behavior and tool-use guidance for AnalyticsBot.

Analytics backend integration:
- `lib/analytics-backend/client.ts` POSTs JSON to the configured backend endpoints with bearer auth, timeout handling, and `cache: "no-store"`.
- `lib/analytics-backend/normalizers.ts` adapts backend responses into the shapes expected by `chat-interface.tsx` tool result renderers.
- `lib/analytics-backend/types.ts` contains backend result and normalized response types.
- When updating a tool result shape, keep `lib/ai/tools.ts`, backend normalizers/types, and the renderer branches in `components/analytics-bot/chat-interface.tsx` in sync.

Data model:
- `scripts/build-project-data.mjs` reads the root-level `train.csv` and `submission_nbeats.csv`, then writes compact generated JSON into `lib/project-data/generated/`.
- `lib/project-data/index.ts` exports SKU records, derived inventory planning levels, sales summaries, N-BEATS forecasts, stock alerts, replenishment suggestions, and helper query functions used by dashboard pages and AI tools. The sales, price, cost, SKU, and forecast metrics come from the competition files; product names/category/supplier/catalog metadata is deterministic inferred metadata because the raw files only include SKU-level transaction and forecast fields.
- Profit command metrics in `getProfitCommandCenter()` are business planning estimates derived from competition sales/forecast/price/cost plus the augmented operational catalog. Treat inventory, supplier, lead-time, target-stock, holding-cost, and order recommendation fields as enriched demo assumptions.
- `types/index.ts` contains the shared domain types for products, inventory, sales, forecasts, alerts, suggestions, KPIs, and older chat/tool result types.

Data truth and enrichment policy:
- Treat `train.csv`, `submission_nbeats.csv`, and the generated JSON under `lib/project-data/generated/` as the real competition data layer.
- Do not claim generated product names such as "Loc gio SKU-10121", categories, brands, suppliers, lead times, current stock, reorder points, or replenishment quantities are raw facts from the competition files unless a real catalog/master-data source is added.
- It is acceptable to add an augmented catalog for demo usability, but UI copy, AnalyticsBot responses, and slides must label it as "augmented catalog", "assumption", or "inferred metadata" rather than raw data.
- `external_calendar.csv`, if added, must contain factual calendar/event features with source notes where possible. Weekend, official public holidays, lunar holidays, and date-derived month/week features are factual. Payday windows, shopping festivals, campaign periods, and catalog mappings are assumptions unless backed by a cited source.
- Keep the demo wording precise: "Competition sales and forecast data are real; catalog and operational planning fields are enrichment used to productize the workflow."
- See `DATA_ENRICHMENT_PLAN.md` for the planned external data and catalog-enrichment workflow.

Styling and UI:
- `app/globals.css` is the active global stylesheet. It imports Tailwind v4 and `tw-animate-css`, defines shadcn CSS variables for light/dark themes, maps them via `@theme inline`, and contains the chatbot launcher animation.
- `components/ui/*` contains shadcn-style primitives. `components.json` configures style `new-york`, `rsc: true`, aliases such as `@/components`, `@/lib`, and CSS variables in `app/globals.css`.
- Prefer existing theme tokens (`bg-background`, `bg-card`, `text-foreground`, `border-border`, `bg-primary`, etc.) and the `cn` helper from `lib/utils.ts` for conditional Tailwind classes.

Path and compiler conventions:
- `tsconfig.json` enables strict TypeScript and maps `@/*` to the repository root.
- Next image optimization is disabled via `images.unoptimized: true` in `next.config.mjs`.
