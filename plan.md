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

## Nguyên tắc thiết kế lại

- Mọi màn hình phải trả lời một câu hỏi vận hành cụ thể.
- KPI ưu tiên tiền, tác động lợi nhuận, chi phí và deadline hành động.
- Không dùng dữ liệu enrichment như sự thật thô. Luôn gắn nhãn dữ liệu cuộc thi, dữ liệu lịch ngoài, và danh mục bổ sung.
- Giảm giao diện kiểu template. Tăng cảm giác sản phẩm vận hành thật: bảng quyết định, mô phỏng ngân sách, giải thích khuyến nghị.
- Không giữ nút/chức năng giả nếu demo không dùng được.

## P0 - Chuẩn hóa nền tảng UI và dữ liệu

Mục tiêu: làm sạch trải nghiệm hiện tại trước khi thêm chức năng lớn.

- [x] Sửa toàn bộ lỗi encoding/mojibake trong UI tiếng Việt.
- [x] Chuẩn hóa thuật ngữ:
  - "Lợi nhuận có nguy cơ mất"
  - "Vốn bị khóa"
  - "Rủi ro thiếu hàng"
  - "Tồn kho dư"
  - "Khuyến nghị đặt hàng"
  - "Dữ liệu cuộc thi"
  - "Danh mục bổ sung"
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
- Dashboard chính chuyển sang layout enterprise: KPI tiền, bảng quyết định, bảng tối ưu vốn, ngân sách theo nhà cung cấp/danh mục, và nhãn nguồn dữ liệu.
- Các bảng chính dùng overflow ngang và grid responsive để giữ khả năng scan trên desktop/mobile.

## P1 - Executive Profit Command Center

Mục tiêu: thay dashboard hiện tại bằng màn hình điều hành lợi nhuận.

Các KPI cần có:

- [x] Lợi nhuận có nguy cơ mất do stockout.
- [x] Vốn bị khóa do overstock.
- [x] Chi phí tồn kho ước tính.
- [x] Lợi nhuận kỳ vọng nếu duyệt các khuyến nghị đặt hàng.
- [x] Số SKU cần hành động trong 7 ngày tới.
- [x] Tỷ lệ ngân sách đề xuất theo mức ưu tiên.

Các khối UI:

- [x] "Cần hành động ngay" - top SKU theo tác động tài chính.
- [x] "Cơ hội tối ưu vốn" - SKU tồn dư nên giảm mua/xả hàng.
- [x] "Dòng tiền mua hàng" - tổng chi phí đề xuất theo nhà cung cấp/danh mục.
- [x] "Nguồn dữ liệu" - compact label: dữ liệu cuộc thi, lịch ngoài, danh mục bổ sung.

Xóa/giảm:

- [x] Xóa "Truy cập nhanh" nếu không còn cần.
- [x] Đưa chart category xuống phụ hoặc gắn nhãn enrichment rõ.

Đã thực hiện:

- Thay `/dashboard` bằng Executive Profit Command Center.
- Thêm `getProfitCommandCenter()` trong `lib/project-data/index.ts` để gom KPI lợi nhuận, vốn bị khóa, holding cost, profit saved, action SKU, budget mix, supplier budget, và category budget.
- Bỏ chart danh mục cũ khỏi dashboard chính; phần danh mục còn lại chỉ nằm trong "Dòng tiền mua hàng" và được gắn nhãn "Danh mục bổ sung".
- Dữ liệu thật và enrichment được tách nhãn rõ: dữ liệu cuộc thi, lịch ngoài, danh mục bổ sung.

## P2 - Decision Queue

Mục tiêu: tạo một hàng đợi hành động để người dùng biết nên làm gì trước.

Mỗi action cần có:

- [x] SKU.
- [x] Loại hành động: đặt hàng, giảm mua, xả hàng, theo dõi.
- [x] Tác động tài chính ước tính.
- [x] Độ khẩn cấp.
- [x] Deadline hành động.
- [x] Lý do.
- [x] Confidence hoặc mức tin cậy.
- [x] Nguồn dữ liệu/giả định.

Tính năng:

- [x] Sort mặc định theo tác động tài chính.
- [x] Filter theo loại hành động, danh mục, nhà cung cấp, mức ưu tiên.
- [x] Bulk select và approve.
- [x] Drawer chi tiết giải thích vì sao hệ thống đề xuất hành động.

Đã thực hiện:

- Thêm `/dashboard/decision-queue` với bảng hành động ưu tiên theo tác động tài chính.
- Thêm `DecisionQueueItem`, `decisionQueueItems`, và `getDecisionQueueItems()` để gom stockout/replenishment, overstock, slow-moving thành các hành động đặt hàng, giảm mua, xả hàng hoặc theo dõi.
- Bảng hỗ trợ search, sort, pagination, checkbox select, duyệt từng dòng và duyệt hàng loạt.
- Drawer chi tiết hiển thị SKU, hành động, tác động tài chính, deadline, lý do, confidence, nguồn dữ liệu và giả định enrichment.

## P3 - Profit-Aware Replenishment

Mục tiêu: biến trang đặt hàng thành công cụ tối ưu ngân sách.

Metric bổ sung:

- [ ] Gross margin theo SKU.
- [ ] Lost sales risk.
- [ ] Holding cost.
- [ ] Expected profit saved.
- [ ] Purchase cost.
- [ ] ROI của khuyến nghị.
- [ ] Days until stockout.

Tính năng:

- [ ] Budget slider: "Nếu chỉ có X VND, nên mua gì trước?"
- [ ] Tối ưu danh sách đặt hàng theo ROI/tác động lợi nhuận.
- [ ] Hiển thị trade-off: ngân sách, lợi nhuận bảo vệ, số SKU tránh stockout.
- [ ] Ràng buộc lead time và MOQ.
- [ ] So sánh trước/sau khi duyệt đề xuất.

UI nên chuyển từ card grid sang:

- [ ] Summary trên cùng.
- [ ] Decision table ở giữa.
- [ ] Panel mô phỏng ngân sách bên phải hoặc phía trên.

## P4 - Forecast Page thành Forecast-to-Action

Mục tiêu: forecast không chỉ là biểu đồ, mà dẫn đến quyết định.

Cần chỉnh:

- [x] Đưa "Khuyến nghị từ dự báo" lên trên chart.
- [x] Hiển thị:
  - forecast 28/56 ngày
  - nhu cầu trung bình
  - tồn kho hiện tại
  - ngày hết hàng dự kiến
  - số lượng nên đặt
  - tác động lợi nhuận
- [x] Giữ Demand Drivers nhưng gom gọn và giải thích dễ hiểu hơn.
- [x] Bỏ "Độ chính xác 92.5%" nếu không có nguồn thật.
- [x] Thay bằng backtest/WRMSSE hoặc nhãn "demo estimate" nếu cần.
- [x] Thêm chế độ xem "SKU có tác động cao" thay vì chỉ chọn sản phẩm thủ công.

Đã thực hiện:

- Trang Forecast đã chuyển sang Forecast-to-Action: khuyến nghị AI nằm trên chart, kèm forecast, nhu cầu trung bình, tồn kho hiện tại, ngày dự kiến hết hàng, số lượng nên đặt và tác động lợi nhuận.
- Thêm chế độ "SKU tác động cao" để chọn nhanh các SKU có lợi nhuận có nguy cơ mất lớn.
- Demand Drivers được gom gọn, có nhãn nguồn dữ liệu và nhãn giả định cho lịch/danh mục.
- Bỏ "Độ chính xác 92.5%" không có nguồn thật; thay bằng nguồn forecast N-BEATS và nhãn demo estimate.
- `app/api/forecast-recommendation/route.ts` dùng chung `getAnalyticsModel()` với AnalyticsBot, nên cùng nguồn model/API key với chatbot.
- Output "Khuyến nghị từ AI" được khóa còn đúng 5 bullet theo góc nhìn chuyên gia phân tích kinh doanh, tài chính và dữ liệu; UI không hiển thị token usage.

## P5 - Watchlist thành Risk & Cost Monitor

Mục tiêu: cảnh báo phải gắn với tiền và hành động.

Cần chỉnh:

- [ ] Sort mặc định theo estimated impact.
- [ ] Tách rõ ba loại rủi ro:
  - thiếu hàng làm mất doanh thu/lợi nhuận
  - tồn dư khóa vốn
  - bán chậm gây chi phí lưu kho
- [ ] Thêm action nhanh:
  - tạo đề xuất đặt hàng
  - đánh dấu theo dõi
  - chuyển sang xả hàng
- [ ] Bảng cần có cột:
  - tác động tài chính
  - ngày tồn kho còn lại
  - forecast 28/56 ngày
  - đề xuất hành động
  - nguồn dữ liệu

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

- [ ] "Nếu ngân sách mua hàng là 500 triệu, nên ưu tiên SKU nào?"
- [ ] "Top 10 SKU có nguy cơ mất lợi nhuận cao nhất là gì?"
- [ ] "SKU nào đang khóa vốn tồn kho nhiều nhất?"
- [ ] "Giải thích vì sao nên đặt hàng SKU này."
- [ ] "Tuần tới logistics cần xử lý những đơn nào?"

Tool cần bổ sung:

- [ ] getProfitRiskSummary
- [ ] getDecisionQueue
- [ ] optimizeReplenishmentBudget
- [ ] explainRecommendation
- [ ] getModelHealth

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
- [x] Dữ liệu thật và dữ liệu enrichment được gắn nhãn rõ.
- [x] `pnpm.cmd build:data` pass.
- [x] `pnpm.cmd exec tsc --noEmit` pass.
- [x] `pnpm.cmd build` pass.
