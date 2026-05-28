import { generateText } from "ai"
import { z } from "zod"
import { getAnalyticsModel } from "@/lib/ai/model-provider"

export const maxDuration = 60

const requestSchema = z.object({
  product: z.object({
    sku: z.string(),
    name: z.string(),
    category: z.string(),
    brand: z.string(),
    unitPrice: z.number(),
    unitCost: z.number(),
    leadTimeDays: z.number(),
    minOrderQty: z.number(),
  }),
  forecast: z.object({
    days: z.number(),
    totalForecastQty: z.number(),
    avgDailyDemand: z.number(),
    method: z.string(),
  }),
  inventory: z.object({
    currentStock: z.number(),
    reorderPoint: z.number(),
    daysOfStock: z.number(),
  }),
  historical: z.object({
    totalSales: z.number(),
    avgDaily: z.number(),
  }),
  drivers: z.object({
    windowStartDate: z.string(),
    windowEndDate: z.string(),
    peakForecastQty: z.number(),
    peakForecastDate: z.string(),
    averageForecastQty: z.number(),
    notableEvents: z.array(z.object({
      date: z.string(),
      label: z.string(),
      type: z.string(),
      forecastQty: z.number(),
    })),
  }).optional(),
})

type ForecastRequest = z.infer<typeof requestSchema>

function buildPrompt(data: ForecastRequest) {
  const margin = data.product.unitPrice - data.product.unitCost
  const marginPct = ((margin / Math.max(1, data.product.unitPrice)) * 100).toFixed(0)
  const quantityAtRisk = Math.max(0, Math.ceil(data.forecast.totalForecastQty - data.inventory.currentStock))
  const profitAtRisk = Math.round(quantityAtRisk * margin)
  const recommendedQty = Math.max(
    data.product.minOrderQty,
    data.inventory.reorderPoint - data.inventory.currentStock +
      Math.ceil(data.forecast.avgDailyDemand * data.product.leadTimeDays)
  )

  let driverText = ""
  if (data.drivers && data.drivers.notableEvents.length > 0) {
    const events = data.drivers.notableEvents
      .map((e) => `  - ${e.date}: ${e.label} (${e.type}), dự báo ${e.forecastQty} đơn vị`)
      .join("\n")
    driverText = `
Các sự kiện lịch ảnh hưởng đến nhu cầu trong cửa sổ dự báo (${data.drivers.windowStartDate} → ${data.drivers.windowEndDate}):
${events}
Đỉnh dự báo: ${data.drivers.peakForecastQty} đơn vị vào ${data.drivers.peakForecastDate}`
  }

  return `Bạn là chuyên gia phân tích kinh doanh, tài chính và dữ liệu cho chuỗi cung ứng phụ tùng ô tô. Phân tích dữ liệu dự báo sau và đưa ra khuyến nghị hành động.

## Sản phẩm
- SKU: ${data.product.sku}
- Tên: ${data.product.name}
- Ngành hàng: ${data.product.category}
- Thương hiệu: ${data.product.brand}
- Giá bán: ${data.product.unitPrice.toLocaleString("vi-VN")}đ
- Giá vốn: ${data.product.unitCost.toLocaleString("vi-VN")}đ
- Biên lợi nhuận: ${margin.toLocaleString("vi-VN")}đ (${marginPct}%)
- Lead time nhà cung cấp: ${data.product.leadTimeDays} ngày
- MOQ: ${data.product.minOrderQty}

## Dự báo nhu cầu
- Cửa sổ dự báo: ${data.forecast.days} ngày
- Tổng nhu cầu dự báo: ${data.forecast.totalForecastQty} đơn vị
- Nhu cầu trung bình: ${data.forecast.avgDailyDemand.toFixed(1)} đơn vị/ngày
- Phương pháp: ${data.forecast.method}

## Tồn kho hiện tại
- Tồn kho khả dụng: ${data.inventory.currentStock}
- Điểm đặt hàng lại: ${data.inventory.reorderPoint}
- Số ngày tồn kho còn lại: ${data.inventory.daysOfStock}

## Lịch sử bán hàng
- Doanh số ${data.forecast.days} ngày qua: ${data.historical.totalSales}
- Trung bình: ${data.historical.avgDaily.toFixed(1)} đơn vị/ngày

## Tính toán tham khảo
- Số lượng có nguy cơ thiếu: ${quantityAtRisk} đơn vị
- Lợi nhuận có nguy cơ mất: ${profitAtRisk.toLocaleString("vi-VN")}đ
- Số lượng đề xuất đặt: ${Math.max(0, recommendedQty)} đơn vị
${driverText}

## Yêu cầu
Chỉ trả về đúng 5 bullet bằng tiếng Việt, không viết đoạn mở đầu, không kết luận, không thêm dòng ngoài 5 bullet.
Mỗi bullet bắt đầu bằng "- " và dài tối đa 1 câu.
Góc nhìn phải kết hợp phân tích kinh doanh, tài chính và dữ liệu.
Không bịa nguyên nhân ngoài dữ liệu đã cung cấp; nếu không có sự kiện lịch nổi bật thì nói rõ "không có driver lịch nổi bật".
5 bullet bắt buộc theo thứ tự:
- Rủi ro kinh doanh của SKU dựa trên tồn kho, lead time và forecast.
- Tín hiệu dữ liệu chính: forecast, nhu cầu lịch sử, ngày hết hàng hoặc driver lịch nếu có.
- Tác động tài chính: lợi nhuận có nguy cơ mất hoặc lợi nhuận có thể bảo vệ.
- Khuyến nghị hành động: đặt bao nhiêu, khi nào, điều kiện ưu tiên.
- Lưu ý về độ tin cậy/giả định dữ liệu: N-BEATS là dữ liệu cuộc thi, tồn kho/danh mục là enrichment demo.`
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data
    const prompt = buildPrompt(data)

    const result = await generateText({
      model: getAnalyticsModel(),
      prompt,
      temperature: 0.3,
    })

    const recommendation = result.text?.trim()
    if (!recommendation) {
      console.error("Empty AI recommendation text", { usage: result.usage })
      return Response.json(
        { error: "Model returned empty response" },
        { status: 500 }
      )
    }

    return Response.json({
      recommendation,
    })
  } catch (error) {
    console.error("Forecast recommendation error:", error)
    return Response.json(
      { error: "Failed to generate recommendation" },
      { status: 500 }
    )
  }
}
