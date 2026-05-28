import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const trainPath = path.join(rootDir, "train.csv")
const forecastPath = path.join(rootDir, "submission_nbeats.csv")
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
  writeJson("daily-calendar-features.json", buildDailyCalendarFeatures(calendarData, trainData.minDate, forecastEndDate))
  writeJson("calendar-summary.json", buildCalendarSummary(calendarData, trainData.minDate, forecastEndDate))

  console.log(`Generated ${productSummaries.length} SKU summaries, ${seriesSkus.size} SKU series, and ${calendarData.rowCount} calendar rows.`)
}

main()
