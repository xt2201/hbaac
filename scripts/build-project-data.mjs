import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const trainPath = path.join(rootDir, "train.csv")
const forecastPath = path.join(rootDir, "submission_nbeats.csv")
const inventoryPlanPath = path.join(rootDir, "inventory_plan.csv")
const calendarPath = path.join(rootDir, "data", "external_calendar.csv")
const outputDir = path.join(rootDir, "lib", "project-data", "generated")

const TOP_SERIES_SKUS = 1200
const RECENT_HISTORY_DAYS = 90
const FORECAST_DAYS_PER_SPLIT = 28
const MS_PER_DAY = 24 * 60 * 60 * 1000

function parseCsvLine(line) {
  const fields = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]

    if (char === "\"") {
      if (inQuotes && line[i + 1] === "\"") {
        current += "\""
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === "," && !inQuotes) {
      fields.push(current)
      current = ""
      continue
    }

    current += char
  }

  fields.push(current)
  return fields
}

function parseNumber(value) {
  if (value == null) return 0
  const normalized = String(value).trim().replace(",", ".")
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function readLines(filePath) {
  return fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/)
}

function toUtcDate(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`)
}

function addDays(isoDate, days) {
  const date = toUtcDate(isoDate)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function daysBetween(startIso, endIso) {
  return Math.round((toUtcDate(endIso).getTime() - toUtcDate(startIso).getTime()) / MS_PER_DAY)
}

function eachDate(startIso, endIso) {
  const dates = []
  for (let offset = 0; offset <= daysBetween(startIso, endIso); offset += 1) {
    dates.push(addDays(startIso, offset))
  }
  return dates
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function headerIndexes(headerRow) {
  return new Map(headerRow.map((field, index) => [field, index]))
}

function requireColumn(indexes, columnName, filePath) {
  const index = indexes.get(columnName)
  if (index == null) {
    throw new Error(`Missing column ${columnName} in ${path.relative(rootDir, filePath)}`)
  }
  return index
}

function getSummary(summaryBySku, sku) {
  let summary = summaryBySku.get(sku)
  if (!summary) {
    summary = {
      sku,
      totalQuantity: 0,
      totalRevenue: 0,
      totalCost: 0,
      transactionCount: 0,
      positiveQuantity: 0,
      positiveRevenue: 0,
      positiveCost: 0,
      returnQuantity: 0,
      firstDate: "",
      lastDate: "",
      daily: new Map(),
    }
    summaryBySku.set(sku, summary)
  }
  return summary
}

function addDailyPoint(summary, date, quantity, revenue) {
  const existing = summary.daily.get(date) ?? { quantity: 0, revenue: 0 }
  existing.quantity += quantity
  existing.revenue += revenue
  summary.daily.set(date, existing)
}

function loadTrainData() {
  const lines = readLines(trainPath)
  const summaryBySku = new Map()
  let minDate = "9999-99-99"
  let maxDate = "0000-00-00"

  for (let index = 1; index < lines.length; index += 1) {
    const row = parseCsvLine(lines[index])
    const date = row[0]
    const sku = row[2]
    if (!date || !sku) continue

    const quantity = parseNumber(row[3])
    const unitPrice = parseNumber(row[4])
    const salesAmount = parseNumber(row[5]) || quantity * unitPrice
    const unitCost = parseNumber(row[6])
    const costAmount = parseNumber(row[7]) || quantity * unitCost

    if (date < minDate) minDate = date
    if (date > maxDate) maxDate = date

    const summary = getSummary(summaryBySku, sku)
    summary.totalQuantity += quantity
    summary.totalRevenue += salesAmount
    summary.totalCost += costAmount
    summary.transactionCount += 1
    if (!summary.firstDate || date < summary.firstDate) summary.firstDate = date
    if (!summary.lastDate || date > summary.lastDate) summary.lastDate = date

    if (quantity > 0) {
      summary.positiveQuantity += quantity
      summary.positiveRevenue += Math.max(0, salesAmount)
      summary.positiveCost += Math.max(0, costAmount)
    } else if (quantity < 0) {
      summary.returnQuantity += quantity
    }

    addDailyPoint(summary, date, quantity, salesAmount)
  }

  return {
    rowCount: lines.length - 1,
    skuCount: summaryBySku.size,
    minDate,
    maxDate,
    summaryBySku,
  }
}

function loadForecastData() {
  const lines = readLines(forecastPath)
  const forecastBySku = new Map()

  for (let index = 1; index < lines.length; index += 1) {
    const row = parseCsvLine(lines[index])
    const id = row[0]
    if (!id) continue

    const match = id.match(/^(.*)_(validation|evaluation)$/)
    if (!match) continue

    const sku = match[1]
    const split = match[2]
    const values = row
      .slice(1, FORECAST_DAYS_PER_SPLIT + 1)
      .map((value) => round(Math.max(0, parseNumber(value)), 4))

    let forecast = forecastBySku.get(sku)
    if (!forecast) {
      forecast = {
        validation: Array(FORECAST_DAYS_PER_SPLIT).fill(0),
        evaluation: Array(FORECAST_DAYS_PER_SPLIT).fill(0),
      }
      forecastBySku.set(sku, forecast)
    }

    forecast[split] = values
  }

  return {
    rowCount: lines.length - 1,
    skuCount: forecastBySku.size,
    forecastBySku,
  }
}


function loadInventoryPlanData(forecastData) {
  if (!fs.existsSync(inventoryPlanPath)) {
    console.warn(`Inventory plan: missing ${path.relative(rootDir, inventoryPlanPath)}; generated empty policy dataset.`)
    return {
      metadata: {
        generatedAt: new Date().toISOString(),
        source: "inventory_plan.csv",
        forecastSource: "submission_nbeats.csv",
        horizonDays: FORECAST_DAYS_PER_SPLIT,
        months: [1, 2],
        rows: 0,
        skuCount: 0,
        duplicateKeys: 0,
        forecastMismatchRows: 0,
        fields: [],
        summaries: [],
      },
      rows: [],
    }
  }

  const lines = readLines(inventoryPlanPath)
  const indexes = headerIndexes(parseCsvLine(lines[0]))
  const columns = {
    sku: requireColumn(indexes, "sku", inventoryPlanPath),
    month: requireColumn(indexes, "month", inventoryPlanPath),
    unitCost: requireColumn(indexes, "unit_cost", inventoryPlanPath),
    stdDaily: requireColumn(indexes, "std_daily", inventoryPlanPath),
    demand28: requireColumn(indexes, "D_month", inventoryPlanPath),
    meanDaily: requireColumn(indexes, "mean_daily", inventoryPlanPath),
    annualizedDemand: requireColumn(indexes, "D_annual_equiv", inventoryPlanPath),
    economicOrderQty: requireColumn(indexes, "EOQ", inventoryPlanPath),
    recommendedOrderTarget: requireColumn(indexes, "Recommended_Order", inventoryPlanPath),
    safetyStock: requireColumn(indexes, "Safety_Stock", inventoryPlanPath),
    reorderPoint: requireColumn(indexes, "Reorder_Point", inventoryPlanPath),
    cycleTimeDays: requireColumn(indexes, "Cycle_Time_days", inventoryPlanPath),
    annualOrderCost: requireColumn(indexes, "Annual_Order_Cost", inventoryPlanPath),
    annualHoldingCost: requireColumn(indexes, "Annual_Holding_Cost", inventoryPlanPath),
    annualPurchaseCost: requireColumn(indexes, "Annual_Purchase_Cost", inventoryPlanPath),
    totalAnnualCost: requireColumn(indexes, "Total_Annual_Cost", inventoryPlanPath),
  }

  const rows = []
  const seenKeys = new Set()
  const skuSet = new Set()
  const skuMonths = new Map()
  const summaryByMonth = new Map()
  const duplicateKeys = []
  const invalidRows = []
  const mismatchRows = []
  const requiredNumericColumns = [
    ["unitCost", columns.unitCost, "unit_cost"],
    ["stdDaily", columns.stdDaily, "std_daily"],
    ["demand28", columns.demand28, "D_month"],
    ["meanDaily", columns.meanDaily, "mean_daily"],
    ["annualizedDemand", columns.annualizedDemand, "D_annual_equiv"],
    ["economicOrderQty", columns.economicOrderQty, "EOQ"],
    ["recommendedOrderTarget", columns.recommendedOrderTarget, "Recommended_Order"],
    ["safetyStock", columns.safetyStock, "Safety_Stock"],
    ["reorderPoint", columns.reorderPoint, "Reorder_Point"],
    ["annualOrderCost", columns.annualOrderCost, "Annual_Order_Cost"],
    ["annualHoldingCost", columns.annualHoldingCost, "Annual_Holding_Cost"],
    ["annualPurchaseCost", columns.annualPurchaseCost, "Annual_Purchase_Cost"],
    ["totalAnnualCost", columns.totalAnnualCost, "Total_Annual_Cost"],
  ]

  for (let index = 1; index < lines.length; index += 1) {
    const row = parseCsvLine(lines[index])
    const sku = (row[columns.sku] ?? "").trim()
    if (!sku) continue

    const month = parseNumber(row[columns.month])
    if (month !== 1 && month !== 2) {
      invalidRows.push(`${sku}: invalid month ${row[columns.month]}`)
      continue
    }

    const key = `${sku}:${month}`
    if (seenKeys.has(key)) duplicateKeys.push(key)
    seenKeys.add(key)
    skuSet.add(sku)
    const monthsForSku = skuMonths.get(sku) ?? new Set()
    monthsForSku.add(month)
    skuMonths.set(sku, monthsForSku)

    const invalidCountBeforeRow = invalidRows.length
    const values = {}
    for (const [name, columnIndex, label] of requiredNumericColumns) {
      const rawValue = row[columnIndex]
      const normalized = String(rawValue ?? "").trim().replace(",", ".")
      const parsed = Number(normalized)
      if (!normalized || !Number.isFinite(parsed)) {
        invalidRows.push(`${sku}: invalid ${label} ${rawValue ?? ""}`.trim())
      }
      values[name] = Number.isFinite(parsed) ? parsed : 0
    }

    const cycleTimeRaw = String(row[columns.cycleTimeDays] ?? "").trim()
    const cycleTime = cycleTimeRaw ? Number(cycleTimeRaw.replace(",", ".")) : null
    if (cycleTimeRaw && !Number.isFinite(cycleTime)) {
      invalidRows.push(`${sku}: invalid Cycle_Time_days ${row[columns.cycleTimeDays]}`)
    }
    if (invalidRows.length > invalidCountBeforeRow) continue

    const entry = [
      sku,
      month,
      round(values.unitCost, 2),
      round(values.stdDaily, 4),
      round(values.demand28, 2),
      round(values.meanDaily, 4),
      round(values.annualizedDemand, 2),
      round(values.economicOrderQty, 2),
      round(values.recommendedOrderTarget, 2),
      round(values.safetyStock, 2),
      round(values.reorderPoint, 2),
      cycleTime != null && cycleTime > 0 && cycleTime <= 365 ? round(cycleTime, 2) : null,
      round(values.annualOrderCost, 0),
      round(values.annualHoldingCost, 0),
      round(values.annualPurchaseCost, 0),
      round(values.totalAnnualCost, 0),
    ]

    if ([2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15].some((tupleIndex) => entry[tupleIndex] < 0 || Number.isNaN(entry[tupleIndex]))) {
      invalidRows.push(`${sku}: negative or NaN numeric field`)
      continue
    }

    const forecast = forecastData.forecastBySku.get(sku)
    const forecastSum = month === 1 ? sumForecast(forecast, "validation") : sumForecast(forecast, "evaluation")
    if (forecast && Math.abs(entry[4] - forecastSum) > 0.1) {
      mismatchRows.push({ sku, month, demand28: entry[4], forecastSum: round(forecastSum, 2) })
    }

    rows.push(entry)
    const summary = summaryByMonth.get(month) ?? {
      month,
      skuCount: 0,
      totalDemand28: 0,
      totalRecommendedOrderTarget: 0,
      totalSafetyStock: 0,
      totalAnnualOrderCost: 0,
      totalAnnualHoldingCost: 0,
      totalAnnualPurchaseCost: 0,
      totalAnnualCost: 0,
      cycleTimeTotal: 0,
      cycleTimeCount: 0,
    }
    summary.skuCount += 1
    summary.totalDemand28 += entry[4]
    summary.totalRecommendedOrderTarget += entry[8]
    summary.totalSafetyStock += entry[9]
    summary.totalAnnualOrderCost += entry[12]
    summary.totalAnnualHoldingCost += entry[13]
    summary.totalAnnualPurchaseCost += entry[14]
    summary.totalAnnualCost += entry[15]
    if (entry[11] != null) {
      summary.cycleTimeTotal += entry[11]
      summary.cycleTimeCount += 1
    }
    summaryByMonth.set(month, summary)
  }

  if (duplicateKeys.length > 0) throw new Error(`Inventory plan duplicate keys: ${duplicateKeys.slice(0, 10).join(", ")}`)
  if (invalidRows.length > 0) throw new Error(`Inventory plan invalid rows: ${invalidRows.slice(0, 10).join("; ")}`)
  const missingMonthSkus = [...skuMonths.entries()]
    .filter(([, months]) => !months.has(1) || !months.has(2))
    .map(([sku, months]) => `${sku}: months ${[...months].sort().join(",") || "none"}`)
  if (missingMonthSkus.length > 0) {
    throw new Error(`Inventory plan SKUs missing month coverage: ${missingMonthSkus.slice(0, 10).join("; ")}`)
  }
  const missingForecastKeys = []
  for (const sku of forecastData.forecastBySku.keys()) {
    if (!seenKeys.has(`${sku}:1`)) missingForecastKeys.push(`${sku}:1`)
    if (!seenKeys.has(`${sku}:2`)) missingForecastKeys.push(`${sku}:2`)
  }
  if (missingForecastKeys.length > 0) {
    throw new Error(`Inventory plan missing forecast SKU/month keys: ${missingForecastKeys.slice(0, 10).join(", ")}`)
  }
  if (mismatchRows.length > 0) {
    throw new Error(`Inventory plan forecast mismatch rows: ${mismatchRows.length}. First mismatches: ${JSON.stringify(mismatchRows.slice(0, 10))}`)
  }

  const summaries = [...summaryByMonth.values()].map((summary) => ({
    month: summary.month,
    skuCount: summary.skuCount,
    totalDemand28: round(summary.totalDemand28, 2),
    totalRecommendedOrderTarget: round(summary.totalRecommendedOrderTarget, 2),
    totalSafetyStock: round(summary.totalSafetyStock, 2),
    totalAnnualOrderCost: round(summary.totalAnnualOrderCost, 0),
    totalAnnualHoldingCost: round(summary.totalAnnualHoldingCost, 0),
    totalAnnualPurchaseCost: round(summary.totalAnnualPurchaseCost, 0),
    totalAnnualCost: round(summary.totalAnnualCost, 0),
    averageCycleTimeDays: summary.cycleTimeCount > 0 ? round(summary.cycleTimeTotal / summary.cycleTimeCount, 2) : null,
  })).sort((left, right) => left.month - right.month)

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      source: "inventory_plan.csv",
      forecastSource: "submission_nbeats.csv",
      horizonDays: FORECAST_DAYS_PER_SPLIT,
      months: [1, 2],
      rows: rows.length,
      skuCount: skuSet.size,
      duplicateKeys: duplicateKeys.length,
      forecastMismatchRows: mismatchRows.length,
      fields: ["sku", "month", "unitCost", "stdDaily", "demand28", "meanDaily", "annualizedDemand", "economicOrderQty", "recommendedOrderTarget", "safetyStock", "reorderPoint", "cycleTimeDays", "annualOrderCost", "annualHoldingCost", "annualPurchaseCost", "totalAnnualCost"],
      summaries,
    },
    rows: rows.sort((left, right) => left[0].localeCompare(right[0]) || left[1] - right[1]),
  }
}

function loadCalendarData(expectedStartDate, expectedEndDate) {
  const lines = readLines(calendarPath)
  const indexes = headerIndexes(parseCsvLine(lines[0]))
  const columns = {
    date: requireColumn(indexes, "date", calendarPath),
    isWeekend: requireColumn(indexes, "is_weekend", calendarPath),
    dayOfWeek: requireColumn(indexes, "day_of_week", calendarPath),
    isMonthStart: requireColumn(indexes, "is_month_start", calendarPath),
    isMonthEnd: requireColumn(indexes, "is_month_end", calendarPath),
    isPublicHoliday: requireColumn(indexes, "is_public_holiday", calendarPath),
    holidayName: requireColumn(indexes, "holiday_name", calendarPath),
    isLunarEvent: requireColumn(indexes, "is_lunar_event", calendarPath),
    lunarEventName: requireColumn(indexes, "lunar_event_name", calendarPath),
    isRetailEvent: requireColumn(indexes, "is_retail_event", calendarPath),
    retailEventName: requireColumn(indexes, "retail_event_name", calendarPath),
    sourceNote: requireColumn(indexes, "source_note", calendarPath),
  }

  const calendarByDate = new Map()
  let minDate = "9999-99-99"
  let maxDate = "0000-00-00"

  for (let index = 1; index < lines.length; index += 1) {
    const row = parseCsvLine(lines[index])
    const date = row[columns.date]
    if (!date) continue

    const entry = {
      date,
      isWeekend: parseNumber(row[columns.isWeekend]) === 1,
      dayOfWeek: parseNumber(row[columns.dayOfWeek]),
      isMonthStart: parseNumber(row[columns.isMonthStart]) === 1,
      isMonthEnd: parseNumber(row[columns.isMonthEnd]) === 1,
      isPublicHoliday: parseNumber(row[columns.isPublicHoliday]) === 1,
      holidayName: row[columns.holidayName] ?? "",
      isLunarEvent: parseNumber(row[columns.isLunarEvent]) === 1,
      lunarEventName: row[columns.lunarEventName] ?? "",
      isRetailEvent: parseNumber(row[columns.isRetailEvent]) === 1,
      retailEventName: row[columns.retailEventName] ?? "",
      sourceNote: row[columns.sourceNote] ?? "",
    }

    calendarByDate.set(date, entry)
    if (date < minDate) minDate = date
    if (date > maxDate) maxDate = date
  }

  const missingDates = eachDate(expectedStartDate, expectedEndDate).filter((date) => !calendarByDate.has(date))
  if (missingDates.length > 0) {
    throw new Error(
      `${path.relative(rootDir, calendarPath)} is missing ${missingDates.length} dates from ${expectedStartDate} to ${expectedEndDate}. First missing date: ${missingDates[0]}`
    )
  }

  return {
    rowCount: calendarByDate.size,
    minDate,
    maxDate,
    calendarByDate,
  }
}

function sumForecast(forecast, split) {
  return forecast?.[split]?.reduce((sum, value) => sum + value, 0) ?? 0
}

function sumDailyBetween(summary, startDate, endDate) {
  let quantity = 0
  let revenue = 0

  for (const [date, point] of summary.daily.entries()) {
    if (date >= startDate && date <= endDate) {
      quantity += point.quantity
      revenue += point.revenue
    }
  }

  return { quantity, revenue }
}

function buildProductSummaries(trainData, forecastData) {
  const maxDate = trainData.maxDate
  const recent7Start = addDays(maxDate, -6)
  const recent28Start = addDays(maxDate, -27)
  const recent56Start = addDays(maxDate, -55)
  const recent90Start = addDays(maxDate, -(RECENT_HISTORY_DAYS - 1))
  const prev28Start = addDays(maxDate, -55)
  const prev28End = addDays(maxDate, -28)

  return Array.from(trainData.summaryBySku.values())
    .sort((left, right) => left.sku.localeCompare(right.sku))
    .map((summary) => {
      const forecast = forecastData.forecastBySku.get(summary.sku)
      const recent7 = sumDailyBetween(summary, recent7Start, maxDate)
      const recent28 = sumDailyBetween(summary, recent28Start, maxDate)
      const recent56 = sumDailyBetween(summary, recent56Start, maxDate)
      const recent90 = sumDailyBetween(summary, recent90Start, maxDate)
      const prev28 = sumDailyBetween(summary, prev28Start, prev28End)
      const validationTotal = sumForecast(forecast, "validation")
      const evaluationTotal = sumForecast(forecast, "evaluation")

      return [
        summary.sku,
        round(summary.totalQuantity, 2),
        round(summary.totalRevenue, 0),
        round(summary.totalCost, 0),
        summary.transactionCount,
        round(summary.positiveQuantity > 0 ? summary.positiveRevenue / summary.positiveQuantity : 0, 2),
        round(summary.positiveQuantity > 0 ? summary.positiveCost / summary.positiveQuantity : 0, 2),
        round(recent7.quantity, 2),
        round(recent28.quantity, 2),
        round(recent56.quantity, 2),
        round(recent90.quantity, 2),
        round(recent28.revenue, 0),
        round(prev28.revenue, 0),
        summary.firstDate,
        summary.lastDate,
        round(validationTotal, 4),
        round(evaluationTotal, 4),
        round(validationTotal + evaluationTotal, 4),
        summary.daily.size,
        round(summary.returnQuantity, 2),
      ]
    })
}

function selectSeriesSkus(productSummaries) {
  return new Set(
    [...productSummaries]
      .sort((left, right) => {
        const leftScore = Math.max(0, left[11]) + Math.max(0, left[17]) * Math.max(1, left[5])
        const rightScore = Math.max(0, right[11]) + Math.max(0, right[17]) * Math.max(1, right[5])
        return rightScore - leftScore
      })
      .slice(0, TOP_SERIES_SKUS)
      .map((summary) => summary[0])
  )
}

function buildDailySalesSeries(trainData, seriesSkus) {
  const startDate = addDays(trainData.maxDate, -(RECENT_HISTORY_DAYS - 1))
  const output = []

  for (const sku of seriesSkus) {
    const summary = trainData.summaryBySku.get(sku)
    if (!summary) continue

    const points = []
    for (const [date, point] of [...summary.daily.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      if (date >= startDate && date <= trainData.maxDate) {
        points.push([date, round(point.quantity, 2), round(point.revenue, 0)])
      }
    }

    output.push([sku, points])
  }

  return output.sort(([left], [right]) => left.localeCompare(right))
}

function buildDailyForecastSeries(forecastData, seriesSkus) {
  const output = []

  for (const sku of seriesSkus) {
    const forecast = forecastData.forecastBySku.get(sku)
    if (!forecast) continue
    output.push([sku, forecast.validation, forecast.evaluation])
  }

  return output.sort(([left], [right]) => left.localeCompare(right))
}

function buildDailyCalendarFeatures(calendarData, startDate, endDate) {
  return eachDate(startDate, endDate).map((date) => {
    const entry = calendarData.calendarByDate.get(date)
    if (!entry) {
      throw new Error(`Missing calendar feature for ${date}`)
    }

    return [
      entry.date,
      entry.isWeekend ? 1 : 0,
      entry.dayOfWeek,
      entry.isMonthStart ? 1 : 0,
      entry.isMonthEnd ? 1 : 0,
      entry.isPublicHoliday ? 1 : 0,
      entry.holidayName,
      entry.isLunarEvent ? 1 : 0,
      entry.lunarEventName,
      entry.isRetailEvent ? 1 : 0,
      entry.retailEventName,
      entry.sourceNote,
    ]
  })
}

function buildCalendarSummary(calendarData, startDate, endDate) {
  const features = buildDailyCalendarFeatures(calendarData, startDate, endDate)

  return {
    rowCount: features.length,
    minDate: startDate,
    maxDate: endDate,
    weekendDays: features.filter((entry) => entry[1] === 1).length,
    monthBoundaryDays: features.filter((entry) => entry[3] === 1 || entry[4] === 1).length,
    publicHolidayDays: features.filter((entry) => entry[5] === 1).length,
    lunarEventDays: features.filter((entry) => entry[7] === 1).length,
    retailEventDays: features.filter((entry) => entry[9] === 1).length,
    sourceNotes: [
      "Đặc trưng lịch suy ra từ ngày",
      "Ghi chú nguồn ngày lễ Việt Nam: lịch chính thức/Vietnam Briefing",
      "Ghi chú nguồn sự kiện âm lịch",
      "Giả định lịch bán lẻ",
    ],
    dailyCalendarFeatureFields: [
      "date",
      "isWeekend",
      "dayOfWeek",
      "isMonthStart",
      "isMonthEnd",
      "isPublicHoliday",
      "holidayName",
      "isLunarEvent",
      "lunarEventName",
      "isRetailEvent",
      "retailEventName",
      "sourceNote",
    ],
  }
}

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]

function getWeekday(isoDate) {
  return toUtcDate(isoDate).getUTCDay()
}

function isHolidayWindow(calendarData, date) {
  for (let offset = -3; offset <= 3; offset += 1) {
    const entry = calendarData.calendarByDate.get(addDays(date, offset))
    if (entry?.isPublicHoliday || entry?.isLunarEvent) return true
  }
  return false
}

function buildDashboardInsights(trainData, forecastData, inventoryPlanData, calendarData) {
  const weekdayAccumulator = Array.from({ length: 7 }, (_, weekday) => ({
    weekday,
    label: WEEKDAY_LABELS[weekday],
    totalQuantity: 0,
    totalRevenue: 0,
    activeDays: new Set(),
  }))
  const saturdaySundayByMonth = new Map()
  const returnByMonth = new Map()
  const dailyTotals = new Map()
  const revenueBySku = []

  for (const summary of trainData.summaryBySku.values()) {
    revenueBySku.push({ sku: summary.sku, revenue: Math.max(0, summary.positiveRevenue) })

    for (const [date, point] of summary.daily.entries()) {
      const weekday = getWeekday(date)
      const quantity = point.quantity
      const revenue = point.revenue
      const month = date.slice(0, 7)

      weekdayAccumulator[weekday].totalQuantity += quantity
      weekdayAccumulator[weekday].totalRevenue += revenue
      weekdayAccumulator[weekday].activeDays.add(date)

      if (weekday === 0 || weekday === 6) {
        const trend = saturdaySundayByMonth.get(month) ?? {
          month,
          saturdayQuantity: 0,
          sundayQuantity: 0,
          saturdayRevenue: 0,
          sundayRevenue: 0,
        }
        if (weekday === 6) {
          trend.saturdayQuantity += quantity
          trend.saturdayRevenue += revenue
        } else {
          trend.sundayQuantity += quantity
          trend.sundayRevenue += revenue
        }
        saturdaySundayByMonth.set(month, trend)
      }

      const daily = dailyTotals.get(date) ?? { quantity: 0, revenue: 0 }
      daily.quantity += quantity
      daily.revenue += revenue
      dailyTotals.set(date, daily)

      const returns = returnByMonth.get(month) ?? {
        month,
        grossQuantity: 0,
        returnQuantity: 0,
        grossRevenue: 0,
        returnedRevenueProxy: 0,
      }
      if (quantity > 0) {
        returns.grossQuantity += quantity
        returns.grossRevenue += Math.max(0, revenue)
      } else if (quantity < 0) {
        const absoluteReturn = Math.abs(quantity)
        returns.returnQuantity += absoluteReturn
        returns.returnedRevenueProxy += Math.abs(revenue)
      }
      returnByMonth.set(month, returns)
    }
  }

  const forecastStartDate = addDays(trainData.maxDate, 1)
  const forecastCalendarByDate = new Map()
  for (const forecast of forecastData.forecastBySku.values()) {
    const values = [...forecast.validation, ...forecast.evaluation]
    values.forEach((quantity, index) => {
      const date = addDays(forecastStartDate, index)
      const existing = forecastCalendarByDate.get(date) ?? 0
      forecastCalendarByDate.set(date, existing + quantity)
    })
  }

  const weekdaySummary = weekdayAccumulator.map((entry) => ({
    weekday: entry.weekday,
    label: entry.label,
    totalQuantity: round(entry.totalQuantity, 2),
    totalRevenue: round(entry.totalRevenue, 0),
    activeDays: entry.activeDays.size,
    averageDailyQuantity: entry.activeDays.size > 0 ? round(entry.totalQuantity / entry.activeDays.size, 2) : 0,
    averageDailyRevenue: entry.activeDays.size > 0 ? round(entry.totalRevenue / entry.activeDays.size, 0) : 0,
    forecast28Quantity: round([...forecastCalendarByDate.entries()].reduce((sum, [date, quantity]) => getWeekday(date) === entry.weekday && date < addDays(forecastStartDate, FORECAST_DAYS_PER_SPLIT) ? sum + quantity : sum, 0), 2),
  }))

  const saturdaySundayTrend = [...saturdaySundayByMonth.values()]
    .sort((left, right) => left.month.localeCompare(right.month))
    .map((entry) => ({
      month: entry.month,
      saturdayQuantity: round(entry.saturdayQuantity, 2),
      sundayQuantity: round(entry.sundayQuantity, 2),
      saturdayRevenue: round(entry.saturdayRevenue, 0),
      sundayRevenue: round(entry.sundayRevenue, 0),
    }))

  const returnMonthly = [...returnByMonth.values()]
    .sort((left, right) => left.month.localeCompare(right.month))
    .map((entry) => ({
      month: entry.month,
      grossQuantity: round(entry.grossQuantity, 2),
      returnQuantity: round(entry.returnQuantity, 2),
      returnRate: entry.grossQuantity > 0 ? round(entry.returnQuantity / entry.grossQuantity, 4) : 0,
      grossRevenue: round(entry.grossRevenue, 0),
      returnedRevenueProxy: round(entry.returnedRevenueProxy, 0),
    }))

  const rankedSkuRevenue = revenueBySku.sort((left, right) => right.revenue - left.revenue)
  const totalRevenue = rankedSkuRevenue.reduce((sum, entry) => sum + entry.revenue, 0)
  const revenueShare = (count) => totalRevenue > 0 ? rankedSkuRevenue.slice(0, count).reduce((sum, entry) => sum + entry.revenue, 0) / totalRevenue : 0
  const bucketDefinitions = [
    ["Top 1", 1],
    ["Top 2-50", 50],
    ["Top 51-200", 200],
    ["Long-tail", rankedSkuRevenue.length],
  ]
  let previousCutoff = 0
  let cumulativeRevenue = 0
  const rankedBuckets = bucketDefinitions.map(([bucket, cutoff]) => {
    const rows = rankedSkuRevenue.slice(previousCutoff, cutoff)
    const revenue = rows.reduce((sum, entry) => sum + entry.revenue, 0)
    cumulativeRevenue += revenue
    previousCutoff = cutoff
    return {
      bucket,
      skuCount: rows.length,
      revenue: round(revenue, 0),
      revenueShare: totalRevenue > 0 ? round(revenue / totalRevenue, 4) : 0,
      cumulativeShare: totalRevenue > 0 ? round(cumulativeRevenue / totalRevenue, 4) : 0,
    }
  })

  const holidayDates = [...calendarData.calendarByDate.values()]
    .filter((entry) => entry.date >= trainData.minDate && entry.date <= trainData.maxDate && (entry.isPublicHoliday || entry.isLunarEvent))
    .map((entry) => entry.date)
  const holidayImpact = []
  for (let relativeDay = -7; relativeDay <= 7; relativeDay += 1) {
    let quantity = 0
    let revenue = 0
    let sampleDays = 0
    const seenDates = new Set()
    for (const holidayDate of holidayDates) {
      const date = addDays(holidayDate, relativeDay)
      if (seenDates.has(date)) continue
      seenDates.add(date)
      const daily = dailyTotals.get(date)
      if (!daily) continue
      quantity += daily.quantity
      revenue += daily.revenue
      sampleDays += 1
    }
    holidayImpact.push({
      relativeDay,
      averageQuantity: sampleDays > 0 ? round(quantity / sampleDays, 2) : 0,
      averageRevenue: sampleDays > 0 ? round(revenue / sampleDays, 0) : 0,
      sampleDays,
    })
  }

  const forecastCalendarImpact = [...forecastCalendarByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, forecastQuantity]) => {
      const weekday = getWeekday(date)
      return {
        date,
        forecastQuantity: round(forecastQuantity, 2),
        weekday,
        weekdayLabel: WEEKDAY_LABELS[weekday],
        isSaturday: weekday === 6,
        isSunday: weekday === 0,
        isHolidayWindow: isHolidayWindow(calendarData, date),
      }
    })

  if (weekdaySummary.length !== 7) throw new Error("Dashboard insights weekday summary must contain 7 rows")
  if (returnMonthly.some((entry) => !Number.isFinite(entry.returnRate))) throw new Error("Dashboard insights return rate contains invalid values")
  if (!Number.isFinite(totalRevenue) || rankedBuckets.some((entry) => entry.revenueShare < 0 || entry.revenueShare > 1)) throw new Error("Dashboard insights Pareto share is invalid")
  if (forecastCalendarImpact.some((entry) => !entry.date)) throw new Error("Dashboard insights forecast calendar point has invalid date")

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      transactionRows: trainData.rowCount,
      trainSkuCount: trainData.skuCount,
      forecastSkuCount: forecastData.skuCount,
      inventoryPlanSkuCount: inventoryPlanData.metadata.skuCount,
      inventoryPlanForecastMismatchRows: inventoryPlanData.metadata.forecastMismatchRows,
      trainStartDate: trainData.minDate,
      trainEndDate: trainData.maxDate,
      forecastStartDate,
      forecastEndDate: addDays(trainData.maxDate, FORECAST_DAYS_PER_SPLIT * 2),
    },
    weekdaySummary,
    saturdaySundayTrend,
    returnMonthly,
    paretoSummary: {
      top1Share: round(revenueShare(1), 4),
      top50Share: round(revenueShare(50), 4),
      top200Share: round(revenueShare(200), 4),
      longTailShare: round(1 - revenueShare(200), 4),
      totalSkuCount: rankedSkuRevenue.length,
      rankedBuckets,
    },
    holidayImpact,
    forecastCalendarImpact,
  }
}

function writeJson(fileName, value) {
  fs.writeFileSync(path.join(outputDir, fileName), `${JSON.stringify(value)}\n`, "utf8")
}

function main() {
  if (!fs.existsSync(trainPath)) {
    throw new Error(`Missing ${path.relative(rootDir, trainPath)}`)
  }
  if (!fs.existsSync(forecastPath)) {
    throw new Error(`Missing ${path.relative(rootDir, forecastPath)}`)
  }
  if (!fs.existsSync(calendarPath)) {
    throw new Error(`Missing ${path.relative(rootDir, calendarPath)}`)
  }

  fs.mkdirSync(outputDir, { recursive: true })

  const trainData = loadTrainData()
  const forecastData = loadForecastData()
  const inventoryPlanData = loadInventoryPlanData(forecastData)
  const forecastEndDate = addDays(trainData.maxDate, FORECAST_DAYS_PER_SPLIT * 2)
  const calendarData = loadCalendarData(trainData.minDate, forecastEndDate)
  const productSummaries = buildProductSummaries(trainData, forecastData)
  const seriesSkus = selectSeriesSkus(productSummaries)

  writeJson("dataset-info.json", {
    trainRows: trainData.rowCount,
    trainSkuCount: trainData.skuCount,
    forecastRows: forecastData.rowCount,
    forecastSkuCount: forecastData.skuCount,
    calendarRows: calendarData.rowCount,
    inventoryPlanRows: inventoryPlanData.metadata.rows,
    inventoryPlanSkuCount: inventoryPlanData.metadata.skuCount,
    inventoryPlanForecastMismatchRows: inventoryPlanData.metadata.forecastMismatchRows,
    inventoryPlanSource: inventoryPlanData.metadata.source,
    calendarStartDate: calendarData.minDate,
    calendarEndDate: calendarData.maxDate,
    minTrainDate: trainData.minDate,
    maxTrainDate: trainData.maxDate,
    validationStartDate: addDays(trainData.maxDate, 1),
    validationEndDate: addDays(trainData.maxDate, FORECAST_DAYS_PER_SPLIT),
    evaluationStartDate: addDays(trainData.maxDate, FORECAST_DAYS_PER_SPLIT + 1),
    evaluationEndDate: addDays(trainData.maxDate, FORECAST_DAYS_PER_SPLIT * 2),
    productSummaryFields: [
      "sku",
      "totalQuantity",
      "totalRevenue",
      "totalCost",
      "transactionCount",
      "avgUnitPrice",
      "avgUnitCost",
      "recent7Quantity",
      "recent28Quantity",
      "recent56Quantity",
      "recent90Quantity",
      "recent28Revenue",
      "prev28Revenue",
      "firstDate",
      "lastDate",
      "validationForecastTotal",
      "evaluationForecastTotal",
      "forecast56Total",
      "positiveSalesDays",
      "returnQuantity",
    ],
    dailySalesSeriesFields: ["sku", ["date", "quantity", "revenue"]],
    dailyForecastSeriesFields: ["sku", "validationF1ToF28", "evaluationF1ToF28"],
    inventoryPlanFields: inventoryPlanData.metadata.fields,
    inventoryPlanSummaries: inventoryPlanData.metadata.summaries,
    dailyCalendarFeatureFields: [
      "date",
      "isWeekend",
      "dayOfWeek",
      "isMonthStart",
      "isMonthEnd",
      "isPublicHoliday",
      "holidayName",
      "isLunarEvent",
      "lunarEventName",
      "isRetailEvent",
      "retailEventName",
      "sourceNote",
    ],
    seriesSkuCount: seriesSkus.size,
  })
  writeJson("product-summaries.json", productSummaries)
  writeJson("daily-sales-series.json", buildDailySalesSeries(trainData, seriesSkus))
  writeJson("daily-forecast-series.json", buildDailyForecastSeries(forecastData, seriesSkus))
  writeJson("inventory-plan.json", { metadata: inventoryPlanData.metadata, rows: inventoryPlanData.rows })
  writeJson("daily-calendar-features.json", buildDailyCalendarFeatures(calendarData, trainData.minDate, forecastEndDate))
  writeJson("calendar-summary.json", buildCalendarSummary(calendarData, trainData.minDate, forecastEndDate))
  writeJson("dashboard-insights.json", buildDashboardInsights(trainData, forecastData, inventoryPlanData, calendarData))

  console.log(`Inventory plan: ${inventoryPlanData.metadata.rows} rows, ${inventoryPlanData.metadata.skuCount} SKU, ${inventoryPlanData.metadata.forecastMismatchRows} forecast mismatches.`)
  console.log(`Generated ${productSummaries.length} SKU summaries, ${seriesSkus.size} SKU series, and ${calendarData.rowCount} calendar rows.`)
}

main()
