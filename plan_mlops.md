# Kế hoạch triển khai MLOps demo cho HBAAC

## Mục tiêu

Bổ sung một lớp MLOps demo vào sản phẩm để giám khảo thấy hệ thống không chỉ có dashboard, mà còn có tư duy vận hành mô hình sau triển khai: kiểm tra dữ liệu, theo dõi forecast, phát hiện drift, quản lý phiên bản mô hình và chính sách retrain.

Phạm vi nên trình bày là **MLOps simulation / pilot-ready design** trên dữ liệu cuộc thi, không claim đã có production thật hoặc đã nối ERP thật.

## Nguyên tắc trình bày

- Dùng ngôn ngữ sản phẩm: “Model Operations”, “Forecast Monitoring”, “Retrain Policy”, “Pilot-ready MLOps”.
- Không nói hệ thống đã retrain tự động thật mỗi ngày nếu chưa có job chạy thật.
- Không nói đã nối ERP/POS thật nếu chưa có nguồn dữ liệu đó.
- Có thể nói: “thiết kế sẵn để nối ERP/POS ở Pilot”, “mô phỏng monitoring trên dữ liệu cuộc thi”, “sẵn sàng productionize”.
- Kết nối trực tiếp với yêu cầu BTC: sản phẩm dữ liệu có khả năng triển khai, roadmap rõ ràng, KPI đo được.

## Vị trí trong app

Ưu tiên thêm vào `/dashboard/story` vì đây là trang kể chuyện demo tổng thể.

Nếu còn thời gian, thêm trang riêng `/dashboard/model-health` hoặc `/dashboard/mlops` sau. Nhưng để demo nhanh, chỉ cần một section mạnh trong story page là đủ.

## Section đề xuất trong `/dashboard/story`

### 1. MLOps Control Panel

Mục tiêu: tạo cảm giác hệ thống có vòng đời vận hành mô hình đầy đủ.

Các thẻ KPI:

- **Model version**: N-BEATS v5
- **Deployment stage**: POC / Pilot-ready
- **Data freshness**: Dữ liệu cuộc thi + forecast output đã sinh
- **Forecast coverage**: số SKU có forecast
- **Inventory-plan validation**: số dòng mismatch forecast-plan
- **Retrain policy**: warm-start 7 ngày khi có dữ liệu mới
- **Drift status**: Normal / Watch / Action required

Copy nên dùng:

> MLOps pilot-ready: theo dõi dữ liệu, forecast coverage, consistency giữa forecast và inventory-plan, cùng chính sách retrain khi có dữ liệu vận hành mới.

Không dùng:

> Production MLOps đang chạy tự động hằng ngày.

### 2. Model Lifecycle Timeline

Timeline 5 bước:

1. **Data ingestion** — nhận sales/POS/ERP data.
2. **Validation** — kiểm tra thiếu dữ liệu, SKU mới, outlier, forecast coverage.
3. **Forecast run** — chạy N-BEATS theo horizon 56 ngày.
4. **Decision optimization** — sinh EOQ, safety stock, reorder point, recommended order.
5. **Monitoring & retrain** — theo dõi WRMSSE khi có actual, drift signal, warm-start retrain.

Cách nói khi demo:

> Đây là vòng đời vận hành mô hình mà nhóm thiết kế cho Pilot. Trong demo hiện tại, các bước validation và monitoring được mô phỏng trên dữ liệu cuộc thi và output forecast/inventory-plan.

### 3. Drift & Backtest Monitor

Hiển thị 3 khối:

- **Performance drift**
  - Signal: WRMSSE rolling window
  - Trigger: tăng >15% so với baseline
  - Status: chờ actual sales trong Pilot

- **Data drift**
  - Signal: PSI / SKU mix / demand sparsity
  - Trigger: PSI > 0.2
  - Status: simulation-ready

- **Business drift**
  - Signal: spike demand, SKU mới, thay đổi giá vốn
  - Trigger: vượt ngưỡng chính sách
  - Status: watchlist

Copy an toàn:

> WRMSSE drift cần actual sales sau kỳ dự báo; bản demo thể hiện cơ chế giám sát và trigger, còn Pilot sẽ nối trực tiếp với POS/ERP.

### 4. Model Registry Preview

Bảng nhỏ:

| Version | Role | WRMSSE | Status | Action |
|---|---|---:|---|---|
| Naive baseline | Reference | 0.522 | Archived | Compare |
| LightGBM global | Challenger | 0.527 | Archived | Review |
| N-BEATS v5 | Champion | 0.514 | Active demo | Serve forecast |
| N-BEATS + external data | Candidate | TBD | Roadmap | Experiment |

Lưu ý:

- WRMSSE dùng đúng số trong proposal.
- Không thêm số mới nếu chưa có.
- Candidate để `TBD`, không bịa kết quả.

### 5. Retrain Policy

Hiển thị policy dạng card:

- **Warm-start retrain**: khi có thêm 7 ngày dữ liệu mới.
- **Full retrain**: khi drift nặng hoặc PSI > 0.2.
- **Rollback**: quay về Champion nếu model mới làm WRMSSE xấu hơn.
- **Approval gate**: chỉ promote model khi WRMSSE tốt hơn baseline và business KPI không xấu đi.

Copy:

> Chính sách retrain được thiết kế cho Pilot để giảm rủi ro đưa model mới vào vận hành.

## Data dùng được trong dự án hiện tại

Có thể lấy từ các nguồn hiện có:

- Dữ liệu giao dịch thực tế do BTC cung cấp.
- Forecast output từ N-BEATS.
- Inventory-plan output từ module EOQ.
- Dataset info generated trong app.
- Decision queue và replenishment suggestions.
- WRMSSE từ proposal: baseline 0.522, N-BEATS 0.514.

Không nên dùng như sự thật:

- Tồn kho hiện tại thật.
- ERP/POS đã nối thật.
- Lead time thật.
- Nhà cung cấp thật.
- Model registry production thật.
- Job retrain thật nếu chưa có job.

## UI đề xuất

### Bố cục

Thêm section sau phần “Bằng chứng kỹ thuật forecast” hoặc trước roadmap.

Layout:

- Hàng 1: 4 KPI cards MLOps.
- Hàng 2: timeline lifecycle 5 bước.
- Hàng 3: drift monitor + model registry preview.
- Hàng 4: retrain policy checklist.

### Tone màu

- Blue: data validation / forecast coverage.
- Emerald: active model / healthy status.
- Amber: drift watch.
- Violet: model registry / MLOps.
- Red: action required nhưng hạn chế dùng nếu không có lỗi thật.

### Copy chính

Title:

> MLOps pilot-ready

Subtitle:

> Thiết kế vòng đời vận hành mô hình từ dữ liệu mới, forecast run, kiểm định chất lượng đến chính sách retrain.

Badge:

> Simulation on competition data

hoặc tiếng Việt:

> Mô phỏng trên dữ liệu cuộc thi

## Script demo 45 giây

> Sau khi forecast tạo ra quyết định đặt hàng, phần MLOps đảm bảo mô hình không bị “để đó rồi quên”. Hệ thống theo dõi coverage dữ liệu, consistency giữa forecast và inventory-plan, quản lý champion/challenger model và định nghĩa trigger retrain. Trong demo, chúng tôi mô phỏng các signal này trên dữ liệu cuộc thi; khi sang Pilot, các signal WRMSSE rolling và drift sẽ nối trực tiếp với POS/ERP để tự động cảnh báo và đề xuất retrain.

## Việc cần làm trong code

1. Thêm constants MLOps vào `/dashboard/story/page.tsx` server component:
   - `mlopsKpis`
   - `modelRegistryRows`
   - `driftMonitors`
   - `retrainPolicies`
   - `lifecycleSteps`

2. Truyền qua `StoryDashboardData` sang client component.

3. Render section mới trong `story-dashboard-client.tsx`:
   - MLOps KPI cards.
   - Lifecycle timeline.
   - Drift monitor cards.
   - Model registry table.
   - Retrain policy checklist.

4. Copy phải ghi rõ:
   - `Pilot-ready`
   - `Mô phỏng trên dữ liệu cuộc thi`
   - `WRMSSE khi có actual sales trong Pilot`

5. Chạy kiểm tra:
   - `pnpm.cmd exec tsc --noEmit --incremental false`
   - `pnpm.cmd build`

## Không nên làm

- Không tạo số WRMSSE mới.
- Không ghi “đã nối ERP/POS thật”.
- Không ghi “production retrain đang chạy”.
- Không thêm dashboard quá nhiều chữ.
- Không dùng thuật ngữ quá kỹ thuật nếu không phục vụ storytelling.

## Kết quả kỳ vọng

Sau khi thêm section này, `/dashboard/story` sẽ kể được đủ 4 ý lớn:

1. Forecast có kỹ thuật và WRMSSE.
2. Forecast chuyển thành quyết định đặt hàng.
3. Sản phẩm có dashboard/chatbot/workflow.
4. Hệ thống có thiết kế MLOps để triển khai Pilot và Production.
