# Kế hoạch Việt hóa và chính quy hóa hệ thống

Ngày lập kế hoạch: 2026-05-28

Mục tiêu của file này: biến toàn bộ ứng dụng thành một hệ thống vận hành nghiêm túc bằng tiếng Việt, không còn cảm giác là bản demo, bài thi, dashboard thử nghiệm, hoặc giao diện kỹ thuật lộ tên mô hình/dữ liệu nội bộ. Tất cả công việc tiếp theo về UI/copy/AnalyticsBot phải bám theo kế hoạch này.

## 1. Mục tiêu tổng thể

### 1.1. Trạng thái mong muốn

Ứng dụng phải được nhìn nhận như một sản phẩm hoàn chỉnh cho doanh nghiệp phụ tùng ô tô:

- Có ngôn ngữ vận hành rõ ràng bằng tiếng Việt.
- Có luồng nghiệp vụ thống nhất từ cảnh báo -> phân tích -> quyết định -> kế hoạch mua hàng -> theo dõi độ tin cậy -> lộ trình triển khai.
- Không còn chữ hoặc nhãn khiến người xem nghĩ đây là demo kỹ thuật, dữ liệu giả lập, dữ liệu cuộc thi, notebook, file CSV, hoặc mô hình nghiên cứu.
- Không còn tên mô hình cụ thể như N-BEATS trên giao diện người dùng.
- Không còn các nhãn như “demo enrichment”, “competition data”, “Train.csv”, “Forecast: N-BEATS / 56 ngày”, “Calendar”, “proxy”, “baseline”, “mock”, “fallback” trong UI hoặc câu trả lời của trợ lý.
- Mọi dữ liệu trên giao diện được trình bày như dữ liệu vận hành thật của hệ thống.

### 1.2. Nguyên tắc sản phẩm

Giao diện phải trả lời nhanh các câu hỏi vận hành:

1. Hôm nay doanh nghiệp đang có bao nhiêu lợi nhuận có nguy cơ mất?
2. Bao nhiêu vốn đang bị khóa trong tồn kho?
3. Mã hàng nào cần xử lý trước?
4. Nên đặt thêm, giảm mua, xả hàng hay theo dõi?
5. Cần bao nhiêu ngân sách mua hàng?
6. Nếu ngân sách hạn chế thì ưu tiên mã nào?
7. Dự báo có đủ tin cậy để ra quyết định không?
8. Hệ thống có thể triển khai vào vận hành thật như thế nào?

### 1.3. Phạm vi công việc

Phạm vi bao gồm:

- Toàn bộ text hiển thị trong UI.
- Sidebar, header, page title, card title, table header, button, badge, tab, drawer, dialog, empty state, loading state, error state.
- AnalyticsBot: lời chào, prompt gợi ý, system prompt, tool result renderer, câu trả lời.
- Các trang dashboard chính:
  - `/dashboard`
  - `/dashboard/decision-queue`
  - `/dashboard/forecast`
  - `/dashboard/replenishment`
  - `/dashboard/watchlist`
  - `/dashboard/model-health`
  - `/dashboard/roadmap`
  - `/analytics-bot`
- Các API prompt/copy tạo nội dung cho AI recommendation.
- Các nhãn nguồn dữ liệu, dòng mô tả dữ liệu, mô tả độ tin cậy.

Không bắt buộc đổi:

- Tên biến, type, function nội bộ nếu không render ra UI.
- Tên file hoặc route nếu đổi route gây rủi ro lớn.
- Tool name nội bộ nếu chỉ dùng trong code.
- Nội dung tài liệu kỹ thuật nội bộ như `CLAUDE.md`, `plan_ui.md`, README, trừ khi cần cập nhật sau khi hoàn tất.

## 2. Vấn đề hiện tại cần xử lý

### 2.1. Vấn đề về ngôn ngữ

Hiện hệ thống còn lẫn nhiều tiếng Anh và thuật ngữ kỹ thuật:

- Control Tower
- Decision Queue
- Forecast
- Replenishment
- Risk Monitor
- Model Trust
- Model Health
- Roadmap
- AnalyticsBot
- ROI-first simulation
- proxy consistency
- baseline delta
- data lineage
- source badges
- model narrative
- implementation roadmap

Các cụm này làm sản phẩm có cảm giác là bản demo nội bộ hoặc tài liệu kỹ thuật, không phải hệ thống vận hành hoàn chỉnh.

### 2.2. Vấn đề về dữ liệu

Hiện UI hoặc bot có thể lộ các cụm:

- Dữ liệu cuộc thi
- competition data
- train.csv
- Train.csv
- submission_nbeats.csv
- Forecast: N-BEATS / 56 ngày
- Calendar: 1.810 ngày
- Danh mục bổ sung: demo enrichment
- demo estimate
- augmented catalog
- inferred metadata
- assumptions

Các cụm này cần biến mất khỏi UI người dùng cuối. Dữ liệu phải được gọi như dữ liệu thật của hệ thống:

- Dữ liệu bán hàng
- Dữ liệu tồn kho
- Dữ liệu danh mục sản phẩm
- Lịch vận hành
- Dự báo nhu cầu
- Khuyến nghị mua hàng
- Chỉ số vận hành

### 2.3. Vấn đề về tên mô hình

Không được hiển thị tên “N-BEATS” trên UI hoặc trong câu trả lời của bot.

Lý do:

- Người vận hành cần hiểu năng lực dự báo, không cần biết tên kiến trúc mô hình.
- Tên mô hình khiến sản phẩm giống demo kỹ thuật.
- Nếu sau này thay mô hình, UI không cần đổi.

Thay bằng:

- Mô hình dự báo nhu cầu
- Hệ thống dự báo nhu cầu
- Dự báo tự động
- Dự báo nhu cầu 56 ngày
- Tín hiệu dự báo
- Chỉ số độ tin cậy dự báo

### 2.4. Vấn đề về cảm giác “demo”

Không được dùng các cụm:

- demo
- dữ liệu demo
- demo estimate
- demo enrichment
- mock
- fallback
- sample
- giả lập
- giả định demo
- bản thử nghiệm

Ngoại lệ: trang lộ trình triển khai có thể nói “giai đoạn thử nghiệm” nếu đó là nghĩa triển khai POC, nhưng không được nói dữ liệu hiện tại là dữ liệu thử nghiệm.

## 3. Bộ thuật ngữ chuẩn

### 3.1. Tên module

| Cụm hiện tại | Cụm chuẩn mới |
|---|---|
| Control Tower | Trung tâm điều hành |
| Executive Profit Command Center | Trung tâm điều hành lợi nhuận |
| Decision Queue | Hàng chờ quyết định |
| Forecast | Dự báo nhu cầu |
| Replenishment | Kế hoạch mua hàng |
| Risk Monitor | Giám sát rủi ro tồn kho |
| Watchlist | Danh sách theo dõi |
| Model Trust | Độ tin cậy dự báo |
| Model Health | Sức khỏe hệ thống dự báo |
| Roadmap | Lộ trình triển khai |
| AnalyticsBot | Trợ lý phân tích |
| Chatbot | Trợ lý phân tích |

Khuyến nghị dùng trong sidebar:

1. Trung tâm điều hành
2. Quyết định
3. Dự báo nhu cầu
4. Kế hoạch mua hàng
5. Giám sát rủi ro
6. Độ tin cậy dự báo
7. Lộ trình triển khai
8. Trợ lý phân tích

### 3.2. Thuật ngữ tài chính/vận hành

| Cụm hiện tại | Cụm chuẩn mới |
|---|---|
| Profit at risk | Lợi nhuận có nguy cơ mất |
| Capital locked | Vốn bị khóa |
| Protected profit | Lợi nhuận được bảo vệ |
| Lost profit risk | Lợi nhuận có nguy cơ mất |
| Holding cost | Chi phí lưu kho |
| Stockout risk | Rủi ro thiếu hàng |
| Overstock | Tồn kho dư |
| Slow-moving | Bán chậm |
| Purchase basket | Danh sách mua đề xuất |
| Trade-off | Phần lợi nhuận còn rủi ro |
| Budget simulator | Mô phỏng ngân sách |
| Budget scenario | Kịch bản ngân sách |
| Bulk approve | Duyệt hàng loạt |
| Pending | Chờ xử lý |
| Approved | Đã duyệt |
| Skipped | Đã bỏ qua |
| Confidence | Độ tin cậy |
| Deadline | Hạn xử lý |
| Financial impact | Tác động tài chính |
| Recommended action | Khuyến nghị xử lý |

### 3.3. Thuật ngữ dữ liệu

| Cụm hiện tại | Cụm chuẩn mới |
|---|---|
| competition data | Dữ liệu bán hàng |
| train.csv | Dữ liệu giao dịch |
| submission_nbeats.csv | Dữ liệu dự báo |
| Forecast: N-BEATS / 56 ngày | Dự báo nhu cầu 56 ngày |
| Calendar | Lịch vận hành |
| external calendar | Lịch vận hành |
| augmented catalog | Danh mục sản phẩm |
| demo enrichment | Danh mục sản phẩm |
| inferred metadata | Thông tin danh mục |
| data lineage | Nguồn dữ liệu vận hành |
| source | Nguồn dữ liệu |
| assumption | Cơ sở tính toán |
| demo estimate | Ước tính vận hành |
| proxy metric | Chỉ số theo dõi |
| baseline | Mức tham chiếu |

Lưu ý: dù bảng trên có cụm “Mức tham chiếu”, không nên dùng “baseline” hay “mức tham chiếu” quá nhiều trên UI vận hành. Nếu cần thì dùng trong trang độ tin cậy dự báo.

### 3.4. Thuật ngữ mô hình

| Cụm hiện tại | Cụm chuẩn mới |
|---|---|
| N-BEATS | Mô hình dự báo nhu cầu |
| model | hệ thống dự báo / mô hình dự báo |
| model health | sức khỏe hệ thống dự báo |
| model trust | độ tin cậy dự báo |
| drift | biến động nhu cầu |
| sparse SKU | mã hàng ít dữ liệu |
| forecast coverage | độ phủ dự báo |
| proxy accuracy | mức ổn định dự báo |
| validation | kiểm tra lại |
| retraining | cập nhật mô hình |
| backtest | kiểm tra lại dự báo |
| accuracy | độ chính xác dự báo |

Nguyên tắc: UI chính dùng ngôn ngữ vận hành. Trang độ tin cậy có thể dùng thuật ngữ kỹ thuật đã Việt hóa, nhưng phải giải thích ngắn gọn và không lộ tên mô hình cụ thể.

## 4. Nguyên tắc viết nội dung mới

### 4.1. Không dùng tiếng Anh nếu có thể Việt hóa

Tránh tất cả cụm tiếng Anh trong UI chính. Nếu bắt buộc dùng viết tắt phổ biến như SKU, KPI, ERP thì được phép giữ vì đây là thuật ngữ doanh nghiệp quen thuộc.

Được phép giữ:

- SKU
- KPI
- ERP
- WMS
- API nếu nói trong trang lộ trình kỹ thuật

Không nên giữ:

- Forecast
- Model Trust
- Decision Queue
- Roadmap
- ROI-first
- Control Tower
- Data lineage
- Backtest nếu có thể đổi thành “kiểm tra lại dự báo”

### 4.2. Không gọi dữ liệu là demo

Cấm trên UI:

- demo
- dữ liệu demo
- bản demo
- demo estimate
- demo enrichment
- mock
- fallback

Thay bằng:

- dữ liệu vận hành
- dữ liệu bán hàng
- dữ liệu tồn kho
- dữ liệu danh mục
- ước tính vận hành
- cơ sở tính toán
- thông tin danh mục

### 4.3. Không lộ file nguồn

Cấm trên UI:

- train.csv
- Train.csv
- submission_nbeats.csv
- product-summaries.json
- generated JSON
- file CSV
- dữ liệu cuộc thi

Thay bằng:

- dữ liệu bán hàng
- dữ liệu giao dịch
- dữ liệu dự báo
- dữ liệu danh mục sản phẩm

### 4.4. Không lộ tên mô hình

Cấm trên UI và bot:

- N-BEATS
- nbeats
- NBEATS
- ensemble nếu không cần thiết
- model architecture nếu không nằm trong nội dung kỹ thuật được kiểm soát

Thay bằng:

- mô hình dự báo nhu cầu
- hệ thống dự báo
- dự báo tự động
- tín hiệu dự báo
- chất lượng dự báo

### 4.5. Viết như một hệ thống thật

Nên dùng:

- “Dữ liệu đã đồng bộ”
- “Dự báo nhu cầu 56 ngày”
- “Danh mục sản phẩm đã cập nhật”
- “Lịch vận hành đã ghi nhận”
- “Mã hàng cần xử lý”
- “Khuyến nghị đặt hàng”
- “Duyệt đề xuất”
- “Theo dõi tiếp”

Không dùng:

- “dữ liệu giả lập”
- “để demo”
- “giả định”
- “ước lượng demo”
- “competition file”
- “raw file”

### 4.6. Text budget

Tiếp tục áp dụng quy tắc gọn:

- Page description: tối đa 1 dòng.
- KPI helper: tối đa 1 dòng.
- Card description: tối đa 1 dòng nếu cần.
- Drawer: không có paragraph dài hơn 3 dòng.
- AI recommendation: đúng 5 bullet, mỗi bullet 1 câu ngắn.
- Bảng: header ngắn, không wrap nhiều dòng.

## 5. Kế hoạch theo file và khu vực

## 5.1. Sidebar và layout shell

Files cần xử lý:

- `components/dashboard/sidebar.tsx`
- `app/dashboard/layout.tsx`
- `app/analytics-bot/layout.tsx`
- `components/analytics-bot/chat-widget.tsx`

### Công việc

1. Đổi toàn bộ tên nav sang tiếng Việt.
2. Đổi tên hiển thị AnalyticsBot thành “Trợ lý phân tích”.
3. Kiểm tra header nếu có dòng:
   - Data freshness
   - Model badge
   - N-BEATS forecast
   - Open AnalyticsBot
4. Thay các cụm đó bằng:
   - “Dữ liệu đã đồng bộ”
   - “Dự báo nhu cầu 56 ngày”
   - “Mở trợ lý phân tích”
5. Nếu header có search/notification/user fake, không thêm text tiếng Anh mới.

### Acceptance criteria

- Sidebar không còn chữ tiếng Anh.
- Không còn “AnalyticsBot” trên UI, trừ khi tên thương hiệu được user quyết định giữ. Mặc định đổi thành “Trợ lý phân tích”.
- Không còn tên model ở header.
- Header không có dòng gợi cảm giác dữ liệu tĩnh thô như “Data đến ngày”.

## 5.2. Trang `/dashboard` — Trung tâm điều hành lợi nhuận

File chính:

- `app/dashboard/page.tsx`

Có thể liên quan:

- component KPI dùng chung nếu có
- data lineage strip nếu tách component

### Công việc

1. Đổi title chính thành “Trung tâm điều hành lợi nhuận”.
2. Đổi mọi “Control Tower” thành “Trung tâm điều hành”.
3. Command strip dùng ngôn ngữ vận hành:
   - “Cần xử lý {count} mã hàng trong 7 ngày để bảo vệ {money} lợi nhuận.”
   - “{money} lợi nhuận có nguy cơ mất; {money} vốn đang bị khóa.”
4. KPI row giữ 4 KPI:
   - Lợi nhuận có nguy cơ mất
   - Vốn bị khóa
   - Mã hàng cần xử lý
   - Độ tin cậy dự báo
5. Bảng top decisions đổi headers:
   - Hạng
   - Mã hàng
   - Rủi ro
   - Hạn xử lý
   - Tác động
   - Khuyến nghị
   - Thao tác
6. Panel bên phải đổi thành:
   - “Việc cần làm tiếp theo”
   - “Kịch bản ngân sách”
   - “Lý do ưu tiên”
7. CTA đổi:
   - Review decisions -> Xem quyết định
   - Simulate budget -> Mô phỏng ngân sách
   - View forecast -> Xem dự báo
   - Approve -> Duyệt đề xuất
8. Data lineage strip hiện tại cần thay hoàn toàn.

### Data lineage mới

Không dùng:

- Train.csv: 15.972 SKU
- Forecast: N-BEATS / 56 ngày
- Calendar: 1.810 ngày
- Danh mục bổ sung: demo enrichment
- Dữ liệu cuộc thi

Dùng một trong hai phương án.

Phương án A — gọn:

- Dữ liệu bán hàng · Dự báo nhu cầu 56 ngày · Lịch vận hành · Danh mục sản phẩm

Phương án B — có số liệu:

- Dữ liệu bán hàng: 15.972 mã hàng
- Dự báo nhu cầu: 56 ngày
- Lịch vận hành: 1.810 ngày
- Danh mục sản phẩm: đã đồng bộ

Khuyến nghị dùng phương án A nếu first viewport đang chật; phương án B nếu cần chứng minh quy mô dữ liệu.

### Acceptance criteria

- Không còn chữ “Control Tower”.
- Không còn “demo”, “competition”, “N-BEATS”, “Train.csv”, “Calendar”, “enrichment”.
- First viewport vẫn giữ được command strip, 4 KPI, top decisions, side panel.
- Mọi CTA tiếng Việt.
- Dữ liệu được gọi như dữ liệu vận hành thật.

## 5.3. Trang `/dashboard/decision-queue` — Hàng chờ quyết định

Files:

- `app/dashboard/decision-queue/page.tsx`
- `components/dashboard/decision-queue-table.tsx`
- `components/dashboard/decision-detail-drawer.tsx`

### Công việc ở page

1. Đổi title thành “Hàng chờ quyết định”.
2. Description ngắn:
   - “Ưu tiên các mã hàng cần xử lý theo tác động tài chính và hạn xử lý.”
3. Đổi summary/toolbar:
   - Pending -> Chờ xử lý
   - High priority -> Ưu tiên cao
   - Impact -> Tác động tài chính
   - Approved -> Đã duyệt
4. Đổi filters:
   - All -> Tất cả
   - Stockout -> Thiếu hàng
   - Overstock -> Tồn kho dư
   - Slow moving -> Bán chậm
   - Watch -> Theo dõi
5. Bulk approve -> Duyệt hàng loạt.

### Công việc ở table

1. Đổi headers:
   - Priority -> Ưu tiên
   - SKU/Product -> Mã hàng
   - Action -> Khuyến nghị
   - Deadline -> Hạn xử lý
   - Impact -> Tác động
   - Confidence -> Độ tin cậy
   - Buttons -> Thao tác
2. Đổi action labels:
   - Reorder -> Đặt thêm
   - Reduce purchase -> Giảm mua
   - Clear stock -> Xả hàng
   - Watch -> Theo dõi
3. Đổi status:
   - Approved -> Đã duyệt
   - Skipped -> Đã bỏ qua
   - Pending -> Chờ xử lý

### Công việc ở drawer

Drawer phải trả lời bằng tiếng Việt:

1. “Vì sao cần xử lý ngay?”
2. “Tác động tài chính”
3. “Tín hiệu dự báo”
4. “Tình trạng tồn kho”
5. “Cơ sở dữ liệu” hoặc “Cơ sở tính toán”
6. “Khuyến nghị xử lý”

CTA drawer:

- Duyệt đề xuất
- Xem dự báo
- Mô phỏng ngân sách
- Hỏi trợ lý phân tích

Cấm trong drawer:

- assumption
- source assumptions
- demo
- competition data
- augmented catalog
- inferred metadata
- N-BEATS

Thay bằng:

- cơ sở tính toán
- dữ liệu bán hàng
- dữ liệu tồn kho
- danh mục sản phẩm
- dự báo nhu cầu

### Acceptance criteria

- Page, table, drawer không còn text tiếng Anh.
- Không còn nhãn “demo state”.
- Drawer không lộ tên mô hình hoặc file dữ liệu.
- Luồng click sang forecast/replenishment vẫn giữ đúng productId/sku.

## 5.4. Trang `/dashboard/forecast` — Dự báo nhu cầu

File chính:

- `app/dashboard/forecast/page.tsx`

Có thể liên quan:

- `components/dashboard/forecast-chart.tsx`
- `components/dashboard/product-selector.tsx`
- `app/api/forecast-recommendation/route.ts`

### Công việc UI

1. Đổi title thành “Dự báo nhu cầu”.
2. Description:
   - “Theo dõi nhu cầu, tồn kho và khuyến nghị xử lý cho từng mã hàng.”
3. Đổi AI card:
   - “AI recommendation” -> “Khuyến nghị từ hệ thống” hoặc “Khuyến nghị phân tích”
   - “Generate recommendation” -> “Tạo khuyến nghị”
   - “Ask AI why” -> “Hỏi trợ lý giải thích”
4. Đổi action panel:
   - Status -> Trạng thái
   - Stockout in N days -> Nguy cơ thiếu hàng sau N ngày
   - Healthy -> Đang ổn định
   - Forecast 28/56 -> Dự báo 28/56 ngày
   - Stock on hand -> Tồn kho hiện tại
   - Suggested order qty -> Số lượng nên đặt
   - Profit at risk -> Lợi nhuận có nguy cơ mất
   - Simulate replenishment -> Mô phỏng mua hàng
   - Add to decision queue -> Thêm vào hàng chờ
5. Đổi tabs:
   - Drivers -> Yếu tố ảnh hưởng
   - Data -> Dữ liệu
   - AI reasoning -> Giải thích khuyến nghị
6. Đổi source badges:
   - factual -> Dữ liệu ghi nhận
   - date-derived -> Theo lịch vận hành
   - assumption -> Cơ sở tính toán

### Công việc AI recommendation

Trong `app/api/forecast-recommendation/route.ts` hoặc prompt liên quan:

1. Cấm model trả lời:
   - N-BEATS
   - competition data
   - demo
   - token usage
   - file CSV
2. Bắt buộc trả lời đúng 5 bullet tiếng Việt.
3. Cấu trúc 5 bullet:
   - Rủi ro vận hành
   - Tác động tài chính
   - Tín hiệu dự báo
   - Khuyến nghị xử lý
   - Điểm cần theo dõi
4. Không nhắc “dữ liệu giả định” hay “demo”.
5. Nếu cần caveat, dùng:
   - “Cần theo dõi lại nếu nhu cầu thực tế thay đổi mạnh.”
   - “Nên rà soát khi có biến động bất thường về bán hàng hoặc tồn kho.”

### Ví dụ output đúng

- Mã hàng này có nguy cơ thiếu hàng trong ngắn hạn.
- Tác động tài chính cao do biên lợi nhuận và nhu cầu dự báo đều lớn.
- Dự báo 56 ngày vượt mức tồn kho hiện tại.
- Nên ưu tiên đặt bổ sung theo số lượng khuyến nghị.
- Cần theo dõi lại nếu nhu cầu thực tế thay đổi mạnh.

### Acceptance criteria

- Không còn “Forecast” trên UI.
- Không còn “N-BEATS”.
- Không còn token usage.
- AI output đúng 5 bullet tiếng Việt.
- Button sang kế hoạch mua hàng vẫn truyền đúng mã hàng.

## 5.5. Trang `/dashboard/replenishment` — Kế hoạch mua hàng

File:

- `app/dashboard/replenishment/page.tsx`

### Công việc

1. Đổi title thành “Kế hoạch mua hàng”.
2. Description:
   - “Mô phỏng ngân sách và ưu tiên các mã hàng bảo vệ lợi nhuận cao nhất.”
3. Đổi scenario bar:
   - Budget -> Ngân sách
   - Budget scenario -> Kịch bản ngân sách
   - Unlimited -> Không giới hạn ngân sách
   - Reset -> Đặt lại
   - No spend -> Không phân bổ ngân sách
4. Đổi basket:
   - Purchase basket -> Danh sách mua đề xuất
   - Selected by ROI-first -> Ưu tiên theo hiệu quả vốn
   - Cost -> Chi phí mua
   - Protected profit -> Lợi nhuận được bảo vệ
   - ROI -> Hiệu quả vốn
   - Deadline -> Hạn xử lý
5. Đổi trade-off panel:
   - Trade-off -> Phần lợi nhuận còn rủi ro
   - Excluded SKUs -> Mã hàng chưa được phân bổ
   - Profit left at risk -> Lợi nhuận còn rủi ro
6. Đổi table:
   - SKU/Product -> Mã hàng
   - Qty -> Số lượng
   - Purchase cost -> Chi phí mua
   - Protected profit -> Lợi nhuận bảo vệ
   - Days left -> Hạn xử lý
   - Action -> Thao tác
7. Đổi button:
   - Approve selected -> Duyệt danh sách
   - Approve -> Duyệt
   - Skip -> Bỏ qua

### Thuật ngữ quan trọng

Không dùng:

- ROI-first simulation
- optimizer
- optimal absolute
- demo estimate

Dùng:

- mô phỏng ưu tiên hiệu quả vốn
- ưu tiên theo hiệu quả vốn
- mô phỏng ngân sách
- ước tính vận hành

Lưu ý: Nếu cần giải thích thuật toán, nói ngắn:

- “Hệ thống ưu tiên mã hàng có tỷ lệ lợi nhuận được bảo vệ trên chi phí mua cao hơn.”

Không gọi là tối ưu tuyệt đối.

### Logic cần giữ nguyên

- `budget === null` nghĩa là không giới hạn ngân sách.
- `budget === 0` nghĩa là không phân bổ ngân sách.
- Nếu selected count = 0 thì không cho duyệt hàng loạt.
- Approval flow vẫn là state client-side, nhưng UI không được gọi là demo state.

### Acceptance criteria

- Không còn “Replenishment”.
- Không còn “ROI-first simulation”.
- 0 VND hiển thị như không phân bổ ngân sách.
- Không giới hạn ngân sách hiển thị rõ.
- Duyệt danh sách cập nhật trạng thái.

## 5.6. Trang `/dashboard/watchlist` — Giám sát rủi ro tồn kho

Files:

- `app/dashboard/watchlist/page.tsx`
- `components/dashboard/watchlist-table.tsx`

### Công việc

1. Đổi title thành “Giám sát rủi ro tồn kho”.
2. Description:
   - “Theo dõi thiếu hàng, tồn kho dư và mã hàng bán chậm.”
3. Đổi risk tabs:
   - Stockout -> Nguy cơ thiếu hàng
   - Overstock -> Tồn kho dư
   - Slow-moving -> Bán chậm
4. Đổi summary labels:
   - Financial impact -> Tác động tài chính
   - Count -> Số mã hàng
   - Risk type -> Loại rủi ro
5. Đổi table headers:
   - SKU/Product -> Mã hàng
   - Risk type -> Rủi ro
   - Days left -> Hạn xử lý
   - FC 28/56 -> Dự báo 28/56 ngày
   - Financial impact -> Tác động
   - Action -> Thao tác
6. Đổi quick actions:
   - Order -> Đặt hàng
   - Clear stock -> Xả hàng
   - Watch -> Theo dõi
7. Dialog confirmation:
   - “Xác nhận xử lý”
   - “Hành động này sẽ đánh dấu mã hàng là đã xử lý trong phiên làm việc hiện tại.”

### Search/filter

Search phải tìm theo:

- SKU
- tên sản phẩm
- danh mục

Nếu hiện tại CLAUDE.md nói search chỉ match SKU/product name, cần mở rộng thêm category nếu code cho phép và không gây rủi ro.

### Acceptance criteria

- Không còn “Watchlist” nếu hiển thị trên UI.
- Không còn “Risk Monitor”.
- Không còn source badge kỹ thuật lộ dữ liệu demo.
- Search SKU/product/category hoạt động.
- Dialog/action toàn tiếng Việt.

## 5.7. Trang `/dashboard/model-health` — Độ tin cậy dự báo

File:

- `app/dashboard/model-health/page.tsx`

### Mục tiêu đặc biệt

Trang này cần phục vụ tiêu chí kỹ thuật nhưng vẫn không làm sản phẩm giống báo cáo nghiên cứu. Không lộ tên mô hình. Không lộ “proxy”, “baseline”, “N-BEATS”, “official WRMSSE” trên UI chính.

### Công việc

1. Đổi title thành “Độ tin cậy dự báo”.
2. Description:
   - “Theo dõi độ phủ, biến động nhu cầu và các mã hàng cần rà soát.”
3. Trust cards:
   - Forecast coverage -> Độ phủ dự báo
   - Proxy accuracy/baseline delta -> Mức ổn định dự báo
   - Drift -> Biến động nhu cầu
   - Sparse SKU share -> Mã hàng ít dữ liệu
   - Returns rate -> Tỷ lệ hoàn trả
4. Tabs:
   - Accuracy & Backtest -> Kiểm tra dự báo
   - Drift & Monitoring -> Biến động & theo dõi
   - Sparse SKU & Returns -> Mã hàng ít dữ liệu & hoàn trả
   - Calendar & Data Lineage -> Lịch vận hành & nguồn dữ liệu
   - Model Narrative -> Năng lực hệ thống
5. Nội dung tab kiểm tra dự báo:
   - Không nói “official WRMSSE” nếu chưa có ground truth thật.
   - Không nói “proxy” trên UI chính.
   - Có thể nói “chỉ số theo dõi nội bộ” hoặc “chỉ số kiểm tra lại”.
6. Nội dung tab biến động:
   - validation vs evaluation delta -> thay bằng “mức thay đổi giữa các kỳ dự báo”
   - retraining trigger -> “điều kiện cập nhật mô hình”
7. Nội dung sparse/returns:
   - no sales SKU -> mã hàng chưa phát sinh bán
   - <=5 transactions -> mã hàng có rất ít giao dịch
   - returns SKU -> mã hàng có hoàn trả
   - total return qty -> tổng số lượng hoàn trả
   - return rate -> tỷ lệ hoàn trả
8. Nội dung calendar/data:
   - public holidays -> ngày nghỉ lễ
   - lunar events -> dịp âm lịch
   - retail events assumption -> sự kiện kinh doanh theo kế hoạch
   - competition data -> dữ liệu bán hàng
   - external calendar -> lịch vận hành
   - demo enrichment -> danh mục sản phẩm
9. Narrative:
   - Architecture: N-BEATS -> Năng lực dự báo chuỗi thời gian
   - Ensemble strategy -> Kết hợp tín hiệu dự báo
   - Sparse/cold-start handling -> Xử lý mã hàng ít dữ liệu
   - Profit-aware prioritization -> Ưu tiên theo tác động lợi nhuận
   - Future improvement -> Hướng cải tiến

### Cẩn trọng về claims

Nếu không có ground truth thật, không claim quá mạnh:

Không nói:

- “độ chính xác thực tế”
- “mô hình chính xác X%”
- “dự báo cao hơn thực tế”

Nên nói:

- “chỉ số theo dõi độ ổn định”
- “mức biến động giữa các kỳ dự báo”
- “mã hàng cần rà soát thêm”
- “tín hiệu cần theo dõi khi vận hành”

### Acceptance criteria

- Không còn “Model Health” hoặc “Model Trust” trên UI.
- Không còn “N-BEATS”.
- Không còn “proxy” trên UI chính.
- Không còn “baseline” nếu chưa Việt hóa thành ngữ cảnh vận hành.
- Return metrics vẫn dùng absolute negative quantity và format là số lượng, không phải tiền.

## 5.8. Trang `/dashboard/roadmap` — Lộ trình triển khai

File:

- `app/dashboard/roadmap/page.tsx`

### Công việc

1. Đổi title thành “Lộ trình triển khai”.
2. Description:
   - “Các giai đoạn đưa hệ thống dự báo và ra quyết định vào vận hành.”
3. Phase names:
   - POC -> Giai đoạn thử nghiệm
   - Pilot -> Thí điểm vận hành
   - Rollout -> Triển khai toàn hệ thống
4. Section labels:
   - Resource estimate -> Nguồn lực dự kiến
   - Budget estimate -> Ngân sách dự kiến
   - KPI target -> Chỉ tiêu mục tiêu
   - Risk register -> Rủi ro triển khai
   - Mitigation -> Phương án xử lý
   - Delivery checkpoint -> Mốc nghiệm thu
5. Risks:
   - Missing inventory/lead time data -> Thiếu dữ liệu tồn kho hoặc thời gian cung ứng
   - Returns distort demand -> Hoàn trả làm nhiễu nhu cầu
   - Sparse SKU/cold start -> Mã hàng ít dữ liệu hoặc mới phát sinh
   - Forecast drift -> Nhu cầu biến động mạnh
   - User distrust automation -> Người dùng chưa tin khuyến nghị tự động
   - ERP integration delay -> Tích hợp ERP chậm tiến độ
6. Nếu cần giữ POC/Pilot/Rollout vì thuật ngữ doanh nghiệp, có thể dùng dạng:
   - “Thử nghiệm POC”
   - “Thí điểm vận hành”
   - “Triển khai toàn hệ thống”

### Cấm

- demo budget
- assumptions nếu có thể thay bằng “cơ sở tính toán”
- implementation roadmap nếu hiển thị trên UI
- mock
- sample

### Acceptance criteria

- Trang có thể trình bày trong 90 giây.
- Toàn bộ nội dung chính tiếng Việt.
- Không gọi hệ thống hiện tại là demo.
- Có phase, timeline, resource, budget, KPI, risk, mitigation.

## 5.9. Trang `/analytics-bot` và ChatWidget — Trợ lý phân tích

Files:

- `app/analytics-bot/page.tsx`
- `components/analytics-bot/chat-interface.tsx`
- `components/analytics-bot/chat-widget.tsx`
- `app/api/chat/route.ts`
- `lib/ai/system-prompt.ts`
- `lib/ai/tools.ts`
- `lib/analytics-backend/normalizers.ts`
- `lib/analytics-backend/types.ts`

### Công việc UI chat

1. Đổi title thành “Trợ lý phân tích”.
2. Greeting tiếng Việt, ngắn, nghiêm túc:
   - “Tôi có thể giúp phân tích rủi ro thiếu hàng, vốn bị khóa, dự báo nhu cầu và kế hoạch mua hàng.”
3. Suggested prompts:
   - “Nếu ngân sách mua hàng là 500 triệu, nên ưu tiên mã hàng nào?”
   - “Giải thích vì sao mã hàng này cần đặt ngay.”
   - “Mã hàng nào đang có lợi nhuận rủi ro cao nhất?”
   - “Mã hàng nào đang khóa vốn tồn kho nhiều nhất?”
   - “Độ tin cậy dự báo hiện tại có điểm nào cần chú ý?”
   - “Tóm tắt tình hình vận hành hôm nay trong 60 giây.”
4. Placeholder input:
   - “Nhập câu hỏi về bán hàng, tồn kho hoặc kế hoạch mua hàng...”
5. Button labels:
   - Send -> Gửi
   - Stop -> Dừng
   - Retry -> Thử lại
   - Clear -> Xóa hội thoại

### Công việc system prompt

Trong `lib/ai/system-prompt.ts`, cần sửa để bot:

1. Luôn trả lời tiếng Việt.
2. Không nhắc tên mô hình cụ thể như N-BEATS.
3. Không nhắc file dữ liệu như train.csv, submission, generated JSON.
4. Không nói dữ liệu là demo, giả lập, cuộc thi, mock, fallback.
5. Gọi dữ liệu là:
   - dữ liệu bán hàng
   - dữ liệu tồn kho
   - dữ liệu danh mục sản phẩm
   - dữ liệu dự báo nhu cầu
   - dữ liệu vận hành
6. Trả lời khuyến nghị tối đa 5 bullet.
7. Khi cần nói về uncertainty, dùng:
   - “cần theo dõi thêm khi nhu cầu thực tế biến động”
   - “nên rà soát nếu có thay đổi lớn về tồn kho hoặc bán hàng”
8. Không hiển thị token usage.
9. Không nói “tool”, “function”, “backend”, “API” với người dùng cuối trừ khi user hỏi kỹ thuật.

### Công việc tool result renderer

Trong `components/analytics-bot/chat-interface.tsx`, kiểm tra mọi renderer:

- product forecast
- stock alerts
- replenishment suggestions
- sales analytics
- inventory summary
- product comparison
- dashboard KPIs
- decision queue
- budget simulation
- recommendation explanation
- model health
- implementation roadmap

Mỗi renderer phải:

- Có title tiếng Việt.
- Có field label tiếng Việt.
- Không lộ tên tool tiếng Anh.
- Không lộ dữ liệu demo/mô hình/file.
- Không lộ “source: competition” hoặc “source: augmented”.

### Công việc tool descriptions

Trong `lib/ai/tools.ts`, descriptions có thể là tiếng Anh nếu chỉ nội bộ cho model, nhưng vì model có thể học theo text đó, nên nên Việt hóa hoặc ít nhất tránh từ cấm.

Cần thay:

- competition data -> dữ liệu bán hàng
- N-BEATS -> hệ thống dự báo nhu cầu
- demo enrichment -> danh mục sản phẩm
- proxy -> chỉ số theo dõi
- roadmap -> lộ trình triển khai

### Acceptance criteria

- Chat page không còn “AnalyticsBot” nếu không giữ brand.
- Bot trả lời bằng tiếng Việt.
- Bot không nhắc N-BEATS, train.csv, demo, competition data.
- Tool result cards tiếng Việt.
- Prompt gợi ý theo workflow vận hành.

## 6. Danh sách chuỗi cần grep và xử lý

Sau khi sửa theo file, phải grep toàn repo để tìm các chuỗi còn sót.

### 6.1. Nhóm tên mô hình

- `N-BEATS`
- `nbeats`
- `NBEATS`
- `ensemble`
- `model architecture`

Xử lý:

- Nếu render ra UI hoặc bot: thay ngay.
- Nếu là tên file/data import/internal code: có thể giữ nếu không render.

### 6.2. Nhóm dữ liệu demo/cuộc thi

- `demo`
- `Demo`
- `competition`
- `Competition`
- `dữ liệu cuộc thi`
- `Dữ liệu cuộc thi`
- `train.csv`
- `Train.csv`
- `submission`
- `sample_submission`
- `generated`
- `demo enrichment`
- `augmented`
- `inferred`
- `assumption`
- `assumptions`
- `mock`
- `fallback`

Xử lý:

- UI/bot: thay.
- README/CLAUDE/plan: có thể giữ.
- Config/env/backend code: giữ nếu là kỹ thuật, nhưng không render.

### 6.3. Nhóm tiếng Anh UI

- `Control Tower`
- `Decision Queue`
- `Forecast`
- `Replenishment`
- `Risk Monitor`
- `Watchlist`
- `Model Trust`
- `Model Health`
- `Roadmap`
- `AnalyticsBot`
- `Profit at risk`
- `Capital locked`
- `Protected profit`
- `Budget simulator`
- `Purchase basket`
- `Trade-off`
- `ROI-first`
- `Data lineage`
- `source badge`
- `token usage`
- `baseline`
- `proxy`
- `backtest`
- `drift`

Xử lý:

- UI/bot: thay bằng tiếng Việt.
- Internal variable: không cần thay nếu không render.

### 6.4. Nhóm nhãn action/status

- `Approve`
- `Approved`
- `Pending`
- `Skipped`
- `Skip`
- `Review`
- `Simulate`
- `Ask bot`
- `View forecast`
- `Generate`
- `Retry`
- `Clear`
- `Send`
- `Loading`
- `Error`

Xử lý:

- Tất cả text hiển thị phải tiếng Việt.

## 7. Quy trình triển khai đề xuất

### Phase 1 — Audit text hiển thị

Mục tiêu: xác định đầy đủ các file có copy cần sửa.

Cách làm:

1. Grep các chuỗi cấm nhóm mô hình/dữ liệu/demo.
2. Grep các chuỗi tiếng Anh UI.
3. Lập danh sách file cần sửa.
4. Phân loại:
   - UI render trực tiếp
   - AI prompt/system prompt
   - tool renderer
   - nội bộ code, không cần sửa

Output mong muốn:

- Danh sách file cần sửa.
- Danh sách chuỗi không sửa vì chỉ là nội bộ.

### Phase 2 — Sửa shell và dashboard chính

Files ưu tiên:

- `components/dashboard/sidebar.tsx`
- `app/dashboard/layout.tsx`
- `app/dashboard/page.tsx`

Lý do:

- Đây là nơi người xem thấy đầu tiên.
- Sửa trước để định chuẩn thuật ngữ cho toàn app.

Kiểm tra sau Phase 2:

- Sidebar tiếng Việt.
- Dashboard không còn model/data/demo leakage.
- CTA tiếng Việt.

### Phase 3 — Sửa workflow nghiệp vụ

Files:

- `app/dashboard/decision-queue/page.tsx`
- `components/dashboard/decision-queue-table.tsx`
- `components/dashboard/decision-detail-drawer.tsx`
- `app/dashboard/forecast/page.tsx`
- `app/api/forecast-recommendation/route.ts`
- `app/dashboard/replenishment/page.tsx`

Lý do:

- Đây là luồng demo chính.
- Cần đảm bảo một mã hàng đi xuyên suốt dashboard -> decision -> forecast -> replenishment mà copy thống nhất.

Kiểm tra sau Phase 3:

- Click từ dashboard sang forecast đúng mã.
- Click từ forecast sang kế hoạch mua hàng đúng mã.
- Duyệt đề xuất vẫn hoạt động.
- Không còn từ cấm trên các trang này.

### Phase 4 — Sửa trang giám sát và độ tin cậy

Files:

- `app/dashboard/watchlist/page.tsx`
- `components/dashboard/watchlist-table.tsx`
- `app/dashboard/model-health/page.tsx`

Lý do:

- Watchlist là trang vận hành phụ.
- Model health dễ lộ thuật ngữ kỹ thuật nhất, cần xử lý kỹ.

Kiểm tra sau Phase 4:

- Watchlist tiếng Việt hoàn toàn.
- Search hoạt động.
- Model health không còn N-BEATS/proxy/baseline trên UI chính.
- Return metrics vẫn đúng.

### Phase 5 — Sửa lộ trình triển khai

File:

- `app/dashboard/roadmap/page.tsx`

Lý do:

- Đây là phần chấm điểm triển khai.
- Cần giữ nghiêm túc, giống kế hoạch áp dụng thật cho doanh nghiệp.

Kiểm tra sau Phase 5:

- Không còn “Implementation Roadmap” nếu render.
- Không gọi là demo budget.
- Có phase, timeline, nguồn lực, ngân sách, KPI, rủi ro.

### Phase 6 — Sửa AnalyticsBot và AI tools

Files:

- `app/analytics-bot/page.tsx`
- `components/analytics-bot/chat-interface.tsx`
- `components/analytics-bot/chat-widget.tsx`
- `lib/ai/system-prompt.ts`
- `lib/ai/tools.ts`
- `app/api/chat/route.ts`
- `lib/analytics-backend/normalizers.ts`

Lý do:

- Bot có thể tự sinh lại các cụm cấm nếu prompt/tool descriptions còn chứa.
- Renderer có thể lộ tool result tiếng Anh.

Kiểm tra sau Phase 6:

- Bot greeting và suggestions tiếng Việt.
- Bot trả lời không lộ N-BEATS/demo/competition/file.
- Tool result cards tiếng Việt.

### Phase 7 — Rà grep toàn repo lần cuối

Grep lại toàn bộ chuỗi cấm.

Phân loại kết quả:

1. Còn trong UI/bot: phải sửa.
2. Còn trong tài liệu dev: có thể giữ.
3. Còn trong tên biến/type/function: có thể giữ nếu không render.
4. Còn trong env/config/backend fallback: có thể giữ nếu không render.

Kết quả cuối Phase 7 phải có:

- Không còn chuỗi cấm trong text render ra UI.
- Không còn chuỗi cấm trong bot prompt/response templates.

### Phase 8 — Typecheck/build/manual smoke test

Chạy:

```bash
pnpm.cmd exec tsc --noEmit --incremental false
pnpm.cmd build
```

Sau đó chạy app:

```bash
pnpm dev
```

Smoke test bằng browser:

1. `/dashboard`
2. `/dashboard/decision-queue`
3. `/dashboard/forecast`
4. `/dashboard/replenishment`
5. `/dashboard/watchlist`
6. `/dashboard/model-health`
7. `/dashboard/roadmap`
8. `/analytics-bot`

Kiểm tra:

- Không còn tiếng Anh lộ trên UI chính.
- Không còn “demo”.
- Không còn tên mô hình.
- Không còn file dữ liệu.
- Không còn “dữ liệu cuộc thi”.
- Navigation vẫn hoạt động.
- Layout không vỡ ở 1440x900.
- Các button quan trọng không wrap xấu.
- Chat trả lời đúng ngôn ngữ.

## 8. Checklist nghiệm thu chi tiết

### 8.1. Checklist ngôn ngữ

- [ ] Sidebar 100% tiếng Việt.
- [ ] Page title 100% tiếng Việt.
- [ ] Page description 100% tiếng Việt.
- [ ] KPI/card title 100% tiếng Việt.
- [ ] Table headers 100% tiếng Việt.
- [ ] Buttons 100% tiếng Việt.
- [ ] Badges 100% tiếng Việt.
- [ ] Tabs 100% tiếng Việt.
- [ ] Drawer/dialog 100% tiếng Việt.
- [ ] Empty/loading/error states 100% tiếng Việt.
- [ ] AnalyticsBot greeting/suggestions 100% tiếng Việt.
- [ ] AI recommendation 100% tiếng Việt.

### 8.2. Checklist loại bỏ cảm giác demo

- [ ] Không còn “demo” trên UI.
- [ ] Không còn “dữ liệu demo”.
- [ ] Không còn “demo estimate”.
- [ ] Không còn “demo enrichment”.
- [ ] Không còn “mock”.
- [ ] Không còn “fallback”.
- [ ] Không còn “sample”.
- [ ] Không còn “giả lập” khi nói về dữ liệu hiện tại.
- [ ] Không còn “bản thử nghiệm” khi nói về hệ thống hiện tại.

### 8.3. Checklist dữ liệu

- [ ] Không còn “dữ liệu cuộc thi” trên UI.
- [ ] Không còn “competition data”.
- [ ] Không còn “Train.csv”.
- [ ] Không còn “train.csv”.
- [ ] Không còn “submission_nbeats.csv”.
- [ ] Không còn “generated JSON”.
- [ ] Không còn “raw file”.
- [ ] Data lineage nếu có phải dùng ngôn ngữ vận hành.
- [ ] “Danh mục bổ sung” được thay bằng “Danh mục sản phẩm” hoặc “Thông tin danh mục”.

### 8.4. Checklist mô hình

- [ ] Không còn “N-BEATS” trên UI.
- [ ] Không còn “nbeats” trên UI.
- [ ] Không còn “model architecture” trên UI.
- [ ] Không còn “proxy” trên UI chính.
- [ ] Không còn “baseline” nếu chưa Việt hóa.
- [ ] Không claim accuracy thật nếu chưa có ground truth.
- [ ] Trang độ tin cậy dự báo nói đúng về chỉ số theo dõi.

### 8.5. Checklist nghiệp vụ

- [ ] Dashboard trả lời được: mất bao nhiêu lợi nhuận, vốn bị khóa bao nhiêu, mã nào cần xử lý.
- [ ] Decision queue cho biết vì sao ưu tiên mã hàng.
- [ ] Forecast cho thấy dự báo, tồn kho, ngày nguy cơ thiếu hàng, số lượng nên đặt.
- [ ] Replenishment cho thấy ngân sách, danh sách mua đề xuất, lợi nhuận được bảo vệ.
- [ ] Watchlist quét được thiếu hàng/tồn dư/bán chậm.
- [ ] Model health cho thấy độ tin cậy dự báo bằng ngôn ngữ vận hành.
- [ ] Roadmap cho thấy lộ trình triển khai thật.
- [ ] Bot hỗ trợ các câu hỏi vận hành.

### 8.6. Checklist kỹ thuật

- [ ] `pnpm.cmd exec tsc --noEmit --incremental false` pass.
- [ ] `pnpm.cmd build` pass.
- [ ] Không đổi logic ngân sách `budget === null` và `budget === 0`.
- [ ] Không làm hỏng URL param productId/sku.
- [ ] Không làm hỏng approval state.
- [ ] Không làm hỏng tool result rendering.
- [ ] Không làm hỏng chat streaming.

## 9. Rủi ro khi triển khai và cách xử lý

### 9.1. Rủi ro sửa quá sâu vào code nội bộ

Nếu đổi cả tên biến/type/function từ tiếng Anh sang tiếng Việt, rủi ro TypeScript lỗi lớn và khó review.

Cách xử lý:

- Chỉ đổi text render ra UI.
- Giữ tên biến nội bộ nếu không ảnh hưởng trải nghiệm.
- Nếu có constant label map thì đổi value, không nhất thiết đổi key.

### 9.2. Rủi ro bot vẫn nói từ cấm

Ngay cả khi UI đã sạch, bot có thể sinh lại “N-BEATS”, “demo”, “competition data” nếu system prompt/tools còn chứa.

Cách xử lý:

- Sửa system prompt thật chặt.
- Sửa tool descriptions nếu có từ cấm.
- Sửa renderer labels.
- Test bot với các prompt dễ lộ:
  - “Dữ liệu này lấy từ đâu?”
  - “Mô hình dự báo là gì?”
  - “Đây có phải dữ liệu demo không?”
  - “Giải thích mã hàng top 1.”

### 9.3. Rủi ro claims dữ liệu quá mạnh

User muốn coi data là thật, nhưng hệ thống hiện tại có nguồn dữ liệu/metadata được tạo từ pipeline nội bộ. Không nên ghi “giả lập” trên UI, nhưng cũng không nên bịa các claims không có dữ liệu.

Cách xử lý:

- UI vận hành gọi là dữ liệu bán hàng/tồn kho/danh mục.
- Không nhắc “demo”.
- Không claim provenance chi tiết nếu không cần.
- Dùng ngôn ngữ “dữ liệu đã đồng bộ”, “cơ sở tính toán”, “ước tính vận hành”.

### 9.4. Rủi ro mất điểm kỹ thuật nếu ẩn tên model

Không hiển thị N-BEATS trên UI chính có thể làm giảm phần kỹ thuật nếu giám khảo hỏi.

Cách xử lý:

- Trang “Độ tin cậy dự báo” trình bày năng lực kỹ thuật bằng tiếng Việt, không cần tên model.
- Nếu cần trả lời Q&A, có thể chuẩn bị slide hoặc lời nói riêng về thuật toán, nhưng UI sản phẩm không lộ.
- Nếu user sau này muốn, có thể thêm chế độ “Chi tiết kỹ thuật” ẩn trong accordion, nhưng mặc định kế hoạch này là không hiện tên model.

### 9.5. Rủi ro layout vỡ do tiếng Việt dài hơn tiếng Anh

Tiếng Việt có thể dài hơn một số label tiếng Anh.

Cách xử lý:

- Dùng label ngắn:
  - “Tác động” thay vì “Tác động tài chính” ở table nếu chật.
  - “Hạn xử lý” thay vì “Số ngày còn lại”.
  - “Duyệt” thay vì “Duyệt đề xuất” ở button nhỏ.
- Dùng tooltip/drawer cho giải thích dài.
- Kiểm tra 1440x900 và 1280x720.

## 10. Định nghĩa hoàn thành

Công việc Việt hóa và chính quy hóa được xem là hoàn thành khi:

1. Người xem mở `/dashboard` không thấy bất kỳ dấu hiệu nào cho thấy đây là demo, dữ liệu cuộc thi, file CSV, hoặc mô hình nghiên cứu.
2. Toàn bộ UI chính dùng tiếng Việt thống nhất.
3. Không còn tên “N-BEATS” trên UI hoặc trong câu trả lời của bot.
4. Không còn “demo”, “competition data”, “Train.csv”, “Forecast: N-BEATS”, “Calendar”, “demo enrichment” trên UI.
5. Dữ liệu được trình bày như dữ liệu vận hành thật của hệ thống.
6. Luồng nghiệp vụ vẫn hoạt động:
   - Trung tâm điều hành -> Quyết định -> Dự báo nhu cầu -> Kế hoạch mua hàng -> Độ tin cậy dự báo -> Lộ trình triển khai -> Trợ lý phân tích.
7. TypeScript và build pass.
8. Browser smoke test xác nhận không còn text cấm trong các màn hình chính.
9. Bot trả lời tiếng Việt, tối đa 5 bullet khi đưa khuyến nghị, không lộ tên model/file/demo.

## 11. Thứ tự làm ngay sau plan này

Khi bắt đầu triển khai theo file này, thứ tự nên là:

1. Grep chuỗi cấm toàn repo.
2. Sửa sidebar/layout/dashboard.
3. Sửa decision queue/drawer.
4. Sửa forecast và forecast recommendation prompt.
5. Sửa replenishment.
6. Sửa watchlist.
7. Sửa model-health.
8. Sửa roadmap.
9. Sửa AnalyticsBot/system prompt/tool renderers.
10. Grep lại chuỗi cấm.
11. Typecheck/build.
12. Smoke test browser.

Không nên sửa ngẫu nhiên từng chữ theo grep mà không theo module, vì dễ làm vỡ luồng nghiệp vụ và khó kiểm tra.
