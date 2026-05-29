# Plan triển khai sản phẩm HBAAC

## Mục tiêu sản phẩm

Xây dựng một sản phẩm dữ liệu doanh nghiệp cho nhà phân phối phụ tùng ô tô, lấy dự báo nhu cầu làm lõi nhưng chuyển trọng tâm từ "xem forecast" sang "ra quyết định tối ưu lợi nhuận".

Luận điểm chính khi demo:

> Dự báo chính xác chỉ là đầu vào. Giá trị kinh doanh nằm ở việc giảm mất doanh thu do thiếu hàng, giảm vốn bị khóa do tồn kho dư, và ưu tiên ngân sách mua hàng cho các SKU có tác động lợi nhuận cao nhất.

## Định hướng chấm điểm từ HBAAC.final.pdf

- Kỹ thuật: chứng minh năng lực dự báo, xử lý SKU thưa, cải thiện WRMSSE, độ tin cậy mô hình.
- Sản phẩm: demo trực tiếp một workflow hoàn chỉnh, thực tế với kinh doanh và logistics.
- Lộ trình: có kế hoạch triển khai POC, pilot, rollout, KPI và rủi ro.
- Trình bày: câu chuyện rõ, tập trung vào giá trị tiền và hành động.

`plan_fix.md` là hướng chỉnh mới: giữ data contract nghiêm ngặt để mọi con số là số thật, nhưng primary UI không cần phô tên file nguồn; giao diện nên để số liệu, tác động tài chính và quyết định vận hành tự nói lên giá trị.

## Nguyên tắc thiết kế lại

- Mọi màn hình phải trả lời một câu hỏi vận hành cụ thể.
- KPI ưu tiên tiền, tác động lợi nhuận, chi phí và deadline hành động.
- Dự án chỉ dùng số liệu thật từ `train.csv`, `submission_nbeats.csv`, và `inventory.py`/`inventory_plan.csv`. UI không cần phô tên file nguồn ở màn hình chính; các con số phải tự nói lên giá trị. Không hardcode số giả cho category, brand, supplier, current stock, lead time, MOQ, warehouse hoặc PO workflow.
- Có thể dùng copy, nhãn workflow, icon, màu sắc và cách kể chuyện theo bối cảnh Công ty X để sản phẩm thuyết phục hơn, miễn là không biến giả định thành con số hoặc fact vận hành.
- Giảm giao diện kiểu template. Tăng cảm giác sản phẩm vận hành thật: bảng quyết định, mô phỏng ngân sách, giải thích khuyến nghị.
- Không giữ nút/chức năng giả nếu demo không dùng được.

## P0 - Chuẩn hóa nền tảng UI và dữ liệu

Mục tiêu: làm sạch trải nghiệm hiện tại trước khi thêm chức năng lớn.

- [x] Sửa toàn bộ lỗi encoding/mojibake trong UI tiếng Việt.
- [x] Chuẩn hóa thuật ngữ:
  - "Lợi nhuận có nguy cơ mất"
  - "Holding cost annualized"
  - "Forecast cần mua"
  - "Recommended_Order"
  - "Khuyến nghị đặt hàng"
  - "Tác động tài chính"
  - "Độ tin cậy dữ liệu"
- [x] Loại bỏ hoặc implement các nút chưa có tác dụng:
  - Refresh
  - Xuất CSV
  - Xem đơn hàng
  - Tạo đơn hàng trong menu nếu chưa có flow
- [x] Thống nhất layout dashboard theo kiểu enterprise: ít card trang trí, nhiều bảng/quyết định có thể scan nhanh.
- [x] Kiểm tra responsive desktop/mobile cho các bảng và card chính.

Đã thực hiện:

- Chuẩn hóa copy tiếng Việt trong dashboard, watchlist, replenishment, sidebar, AnalyticsBot prompt gợi ý, và nhãn danh mục sản phẩm.
- Bỏ các nút/chức năng chưa có flow thật: refresh/export CSV ở forecast, "Xem đơn hàng" ở replenishment, và menu tạo đơn hàng trong watchlist.
- Dashboard chính chuyển sang layout enterprise: KPI tiền, bảng quyết định, ngân sách theo priority/policy, và wording business-first thay vì nhãn nguồn dài.
- Các bảng chính dùng overflow ngang và grid responsive để giữ khả năng scan trên desktop/mobile.

## P1 - Executive Profit Command Center

Mục tiêu: thay dashboard hiện tại bằng màn hình điều hành lợi nhuận.

Các KPI cần có:

- [x] Lợi nhuận có thể bảo vệ theo forecast và Recommended_Order.
- [x] Holding cost annualized từ `inventory_plan.csv`.
- [x] Chi phí tồn kho/tổng cost từ output optimizer.
- [x] Lợi nhuận kỳ vọng nếu duyệt các khuyến nghị đặt hàng.
- [x] Số SKU có Recommended_Order.
- [x] Tỷ lệ ngân sách đề xuất theo mức ưu tiên.

Các khối UI:

- [x] "Cần hành động ngay" - top SKU theo tác động tài chính.
- [x] "Cơ hội tối ưu vốn" - holding cost/safety stock cao theo inventory.py.
- [x] "Dòng tiền mua hàng" - tổng chi phí đề xuất theo priority/source policy.
- [x] Trạng thái dữ liệu/tin cậy gọn, không lặp tên file nguồn ở primary UI.

Xóa/giảm:

- [x] Xóa "Truy cập nhanh" nếu không còn cần.
- [x] Bỏ/giảm chart category nếu không có catalog thật; ưu tiên bảng quyết định và KPI tiền.

Đã thực hiện:

- Thay `/dashboard` bằng Executive Profit Command Center.
- Thêm `getProfitCommandCenter()` trong `lib/project-data/index.ts` để gom KPI lợi nhuận, holding cost, profit saved, action SKU và budget mix từ 3 nguồn chính.
- Bỏ chart danh mục/supplier giả khỏi dashboard chính.
- Dữ liệu hiện được khóa theo 3 nguồn ở tầng tính toán; primary UI trình bày bằng ngôn ngữ kinh doanh thay vì liệt kê file nguồn.

## P2 - Decision Queue

Mục tiêu: tạo một hàng đợi hành động để người dùng biết nên làm gì trước.

Mỗi action cần có:

- [x] SKU.
- [x] Loại hành động: đặt hàng, giảm mua, xả hàng, theo dõi.
- [x] Tác động tài chính ước tính.
- [x] Độ khẩn cấp.
- [x] Ngày dữ liệu/cycle time nếu có trong inventory plan.
- [x] Lý do.
- [x] Confidence hoặc mức tin cậy.
- [x] Giải thích/tin cậy khi cần, nhưng không chiếm primary UI bằng nhãn nguồn dài.

Tính năng:

- [x] Sort mặc định theo tác động tài chính.
- [x] Filter theo loại hành động, source category trung lập và mức ưu tiên.
- [x] Bulk select và approve.
- [x] Drawer chi tiết giải thích vì sao hệ thống đề xuất hành động.

Đã thực hiện:

- Thêm `/dashboard/decision-queue` với bảng hành động ưu tiên theo tác động tài chính.
- Thêm `DecisionQueueItem`, `decisionQueueItems`, và `getDecisionQueueItems()` để gom stockout/replenishment, overstock, slow-moving thành các hành động đặt hàng, giảm mua, xả hàng hoặc theo dõi.
- Bảng hỗ trợ search, sort, pagination, checkbox select, duyệt từng dòng và duyệt hàng loạt.
- Drawer chi tiết hiển thị SKU, hành động, tác động tài chính, ngày dữ liệu/cycle time, lý do và confidence; nguồn dữ liệu chỉ nên nằm trong phần kỹ thuật/tooltip nếu cần.

## P3 - Profit-Aware Replenishment

Mục tiêu: biến trang đặt hàng thành công cụ tối ưu ngân sách.

Metric bổ sung:

- [x] Gross margin theo SKU.
- [x] Lost sales risk.
- [x] Holding cost.
- [x] Expected profit saved.
- [x] Purchase cost.
- [x] ROI của khuyến nghị.
- [x] Cycle_Time_days nếu có trong `inventory_plan.csv`.

Tính năng:

- [x] Budget slider: "Nếu chỉ có X VND, nên mua gì trước?"
- [x] Tối ưu danh sách đặt hàng theo ROI/tác động lợi nhuận.
- [x] Hiển thị trade-off: ngân sách, lợi nhuận bảo vệ, số SKU có Recommended_Order.
- [x] Không dùng lead time/MOQ vì 3 nguồn không có dữ liệu thật cho các field này.
- [x] So sánh trước/sau khi duyệt đề xuất.

UI nên chuyển từ card grid sang:

- [x] Summary trên cùng.
- [x] Decision table ở giữa.
- [x] Panel mô phỏng ngân sách bên phải hoặc phía trên.

Đã thực hiện:

- Trang `/dashboard/replenishment` đã chuyển từ card grid sang summary KPI, panel mô phỏng ngân sách và decision table.
- Mỗi khuyến nghị dùng gross margin từ `train.csv`, forecast từ `submission_nbeats.csv`, Recommended_Order/EOQ/Safety/ROP/cost từ `inventory_plan.csv`, rồi tính expected profit saved, purchase cost và ROI.
- Budget slider mô phỏng ngân sách mua hàng; danh sách được ưu tiên theo ROI và hiển thị SKU được mua, chi phí mua hàng, lợi nhuận bảo vệ, ngân sách còn lại và lợi nhuận bị bỏ lỡ.
- Decision table hỗ trợ sort theo ROI, lợi nhuận bảo vệ, chi phí, Cycle_Time_days, margin và mức ưu tiên.
- Approval/skip là state demo phía client, dùng để so sánh trạng thái trước/sau duyệt trong phiên hiện tại; chưa tạo purchase order thật.

Review notes:

- Budget optimizer hiện dùng greedy ROI-first, phù hợp demo "nên mua gì trước" nhưng chưa phải tối ưu knapsack tuyệt đối.
- Edge case ngân sách 0 VND đã được xử lý bằng `budget !== null`; khi ngân sách là 0, toàn bộ SKU nằm ngoài ngân sách và bulk approve bị disable nếu không có SKU nào được chọn.

## P4 - Forecast Page thành Forecast-to-Action

Mục tiêu: forecast không chỉ là biểu đồ, mà dẫn đến quyết định.

Cần chỉnh:

- [x] Đưa "Khuyến nghị từ dự báo" lên trên chart.
- [x] Hiển thị:
  - forecast 28/56 ngày
  - nhu cầu trung bình
  - Reorder_Point
  - Cycle_Time_days nếu có
  - Recommended_Order
  - tác động lợi nhuận
- [x] Giữ Demand Drivers nhưng gom gọn và giải thích dễ hiểu hơn.
- [x] Bỏ "Độ chính xác 92.5%" nếu không có nguồn thật.
- [x] Thay bằng backtest/WRMSSE hoặc nhãn "demo estimate" nếu cần.
- [x] Thêm chế độ xem "SKU có tác động cao" thay vì chỉ chọn sản phẩm thủ công.

Đã thực hiện:

- Trang Forecast đã chuyển sang Forecast-to-Action: khuyến nghị AI nằm trên chart, kèm forecast, nhu cầu trung bình, Reorder_Point, Recommended_Order, Cycle_Time_days và tác động lợi nhuận.
- Thêm chế độ "SKU tác động cao" để chọn nhanh các SKU có lợi nhuận có nguy cơ mất lớn.
- Demand Drivers được gom gọn theo ngôn ngữ kinh doanh; không dùng danh mục/supplier/brand giả làm fact định lượng.
- Bỏ "Độ chính xác 92.5%" không có nguồn thật; thay bằng nguồn forecast N-BEATS và nhãn demo estimate.
- `app/api/forecast-recommendation/route.ts` dùng chung `getAnalyticsModel()` với AnalyticsBot, nên cùng nguồn model/API key với chatbot.
- Output "Khuyến nghị từ AI" được khóa còn đúng 5 bullet theo góc nhìn chuyên gia phân tích kinh doanh, tài chính và dữ liệu; UI không hiển thị token usage.

## P5 - Watchlist thành Risk & Cost Monitor

Mục tiêu: cảnh báo phải gắn với tiền và hành động.

Cần chỉnh:

- [x] Sort mặc định theo estimated impact.
- [x] Tách rõ ba loại rủi ro:
  - thiếu hàng làm mất doanh thu/lợi nhuận
  - tồn dư khóa vốn
  - bán chậm gây chi phí lưu kho
- [x] Thêm action nhanh:
  - tạo đề xuất đặt hàng
  - đánh dấu theo dõi
  - chuyển sang xả hàng
- [x] Bảng cần có cột:
  - tác động tài chính
  - chu kỳ EOQ / cycle time từ inventory.py
  - forecast 28/56 ngày
  - đề xuất hành động
  - trạng thái/tin cậy nếu cần

Đã thực hiện:

- Trang Watchlist đã chuyển thành Risk & Cost Monitor: "Risk & Cost Monitor" với mô tả "Cảnh báo gắn với tác động tài chính".
- Summary cards được reframe theo ngôn ngữ tiền: "Thiếu hàng — Mất doanh thu & LN", "Tồn dư — Khóa vốn lưu động", "Bán chậm — Chi phí lưu kho".
- Bảng sort mặc định theo estimatedImpact giảm dần.
- Thêm cột FC 28d, FC 56d, Loại rủi ro (với mô tả tài chính), và trạng thái/tin cậy gọn nếu cần.
- Quick actions: "Đặt hàng" (thiếu hàng), "Xả hàng" (tồn dư/bán chậm), "Theo dõi" (tất cả). Mỗi action có dialog xác nhận và badge trạng thái sau khi thực hiện.

## P6 - Model Health & Trust

Mục tiêu: ăn điểm kỹ thuật và tăng niềm tin doanh nghiệp.

Nội dung:

- [ ] Trang hoặc panel "Sức khỏe mô hình".
- [ ] WRMSSE/backtest score.
- [ ] Forecast bias.
- [ ] Top SKU forecast tốt/xấu.
- [ ] Sparse SKU handling.
- [ ] Calendar features.
- [ ] Return handling.
- [ ] Sunday/closed-day effect nếu dùng.
- [ ] N-BEATS/ensemble narrative từ bài thi.

Demo narrative:

- [ ] "Mô hình không chỉ dự báo tổng lượng, mà ưu tiên SKU có trọng số lợi nhuận cao."
- [ ] "Sai số được theo dõi theo SKU để phát hiện drift và tái huấn luyện."

## P7 - AnalyticsBot thành trợ lý điều hành

Mục tiêu: bot hỗ trợ workflow ra quyết định, không chỉ hỏi đáp số liệu.

Câu hỏi gợi ý mới:

- [x] "Nếu ngân sách mua hàng là 500 triệu, nên ưu tiên SKU nào?"
- [x] "Top 10 SKU có nguy cơ mất lợi nhuận cao nhất là gì?"
- [x] "SKU nào đang khóa vốn tồn kho nhiều nhất?"
- [x] "Giải thích vì sao nên đặt hàng SKU này."
- [x] "Tuần tới logistics cần xử lý những đơn nào?"

Tool cần bổ sung:

- [x] getProfitRiskSummary
- [x] getDecisionQueue
- [x] optimizeReplenishmentBudget
- [x] explainRecommendation
- [x] getModelHealth
- [x] getInventoryPolicy

Đã thực hiện:

- AnalyticsBot có prompt gợi ý workflow về ngân sách, rủi ro lợi nhuận, đặt hàng và model trust.
- `lib/ai/tools.ts` đã có decision queue, ROI-first budget simulation, recommendation explanation, model health, implementation roadmap và inventory policy.
- Bot dùng cùng generated project data với UI; policy EOQ/ROP/Safety/Recommended_Order không parse CSV runtime.
- Chat UI render compact card cho replenishment, forecast và inventory policy để giải thích Recommended_Order, Purchase Qty, ROP, Safety Stock và EOQ.

## P8 - Implementation Roadmap Page

Mục tiêu: đáp ứng phần lộ trình triển khai trong PDF.

Cấu trúc:

- [ ] Hiện trạng giả định của Công ty X.
- [ ] POC 4 tuần:
  - kết nối dữ liệu bán hàng/tồn kho
  - chạy forecast batch
  - dashboard thử nghiệm
- [ ] Pilot 8-12 tuần:
  - áp dụng cho nhóm SKU giá trị cao
  - đo stockout, overstock, forecast error
- [ ] Rollout 3-6 tháng:
  - tích hợp ERP/WMS
  - phân quyền
  - alert automation
  - retraining định kỳ
- [ ] KPI thành công:
  - giảm WRMSSE
  - giảm stockout
  - giảm vốn tồn kho
  - tăng service level
  - giảm thời gian ra quyết định
- [ ] Rủi ro và phương án dự phòng:
  - dữ liệu thiếu/chậm
  - forecast drift
  - người dùng không tin mô hình
  - thay đổi lead time

## P9 - Demo Script 5-7 phút

Luồng demo đề xuất:

1. Mở Executive Profit Command Center.
2. Chỉ ra tổng lợi nhuận có nguy cơ mất và vốn đang bị khóa.
3. Mở Decision Queue, chọn top action có tác động cao nhất.
4. Mở chi tiết SKU để xem forecast, demand drivers và lý do đề xuất.
5. Chuyển sang Replenishment, đặt budget và tối ưu danh sách mua.
6. Hỏi AnalyticsBot: "Nếu chỉ có 500 triệu, nên mua SKU nào trước?"
7. Kết thúc bằng expected profit saved/cost avoided và roadmap triển khai.

## Thứ tự triển khai khuyến nghị

1. P0 - Chuẩn hóa UI/copy.
2. P1 - Executive Profit Command Center.
3. P2 - Decision Queue.
4. P3 - Profit-Aware Replenishment.
5. P4 - Forecast-to-Action.
6. P7 - AnalyticsBot decision tools.
7. P6 - Model Health.
8. P8 - Roadmap Page.
9. P9 - Demo Script.

## Definition of Done

- [ ] Mỗi màn hình có mục tiêu kinh doanh rõ ràng.
- [x] Các KPI chính đều quy đổi được sang tiền hoặc hành động.
- [ ] Demo có một workflow hoàn chỉnh từ cảnh báo đến quyết định.
- [x] UI không còn nút giả gây gãy demo.
- [x] Các con số quan trọng đều là số thật hoặc phép tính deterministic; UI không cần lặp nhãn nguồn file ở primary cards/tables.
- [x] `pnpm.cmd build:data` pass.
- [x] `pnpm.cmd exec tsc --noEmit` pass.
- [x] `pnpm.cmd build` pass.
