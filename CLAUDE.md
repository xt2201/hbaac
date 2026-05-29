# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Lệnh thường dùng

Dự án dùng pnpm để quản lý phụ thuộc vì có [pnpm-lock.yaml](pnpm-lock.yaml).

```bash
pnpm install
pnpm dev
pnpm build:data
pnpm exec tsc --noEmit --incremental false
pnpm build
pnpm start
pnpm lint
```

Luồng dự báo Python trong [README.md](README.md):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python scripts/pipeline.py
python src/preprocessor.py
python src/feature_builder.py
python src/forecaster.py
python scripts/tune_magic.py
python src/forecaster.py --forecast-only
python scripts/run_eda.py
```

Ghi chú:
- `pnpm dev` chạy máy chủ phát triển Next.js bằng webpack (`next dev --webpack`), thường ở `http://localhost:3000`; `/` chuyển hướng tới `/dashboard`.
- `pnpm dev:turbo` dùng để thử Turbopack, nhưng trên không gian làm việc Windows này Turbopack từng tạo lỗi nghiêm trọng ở PostCSS/CSS. Ưu tiên webpack để demo cục bộ ổn định.
- `pnpm build:data` tạo lại JSON gọn cho bảng điều khiển từ `train.csv`, `submission_nbeats.csv`, và `inventory_plan.csv` ở thư mục gốc vào [lib/project-data/generated/](lib/project-data/generated/).
- `pnpm exec tsc --noEmit --incremental false` là lệnh kiểm tra TypeScript nghiêm ngặt trước khi chốt demo.
- `pnpm build` chạy `next build`. [next.config.mjs](next.config.mjs) hiện có `typescript.ignoreBuildErrors: true`, nên bản dựng sản xuất không tự thất bại khi còn lỗi TypeScript.
- `pnpm lint` chạy `eslint .`, nhưng [package.json](package.json) hiện chưa khai báo `eslint`; cần cài và cấu hình ESLint trước khi dựa vào lệnh này.
- Chưa có lệnh kiểm thử hoặc khung kiểm thử trong [package.json](package.json), nên hiện chưa có lệnh chạy một kiểm thử riêng lẻ.
- Luồng dự báo Python V5 cần dữ liệu cuộc thi trong [dataset/](dataset/) (`train.csv`, `sample_submission.csv`) và ghi kết quả vào `processed/`, `models/`, `submissions/` theo [README.md](README.md).

## Môi trường

AnalyticsBot cần nhà cung cấp trò chuyện tương thích OpenAI:
- Cấu hình gateway thông thường: đặt `AI_GATEWAY_BASE_URL`, `AI_GATEWAY_AUTH_TOKEN` hoặc `AI_GATEWAY_API_KEY`, và tùy chọn `ANALYTICS_BOT_MODEL` trong `.env.local`.
- Nếu không có `AI_GATEWAY_BASE_URL`, [app/api/chat/route.ts](app/api/chat/route.ts) dùng dự phòng `OPENAI_API_KEY`.
- `AI_GATEWAY_BASE_URL` có thể chỉ là tên máy chủ; route sẽ thêm `/v1` trừ khi URL đã kết thúc bằng `/vN`.
- [app/api/chat/route.ts](app/api/chat/route.ts) và [app/api/forecast-recommendation/route.ts](app/api/forecast-recommendation/route.ts) đều dùng [lib/ai/model-provider.ts](lib/ai/model-provider.ts) (`getAnalyticsModel()`), nên khuyến nghị AI ở trang dự báo và AnalyticsBot dùng chung nhà cung cấp/mô hình.

Dữ liệu phân tích cho AnalyticsBot có thể đến từ backend riêng:
- Đặt `ANALYTICS_BACKEND_BASE_URL` và `ANALYTICS_BACKEND_AUTH_TOKEN` để bật gọi backend.
- `ANALYTICS_BACKEND_USE_LOCAL_FALLBACK=true` cho phép dùng dữ liệu HBAAC cục bộ khi cấu hình/gọi backend thất bại. Biến cũ `ANALYTICS_BACKEND_USE_MOCK_FALLBACK` vẫn được chấp nhận để tương thích.
- Các biến môi trường endpoint tùy chọn ghi đè đường dẫn mặc định trong [lib/analytics-backend/config.ts](lib/analytics-backend/config.ts).
- [.env.example](.env.example) mô tả cấu hình tối thiểu cho demo cục bộ.

## Kiến trúc dự án

Đây là ứng dụng Next.js App Router cho bảng điều khiển AutoParts Intelligence Platform. Công nghệ chính gồm React 19, TypeScript, Tailwind CSS v4, primitive UI kiểu shadcn, Radix, Lucide, Recharts và AI SDK v6.

Cấu trúc ứng dụng cấp cao:
- [app/layout.tsx](app/layout.tsx) là layout gốc, nhập [app/globals.css](app/globals.css), đặt metadata tiếng Việt, và chỉ render Vercel Analytics ở môi trường production.
- [app/page.tsx](app/page.tsx) chuyển hướng `/` tới `/dashboard`.
- [app/dashboard/](app/dashboard/) chứa các trang bảng điều khiển chính.
- [app/analytics-bot/](app/analytics-bot/) chứa trải nghiệm AnalyticsBot toàn trang.
- [app/api/chat/route.ts](app/api/chat/route.ts) là API trò chuyện streaming dùng cho cả giao diện toàn trang và widget.

Khung bảng điều khiển:
- [components/dashboard/sidebar.tsx](components/dashboard/sidebar.tsx) quản lý điều hướng chính, gồm liên kết `/analytics-bot`.
- [app/dashboard/layout.tsx](app/dashboard/layout.tsx) render `Sidebar`, vùng nội dung cuộn được và `ChatWidget` nổi cho các trang dashboard.
- [app/analytics-bot/layout.tsx](app/analytics-bot/layout.tsx) dùng cùng khung sidebar nhưng không gắn widget nổi vì `/analytics-bot` đã render trang chat đầy đủ.

## Trạng thái triển khai dashboard

- `/dashboard` là Trung tâm điều hành lợi nhuận, tập trung vào rủi ro lợi nhuận và quyết định mua hàng thay vì trang tổng quan chung.
- [app/dashboard/page.tsx](app/dashboard/page.tsx) render KPI ưu tiên tiền, bảng "Cần hành động ngay", "Cơ hội tối ưu vốn", và "Dòng tiền mua hàng". UI chính nên dùng nhãn nghiệp vụ và số liệu, không lặp nhãn nguồn file.
- [lib/project-data/index.ts](lib/project-data/index.ts) xuất `getProfitCommandCenter()` và các kiểu `Profit*`. Hàm này tính rủi ro lợi nhuận theo dự báo, chi phí lưu kho annualized, lợi nhuận kỳ vọng được bảo vệ bởi `Recommended_Order`, số SKU cần xử lý, cơ cấu ngân sách theo mức ưu tiên, và tóm tắt chính sách tồn kho từ `getInventoryOptimizationSummary(1)`.
- `inventory_plan.csv` là đầu ra optimizer EOQ sau dự báo N-BEATS. [scripts/build-project-data.mjs](scripts/build-project-data.mjs) tạo [lib/project-data/generated/inventory-plan.json](lib/project-data/generated/inventory-plan.json), còn [lib/project-data/index.ts](lib/project-data/index.ts) xuất `getInventoryPoliciesBySku()`, `getInventoryPolicyBySkuMonth()`, `getInventoryPolicyByProduct()`, và `getInventoryOptimizationSummary()`.
- Sau đợt dọn dẹp chỉ theo nguồn thật, `Recommended_Order`/`recommendedOrderTarget` là lượng đề xuất đặt hàng do [inventory.py](inventory.py) phát ra. Không trừ tồn kho hiện tại vì ba file nguồn không có dữ liệu tồn kho/ERP. Không áp MOQ vì không có nguồn MOQ thật.
- [scripts/build-project-data.mjs](scripts/build-project-data.mjs) kiểm định chính sách tồn kho nghiêm ngặt: trùng `(sku, month)`, trường số không hợp lệ, thiếu coverage theo tháng, thiếu khóa SKU/tháng trong dự báo, hoặc sai lệch `D_month` đều làm build thất bại. Dữ liệu hiện tại có 31.944 dòng chính sách, 15.972 SKU, và 0 sai lệch dự báo.
- `/dashboard/decision-queue` là hàng đợi quyết định P2. Trang này render hành động ưu tiên từ cảnh báo tồn kho và đề xuất bổ sung hàng, có bộ lọc, duyệt hàng loạt, và drawer chi tiết giải thích logic khuyến nghị/giả định nguồn.
- [components/dashboard/decision-queue-table.tsx](components/dashboard/decision-queue-table.tsx) quản lý bảng TanStack có chọn/sắp xếp; [components/dashboard/decision-detail-drawer.tsx](components/dashboard/decision-detail-drawer.tsx) quản lý drawer giải thích.
- `/dashboard/replenishment` là trang Bổ sung hàng theo lợi nhuận P3. Trang thay lưới thẻ cũ bằng KPI tóm tắt, mô phỏng ngân sách, và bảng quyết định có sắp xếp.
- [app/dashboard/replenishment/page.tsx](app/dashboard/replenishment/page.tsx) dùng trường chính sách/nghiệp vụ có nguồn thật từ `ReplenishmentSuggestion`: `Recommended_Order`, `Safety_Stock`, `Reorder_Point`, `EOQ`, nhu cầu 28 ngày, giá vốn đơn vị, biên lợi nhuận gộp từ train, lợi nhuận kỳ vọng được bảo vệ, chi phí mua, ROI, và `Cycle_Time_days`. Không hiển thị tồn kho hiện tại, nhà cung cấp, lead time, MOQ, hoặc workflow đơn mua hàng như sự thật.
- Mô phỏng ngân sách P3 dùng lựa chọn tham lam theo ROI trên các khuyến nghị đang được lọc. Kết quả gồm số SKU được chọn, chi phí mua, lợi nhuận được bảo vệ, ngân sách còn lại, và rủi ro lợi nhuận bị loại.
- Trạng thái ngân sách phân biệt `budget === null` (không giới hạn) và `budget === 0` (không chi). Khi sửa trang này, dùng `hasBudgetLimit`/`budget !== null`, không dùng kiểm tra truthy.
- Duyệt từng dòng và duyệt hàng loạt đều phải tôn trọng loại trừ ngân sách và `purchaseQty > 0`; dòng bị loại bởi ngân sách không được duyệt riêng từ UI.
- Luồng duyệt P3 chỉ là trạng thái demo phía client: duyệt/bỏ qua sẽ xóa đề xuất khỏi hàng đợi đang hoạt động và cập nhật số đếm tóm tắt, nhưng không tạo đơn mua hàng thật.
- `/dashboard/watchlist` là trang Theo dõi rủi ro & chi phí P5. Thẻ tóm tắt phải diễn giải rủi ro bằng tín hiệu có nguồn thật: nhu cầu dự báo, `Recommended_Order`, `Safety_Stock`, chi phí lưu kho, và dự báo thấp. Không trình bày tồn kho hiện tại hoặc overstock như dữ kiện ERP thật.
- [components/dashboard/watchlist-table.tsx](components/dashboard/watchlist-table.tsx) render bảng TanStack có cột dự báo 28/56 ngày, tóm tắt chính sách EOQ, tác động tài chính, loại rủi ro với nhãn tiền, badge nguồn dữ liệu, và nút thao tác nhanh. Dialog xác nhận hiển thị chi tiết chính sách tháng 1/tháng 2 khi có. Hành động được xác nhận qua dialog và lưu trong state cục bộ như chỉ báo workflow demo.
- Tìm kiếm watchlist dùng global filtering của TanStack và phải khớp cả `productSku` lẫn `productName`.
- `/dashboard/model-health` là trang Độ tin cậy mô hình P6. Trang phải dùng chẩn đoán có nguồn thật từ `train.csv`, `submission_nbeats.csv`, và JSON dự báo/chính sách đã sinh: coverage dự báo, so sánh split validation/evaluation, số SKU thưa dữ liệu, hàng trả từ train, và kiểm định inventory-plan. Không claim accuracy chính thức nếu chưa nối WRMSSE/backtest thật.
- Chỉ số hàng trả trong Model Health phải xem `returnQuantity` từ `product-summaries.json` là lượng trả âm; dùng trị tuyệt đối của lượng âm cho số lượng/tỷ lệ trả và định dạng tổng trả là số lượng, không phải tiền.
- Model Health hiện dùng metric consistency proxy, không phải WRMSSE chính thức hoặc bias validation thật nếu chưa thêm ground truth validation. Copy UI phải nói "proxy", "baseline", hoặc "demo estimate" thay vì claim accuracy/bias thật.
- Dashboard chính không còn render "Truy cập nhanh", biểu đồ category trang trí, hoặc khối top-selling-products cũ. Thay đổi tương lai nên giữ hướng bảng/quyết định.
- Hành động placeholder đã bị gỡ hoặc hạ cấp ở nơi chưa có flow thật: nút refresh/export forecast, menu tạo đơn trong watchlist, và luồng "Xem đơn hàng" ở replenishment.
- Thuật ngữ demo tiếng Việt chuẩn là ưu tiên tiền và workflow: "Lợi nhuận có thể bảo vệ", "Chi phí tồn kho annualized", "SKU cần xử lý", "Kế hoạch đặt hàng", "Khuyến nghị đặt hàng", "Tác động tài chính", và "Độ tin cậy dữ liệu". Tránh dùng "Dữ liệu cuộc thi" hoặc tên file thô làm nhãn chính nổi bật.
- Lần kiểm định gần nhất cho triển khai này: `pnpm.cmd build:data`, `pnpm.cmd exec tsc --noEmit --incremental false`, và `pnpm.cmd build` đều pass.

## Hướng cải tiến UI

- [plan_ui.md](plan_ui.md) là kế hoạch chi tiết để cải thiện UI sản phẩm dựa trên `HBAAC.final.pdf`. Đọc file này trước khi thay đổi UX dashboard.
- UI hiện giàu chức năng nhưng quá nhiều chữ và giống báo cáo. Công việc UI tiếp theo nên ưu tiên dashboard "Control Tower" thật và một workflow demo live mạch lạc, không thêm nhiều thẻ hoặc giải thích dài.
- Luồng demo mục tiêu: `/dashboard` Control Tower -> chi tiết/hàng đợi quyết định -> dự báo SKU -> mô phỏng ngân sách bổ sung hàng -> duyệt hành động -> độ tin cậy mô hình -> roadmap -> AnalyticsBot.
- Thứ tự sprint trong [plan_ui.md](plan_ui.md): Sprint A dashboard Control Tower, Sprint B workflow demo xuyên trang, Sprint C dọn Forecast/Replenishment, Sprint D dashboard Model Trust, Sprint E trang Roadmap, Sprint F tích hợp workflow Bot.
- Giữ viewport đầu tiên tập trung vào dashboard: command strip, bốn KPI kết quả, bảng quyết định quan trọng nhất, và panel khuyến nghị bên cạnh. Đẩy data lineage khỏi UI chính trừ khi thật sự hữu ích; đưa vào Model Health, tooltip, drawer, tab, hoặc tài liệu.
- Ngân sách chữ cho UI tương lai: mô tả header tối đa một dòng ngắn; helper KPI tối đa một dòng ngắn; output AI đúng năm bullet súc tích; giải thích kỹ thuật/mô hình ẩn mặc định trong tab/drawer.
- Copy sản phẩm phải ưu tiên tiền và vận hành: lợi nhuận rủi ro, vốn bị khóa, lợi nhuận được bảo vệ, mô phỏng ngân sách, hàng đợi quyết định, độ tin cậy mô hình. Không gọi lựa chọn tham lam ROI-first là optimizer chính xác tuyệt đối.
- Thêm trang `/dashboard/roadmap` trước khi polish demo cuối để đáp ứng yêu cầu lộ trình triển khai trong `HBAAC.final.pdf` (POC -> Pilot -> Rollout, nguồn lực, ngân sách, KPI, rủi ro).

## Forecast-to-Action

- `/dashboard/forecast` có thẻ "Khuyến nghị từ AI" phía trên biểu đồ dự báo, chế độ SKU tác động cao, demand drivers gọn, và các metric thật cốt lõi: lượng dự báo, nhu cầu trung bình, `Reorder_Point`, `Recommended_Order`, `Cycle_Time_days`, và tác động lợi nhuận.
- [app/api/forecast-recommendation/route.ts](app/api/forecast-recommendation/route.ts) tạo khuyến nghị dự báo bằng mô hình AnalyticsBot dùng chung từ `getAnalyticsModel()`.
- Output AI cho forecast bị ràng buộc đúng năm bullet tiếng Việt từ góc nhìn kinh doanh, tài chính, và phân tích dữ liệu. Không render token usage trong UI.
- Khuyến nghị dự báo phải hướng sản phẩm: hiển thị số liệu, quyết định, tác động tài chính, và diễn giải dữ liệu/nghiệp vụ. Không lặp "Nguồn: train.csv + submission_nbeats.csv + inventory.py" trong UI chính hoặc khuyến nghị AI trừ khi người dùng hỏi dữ liệu đến từ đâu. Nội bộ vẫn phải trace forecast, chính sách tồn kho, và trường doanh thu/chi phí về data contract thật. Không có catalog, nhà cung cấp, tồn kho hiện tại, lead time, hoặc MOQ nếu chưa thêm nguồn thật.

## AnalyticsBot

- [components/analytics-bot/chat-interface.tsx](components/analytics-bot/chat-interface.tsx) là bề mặt chat tái sử dụng. Component dùng `useChat<AnalyticsBotMessage>` với `DefaultChatTransport({ api: "/api/chat" })`, render message/tool output, và hỗ trợ biến thể trang/widget, nút prompt theo ngữ cảnh, cùng prompt điền sẵn qua props.
- [components/analytics-bot/chat-widget.tsx](components/analytics-bot/chat-widget.tsx) là launcher robot nổi góc phải dưới cho các trang dashboard và nhúng `ChatInterface variant="widget"`.
- [app/analytics-bot/page.tsx](app/analytics-bot/page.tsx) render chat toàn trang trong `Card`, có prompt gợi ý theo workflow và hỗ trợ `/analytics-bot?prompt=...` cho câu hỏi điền sẵn từ CTA dashboard.
- [app/api/chat/route.ts](app/api/chat/route.ts) validate UI message theo `analyticsTools`, gọi `streamText`, dùng `ANALYTICS_BOT_SYSTEM_PROMPT`, rồi trả `toUIMessageStreamResponse()`.
- [lib/ai/tools.ts](lib/ai/tools.ts) cung cấp tool phân tích và workflow cho model: dự báo sản phẩm, cảnh báo tồn kho, đề xuất bổ sung hàng, phân tích bán hàng, tóm tắt tồn kho, chính sách tồn kho, so sánh sản phẩm, KPI dashboard, hàng đợi quyết định, mô phỏng ngân sách ROI-first, giải thích khuyến nghị, sức khỏe mô hình, và lộ trình triển khai.
- [lib/ai/system-prompt.ts](lib/ai/system-prompt.ts) định nghĩa hành vi tiếng Việt và hướng dẫn dùng tool cho AnalyticsBot, gồm câu trả lời workflow ngắn năm bullet và caveat về data lineage.

## Tích hợp backend phân tích

- [lib/analytics-backend/client.ts](lib/analytics-backend/client.ts) POST JSON tới endpoint backend đã cấu hình với bearer auth, xử lý timeout, và `cache: "no-store"`.
- [lib/analytics-backend/normalizers.ts](lib/analytics-backend/normalizers.ts) chuyển response backend về shape mà renderer tool result trong [components/analytics-bot/chat-interface.tsx](components/analytics-bot/chat-interface.tsx) cần.
- [lib/analytics-backend/types.ts](lib/analytics-backend/types.ts) chứa kiểu kết quả backend và kiểu response đã chuẩn hóa.
- Khi đổi shape tool result, phải đồng bộ [lib/ai/tools.ts](lib/ai/tools.ts), normalizer/type backend, và các nhánh renderer trong [components/analytics-bot/chat-interface.tsx](components/analytics-bot/chat-interface.tsx).

## Mô hình dữ liệu

- [scripts/build-project-data.mjs](scripts/build-project-data.mjs) đọc `train.csv` và `submission_nbeats.csv` ở thư mục gốc, rồi ghi JSON gọn vào [lib/project-data/generated/](lib/project-data/generated/) cho dashboard Next.js.
- [lib/project-data/index.ts](lib/project-data/index.ts) xuất bản ghi SKU, tóm tắt bán hàng, dự báo N-BEATS, đầu ra chính sách tồn kho, cảnh báo có nguồn thật, đề xuất bổ sung hàng, hàng đợi quyết định, metric trung tâm điều hành lợi nhuận, và các hàm truy vấn dùng bởi dashboard/AI tools. Ứng dụng hiện xem SKU là định danh sản phẩm vì ba file nguồn không có catalog thật.
- [README.md](README.md) mô tả thêm luồng dự báo Python V5 trong [src/](src/) và [scripts/](scripts/): tiền xử lý, tạo feature, forecaster kiểu LightGBM, đánh giá/tinh chỉnh WRMSSE, EDA, và tạo submission Kaggle. Luồng này tách biệt với data builder demo Next.js.
- Metric trung tâm điều hành lợi nhuận trong `getProfitCommandCenter()` là ước tính lập kế hoạch kinh doanh chỉ suy ra từ sales/forecast/price/cost trong `train.csv`, output N-BEATS trong `submission_nbeats.csv`, và output chính sách tồn kho từ [inventory.py](inventory.py). Chi phí lưu kho và lượng đề xuất đặt hàng đến từ `inventory_plan.csv`; nhà cung cấp/tồn kho hiện tại/lead time/MOQ không được dùng như sự thật.
- [types/index.ts](types/index.ts) chứa kiểu domain dùng chung cho sản phẩm, tồn kho, bán hàng, dự báo, cảnh báo, đề xuất, KPI, và các kiểu chat/tool result cũ.

## Chính sách sự thật dữ liệu và trình bày

- Xem `train.csv` là lớp giao dịch thô thật. Xem `submission_nbeats.csv` là output dự báo model thật đang có trong repo. Xem `inventory_plan.csv` là output thật của [inventory.py](inventory.py) sinh từ bucket dự báo 28 ngày.
- JSON sinh trong [lib/project-data/generated/](lib/project-data/generated/) phải luôn có nguồn thật: trường trực tiếp hoặc tổng hợp deterministic từ `train.csv`, `submission_nbeats.csv`, và `inventory_plan.csv`. Không thêm trường catalog/master-data giả.
- Không bịa số hoặc dữ kiện vận hành như tồn kho hiện tại, lead time, MOQ, hiệu suất nhà cung cấp, số lượng kho, trạng thái đơn mua hàng, hoặc accuracy mô hình chính thức. Có thể dùng polish phi số như nhãn workflow, icon, trạng thái demo, và copy sản phẩm khi giúp câu chuyện HBAAC tốt hơn, nhưng không được đưa vào tính toán hoặc làm như số liệu thật.
- Định danh sản phẩm là SKU. Bộ lọc category nên gộp về category nguồn trung tính trừ khi có nguồn catalog thật.
- Nếu thêm `external_calendar.csv`, file này phải chứa feature lịch/sự kiện có căn cứ và ghi chú nguồn khi có thể. Cuối tuần, ngày lễ chính thức, Tết âm lịch, và feature ngày/tháng/tuần là dữ kiện. Cửa sổ nhận lương, lễ mua sắm, chiến dịch, và mapping catalog là giả định nếu không có nguồn trích dẫn.
- UI chính không nên phô tên file quá mức. Để số liệu và quyết định nghiệp vụ tự nói lên giá trị; dành tên nguồn dữ liệu cho Model Health, drawer/tooltip kỹ thuật, docs, hoặc khi người dùng hỏi trực tiếp.
- [plan_fix.md](plan_fix.md) là kế hoạch hiện tại cho nguyên tắc này: số thật ở tầng dữ liệu, trình bày sản phẩm gọn ở tầng UI.
- Ma trận sự thật cho claim demo:
  - Sales/SKU/date/quantity/revenue/cost thô từ `train.csv`: dữ liệu cuộc thi thật.
  - Dự báo ngày trong `submission_nbeats.csv`: output model thật sinh trong repo, không phải sales tương lai đã quan sát.
  - `inventory_plan.csv`: output thật của optimizer EOQ partner trên bucket dự báo 28 ngày.
  - KPI dashboard, profit risk, alert row, decision queue, và replenishment plan: ước tính hỗ trợ quyết định chỉ dùng ba file nguồn trên.
  - Tồn kho hiện tại, nhà cung cấp, lead time, product name/category/brand, MOQ, duyệt thật, kho, và workflow đơn mua hàng: không có trong nguồn và không được trình bày như sự thật.
  - Metric Model Health: chẩn đoán có nguồn thật trừ khi dashboard đã nối ground truth validation và output WRMSSE/backtest chính thức.
- Xem [DATA_ENRICHMENT_PLAN.md](DATA_ENRICHMENT_PLAN.md) cho kế hoạch dữ liệu ngoài và enrichment catalog.

## Giao diện và style

- [app/globals.css](app/globals.css) là stylesheet toàn cục đang dùng. File này import Tailwind v4 và `tw-animate-css`, định nghĩa biến CSS shadcn cho theme sáng/tối, map qua `@theme inline`, và chứa animation chatbot launcher.
- [components/ui/](components/ui/) chứa primitive kiểu shadcn. [components.json](components.json) cấu hình style `new-york`, `rsc: true`, alias như `@/components`, `@/lib`, và CSS variables trong [app/globals.css](app/globals.css).
- Ưu tiên token theme hiện có (`bg-background`, `bg-card`, `text-foreground`, `border-border`, `bg-primary`, v.v.) và helper `cn` từ [lib/utils.ts](lib/utils.ts) cho class Tailwind có điều kiện.

## Quy ước đường dẫn và trình biên dịch

- [tsconfig.json](tsconfig.json) bật TypeScript strict và map `@/*` tới thư mục gốc repo.
- Tối ưu ảnh của Next bị tắt qua `images.unoptimized: true` trong [next.config.mjs](next.config.mjs).
