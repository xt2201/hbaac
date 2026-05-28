# Data Enrichment Implementation Plan

## Goal

Turn the current HBAAC forecasting demo into a more credible data product while keeping the distinction between real competition data, factual external data, and demo enrichment clear.

The product should use:
- Real competition data: SKU-level sales, price, cost, and N-BEATS forecasts from `train.csv` and `submission_nbeats.csv`.
- Factual external data: calendar and public-event features that can be verified from public sources.
- Augmented catalog data: optional SKU names/category/supplier fields used to make the live demo understandable, clearly labeled as enrichment.

## Data Layers

### 1. Competition Data

Source files:
- `train.csv`
- `submission_nbeats.csv`

Use as raw facts:
- `Date`
- `ItemCode` / SKU
- `Quantity`
- `UnitPrice`
- `SalesAmount`
- `Unit Cost`
- `Cost Amount`
- N-BEATS forecast values `F1` to `F28`

Do not infer exact real-world product names from SKU codes. A SKU like `SKU-10121` is a real item identifier, but the dataset does not reveal whether it is an auto part, grocery item, household item, or another product.

### 2. Factual External Calendar

Add a new file:

```text
data/external_calendar.csv
```

Recommended schema:

```csv
date,is_weekend,day_of_week,is_month_start,is_month_end,is_public_holiday,holiday_name,is_lunar_event,lunar_event_name,is_retail_event,retail_event_name,source_note
2025-09-02,0,2,0,0,1,National Day,0,,0,,Official 2025 Vietnam holiday calendar
2025-09-06,1,6,0,0,0,,0,,0,,date-derived weekend
2025-09-09,0,2,0,0,0,,0,,1,9.9 Shopping Festival,retail calendar assumption unless sourced
2025-10-06,0,1,0,0,0,,1,Mid-Autumn Festival,0,,lunar calendar event
2025-10-10,0,5,0,0,0,,0,,1,10.10 Shopping Festival,retail calendar assumption unless sourced
```

Feature classification:
- Factual/date-derived: `is_weekend`, `day_of_week`, `is_month_start`, `is_month_end`.
- Factual if sourced: `is_public_holiday`, `holiday_name`, `is_lunar_event`, `lunar_event_name`.
- Assumption unless sourced: `is_retail_event`, `retail_event_name`, payday windows, campaign windows.

Suggested source candidates:
- Vietnam public holiday schedule: Vietnam Briefing summary of MOLISA/VPCP 2025 holiday announcements, `https://www.vietnam-briefing.com/news/2025-vietnam-public-holidays-list.html`
- Vietnam statistics portal: National Statistics Office, `https://www.nso.gov.vn/so-lieu-thong-ke/`
- World Bank Indicators API docs, `https://datahelpdesk.worldbank.org/knowledgebase/articles/889392`
- World Bank official exchange-rate indicator `PA.NUS.FCRF`, `https://data.worldbank.org/indicator/PA.NUS.FCRF`
- Google Trends access for experiments only, for example `pytrends`, `https://pypi.org/pypi/pytrends/`

## Catalog Enrichment

Create an optional file:

```text
data/augmented_catalog.csv
```

Recommended schema:

```csv
sku,display_name,category,subcategory,brand,supplier,lead_time_days,is_assumption,source_note
SKU-10121,Item SKU-10121,Unmapped,Unmapped,,,,1,No real catalog source yet
```

Rules:
- If there is no real catalog source, prefer neutral names like `Item SKU-10121`.
- If demo names are assigned manually, set `is_assumption=1`.
- If a real master catalog is added later, set `is_assumption=0` and include `source_note`.
- AnalyticsBot must not describe assumed names/categories as facts.

## Implementation Steps

1. Add `data/external_calendar.csv` with all dates from `2020-11-17` through `2025-10-31`.
2. Update `scripts/build-project-data.mjs` to join calendar features by date while generating compact JSON.
3. Add generated calendar summary JSON under `lib/project-data/generated/`.
4. Extend `lib/project-data/index.ts` with helper functions such as `getCalendarFeaturesByDate`, `getDemandDriversForProduct`, and `getForecastDrivers`.
5. Add a "Demand Drivers" panel on the forecast page showing whether forecast spikes align with weekends, holidays, month boundaries, or retail events.
6. Update AnalyticsBot tools so product forecast responses include relevant calendar/event drivers for the requested forecast window.
7. Add UI footnotes or compact labels that distinguish `real competition data`, `factual external calendar`, and `augmented catalog`.
8. Keep `pnpm build:data`, `pnpm exec tsc --noEmit`, and `pnpm build` as the verification path.

## Demo Story

Recommended wording:

"The sales, price, cost, SKU, and forecast data come from the competition files. We enriched the product with factual calendar features and an optional catalog layer so business users can understand and act on the forecast. Catalog fields are marked as enrichment, not raw competition data."

Suggested live demo flow:
- Open dashboard overview with real SKU counts, revenue, and N-BEATS forecast-driven alerts.
- Select one high-value SKU on the forecast page.
- Show 28-day or 56-day forecast.
- Open "Demand Drivers" to explain whether the SKU is affected by weekend, holiday, lunar event, or campaign windows.
- Ask AnalyticsBot: "Why is SKU-xxxxx forecast increasing in this window?"
- Show replenishment recommendation as an operational planning output, not a raw inventory fact.

## Acceptance Criteria

- No UI or bot response claims assumed catalog names are raw competition data.
- `external_calendar.csv` has a complete date range covering train and forecast windows.
- Calendar features are either date-derived or have a source note.
- Build data generation is repeatable with `pnpm build:data`.
- `pnpm exec tsc --noEmit` passes.
- `pnpm build` passes.
