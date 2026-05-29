# Kế hoạch layout trang chính theo hướng Insight-first

## Mục tiêu

Chuyển `/dashboard` từ một dashboard nhiều KPI rời rạc thành **Insight Command Center**: giám khảo nhìn nhanh thấy dữ liệu lịch sử đã tạo ra insight vận hành rõ ràng, sau đó thấy forecast N-BEATS được dùng để biến insight thành quyết định nhập hàng.

Trang chính cần kể được mạch:

1. Dữ liệu lịch sử `train.csv` có pattern vận hành mạnh.
2. Các pattern này ảnh hưởng trực tiếp tới forecast và kế hoạch mua hàng.
3. Forecast từ `submission_nbeats.csv` được dùng để ưu tiên SKU, ngân sách và hành động.
4. Dashboard không chỉ hiển thị số, mà đưa ra quyết định nghiệp vụ.

## Nguyên tắc trình bày

- Ưu tiên insight mạnh, ít chữ, có bằng chứng chart ngay bên cạnh hoặc ngay phía dưới.
- Không phô tên file trong UI chính trừ khi cần ghi chú nguồn dữ liệu.
- Không claim dữ liệu chưa có: tồn kho hiện tại, lead time thật, nhà cung cấp thật, POS/ERP live.
- Copy nên đi thẳng vào hành động: “không nhập thừa cho Chủ nhật”, “đảm bảo hàng trước Thứ 7”, “ưu tiên top SKU”, “tính return vào net demand”.
- Chart phải phục vụ storytelling, không trang trí.
- Mỗi insight nên trả lời đủ 3 ý:
  - Phát hiện gì?
  - Vì sao quan trọng?
  - Quyết định vận hành là gì?

## Layout tổng thể đề xuất cho `/dashboard`

### Section 1 — Hero ngắn

Vị trí: đầu trang, ngay dưới header.

Nội dung:

- Title: `5 insight vận hành quan trọng nhất`
- Subtitle: `Từ lịch sử bán hàng và forecast N-BEATS, hệ thống chỉ ra các pattern ảnh hưởng trực tiếp tới kế hoạch nhập hàng.`
- 3 quick stats nhỏ:
  - Số dòng giao dịch từ `train.csv`
  - Số SKU có forecast từ `submission_nbeats.csv`
  - Số SKU có kế hoạch inventory-plan

UI gợi ý:

```text
[5 insight vận hành quan trọng nhất]
Từ lịch sử bán hàng và forecast N-BEATS...

[711.980 dòng giao dịch] [15.972 SKU forecast] [0 mismatch forecast-plan]
```

### Section 2 — 5 insight cards

Dùng layout giống ảnh mẫu: mỗi insight là một card ngang lớn, icon bên trái, title lớn, mô tả 1–2 câu, badge loại insight.

Trên desktop:

```text
[Insight card 1]
[Insight card 2]
[Insight card 3]
[Insight card 4]
[Insight card 5]
```

Nếu muốn giàu hơn nhưng vẫn gọn, mỗi card có mini evidence ở bên phải:

```text
[Icon] Title + mô tả + badge                     [mini metric / mini bar]
```

#### Insight 1 — Chủ nhật gần như không có doanh thu

Copy đề xuất:

- Title: `Chủ nhật gần như không có doanh thu`
- Body: `Hầu như không bán được hàng vào Chủ nhật. Forecast và kế hoạch nhập hàng không nên coi Chủ nhật giống các ngày cuối tuần khác.`
- Badge: `Ưu tiên cao nhất`
- Action: `Clamp hoặc giảm kỳ vọng demand Chủ nhật trong Pilot.`

Chart đi kèm:

- Bar chart: sản lượng/doanh thu trung bình theo thứ.
- Chủ nhật dùng màu xanh nhạt hoặc cảnh báo để nổi bật mức gần 0.

#### Insight 2 — Thứ 7 vẫn bán tốt, không nhầm với Chủ nhật

Copy đề xuất:

- Title: `Thứ 7 vẫn bán tốt — đừng nhầm với Chủ nhật`
- Body: `Thứ 7 là ngày vận hành quan trọng. Kế hoạch nhân lực và tồn kho cần đủ cho Thứ 7, không gộp chung “cuối tuần nghỉ”.`
- Badge: `Vận hành`
- Action: `Đảm bảo hàng trước Thứ 7.`

Chart đi kèm:

- Line chart theo tháng: Saturday average quantity vs Sunday average quantity.
- Nếu cần gọn: grouped bar `Thứ 7` vs `Chủ nhật`.

#### Insight 3 — Tỷ lệ hoàn trả tăng mạnh, đáng lo tháng 10

Copy đề xuất:

- Title: `Tỷ lệ hoàn trả tăng mạnh — đáng lo tháng 10`
- Body: `Return từ mức rất thấp đã tăng lên rõ rệt. Forecast nên phục vụ doanh thu thuần, không chỉ doanh số gộp.`
- Badge: `Rủi ro doanh thu`
- Action: `Theo dõi net demand và SKU có return risk.`

Chart đi kèm:

- Line chart return rate theo tháng.
- Có thể highlight tháng 10 nếu dữ liệu chứng minh tháng 10 cao.
- Metric nên dùng:
  - gross quantity
  - absolute returned quantity
  - return rate = abs(return quantity) / gross quantity

#### Insight 4 — Top 200 SKU chiếm gần 50% doanh số

Copy đề xuất:

- Title: `Top 200 SKU chiếm gần 50% doanh số`
- Body: `Doanh thu tập trung mạnh ở một nhóm SKU nhỏ. Nguồn lực forecast và ngân sách nên ưu tiên nhóm SKU tác động lớn.`
- Badge: `Tập trung nguồn lực`
- Action: `Tách chiến lược top SKU và long-tail SKU.`

Chart đi kèm:

- Pareto chart chuẩn:
  - Bar: revenue theo SKU rank hoặc rank bucket
  - Line: cumulative revenue share
- Card phụ như ảnh:
  - Top 1 SKU
  - Top 50 SKU
  - Top 200 SKU
  - Còn lại

#### Insight 5 — Nghỉ lễ và trước lễ làm sản lượng giảm rõ

Copy đề xuất:

- Title: `Nghỉ lễ + trước lễ làm sản lượng giảm rõ`
- Body: `Nhu cầu thường giảm quanh kỳ nghỉ. Kế hoạch nhập hàng nên điều chỉnh trước các kỳ lễ quan trọng.`
- Badge: `Kế hoạch nhập hàng`
- Action: `Dùng calendar feature để điều chỉnh forecast và thời điểm nhập.`

Chart đi kèm:

- Event impact chart: average demand quanh ngày lễ, từ D-7 tới D+7.
- Nếu chưa có đủ holiday mapping thật, dùng calendar feature hiện có và ghi là `calendar proxy`.

### Section 3 — Evidence charts

Ngay sau 5 cards, hiển thị các chart chứng minh. Không nên quá nhiều chart cùng lúc; ưu tiên 3 chart lớn và 2 chart phụ.

#### Chart A — Doanh số theo thứ

Mục tiêu: chứng minh Insight 1 và 2.

Loại chart: `BarChart`.

Data:

- Source: `train.csv`
- Group by `weekday`
- Metrics:
  - `averageDailyQuantity`
  - `averageDailyRevenue`
  - `activeDays`

UI:

```text
[Card] Sản lượng trung bình theo thứ
Bar: T2, T3, T4, T5, T6, T7, CN
```

Nên highlight:

- Chủ nhật: màu xanh nhạt / muted
- Thứ 7: màu emerald hoặc blue đậm

#### Chart B — Pareto SKU revenue

Mục tiêu: chứng minh Insight 4.

Loại chart: `ComposedChart` hoặc kết hợp custom progress bars.

Data:

- Source: `train.csv`
- Group by SKU
- Sort by revenue desc
- Compute cumulative revenue share

UI nếu dùng Recharts:

- Bar: revenue theo rank bucket
- Line: cumulative share

UI nếu cần gọn:

```text
Top 1 SKU      ████████ 9.3%
Top 50 SKU     █████████████████ 31%
Top 200 SKU    ████████████████████████ 47.5%
Còn lại        █████████████████████████ 52.5%
```

#### Chart C — Return rate theo tháng

Mục tiêu: chứng minh Insight 3.

Loại chart: `LineChart` hoặc `ComposedChart`.

Data:

- Source: `train.csv`
- Group by month
- Compute:
  - gross quantity
  - absolute returned quantity
  - return rate

UI:

- Line: return rate %
- Optional bar: returned quantity
- Highlight tháng có return cao nhất.

#### Chart D — Holiday impact window

Mục tiêu: chứng minh Insight 5.

Loại chart: `LineChart` hoặc `BarChart`.

Data:

- Source: `train.csv` + calendar generated data.
- Group by relative day around holiday: D-7 tới D+7.
- Metric: average daily quantity / revenue.

UI:

```text
D-7 D-6 D-5 D-4 D-3 D-2 D-1 D0 D+1 D+2...
```

Ghi chú copy:

- Nếu holiday feature là proxy, ghi `calendar proxy`.
- Không claim đã có lịch campaign nội bộ.

#### Chart E — Forecast 28 ngày có highlight lịch

Mục tiêu: kết nối lịch sử với forecast.

Loại chart: `AreaChart` hoặc `LineChart`.

Data:

- Source: `submission_nbeats.csv`
- Combine with calendar feature by forecast date.
- Highlight:
  - Chủ nhật
  - Thứ 7
  - holiday window nếu có

UI:

- Line: forecast quantity
- Shaded background hoặc markers cho Chủ nhật/kỳ lễ.
- Badge: `Forecast phải tôn trọng pattern lịch`.

### Section 4 — Insight → Forecast impact → Quyết định

Dạng table gọn, đặt dưới chart để nối storytelling.

Columns:

| Insight | Forecast impact | Quyết định |
|---|---|---|
| Chủ nhật gần 0 | Giảm kỳ vọng demand Chủ nhật | Không overstock cho Chủ nhật |
| Thứ 7 bán tốt | Không gộp Thứ 7 với Chủ nhật | Chuẩn bị hàng trước Thứ 7 |
| Return tăng | Theo dõi net demand | Ưu tiên SKU return risk |
| Top SKU tập trung | Forecast kỹ nhóm A | Ưu tiên ngân sách cho SKU tác động lớn |
| Holiday giảm | Điều chỉnh demand quanh lễ | Nhập hàng sớm hơn trước kỳ lễ |

Mục tiêu: giám khảo thấy insight không dừng ở phân tích, mà đi tới hành động.

### Section 5 — Forecast-to-action preview

Có thể giữ một phần dashboard hiện tại nhưng đặt sau insight.

Nên gồm:

- Top SKU forecast 28 ngày cần hành động.
- Tổng lợi nhuận có thể bảo vệ.
- Ngân sách đề xuất.
- Link sang:
  - `/dashboard/decision-queue`
  - `/dashboard/replenishment`
  - `/dashboard/forecast`

## Derived data cần build thêm

Nên thêm vào `scripts/build-project-data.mjs` để sinh JSON phục vụ UI. Không tính trực tiếp trong component vì dữ liệu lớn.

### 1. `dashboard-insights.json`

Một file tổng hợp cho trang chính, có cấu trúc:

```ts
type DashboardInsights = {
  weekdaySummary: WeekdaySummary[]
  saturdaySundayTrend: SaturdaySundayTrend[]
  returnMonthly: ReturnMonthly[]
  paretoSummary: ParetoSummary
  holidayImpact: HolidayImpactPoint[]
  forecastCalendarImpact: ForecastCalendarPoint[]
}
```

### 2. `weekdaySummary`

```ts
type WeekdaySummary = {
  weekday: number
  label: string
  totalQuantity: number
  totalRevenue: number
  activeDays: number
  averageDailyQuantity: number
  averageDailyRevenue: number
  forecast28Quantity?: number
}
```

Dùng cho:

- Insight Chủ nhật
- Insight Thứ 7
- Chart doanh số theo thứ

### 3. `saturdaySundayTrend`

```ts
type SaturdaySundayTrend = {
  month: string
  saturdayQuantity: number
  sundayQuantity: number
  saturdayRevenue: number
  sundayRevenue: number
}
```

Dùng cho:

- Chart Thứ 7 vs Chủ nhật theo thời gian

### 4. `returnMonthly`

```ts
type ReturnMonthly = {
  month: string
  grossQuantity: number
  returnQuantity: number
  returnRate: number
  grossRevenue: number
  returnedRevenueProxy?: number
}
```

Quy ước:

- `returnQuantity` nên là trị tuyệt đối của quantity âm.
- `returnRate = returnQuantity / grossQuantity`.
- Không gọi là loss thật nếu không có giá trị hoàn tiền chính xác.

### 5. `paretoSummary`

```ts
type ParetoSummary = {
  top1Share: number
  top50Share: number
  top200Share: number
  longTailShare: number
  totalSkuCount: number
  rankedBuckets: Array<{
    bucket: string
    skuCount: number
    revenue: number
    revenueShare: number
    cumulativeShare: number
  }>
}
```

Dùng cho:

- Pareto chart
- Progress bars như ảnh

### 6. `holidayImpact`

```ts
type HolidayImpactPoint = {
  relativeDay: number
  averageQuantity: number
  averageRevenue: number
  sampleDays: number
}
```

Dùng cho:

- Event impact chart D-7 tới D+7

### 7. `forecastCalendarImpact`

```ts
type ForecastCalendarPoint = {
  date: string
  forecastQuantity: number
  weekday: number
  weekdayLabel: string
  isSaturday: boolean
  isSunday: boolean
  isHolidayWindow: boolean
}
```

Dùng cho:

- Forecast chart có highlight lịch

## Các file dự kiến cần sửa

### `scripts/build-project-data.mjs`

Thêm phần tính và ghi `dashboard-insights.json`.

Nguồn vào:

- `train.csv`
- `submission_nbeats.csv`
- calendar generated data nếu đang có trong script hoặc generated JSON.

Cần đảm bảo:

- Không làm chậm build quá nhiều.
- Validate số liệu cơ bản:
  - weekday đủ 7 ngày.
  - return rate không NaN.
  - pareto share tổng hợp hợp lệ.
  - forecastCalendarImpact có forecast date hợp lệ.

### `lib/project-data/index.ts`

Thêm import generated JSON mới và export:

```ts
export const dashboardInsights = ...
export type DashboardInsights = ...
```

Nếu cần helper:

```ts
export function getDashboardInsights() {
  return dashboardInsights
}
```

### `app/dashboard/page.tsx`

Refactor trang chính:

1. Header/Hero insight-first.
2. Render `InsightCards`.
3. Render evidence charts.
4. Render insight-to-action table.
5. Giữ forecast-to-action preview gọn hơn.

### Component có thể tách nếu file quá dài

Nếu `app/dashboard/page.tsx` quá dài, tạo component trong:

- `components/dashboard/insight-card.tsx`
- `components/dashboard/insight-evidence-charts.tsx`
- `components/dashboard/pareto-summary.tsx`

Tuy nhiên chỉ tách khi cần; không tạo abstraction quá sớm.

## Thiết kế visual

### Tone màu theo insight

- Chủ nhật: blue muted / slate
- Thứ 7: emerald
- Return risk: amber
- Pareto/top SKU: violet
- Holiday impact: orange/brown

### Style card giống ảnh

Card insight:

```text
rounded-2xl border bg-card p-5
icon square 72x72 rounded-xl
heading text-xl / font-semibold
body text-muted-foreground
badge rounded-full
```

Desktop layout:

```text
grid-cols-[72px_1fr_auto]
```

Mobile:

```text
icon trên, text dưới
```

### Chart style

- Không dùng quá nhiều màu.
- Mỗi chart chỉ highlight 1 ý chính.
- Tooltip có số định dạng tiếng Việt.
- Axis label ngắn.
- Nếu chart khó hiểu, thêm subtitle 1 dòng.

## Copy mẫu cho trang chính

### Hero

```text
5 insight vận hành quan trọng nhất
Từ lịch sử bán hàng và forecast N-BEATS, hệ thống chỉ ra các pattern ảnh hưởng trực tiếp tới kế hoạch nhập hàng.
```

### Evidence section title

```text
Bằng chứng dữ liệu
Các chart dưới đây dùng lịch sử bán hàng và forecast để kiểm chứng từng insight.
```

### Forecast impact section title

```text
Từ insight tới quyết định
Mỗi insight được chuyển thành một rule vận hành hoặc ưu tiên trong forecast-to-action workflow.
```

## Kiểm tra sau khi triển khai

Chạy:

```bash
pnpm.cmd build:data
pnpm.cmd exec tsc --noEmit --incremental false
pnpm.cmd build
```

Manual check:

1. Mở `/dashboard`.
2. 5 insight cards phải xuất hiện ngay trên fold đầu hoặc ngay sau hero.
3. Mỗi insight có chart hoặc bằng chứng rõ ràng.
4. Chart Pareto phải thể hiện top SKU vs long-tail rõ.
5. Chart weekday phải làm Chủ nhật nổi bật là ngoại lệ.
6. Không có claim live ERP/POS hoặc dữ liệu vận hành thật chưa có.
7. UI không quá nhiều chữ; phần giải thích dài đưa xuống tooltip/table phụ.

## Kết quả kỳ vọng

Sau khi làm xong, `/dashboard` sẽ chuyển thành câu chuyện mạnh hơn:

- Không chỉ “có dashboard”.
- Không chỉ “có forecast”.
- Mà là: dữ liệu lịch sử phát hiện pattern thật → forecast phải tôn trọng pattern → hệ thống đề xuất quyết định nhập hàng theo tác động tiền.
