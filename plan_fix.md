# Plan Fix: Real Numbers, Product-First Demo

## Mục tiêu

Chỉnh hướng sản phẩm theo đúng yêu cầu demo Final Round HBAAC: giao diện phải giống một sản phẩm dữ liệu vận hành thật, tập trung vào quyết định kinh doanh, nhưng toàn bộ con số hiển thị phải trace được về dữ liệu thật hoặc phép tính deterministic từ dữ liệu thật.

Không cần lặp lại kiểu nhãn "Nguồn: train.csv + submission_nbeats.csv + inventory.py" trên UI chính. Người dùng và giám khảo chỉ cần thấy các con số, quyết định, tác động tài chính và workflow đủ thuyết phục. Data lineage giữ ở tầng engineering, Model Health, tooltip kỹ thuật hoặc tài liệu trình bày khi cần giải thích.

## Nguyên tắc mới

### 1. Số liệu thật là bắt buộc

Mọi con số xuất hiện trong dashboard, forecast, replenishment, watchlist, model health và AnalyticsBot phải thuộc một trong các nhóm:

- Trường trực tiếp từ dữ liệu giao dịch: ngày, SKU, quantity, unit price, sales amount, unit cost, cost amount.
- Dự báo từ model hiện có: forecast daily/horizon từ file submission.
- Kế hoạch tồn kho từ optimizer: EOQ, Safety_Stock, Reorder_Point, Recommended_Order, Cycle_Time_days, annual order/holding/purchase/total cost.
- Chỉ số tổng hợp deterministic: doanh thu, lợi nhuận gộp, margin, forecast 28/56 ngày, purchase cost, profit protected, ROI, budget selected/excluded, SKU count, coverage, return quantity, sparse SKU count.
- Kịch bản người dùng nhập: ngân sách mô phỏng, filter, sort, approve/skip trong phiên demo.

Không hardcode các số kiểu "accuracy 92.5%", "service level 98%", "lead time 14 ngày", "MOQ 50", "current stock 1,200" nếu không có dữ liệu thật hoặc phép tính rõ ràng.

### 2. UI không cần phô nguồn file

Primary UI nên dùng nhãn sản phẩm tự nhiên:

- "Dự báo nhu cầu"
- "Kế hoạch đặt hàng"
- "Lợi nhuận có thể bảo vệ"
- "Chi phí tồn kho annualized"
- "SKU cần xử lý"
- "Đề xuất ưu tiên"
- "Độ tin cậy dữ liệu"
- "Tác động tài chính"

Tránh lặp các nhãn dài như:

- "Nguồn: train.csv + submission_nbeats.csv + inventory.py"
- "Dữ liệu cuộc thi + inventory.py"
- "source-backed"

Các nhãn nguồn chỉ dùng ở:

- Model Health / Trust khi cần giải thích kiểm định.
- Tooltip hoặc drawer kỹ thuật.
- `CLAUDE.md`, `plan.md`, docs nội bộ.
- Câu trả lời khi người dùng hỏi dữ liệu đến từ đâu.

### 3. Có thể dùng "hoa lá cành" cho trải nghiệm, nhưng không dùng để bịa số

Được phép polish sản phẩm bằng:

- Tên module, title, subtitle, icon, màu sắc, layout, trạng thái workflow.
- Copy nghiệp vụ như "ưu tiên xử lý", "tác động cao", "cần xem xét", "kế hoạch tháng này".
- Local UI state cho demo như approve/skip, selected rows, budget scenario.
- Storyline theo bối cảnh Công ty X trong PDF.

Không được dùng polish để biến giả định thành con số thật. Nếu cần một thông tin chưa có dữ liệu, trình bày định tính hoặc ẩn khỏi primary UI.

## Scope dữ liệu cho dự án

### Train data

Vai trò:

- Lịch sử bán hàng theo SKU/ngày.
- Quantity, doanh thu, giá bán, giá vốn.
- Gross margin và gross profit.
- Demand history, sales frequency, sparse/active SKU.
- Return/negative quantity nếu có trong dữ liệu.

Chỉ số nên dùng:

- Total sales, total quantity, gross profit.
- Average daily demand.
- Recent demand trend.
- Margin per unit.
- High-value SKU ranking.
- Slow-moving dựa trên sales history và forecast thấp.

### Forecast output

Vai trò:

- Dự báo nhu cầu theo ngày/horizon.
- Validation/evaluation forecast split nếu file có cấu trúc đó.
- Forecast 28 ngày và 56 ngày.

Chỉ số nên dùng:

- Forecast demand.
- Demand acceleration/decline.
- Top SKU theo forecast impact.
- Profit exposure = forecast demand * margin per unit.
- Coverage/consistency diagnostics.

Không nên claim:

- Observed future sales.
- Official forecast accuracy nếu chưa có ground truth.
- WRMSSE thật nếu chưa wire output backtest chính thức.

### Inventory optimizer output

Vai trò:

- Kế hoạch tồn kho từ thuật toán của partner.
- Input vào decision/replenishment layer.

Chỉ số nên dùng:

- EOQ.
- Safety_Stock.
- Reorder_Point.
- Recommended_Order.
- Cycle_Time_days.
- Annual_Order_Cost.
- Annual_Holding_Cost.
- Annual_Purchase_Cost.
- Total_Annual_Cost.

Quy tắc business:

- `Recommended_Order` là lượng đề xuất đặt theo optimizer.
- Nếu không có current stock thật thì không trừ current stock.
- Nếu không có MOQ thật thì không áp MOQ.
- Month 1 là kế hoạch mặc định cho demo; Month 2 là kế hoạch tiếp theo/forward view.

## UI Fix Plan

### P0 - Copy cleanup: bỏ phô nguồn trên primary UI

Mục tiêu: giao diện gọn hơn, bớt kỹ thuật, số liệu tự nói lên giá trị.

Việc cần làm:

- Rà toàn bộ `app/dashboard/*`, `components/dashboard/*`, `components/analytics-bot/*`.
- Bỏ hoặc thu gọn các dòng kiểu "Nguồn: train.csv + submission_nbeats.csv + inventory.py" khỏi primary cards/tables.
- Thay bằng business labels:
  - "Đã đồng bộ"
  - "Mô hình dự báo"
  - "Kế hoạch tồn kho"
  - "Tính từ dữ liệu bán hàng"
  - "Theo kế hoạch tối ưu"
- Không xóa data contract trong code. Chỉ đổi cách trình bày.

Acceptance:

- Không có card/table chính nào bị chiếm bởi dòng nguồn dữ liệu dài.
- Người dùng vẫn hiểu chỉ số là gì mà không cần biết tên file.
- Tooltip/drawer vẫn có thể giải thích nguồn khi cần.

### P1 - Dashboard Control Tower

Mục tiêu: đáp ứng phần "Dashboard & Hệ thống cảnh báo" trong PDF bằng một màn hình điều hành rõ ràng.

First viewport nên có:

- Header ngắn: mục tiêu vận hành hôm nay.
- 4 KPI chính:
  - Lợi nhuận có thể bảo vệ.
  - Chi phí tồn kho annualized.
  - SKU cần xử lý.
  - Ngân sách mua hàng đề xuất.
- Top decision table 5-10 SKU.
- Side panel cho đề xuất ưu tiên nhất.

Không nên có:

- Dòng giải thích dài.
- Source labels lặp lại.
- Chart trang trí không phục vụ quyết định.
- Category/brand/supplier giả.

Acceptance:

- Trong 10 giây, người xem biết "nên xử lý SKU nào trước và vì sao".
- KPI đều tính từ dữ liệu thật hoặc optimizer output.
- Không có số operational giả.

### P2 - Forecast-to-Action

Mục tiêu: biến forecast thành hành động, không chỉ biểu đồ.

Nội dung chính:

- SKU selector/high-impact mode.
- Forecast 28/56 ngày.
- Nhu cầu trung bình.
- Reorder_Point.
- Recommended_Order.
- Cycle_Time_days.
- Profit impact.
- AI recommendation đúng 5 bullet.

AI recommendation:

- Không mở đầu bằng "Dựa trên train.csv...".
- Không in token usage.
- 5 bullet ngắn.
- Góc nhìn chuyên gia business/finance/data.
- Mỗi bullet phải gắn với con số đang hiển thị.
- Nếu không có dữ liệu cho current stock/lead time/MOQ, không nhắc tới chúng.

Acceptance:

- Forecast page trả lời được: "SKU này có đáng đặt hàng không, đặt bao nhiêu, tác động tiền là gì?"
- Không có accuracy giả hoặc stockout date giả.

### P3 - Replenishment Budget Simulator

Mục tiêu: demo một workflow hoàn chỉnh cho logistics/procurement.

Core flow:

1. Xem tổng chi phí mua hàng đề xuất.
2. Kéo ngân sách.
3. Bảng tự chọn SKU theo ROI-first.
4. Xem protected profit và excluded impact.
5. Approve/skip trong phiên demo.

Quy tắc số:

- Purchase qty = Recommended_Order nếu policy có.
- Purchase cost = purchase qty * unit cost.
- Protected profit = min(forecast demand, purchase qty) * margin per unit.
- ROI = protected profit / purchase cost.
- Budget selected/excluded là phép tính từ bảng hiện tại.

Acceptance:

- Ngân sách 0 không approve được SKU nào.
- Không có MOQ/lead time/current stock giả.
- Greedy ROI-first được trình bày là mô phỏng ưu tiên, không claim tối ưu tuyệt đối.

### P4 - Risk & Cost Monitor

Mục tiêu: cảnh báo có tác động tài chính, không phải danh sách alert chung chung.

Risk groups:

- Demand risk: forecast cao, margin cao, Recommended_Order cao.
- Holding-cost risk: Annual_Holding_Cost/Safety_Stock cao.
- Slow-moving risk: sales history thấp và forecast thấp.

UI:

- Summary cards gọn.
- Table sort theo estimated impact.
- Dialog chi tiết có số EOQ/Safety/ROP/Recommended_Order khi cần.
- Quick actions chỉ là demo state, không claim tạo PO thật.

Acceptance:

- Cảnh báo nào cũng có tiền hoặc quantity thật đi kèm.
- Không dùng overstock/current stock nếu không có tồn kho thật.

### P5 - Model Health & Trust

Mục tiêu: ăn điểm kỹ thuật và tăng niềm tin mà không claim quá dữ liệu.

Nên hiển thị:

- Forecast coverage.
- SKU coverage.
- Validation/evaluation split consistency nếu có.
- Sparse SKU count.
- Return/negative quantity diagnostics.
- Inventory plan validation: đủ tháng, mismatch count, invalid numeric count.
- Technical narrative về N-BEATS và optimizer.

Chỉ hiển thị WRMSSE/backtest thật khi có file output chính thức. Nếu chưa có, dùng nhãn "proxy diagnostic" hoặc chuyển sang checklist kỹ thuật.

Acceptance:

- Không có metric accuracy giả.
- Giải thích rõ mô hình đáng tin ở điểm nào và còn thiếu gì để production.

### P6 - AnalyticsBot

Mục tiêu: bot là trợ lý vận hành, không phải nơi đọc lại file nguồn.

Answer style:

- Ngắn, tối đa 5 bullet nếu là recommendation.
- Ưu tiên con số và hành động.
- Không lặp source names trừ khi người dùng hỏi.
- Luôn dùng tool/data hiện có trước khi trả lời.

Tool result cards:

- Hiển thị SKU, forecast, Recommended_Order, cost, profit, ROI.
- Không hiển thị current stock/MOQ/supplier nếu không có dữ liệu thật.
- Source note đưa vào footnote/tooltips nếu cần, không chiếm primary space.

Acceptance:

- Bot trả lời được các câu demo:
  - "Nếu có 500 triệu thì mua SKU nào trước?"
  - "SKU nào tác động lợi nhuận cao nhất?"
  - "Giải thích vì sao nên đặt SKU này."
  - "Kế hoạch tháng này có bao nhiêu SKU cần xử lý?"

### P7 - Roadmap Page

Mục tiêu: đáp ứng phần "Lộ trình triển khai" 20% điểm trong PDF.

Nội dung:

- POC 4 tuần: ingest data, chạy forecast batch, dashboard thử nghiệm.
- Pilot 8-12 tuần: top SKU giá trị cao, đo stockout/cost/profit/action time.
- Rollout 3-6 tháng: phân quyền, tích hợp ERP/WMS khi có, retraining, alert automation.
- Resources: data scientist, data engineer, frontend/fullstack, business owner.
- KPIs: WRMSSE, stockout rate, inventory cost, service level, decision lead time.
- Risks: data latency, forecast drift, adoption, missing master data.

Acceptance:

- Roadmap có mốc thời gian, nguồn lực, KPI, rủi ro.
- Không cần đưa số ngân sách triển khai nếu chưa có căn cứ; có thể dùng range định tính hoặc placeholder rõ là estimate.

## QA / Validation Checklist

### Data truth scan

- Search hardcoded fake numbers in UI copy.
- Search các phrase: "92.5%", "current stock", "MOQ", "supplier", "lead time", "stockout date".
- Mọi KPI card phải lấy từ `lib/project-data/index.ts` hoặc tool result, không hardcode.
- Mọi chart/table number phải có path tính toán rõ.

### UX scan

- Primary UI không lặp tên file nguồn.
- Header/description mỗi page không quá 1-2 dòng.
- Bảng phải scan nhanh, không bị chữ dày.
- AI output đúng 5 bullet.
- Mobile không vỡ layout ở dashboard/forecast/replenishment.

### Build checks

- `pnpm.cmd build:data`
- `pnpm.cmd exec tsc --noEmit --incremental false`
- `pnpm.cmd build`

## Definition of Done

- Dashboard trông như sản phẩm vận hành cho Công ty X, không giống báo cáo notebook.
- Tất cả con số business quan trọng đều trace được về dữ liệu thật hoặc optimizer output.
- UI không còn nhồi dòng nguồn file ở primary cards/tables.
- Không còn số giả cho accuracy, stock, lead time, MOQ, supplier, PO workflow.
- Demo có workflow hoàn chỉnh: Control Tower -> Forecast detail -> Replenishment budget -> Action -> Model Trust -> Roadmap/Bot.
- `CLAUDE.md` và `plan.md` phản ánh đúng nguyên tắc: số thật ở tầng dữ liệu, trình bày sản phẩm gọn ở tầng UI.
