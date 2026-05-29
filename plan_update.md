# Kế Hoạch Chi Tiết Tích Hợp Tối Ưu Tồn Kho

## 1. Mục Tiêu Và Kết Quả Cần Đạt

Mục tiêu của phase này là đưa kết quả tối ưu tồn kho từ `inventory_plan.csv` vào dashboard như một lớp quyết định vận hành nằm sau forecast N-BEATS.

Kết quả cuối cùng cần đạt:

- Dashboard không chỉ hiển thị forecast nhu cầu, mà còn cho biết chính sách tồn kho tối ưu theo SKU.
- Replenishment dùng EOQ, Safety Stock, Reorder Point và Recommended Order từ `inventory_plan.csv` để tính số lượng cần mua.
- Người dùng phân biệt rõ:
  - forecast demand: nhu cầu dự báo trong 28 ngày,
  - safety stock: tồn kho an toàn,
  - reorder point: ngưỡng cần đặt lại,
  - target stock: mức tồn kho mục tiêu,
  - purchase qty: số lượng cần mua thực tế.
- Analytics Bot dùng cùng nguồn dữ liệu inventory policy với UI.
- Nếu một SKU không có policy trong `inventory_plan.csv`, app fallback về logic cũ và không crash.

Phase này không thay đổi thuật toán trong `inventory.py`. Thuật toán của partner được xem là upstream model, còn dashboard chỉ consume output.

## 2. Hiện Trạng Dữ Liệu

### 2.1 Nguồn Forecast

Nguồn forecast hiện tại:

```text
submission_nbeats.csv
```

Ý nghĩa:

- File chứa forecast theo ngày từ mô hình N-BEATS.
- Forecast vẫn là daily forecast.
- Partner gom các ngày dự báo thành 2 kỳ 28 ngày để đưa vào mô hình tồn kho.

Mapping planning horizon:

```text
month 1 = d1  -> d28
month 2 = d29 -> d56
```

### 2.2 Nguồn Inventory Optimization

Nguồn tối ưu tồn kho:

```text
inventory_plan.csv
```

File này chứa 2 dòng cho mỗi SKU:

- `month = 1`: kỳ vận hành hiện tại, lấy từ 28 ngày forecast đầu tiên.
- `month = 2`: kỳ kế hoạch tiếp theo, lấy từ 28 ngày forecast kế tiếp.

Các cột quan trọng:

| CSV column | Ý nghĩa trong app |
| --- | --- |
| `sku` | SKU key để join với product/forecast |
| `month` | Planning horizon, chỉ nhận 1 hoặc 2 |
| `unit_cost` | Giá vốn đơn vị dùng trong cost model |
| `std_daily` | Độ lệch chuẩn demand ngày từ lịch sử |
| `D_month` | Tổng demand dự báo trong 28 ngày |
| `mean_daily` | Demand trung bình/ngày trong kỳ |
| `D_annual_equiv` | Demand annualized để tính EOQ |
| `EOQ` | Economic Order Quantity |
| `Recommended_Order` | Target stock/order target từ optimizer |
| `Safety_Stock` | Tồn kho an toàn |
| `Reorder_Point` | Ngưỡng đặt hàng lại |
| `Cycle_Time_days` | Chu kỳ đặt hàng ước tính |
| `Annual_Order_Cost` | Chi phí đặt hàng annualized |
| `Annual_Holding_Cost` | Chi phí tồn kho annualized |
| `Annual_Purchase_Cost` | Chi phí mua hàng annualized |
| `Total_Annual_Cost` | Tổng chi phí annualized |

### 2.3 Quyết Định Mặc Định

- UI mặc định dùng `month = 1`.
- `month = 2` chỉ dùng cho phân tích kỳ kế tiếp.
- `Recommended_Order` không được hiểu là số lượng cần mua trực tiếp.
- `Recommended_Order` là target stock.
- Số lượng mua thực tế phải tính từ tồn kho hiện tại.

## 3. Data Flow Mục Tiêu

Luồng dữ liệu cần triển khai:

```text
submission_nbeats.csv
  -> inventory.py
  -> inventory_plan.csv
  -> scripts/build-project-data.mjs
  -> lib/project-data/generated/inventory-plan.json
  -> lib/project-data/index.ts
  -> dashboard pages/components
  -> Analytics Bot context/tools
```

Trách nhiệm từng lớp:

- `inventory.py`: upstream optimizer, tạo CSV. Không sửa trong phase này.
- `scripts/build-project-data.mjs`: parse CSV và tạo generated JSON.
- `lib/project-data/generated/inventory-plan.json`: dữ liệu build-time compact, app import được.
- `lib/project-data/index.ts`: expose type, helper và summary.
- UI pages/components: dùng helper thay vì tự parse CSV.
- Analytics Bot: lấy data qua cùng helper hoặc context builder, không đọc CSV riêng.

## 4. Generated Data Contract

### 4.1 File Generated Mới

Tạo generated file:

```text
lib/project-data/generated/inventory-plan.json
```

Không để UI import trực tiếp từ `inventory_plan.csv`.

Lý do:

- Next.js client/server code không nên parse CSV runtime.
- JSON generated nhất quán với các project-data hiện có.
- Dễ validate khi build data.
- Dễ share cùng nguồn cho UI và bot.

### 4.2 Shape Dữ Liệu Đề Xuất

Ưu tiên compact tuple để giảm kích thước file:

```ts
type InventoryPolicyTuple = [
  sku: string,
  month: 1 | 2,
  unitCost: number,
  stdDaily: number,
  demand28: number,
  meanDaily: number,
  annualizedDemand: number,
  economicOrderQty: number,
  recommendedOrderTarget: number,
  safetyStock: number,
  reorderPoint: number,
  cycleTimeDays: number | null,
  annualOrderCost: number,
  annualHoldingCost: number,
  annualPurchaseCost: number,
  totalAnnualCost: number
];
```

Generated JSON nên có metadata:

```json
{
  "generatedAt": "2026-05-28T00:00:00.000Z",
  "source": "inventory_plan.csv",
  "forecastSource": "submission_nbeats.csv",
  "horizonDays": 28,
  "months": [1, 2],
  "rows": []
}
```

Trong đó `rows` là mảng tuple.

### 4.3 Mapping CSV Sang App Field

Mapping bắt buộc:

| CSV | App field |
| --- | --- |
| `sku` | `sku` |
| `month` | `month` |
| `unit_cost` | `unitCost` |
| `std_daily` | `stdDaily` |
| `D_month` | `demand28` |
| `mean_daily` | `meanDaily` |
| `D_annual_equiv` | `annualizedDemand` |
| `EOQ` | `economicOrderQty` |
| `Recommended_Order` | `recommendedOrderTarget` |
| `Safety_Stock` | `safetyStock` |
| `Reorder_Point` | `reorderPoint` |
| `Cycle_Time_days` | `cycleTimeDays` |
| `Annual_Order_Cost` | `annualOrderCost` |
| `Annual_Holding_Cost` | `annualHoldingCost` |
| `Annual_Purchase_Cost` | `annualPurchaseCost` |
| `Total_Annual_Cost` | `totalAnnualCost` |

### 4.4 Parse Và Normalize

Khi build data:

- Trim SKU.
- Parse `month` thành number.
- Chỉ cho phép `month = 1` hoặc `month = 2`.
- Parse toàn bộ numeric field bằng helper an toàn.
- Nếu field numeric rỗng hoặc không parse được, set `0` cho metric chi phí/demand cơ bản.
- Riêng `cycleTimeDays`:
  - nếu không parse được: `null`,
  - nếu `<= 0`: `null`,
  - nếu `> 365`: `null` để tránh hiển thị chu kỳ vô lý.
- Round output theo mức hợp lý:
  - quantity: tối đa 2 chữ số thập phân trong data, UI tự format 0 hoặc 1 chữ số tùy ngữ cảnh,
  - cost: giữ number gốc, UI format tiền.

## 5. Type Và Helper Trong Project Data

### 5.1 Type Public

Thêm type:

```ts
export interface InventoryOptimizationPolicy {
  sku: string;
  month: 1 | 2;
  unitCost: number;
  stdDaily: number;
  demand28: number;
  meanDaily: number;
  annualizedDemand: number;
  economicOrderQty: number;
  recommendedOrderTarget: number;
  safetyStock: number;
  reorderPoint: number;
  cycleTimeDays: number | null;
  annualOrderCost: number;
  annualHoldingCost: number;
  annualPurchaseCost: number;
  totalAnnualCost: number;
}
```

Thêm summary type:

```ts
export interface InventoryOptimizationSummary {
  month: 1 | 2;
  skuCount: number;
  totalDemand28: number;
  totalRecommendedOrderTarget: number;
  totalSafetyStock: number;
  totalAnnualOrderCost: number;
  totalAnnualHoldingCost: number;
  totalAnnualPurchaseCost: number;
  totalAnnualCost: number;
  averageCycleTimeDays: number | null;
}
```

### 5.2 Helper API

Thêm helper:

```ts
getInventoryPoliciesBySku(sku: string): InventoryOptimizationPolicy[]
getInventoryPolicyBySkuMonth(sku: string, month?: 1 | 2): InventoryOptimizationPolicy | null
getInventoryPolicyByProduct(productId: string, month?: 1 | 2): InventoryOptimizationPolicy | null
getInventoryOptimizationSummary(month?: 1 | 2): InventoryOptimizationSummary
```

Default:

```ts
month = 1
```

### 5.3 Indexing

Trong `lib/project-data/index.ts`:

- Build map theo key `${sku}:${month}`.
- Build map `sku -> [month1, month2]`.
- Không scan toàn bộ array mỗi lần render.

Pseudo-code:

```ts
const inventoryPolicyBySkuMonth = new Map<string, InventoryOptimizationPolicy>();
const inventoryPoliciesBySku = new Map<string, InventoryOptimizationPolicy[]>();

for (const row of inventoryPlan.rows) {
  const policy = tupleToInventoryPolicy(row);
  inventoryPolicyBySkuMonth.set(`${policy.sku}:${policy.month}`, policy);

  const list = inventoryPoliciesBySku.get(policy.sku) ?? [];
  list.push(policy);
  inventoryPoliciesBySku.set(policy.sku, list);
}
```

Sort policies theo month tăng dần.

## 6. Replenishment Logic Chi Tiết

### 6.1 Nguyên Tắc Chính

Không dùng:

```text
purchaseQty = Recommended_Order
```

Dùng:

```text
rawPurchaseQty = max(0, recommendedOrderTarget - availableQty)
```

Sau đó mới áp dụng MOQ hoặc pack-size nếu hệ thống đang có.

### 6.2 Pseudo-code

```ts
const policy = getInventoryPolicyByProduct(product.id, selectedMonth);

if (policy) {
  const targetStock = Math.max(0, policy.recommendedOrderTarget);
  const rawPurchaseQty = Math.max(0, targetStock - inventory.availableQty);
  const purchaseQty = applyMoqAndPackSize(rawPurchaseQty, product);

  return {
    ...baseSuggestion,
    forecastDemand28: policy.demand28,
    economicOrderQty: policy.economicOrderQty,
    safetyStock: policy.safetyStock,
    reorderPoint: policy.reorderPoint,
    recommendedOrderTarget: targetStock,
    suggestedQty: purchaseQty,
    inventoryPolicyMonth: policy.month,
    inventoryPolicySource: "inventory_plan",
  };
}

return {
  ...fallbackSuggestion,
  inventoryPolicySource: "fallback",
};
```

### 6.3 Trigger Điều Kiện Cần Mua

Một SKU nên được coi là cần hành động nếu:

```text
availableQty <= reorderPoint
```

hoặc:

```text
rawPurchaseQty > 0
```

Với UI nên ưu tiên giải thích bằng câu ngắn:

```text
Tồn kho hiện tại thấp hơn reorder point
```

hoặc:

```text
Cần nâng tồn kho lên target stock
```

### 6.4 MOQ Và Budget

Quy tắc:

- Nếu `rawPurchaseQty = 0`, không áp dụng MOQ để biến thành đơn mua giả.
- Nếu `rawPurchaseQty > 0`, mới round theo MOQ/pack-size.
- Budget `0` là ngân sách bằng 0, không phải không giới hạn.
- Các check budget phải dùng `budget !== null` hoặc equivalent.
- Bulk approve chỉ duyệt dòng:
  - không bị excluded,
  - `suggestedQty > 0`,
  - nằm trong budget nếu budget khác `null`.

### 6.5 Field Bổ Sung Cho Suggestion

Bổ sung vào suggestion model:

```ts
economicOrderQty?: number;
recommendedOrderTarget?: number;
safetyStock?: number;
reorderPoint?: number;
forecastDemand28?: number;
inventoryPolicyMonth?: 1 | 2;
inventoryPolicySource: "inventory_plan" | "fallback";
```

Nếu fallback:

- các field policy có thể `undefined`,
- `inventoryPolicySource = "fallback"`.

## 7. UI Implementation Plan

### 7.1 Dashboard

Mục tiêu UI:

- Dashboard có một khối summary về tồn kho tối ưu.
- Không biến dashboard thành bảng dày chữ.
- Chỉ đưa các chỉ số cấp quản trị.

Cards/chỉ số nên có:

- `SKUs covered`: số SKU có policy.
- `Demand 28d`: tổng demand forecast trong month 1.
- `Target stock`: tổng recommended order target.
- `Safety stock`: tổng safety stock.
- `Annualized inventory cost`: tổng `Total_Annual_Cost`.

Copy đề xuất:

```text
Inventory policy built from N-BEATS demand forecast and EOQ optimization.
```

Nếu cần tiếng Việt:

```text
Chính sách tồn kho được tính từ forecast N-BEATS và tối ưu EOQ.
```

Không gọi đây là forecast model mới.

### 7.2 Replenishment Page

Mục tiêu:

- Đây là nơi dùng policy để ra quyết định mua hàng.
- Cần hiển thị ít chữ hơn nhưng đúng ý nghĩa hơn.

Cột/chỉ số nên có:

- SKU/Product
- Available Qty
- Demand 28d
- Reorder Point
- Safety Stock
- Target Stock
- Purchase Qty
- Estimated Cost
- Policy Source

Ẩn bớt hoặc đưa vào drawer:

- Annual Order Cost
- Annual Holding Cost
- Annual Purchase Cost
- Cycle Time Days
- EOQ nếu bảng quá chật

Nếu bảng hiện đang rối:

- Bảng chính chỉ để các field hành động.
- Chi tiết EOQ/cost mở trong side panel hoặc expandable row.

Label bắt buộc:

- Dùng `Target Stock`, không dùng `Recommended Order` trong UI chính nếu dễ gây hiểu nhầm.
- Dùng `Purchase Qty` cho số lượng cần mua.
- Dùng `Demand 28d` cho tổng forecast kỳ hiện tại.

### 7.3 Watchlist / Product Detail

Khi người dùng xem một SKU:

- Hiển thị card "Inventory Policy".
- Month 1 là tab mặc định.
- Month 2 là tab "Next horizon".

Các metric hiển thị:

- Demand 28d
- Avg daily demand
- EOQ
- Safety stock
- Reorder point
- Target stock
- Cycle time
- Total annual cost

Nếu thiếu policy:

```text
Chưa có inventory policy cho SKU này. Dashboard đang dùng fallback rule.
```

Không để lỗi `null`/`undefined` xuất hiện trên UI.

### 7.4 Model Health

Thêm section giải thích pipeline:

```text
Daily forecast -> 28-day demand bucket -> EOQ inventory policy
```

Nội dung nên làm rõ:

- N-BEATS chịu trách nhiệm dự báo demand.
- Inventory optimizer chịu trách nhiệm biến demand thành policy.
- EOQ không phải forecast model.
- Safety Stock dùng biến động lịch sử để buffer rủi ro.

Metric nên có:

- SKU coverage.
- Tổng demand month 1/month 2.
- Số SKU có target stock > 0.
- Số SKU có safety stock > 0.
- Tổng cost annualized.

### 7.5 Analytics Bot

Bot cần trả lời được các câu:

- "SKU nào nên ưu tiên đặt hàng?"
- "Vì sao SKU này có reorder point cao?"
- "Tổng chi phí tồn kho ước tính là bao nhiêu?"
- "EOQ khác gì Target Stock?"
- "Month 1 và Month 2 khác nhau thế nào?"

Bot context cần có:

- top SKU theo purchase qty,
- top SKU theo total annual cost,
- summary month 1/month 2,
- explanation ngắn về field.

Không để bot tự đọc `inventory_plan.csv` runtime.

## 8. Build Script Và Validation Plan

### 8.1 Build Script

Cập nhật `scripts/build-project-data.mjs`:

- Detect `inventory_plan.csv` ở root repo.
- Nếu file tồn tại:
  - parse,
  - validate,
  - generate `inventory-plan.json`.
- Nếu file không tồn tại:
  - generate empty dataset với metadata,
  - log warning rõ ràng,
  - không fail build nếu app vẫn muốn chạy demo.

Khuyến nghị: nếu CI/submission yêu cầu policy bắt buộc thì thêm mode strict sau, nhưng phase này chưa cần.

### 8.2 Validation Rules

Validation bắt buộc:

- Không có duplicate `(sku, month)`.
- `month` chỉ là 1 hoặc 2.
- Mỗi SKU nên có đủ 2 tháng.
- Numeric fields không tạo `NaN`.
- `D_month >= 0`.
- `Recommended_Order >= 0`.
- `Safety_Stock >= 0`.
- `Reorder_Point >= 0`.
- `Total_Annual_Cost >= 0`.

Validation với forecast:

- Gom `submission_nbeats.csv` theo SKU.
- Sum d1-d28 thành forecast month 1.
- Sum d29-d56 thành forecast month 2.
- So sánh với `D_month` trong `inventory_plan.csv`.
- Chấp nhận sai số nhỏ do rounding:

```text
abs(D_month - forecastSum) <= 0.1
```

Nếu mismatch nhiều:

- log top 10 SKU mismatch,
- không silently pass,
- build data nên fail hoặc ít nhất exit non-zero khi chạy validation strict.

### 8.3 Validation Output

Log build nên có dạng:

```text
Inventory plan:
- rows: 31944
- sku count: 15972
- month 1 demand: ...
- month 2 demand: ...
- duplicate keys: 0
- forecast mismatch rows: 0
```

## 9. Edge Cases Và Cách Xử Lý

### 9.1 SKU Không Có Policy

Behavior:

- Không crash UI.
- Replenishment dùng fallback logic cũ.
- UI hiển thị `Fallback` hoặc `Rule-based`.
- Analytics Bot nói rõ SKU chưa có inventory policy.

### 9.2 Demand Bằng 0

Behavior:

- Không tạo purchase qty nếu target stock cũng bằng 0.
- Nếu safety stock > 0 do biến động lịch sử, giải thích là buffer rủi ro.
- Không đưa SKU demand 0 lên nhóm ưu tiên mua nếu không có reason rõ.

### 9.3 Unit Cost Bằng 0 Hoặc Thiếu

Behavior:

- Dùng `unitCost` từ policy nếu `> 0`.
- Nếu `unitCost <= 0`, fallback sang product unit cost nếu có.
- Nếu vẫn không có, cost estimate = 0 và UI hiển thị cost confidence thấp.

### 9.4 Cycle Time Không Hợp Lệ

Behavior:

- `cycleTimeDays <= 0` -> `null`.
- `cycleTimeDays > 365` -> `null`.
- UI hiển thị `N/A`.

### 9.5 Budget Bằng 0

Behavior:

- `budget = 0` nghĩa là không có ngân sách mua.
- Không coi là unlimited.
- Không bulk approve dòng nào cần chi phí > 0.

### 9.6 Forecast Và Inventory Plan Lệch Version

Behavior:

- Validation phát hiện mismatch `D_month`.
- Dashboard nên có metadata source.
- Nếu mismatch vượt threshold, dev phải regenerate `inventory_plan.csv` từ forecast mới.

## 10. Implementation Phases

### Phase 1: Data Contract Và Build Data

Việc cần làm:

- Cập nhật build script để parse `inventory_plan.csv`.
- Generate `inventory-plan.json`.
- Thêm validation duplicate, numeric, month và forecast sum.
- Thêm log summary sau build.

Done khi:

- `pnpm build:data` tạo được generated JSON.
- Log cho biết số rows/SKU/month đúng.
- Validation forecast không mismatch.

### Phase 2: Project Data Helpers

Việc cần làm:

- Thêm type `InventoryOptimizationPolicy`.
- Thêm helper get policy theo SKU/product/month.
- Thêm helper summary theo month.
- Index data bằng Map để tránh scan lặp.

Done khi:

- Các helper trả đúng month 1/month 2.
- Missing SKU trả `null`.
- Summary không NaN khi dataset rỗng.

### Phase 3: Replenishment Integration

Việc cần làm:

- Nối policy vào suggestion generation.
- Đổi logic quantity:

```text
purchaseQty = max(0, targetStock - availableQty)
```

- Áp dụng MOQ/pack-size chỉ khi `purchaseQty > 0`.
- Sửa budget check để `0` không bị hiểu là unlimited.
- Thêm policy fields vào table/detail.

Done khi:

- SKU có policy dùng `inventory_plan`.
- SKU thiếu policy dùng fallback.
- Bulk approve không duyệt item excluded hoặc over-budget.

### Phase 4: Dashboard Và Detail UI

Việc cần làm:

- Thêm summary inventory optimization trên Dashboard.
- Thêm policy card ở Watchlist/Product detail.
- Điều chỉnh label để tránh nhầm `Recommended_Order`.
- Giữ UI gọn: bảng chính chỉ hiển thị field ra quyết định.

Done khi:

- Người dùng thấy được policy tồn kho mà không phải đọc CSV.
- UI không bị dày chữ hơn hiện tại.
- Month 1/Month 2 được phân biệt rõ.

### Phase 5: Analytics Bot

Việc cần làm:

- Thêm inventory summary vào bot context.
- Thêm top SKU cần mua/top cost driver.
- Thêm field explanation để bot trả lời đúng thuật ngữ.
- Đảm bảo bot dùng cùng generated data với UI.

Done khi:

- Bot trả lời được câu hỏi về EOQ, ROP, Safety Stock.
- Bot không tự parse CSV.
- Bot không gọi `Recommended_Order` là số lượng mua trực tiếp.

### Phase 6: Docs Và Review

Việc cần làm:

- Cập nhật `CLAUDE.md`.
- Cập nhật `plan.md`.
- Nếu UI plan bị ảnh hưởng, cập nhật `plan_ui.md`.
- Ghi rõ inventory optimizer là lớp sau forecast.

Done khi:

- Docs phản ánh đúng data flow mới.
- Không còn mô tả nhầm EOQ là forecast.

## 11. Test Plan Chi Tiết

### 11.1 Data Validation Tests

Chạy sau khi update build script:

- `inventory_plan.csv` parse được.
- Row count đúng kỳ vọng.
- Unique `(sku, month)` count bằng row count.
- Tất cả month đều thuộc `{1, 2}`.
- Không có numeric field là `NaN`.
- Forecast sum từ `submission_nbeats.csv` khớp `D_month`.

Case cụ thể:

- `SKU-09760`: demand month 1 phải khớp forecast validation sum hiện tại.
- Một SKU bất kỳ month 2: demand phải khớp evaluation sum.
- SKU demand thấp hoặc bằng 0: không tạo số âm.

### 11.2 Unit Tests / Logic Tests

Test helper:

- `getInventoryPolicyBySkuMonth("SKU-09760", 1)` trả policy month 1.
- `getInventoryPolicyBySkuMonth("SKU-09760", 2)` trả policy month 2.
- `getInventoryPolicyBySkuMonth("UNKNOWN", 1)` trả `null`.
- `getInventoryOptimizationSummary(1)` không NaN.
- Dataset empty vẫn không crash.

Test replenishment:

- available thấp hơn target -> purchase qty dương.
- available bằng target -> purchase qty bằng 0.
- available lớn hơn target -> purchase qty bằng 0.
- raw purchase qty bằng 0 không bị MOQ đẩy lên.
- budget 0 không approve item có cost.
- missing policy dùng fallback.

### 11.3 UI Verification

Kiểm tra thủ công trên browser:

- `/dashboard`: thấy inventory optimization summary.
- `/dashboard/replenishment`: bảng có Target Stock/Purchase Qty rõ ràng.
- Product detail/watchlist: thấy policy card.
- Model Health: pipeline forecast -> optimizer đúng.
- Analytics Bot: hỏi về EOQ/ROP trả lời đúng.

Nếu có Playwright:

- Screenshot desktop `/dashboard`.
- Screenshot desktop `/dashboard/replenishment`.
- Kiểm tra text không overflow trong các metric cards.
- Kiểm tra table không bị vỡ layout ở viewport nhỏ.

### 11.4 Build / Typecheck

Chạy:

```text
pnpm build:data
pnpm build
```

Nếu dev server local cần chạy:

```text
pnpm dev
```

Lưu ý repo hiện đã ưu tiên webpack dev script nếu Turbopack panic.

## 12. Acceptance Criteria

Feature được xem là hoàn tất khi:

- `inventory-plan.json` được generate từ `inventory_plan.csv`.
- Project data expose helper policy theo SKU/product/month.
- Replenishment dùng policy nếu có.
- Purchase qty được tính từ target stock trừ tồn kho hiện tại.
- Budget 0 không bị hiểu là unlimited.
- Dashboard có summary inventory optimization.
- UI không gọi nhầm target stock là purchase qty.
- Analytics Bot dùng cùng inventory policy data.
- Missing policy fallback không crash.
- `pnpm build:data` pass.
- Typecheck/build pass hoặc lỗi còn lại được ghi rõ.
- `CLAUDE.md` và `plan.md` được cập nhật sau implementation.

## 13. Out Of Scope Cho Phase Này

Không làm trong phase này:

- Không thay đổi công thức trong `inventory.py`.
- Không train lại N-BEATS.
- Không thêm upload CSV runtime.
- Không thêm database.
- Không thêm approval workflow thật.
- Không tự động tạo purchase order thật.
- Không tối ưu knapsack ngân sách tuyệt đối nếu chưa có yêu cầu riêng.

Nếu cần tối ưu budget thật ở phase sau, nên tách thành bài toán riêng:

```text
maximize expected margin protected
subject to total purchase cost <= budget
```

Khi đó greedy ROI hiện tại chỉ nên xem là heuristic baseline.

## 14. Rủi Ro Và Cách Giảm Thiểu

### Rủi ro 1: Người dùng hiểu nhầm `Recommended_Order`

Giảm thiểu:

- UI đổi label thành `Target Stock`.
- Tooltip giải thích đây là mức tồn kho mục tiêu.
- `Purchase Qty` là field hành động.

### Rủi ro 2: Forecast và inventory plan không cùng version

Giảm thiểu:

- Validate `D_month` với forecast sum.
- Log mismatch.
- Ghi metadata source trong generated JSON.

### Rủi ro 3: UI quá nhiều chữ

Giảm thiểu:

- Dashboard chỉ hiển thị summary.
- Replenishment table chỉ giữ action fields.
- Detail cost/EOQ đưa vào drawer hoặc expandable area.

### Rủi ro 4: Cost annualized bị hiểu là chi phí thực tế 28 ngày

Giảm thiểu:

- Label rõ `Annualized cost`.
- Không dùng annualized cost làm purchase budget trực tiếp.
- Estimated purchase cost phải dùng:

```text
purchaseQty * unitCost
```

### Rủi ro 5: Dataset lớn làm client bundle nặng

Giảm thiểu:

- Dùng compact tuple trong generated JSON.
- Chỉ expose summary/top lists cho client-heavy views nếu cần.
- Tránh import toàn bộ data vào component client nếu có thể xử lý ở server component.

## 15. Checklist Khi Implement

Data:

- [x] Parse `inventory_plan.csv`.
- [x] Generate `inventory-plan.json`.
- [x] Validate duplicate key.
- [x] Validate numeric fields.
- [x] Validate forecast sum.

Types/helpers:

- [x] Thêm `InventoryOptimizationPolicy`.
- [x] Thêm summary type.
- [x] Thêm helper theo SKU.
- [x] Thêm helper theo product.
- [x] Thêm helper summary.

Replenishment:

- [x] Nối policy vào suggestion.
- [x] Tính purchase qty từ target stock.
- [x] Không apply MOQ khi raw qty bằng 0.
- [x] Sửa budget 0.
- [x] Hiển thị policy source.

UI:

- [x] Dashboard summary.
- [x] Replenishment columns/labels.
- [x] Product detail/watchlist policy card.
- [x] Model Health pipeline section.
- [x] Bot context.

Docs/tests:

- [ ] `pnpm build:data`.
- [ ] `pnpm build`.
- [x] Cập nhật `CLAUDE.md`.
- [ ] Cập nhật `plan.md`.
- [ ] Ghi lại known limitations nếu còn.
