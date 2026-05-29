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
  }),
  forecast: z.object({
    days: z.number(),
    totalForecastQty: z.number(),
    avgDailyDemand: z.number(),
    method: z.string(),
  }),
  inventoryPolicy: z.object({
    reorderPoint: z.number(),
    recommendedOrder: z.number(),
    safetyStock: z.number().optional(),
    economicOrderQty: z.number().optional(),
    cycleTimeDays: z.number().nullable().optional(),
  }),
  financial: z.object({
    protectedProfit: z.number(),
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
  const recommendedQty = Math.max(0, Math.ceil(data.inventoryPolicy.recommendedOrder))
  const protectedQty = Math.min(recommendedQty, Math.max(0, Math.ceil(data.forecast.totalForecastQty)))
  const protectedProfit = Math.max(0, Math.round(data.financial.protectedProfit || protectedQty * margin))

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
- Giá bán: ${data.product.unitPrice.toLocaleString("vi-VN")}đ
- Giá vốn: ${data.product.unitCost.toLocaleString("vi-VN")}đ
- Biên lợi nhuận: ${margin.toLocaleString("vi-VN")}đ (${marginPct}%)

## Dự báo nhu cầu
- Cửa sổ dự báo: ${data.forecast.days} ngày
- Tổng nhu cầu dự báo: ${data.forecast.totalForecastQty} đơn vị
- Nhu cầu trung bình: ${data.forecast.avgDailyDemand.toFixed(1)} đơn vị/ngày
- Phương pháp: Dự báo nhu cầu tự động

## Kế hoạch tồn kho
- Điểm đặt hàng lại: ${data.inventoryPolicy.reorderPoint}
- Lượng mua đề xuất: ${recommendedQty}
- Tồn an toàn: ${Math.round(data.inventoryPolicy.safetyStock ?? 0)}
- Lô mua tối ưu: ${Math.round(data.inventoryPolicy.economicOrderQty ?? 0)}
- Thời gian chu kỳ theo chính sách: ${data.inventoryPolicy.cycleTimeDays ? `${Math.round(data.inventoryPolicy.cycleTimeDays)} ngày` : "chưa có"}

## Lịch sử bán hàng
- Doanh số ${data.forecast.days} ngày qua: ${data.historical.totalSales}
- Trung bình: ${data.historical.avgDaily.toFixed(1)} đơn vị/ngày

## Tính toán tham khảo
- Lợi nhuận có thể bảo vệ theo dự báo và lượng mua đề xuất: ${protectedProfit.toLocaleString("vi-VN")}đ
- Số lượng đề xuất đặt: ${recommendedQty} đơn vị
${driverText}

## Yêu cầu
Chỉ trả về đúng 5 bullet bằng tiếng Việt, không viết đoạn mở đầu, không kết luận, không thêm dòng ngoài 5 bullet.
Mỗi bullet bắt đầu bằng "- " và dài tối đa 1 câu.
Góc nhìn phải kết hợp phân tích kinh doanh, tài chính và dữ liệu.
Không bịa nguyên nhân ngoài dữ liệu đã cung cấp; nếu không có tín hiệu lịch nổi bật thì nói rõ "không có tín hiệu lịch nổi bật".
5 bullet bắt buộc theo thứ tự:
- Rủi ro vận hành của mã hàng dựa trên dự báo và kế hoạch tồn kho, không dùng tồn kho giả.
- Tín hiệu dữ liệu chính: dự báo nhu cầu, bán hàng gần đây hoặc tín hiệu lịch nếu có.
- Tác động tài chính: lợi nhuận có thể bảo vệ theo dự báo và biên lợi nhuận.
- Khuyến nghị xử lý: đặt bao nhiêu theo lượng mua đề xuất và ưu tiên tài chính.
- Điểm cần theo dõi: cần rà soát nếu dự báo hoặc bán hàng gần đây biến động lớn.
Không nhắc tên mô hình, tên file dữ liệu, tồn kho hiện tại, nhà cung cấp, thời gian giao hàng, số lượng đặt tối thiểu hoặc thuật ngữ nội bộ.`
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = requestSchema.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { error: "Yêu cầu không hợp lệ", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data
    const prompt = buildPrompt(data)

    const result = await generateText({
      model: getAnalyticsModel(),
      prompt,
    })

    const recommendation = result.text?.trim()
    if (!recommendation) {
      console.error("Empty AI recommendation text", { usage: result.usage })
      return Response.json(
        { error: "Mô hình trả về phản hồi trống" },
        { status: 500 }
      )
    }

    return Response.json({
      recommendation,
    })
  } catch (error) {
    console.error("Forecast recommendation error:", error)
    return Response.json(
      { error: "Không thể tạo khuyến nghị" },
      { status: 500 }
    )
  }
}
