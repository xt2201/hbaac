# UI Improvement Plan - HBAAC Final Demo

Ngay lap ke hoach: 2026-05-28

Muc tieu cua file nay: bien app hien tai tu tap hop nhieu trang bao cao thanh mot san pham demo co luong dieu hanh ro rang, it chu hon, thuyet phuc hon trong 15 phut demo live theo `HBAAC.final.pdf`.

## 1. Can cu tu HBAAC.final.pdf

PDF yeu cau final round tap trung vao 3 phan chinh:

1. Nang cap ky thuat du bao
   - Trinh bay diem dot pha ky thuat.
   - Co minh chung dinh luong nhu WRMSSE/backtest/validation.
   - Neu co them thoi gian hoac data, neu duoc huong cai tien.

2. Phat trien san pham du lieu
   - Demo mot san pham du lieu co tinh ung dung cao.
   - Dashboard/canh bao, AI chatbot, tuy chinh mo hinh, he thong tu cap nhat deu la huong duoc khuyen khich.
   - Demo phai dung du lieu that tu bo du lieu cuoc thi, co the ket hop nguon ngoai va gia dinh hop ly.
   - Demo phai the hien it nhat mot luong su dung hoan chinh.

3. Lo trinh trien khai
   - Danh gia hien trang ha tang du lieu cong ty X.
   - Lo trinh POC -> Pilot -> Rollout.
   - Nguon luc, cong nghe, ngan sach.
   - KPI: WRMSSE, stockout, chi phi ton kho, van hanh.
   - Rui ro va phuong an du phong.

Ty trong cham diem:

- Ky thuat: 40%.
- San pham: 30%.
- Lo trinh: 20%.
- Trinh bay va Q&A: 10%.

He qua cho UI:

- UI khong duoc chi la "dep"; phai giup giam thoi gian giai thich trong demo.
- Dashboard dau tien phai tra loi ngay: hom nay mat bao nhieu tien, mat vi dau, can lam gi, model co dang tin khong.
- Moi trang phu chi nen phuc vu mot buoc trong luong demo.
- Nhung noi giai thich dai phai day vao drawer, accordion, tooltip hoac trang roadmap/model trust, khong de tren first viewport.

## 2. Van de UI hien tai

### 2.1. Van de tong the

- UI co nhieu text giai thich truc tiep tren man hinh, lam nguoi xem bi roi.
- Nhieu page co qua nhieu card va bang, nhung khong co hierarchy ro.
- Dashboard chinh chua giong "dashboard dieu hanh"; no dang giong mot trang tong hop bao cao.
- Navigation hien co nhieu module ngang hang, demo bi dut mach.
- Header co search/notification/user menu nhin nhu san pham that nhung chua co workflow that, tao nhieu diem gay nhieu.
- Mot so page ky thuat nhu Model Health qua dai, giong document hon la UI ra quyet dinh.
- Table qua rong, nhieu cot, nhieu label, can co che do "demo focus".
- Chua co trang Roadmap trong UI, trong khi PDF cham 20% lo trinh.

### 2.2. Van de theo page

#### `/dashboard`

- Dang co nhieu KPI nhung thieu "top narrative".
- Chua co first viewport du suc demo 30 giay dau.
- "Nguon du lieu" de thanh card cuoi trang lam tang chu, nen chuyen thanh compact data lineage strip.
- Bang "Can hanh dong ngay" tot nhung can dua thanh trung tam cua dashboard, them CTA ro.

#### `/dashboard/decision-queue`

- Dung voi concept decision queue, nhung dang thien ve table tool.
- Card summary va filter chiem nhieu dien tich.
- Can co "inbox mode": top actions, bulk approve, explain drawer.
- Can the hien sau khi duyet thi dashboard/queue thay doi ra sao.

#### `/dashboard/forecast`

- Da co AI recommendation, chart, drivers, metrics, nhung qua nhieu section.
- Card AI co nhieu metric con, can gom thanh "Forecast-to-Action panel".
- Driver table/list nen thanh compact evidence panel.
- Can nut chuyen tiep sang replenishment/decision queue cho SKU dang xem.

#### `/dashboard/replenishment`

- Tinh nang ngan sach la gia tri demo cao, nhung UI dang qua day.
- Can lam thanh 3 phan: budget scenario, selected purchase basket, rejected trade-off.
- Table nen co che do compact top 10 va drawer chi tiet.
- Copy can noi ro "ROI-first simulation", tranh goi la optimal absolute.

#### `/dashboard/watchlist`

- Direction Risk & Cost Monitor dung, nhung bang nhieu cot co the gay qua tai.
- Summary card nen la filter tabs/segmented metrics thay vi 3 card to neu can tiet kiem khong gian.
- Quick action can giam text va tang icon/action clarity.

#### `/dashboard/model-health`

- Trang nay can cho diem ky thuat, nhung phai dashboard hoa.
- Hien co nhieu paragraph dai, phai chuyen thanh trust cards + tabs + evidence tables.
- Can tranh dung tu "bias/accuracy" neu chi la proxy, phai co nhan "proxy" ro.
- Can co "judge answer mode": WRMSSE/backtest, drift, sparse SKU, returns, calendar, retraining.

#### `AnalyticsBot`

- Bot la diem cong san pham, nhung neu de doc lap thi demo bi dut.
- Can gan bot vao dashboard nhu "Ask why" / "Explain this decision" thay vi chi chat tong quat.

## 3. Nguyen tac thiet ke moi

### 3.1. Product narrative

Ten san pham de xuat:

- "AutoParts Profit Control Tower"
- Ten phu: "Forecast-to-Decision platform for spare parts distribution"

Thong diep 1 cau:

- "Bien du bao nhu cau thanh quyet dinh mua hang, giam stockout va giam von bi khoa cho doanh nghiep phu tung oto."

3 gia tri tren UI:

- Profit at risk: loi nhuan dang co nguy co mat do thieu hang.
- Capital locked: von dang bi khoa trong hang ton du/ban cham.
- Trusted forecast: model du bao co theo doi sai lech, sparse SKU, returns va calendar effect.

### 3.2. Information hierarchy

Moi man hinh phai co 3 lop:

1. Outcome
   - KPI tien/so luong/hanh dong can lam.
   - Nguoi xem hieu trong 5 giay.

2. Decision
   - Bang/list top viec can xu ly.
   - Co CTA ro: approve, view forecast, simulate budget, watch, clear.

3. Evidence
   - Forecast, drivers, data lineage, model trust.
   - Chi hien khi can mo rong.

### 3.3. Text budget

Luon ap dung gioi han text:

- Header description: toi da 1 dong, duoi 110 ky tu.
- KPI helper: toi da 1 dong, duoi 55 ky tu.
- CardDescription: chi dung khi card can context, duoi 90 ky tu.
- AI output: toi da 5 bullet, moi bullet duoi 1 cau ngan.
- Model explanation: mac dinh an trong drawer/tab, khong de paragraph dai o first viewport.
- Bang: uu tien label ngan, icon + tooltip neu can.

### 3.4. Visual density

- Dashboard phai vua first viewport o 1440x900:
  - Top command strip.
  - KPI row.
  - Main decision table + side recommendation panel.
- Khong lap nhieu card trong card.
- Khong dung mau mot tong duy nhat; dung mau theo y nghia:
  - Red: profit risk/stockout.
  - Amber: locked capital/overstock.
  - Blue: forecast/model/technical.
  - Emerald: approved/profit protected.
  - Slate: neutral/infrastructure.
- Card radius giu <= 8px theo style hien co.
- Font size trong dashboard:
  - Page title: 20-24.
  - KPI value: 28-36.
  - Table body: 13-14.
  - Helper: 12.

### 3.5. Demo-first UI

Moi page phai tra loi cau hoi:

- Tai sao giam khao can xem page nay?
- Page nay day workflow sang buoc tiep theo nhu the nao?
- Neu chi co 45 giay tren page nay, can click gi?

## 4. Luong demo muc tieu 15 phut

### 4.1. Script tong quan

1. Mo `/dashboard`
   - "Day la control tower: hom nay he thong phat hien X loi nhuan co nguy co mat, Y von bi khoa, Z SKU can xu ly."
   - Click top action co impact cao nhat.

2. Mo decision detail
   - "Ly do he thong uu tien SKU nay: stockout trong N ngay, margin cao, forecast N-BEATS tang."
   - Click "Xem du bao".

3. Mo `/dashboard/forecast` voi SKU da chon
   - Show chart + AI 5 bullet.
   - Show drivers ngan gon: weekend/holiday/calendar/source.
   - Click "Mo phong dat hang".

4. Mo `/dashboard/replenishment`
   - Keo budget slider.
   - Show trade-off: neu chi co X VND, mua SKU nao truoc, loi nhuan nao duoc bao ve, SKU nao bi bo lai.
   - Approve selected.

5. Quay lai `/dashboard/decision-queue`
   - Show queue giam, approved impact tang.

6. Mo `/dashboard/model-health`
   - "De tin vao quyet dinh, chung toi theo doi drift, proxy accuracy, sparse SKU, returns, calendar."
   - Show 4 trust cards + one tab evidence.

7. Mo Roadmap
   - POC -> Pilot -> Rollout, KPI va nguon luc.

8. AnalyticsBot
   - Hoi: "Neu ngan sach mua hang 500 trieu, nen uu tien SKU nao?"
   - Bot tra loi dua tren decision/replenishment data.

### 4.2. Demo acceptance

Trong 2 phut dau, nguoi xem phai tra loi duoc:

- Mat bao nhieu loi nhuan neu khong hanh dong?
- SKU nao can xu ly dau tien?
- Ly do la forecast, ton kho hay margin?
- Can mua bao nhieu, ton bao nhieu tien?
- Model co du tin cay de dung trong van hanh khong?

## 5. Information Architecture moi

### 5.1. Sidebar de xuat

Thu tu nav:

1. Control Tower
   - href: `/dashboard`
   - muc dich: man hinh demo dau tien, money-first.

2. Decisions
   - href: `/dashboard/decision-queue`
   - muc dich: inbox hanh dong.

3. Forecast
   - href: `/dashboard/forecast`
   - muc dich: explain forecast cho mot SKU.

4. Replenishment
   - href: `/dashboard/replenishment`
   - muc dich: budget simulation va approve purchase.

5. Risk Monitor
   - href: `/dashboard/watchlist`
   - muc dich: scan stockout/overstock/slow moving.

6. Model Trust
   - href: `/dashboard/model-health`
   - muc dich: technical score va trust evidence.

7. Rollout Plan
   - href: `/dashboard/roadmap`
   - muc dich: phan 3 cua PDF.

8. AnalyticsBot
   - href: `/analytics-bot`
   - muc dich: natural-language assistant.

### 5.2. Header moi

Header hien tai:

- Search global chua co tac dung that.
- Notification/user menu fake lam UI roi.

De xuat:

- Thay bang `DemoProgressHeader`:
  - Breadcrumb: Control Tower / Decisions / Forecast...
  - Compact data freshness: "Data den 2025-09-05".
  - Model badge: "N-BEATS forecast".
  - Button: "Mo AnalyticsBot".
- Neu giu search, phai co tac dung that toi thieu theo SKU/product va mo result popover.

## 6. P0 - Executive Control Tower

Muc tieu: bien `/dashboard` thanh man hinh dieu hanh that su.

File chinh:

- `app/dashboard/page.tsx`
- co the tao them:
  - `components/dashboard/control-tower-kpis.tsx`
  - `components/dashboard/top-actions-table.tsx`
  - `components/dashboard/recommendation-panel.tsx`
  - `components/dashboard/data-lineage-strip.tsx`

### 6.1. First viewport layout

Desktop 1440x900:

```
Header: Control Tower | data freshness | model badge

Command strip:
  "Hom nay can xu ly 42 SKU de bao ve ~41.7M loi nhuan"
  CTA: Review top decisions

KPI row 4 columns:
  Profit at risk | Capital locked | Actions due 7d | Model trust

Main grid:
  Left 70%: Top decisions table
  Right 30%: Today's recommendation panel
```

Mobile/tablet:

- KPI scroll/grid 2 columns.
- Top decision list as stacked rows.
- Recommendation panel below list.

### 6.2. KPI cards moi

Chi giu 4 KPI:

1. Loi nhuan co nguy co mat
   - value: compact currency.
   - sub: "Do stockout trong 56 ngay".
   - trend chip: "+/- vs recent baseline" neu co data.

2. Von bi khoa
   - value: compact currency.
   - sub: "Tu overstock va slow-moving".

3. SKU can xu ly 7 ngay
   - value: count.
   - sub: "Deadline gan nhat: date".

4. Model trust
   - value: "Good / Watch / Needs review" hoac score.
   - sub: "Drift, sparse, returns dang duoc theo doi".

Khong dung 6 KPI nhu hien tai vi first viewport qua day.

### 6.3. Command strip

Noi dung:

- "Can xu ly {actionSkuNext7Days} SKU trong 7 ngay de bao ve {expectedProfit} loi nhuan."
- Secondary: "{lostProfitRisk} dang co nguy co mat; {lockedCapital} von bi khoa."
- CTA primary: `Review decisions`.
- CTA secondary: `Simulate budget`.

Yeu cau:

- Day la diem nhan dau tien.
- Khong de trong card decorative; dung full-width band hoac compact section.

### 6.4. Top decisions table

Cot de xuat:

- Rank.
- SKU + product.
- Risk.
- Days left.
- Financial impact.
- Recommended action.
- CTA.

Bo/gom cac cot phu:

- Category/supplier dua vao subtext.
- Source dua vao icon/badge nho.

CTA theo type:

- stockout: `Dat hang`.
- overstock: `Giam mua`.
- slow moving: `Xa hang`.
- watch: `Theo doi`.

Interaction:

- Click row mo drawer.
- Button `View forecast` trong drawer.
- Button `Approve` cap nhat demo state.

### 6.5. Today's recommendation panel

Noi dung:

- "Best next action"
  - top SKU.
  - action.
  - expected protected profit.
  - deadline.
- "Budget snapshot"
  - proposed budget.
  - protected profit.
  - ROI.
- "Why this matters"
  - toi da 3 bullets ngan.

Khong viet paragraph dai.

### 6.6. Data lineage strip

Thay card "Nguon du lieu" dai bang strip cuoi first viewport:

- Train.csv: X rows / Y SKU.
- Forecast: N-BEATS / 56 days.
- Calendar: external + date-derived.
- Catalog/inventory: demo enrichment.

Mau: badge outline, text ngan.

### 6.7. Acceptance criteria P0

- First viewport khong can scroll van thay duoc:
  - command strip.
  - 4 KPI.
  - it nhat 5 row top decisions.
  - side recommendation panel.
- Tong so paragraph tren first viewport <= 6.
- Khong co CardDescription dai hon 1 dong.
- Co CTA ro dan sang decision/forecast/replenishment.

## 7. P1 - Unified Demo Workflow State

Muc tieu: workflow khong bi dut khi chuyen page.

### 7.1. State can co

Can mot client-side demo state provider:

- selectedSku/productId.
- approved decision ids.
- skipped decision ids.
- selected budget.
- last action timestamp.

File de xuat:

- `components/dashboard/demo-workflow-provider.tsx`
- `hooks/use-demo-workflow.ts`

Neu khong muon provider lon, co the dung URL params:

- `/dashboard/forecast?sku=SKU-...`
- `/dashboard/replenishment?focus=SKU-...&budget=500000000`

De xuat thuc dung:

- Phase 1 dung URL params de nhanh, it risk.
- Phase 2 them provider neu can sync approved state toan app.

### 7.2. Navigation actions

Tu dashboard/decision drawer:

- `Xem du bao` -> `/dashboard/forecast?productId=...`
- `Mo phong dat hang` -> `/dashboard/replenishment?productId=...`
- `Duyet de xuat` -> update local/demo state.

Tu forecast:

- `Mo phong dat hang` -> replenishment voi productId.
- `Hoi AnalyticsBot ve SKU nay` -> bot voi context.

Tu replenishment:

- `Duyet danh sach trong ngan sach` -> update approved state.
- `Quay lai decision queue` -> decision queue.

### 7.3. Acceptance criteria P1

- Click top decision tren dashboard co the di toi forecast dung SKU.
- Forecast page doc URL param va auto select SKU.
- Replenishment page doc URL param va highlight SKU lien quan.
- Decision queue co the an/mark approved trong demo session.

## 8. P2 - Decision Queue Cleanup

Muc tieu: thanh inbox quyet dinh, khong phai spreadsheet lon.

File:

- `app/dashboard/decision-queue/page.tsx`
- `components/dashboard/decision-queue-table.tsx`
- `components/dashboard/decision-detail-drawer.tsx`

### 8.1. Layout moi

Top:

- Compact toolbar:
  - active count.
  - total impact.
  - filter chips.
  - bulk approve button.

Main:

- Table/list left.
- Detail drawer/sheet right or slide-over.

### 8.2. Reduce summary cards

Hien co 4 summary cards. De xuat:

- Chuyen thanh single compact stats bar:
  - Pending: X.
  - High priority: Y.
  - Impact: Z.
  - Approved: A.

Ly do:

- Giam chieu cao.
- Danh sach quyet dinh moi la trung tam.

### 8.3. Table columns

Desktop:

- Checkbox.
- Priority.
- SKU/Product.
- Action.
- Deadline.
- Impact.
- Confidence.
- Buttons.

Mobile:

- Product card row:
  - title, priority, action, impact, CTA.

### 8.4. Drawer noi dung

Drawer phai tra loi:

- Why now?
- Financial impact.
- Forecast evidence.
- Inventory evidence.
- Assumptions/source.
- Buttons:
  - Approve.
  - View forecast.
  - Simulate budget.
  - Ask bot.

### 8.5. Acceptance criteria P2

- Page load thay ngay danh sach action.
- Filters khong chiem qua 20% chieu cao viewport.
- Approve mot item cap nhat summary va row state.
- Drawer khong co paragraph dai hon 3 dong.

## 9. P3 - Forecast-to-Action Cleanup

Muc tieu: bien forecast page thanh trang explain cho mot SKU, khong phai dashboard phu.

File:

- `app/dashboard/forecast/page.tsx`
- `components/dashboard/forecast-chart.tsx`
- `components/dashboard/product-selector.tsx`

### 9.1. Layout moi

```
Top compact:
  SKU selector | view mode | range tabs | source badges

Main:
  Left: chart 65%
  Right: action panel 35%

Below:
  Evidence tabs: Drivers | Data | AI reasoning
```

### 9.2. Action panel

Panel right gom:

- Status:
  - "Stockout in N days" hoac "Healthy".
- 4 metrics:
  - forecast 28/56.
  - stock on hand.
  - suggested order qty.
  - profit at risk/protected.
- CTA:
  - `Simulate replenishment`.
  - `Add to decision queue`.
  - `Ask AI why`.

### 9.3. AI recommendation

Rules:

- Output dung 5 bullets.
- Khong hien token usage.
- Moi bullet theo goc nhin:
  1. Business risk.
  2. Financial impact.
  3. Data/forecast evidence.
  4. Recommended action.
  5. Caveat/assumption.

UI:

- Mac dinh hien trong panel right hoac tab "AI".
- Neu loading, skeleton 5 lines.
- Neu fail, show fallback local metrics, khong show warning to chiem chieu cao.

### 9.4. Demand Drivers

Chuyen sang compact evidence:

- Top 5 drivers only.
- Columns:
  - date.
  - driver.
  - source.
  - forecast lift.
- Source badge:
  - factual.
  - date-derived.
  - assumption.

### 9.5. Acceptance criteria P3

- First viewport thay chart + action panel.
- Khong co table/driver list day chart xuong qua thap.
- User click 1 nut sang replenishment dung SKU.
- AI output khong qua 5 bullets.

## 10. P4 - Replenishment Budget Simulator Redesign

Muc tieu: giup giam khao thay "neu chi co X tien thi mua gi truoc".

File:

- `app/dashboard/replenishment/page.tsx`

### 10.1. Layout moi

Top:

- Scenario bar:
  - budget slider.
  - selected budget.
  - reset/unlimited.

Main:

- Left: purchase basket selected by ROI-first.
- Right: trade-off panel.

Below:

- detailed table with compact columns.

### 10.2. Budget simulator

Can the hien ro:

- Budget selected.
- Purchase cost.
- Profit protected.
- ROI.
- SKU covered.
- SKU excluded.
- Profit left at risk.

Budget 0 rule:

- `budget === null` = unlimited.
- `budget === 0` = no spend.
- Bulk approve disabled if selected count = 0.

### 10.3. Purchase basket

Top rows selected:

- SKU.
- Qty.
- Cost.
- Protected profit.
- ROI.
- Deadline.

Excluded/trade-off:

- "Neu ngan sach khong tang, X loi nhuan van at risk."
- Show top 3 excluded high impact SKUs.

### 10.4. Copy

Khong dung:

- "Toi uu tuyet doi" neu logic la greedy.

Dung:

- "ROI-first simulation".
- "Uu tien SKU co loi nhuan bao ve / chi phi mua cao nhat."
- "Demo estimate".

### 10.5. Acceptance criteria P4

- Keo slider thay metrics thay doi ngay.
- 0 VND khong approve duoc item nao.
- Unlimited mode hien tat ca row eligible.
- Bulk approve cap nhat state.
- Text "ROI-first" xuat hien o tooltip/help, khong gay roi first viewport.

## 11. P5 - Risk & Cost Monitor Cleanup

Muc tieu: trang watchlist dung de scan rui ro, khong can thay the dashboard.

File:

- `app/dashboard/watchlist/page.tsx`
- `components/dashboard/watchlist-table.tsx`

### 11.1. Layout moi

Top:

- Segmented risk tabs:
  - Stockout.
  - Overstock.
  - Slow-moving.

Each tab chip:

- count.
- financial impact.

Main:

- compact table.

Side:

- optional "risk explanation" small panel only on desktop.

### 11.2. Table columns

Keep:

- SKU/Product.
- Risk type.
- Days left.
- FC 28/56.
- Financial impact.
- Action.

Hide or drawer:

- Data source details.
- Long recommendation text.

### 11.3. Search/filter

Search must cover:

- SKU.
- Product name.
- Category.

Filters:

- Category.
- Severity.
- Impact range optional.

### 11.4. Acceptance criteria P5

- First viewport co risk tabs + table.
- Search SKU hoat dong.
- Quick action co badge state sau confirm.
- Khong co row bi wrap qua nhieu dong tren desktop.

## 12. P6 - Model Trust Dashboard

Muc tieu: an diem ky thuat nhung khong bien thanh tai lieu dai.

File:

- `app/dashboard/model-health/page.tsx`

### 12.1. Layout moi

Top:

- Trust score strip:
  - Forecast coverage.
  - Proxy accuracy/baseline delta.
  - Drift.
  - Sparse SKU share.
  - Returns rate.

Main tabs:

1. Accuracy & Backtest
2. Drift & Monitoring
3. Sparse SKU & Returns
4. Calendar & Data Lineage
5. Model Narrative

### 12.2. Accuracy & Backtest tab

Can co:

- WRMSSE/backtest score neu co actual validation.
- Neu chua co actual validation:
  - label "proxy consistency".
  - noi ro "not official WRMSSE".
- Distribution chart.
- Top stable SKUs.
- Top review SKUs.

Khong noi:

- "Dự báo cao hơn thực tế" neu khong co actual.

### 12.3. Drift tab

Metrics:

- validation vs evaluation delta.
- top drift SKUs.
- drift threshold.
- retraining trigger.

UI:

- status badge:
  - Stable.
  - Watch.
  - Retrain recommended.

### 12.4. Sparse & Returns tab

Metrics:

- no sales SKU.
- <=5 transactions.
- <=10 positive sales days.
- returns SKU.
- total return qty.
- return rate.

Need:

- returns use absolute negative quantity from train data.
- total return quantity formatted as quantity, not currency.

### 12.5. Calendar & Data Lineage tab

Metrics:

- weekend days.
- Sunday/closed-day effect marker.
- public holidays.
- lunar events.
- retail events assumption.

Data lineage:

- Competition data.
- External calendar.
- Demo enrichment.

### 12.6. Model Narrative tab

Content compact:

- Architecture: N-BEATS.
- Ensemble strategy.
- Sparse/cold-start handling.
- Profit-aware prioritization.
- Future improvement.

Use accordion sections, not long visible paragraphs.

### 12.7. Acceptance criteria P6

- First viewport khong qua 5 trust cards + tabs.
- Paragraph dai duoc an trong accordion/tab.
- Tat ca proxy metrics co label proxy/demo estimate.
- Returns metrics dung voi data negative returns.

## 13. P7 - Roadmap Page

Muc tieu: dap ung 20% diem lo trinh trien khai.

File moi:

- `app/dashboard/roadmap/page.tsx`
- optional components:
  - `components/dashboard/roadmap-timeline.tsx`
  - `components/dashboard/implementation-kpis.tsx`

### 13.1. Page structure

First viewport:

- Title: "Implementation Roadmap".
- 3 phase timeline:
  1. POC.
  2. Pilot.
  3. Rollout.
- KPI target cards.
- Resource estimate summary.

### 13.2. Phase detail

POC - 4-6 weeks:

- Scope:
  - 1-2 product categories.
  - 500-1,000 SKU.
  - historical sales + inventory + N-BEATS forecast.
- Team:
  - 1 data scientist.
  - 1 data engineer.
  - 1 business owner.
  - 1 frontend/product engineer.
- Tech:
  - data pipeline.
  - dashboard.
  - manual approval workflow.
- KPI:
  - forecast baseline established.
  - top stockout alerts precision.
  - user adoption by operations team.

Pilot - 8-12 weeks:

- Scope:
  - 3-5 categories.
  - supplier workflow.
  - budget simulation.
  - weekly retraining.
- Team:
  - DS/DE/product/ops.
- KPI:
  - stockout reduction.
  - inventory holding cost reduction.
  - decision SLA.
  - forecast drift monitored.

Rollout - 3-6 months:

- Scope:
  - all SKU.
  - ERP/WMS integration.
  - role-based access.
  - automated retraining.
  - monitoring.
- KPI:
  - WRMSSE reduction.
  - stockout rate.
  - locked capital.
  - purchase planning lead time.

### 13.3. Risk register

Risks:

- Missing inventory/lead time data.
- Returns/cancelled orders distort demand.
- Sparse SKU/cold start.
- Forecast drift due market changes.
- User distrust automation.
- ERP integration delay.

Mitigation:

- Data quality score.
- Human approval loop.
- SKU segmentation.
- Drift monitoring.
- Pilot with champions.
- Batch integration before real-time integration.

### 13.4. Acceptance criteria P7

- Roadmap can be demoed in under 90 seconds.
- Has phase, timeline, resource, cost, KPI, risk.
- Makes explicit assumptions for data not in problem statement.

## 14. P8 - AnalyticsBot Integration

Muc tieu: bot tro thanh tro ly workflow, khong chi hoi dap data.

Files:

- `app/analytics-bot/page.tsx`
- `components/analytics-bot/chat-widget.tsx`
- `lib/ai/tools.ts`

### 14.1. Suggested prompts moi

Bot suggestions:

- "Neu ngan sach mua hang la 500 trieu, nen uu tien SKU nao?"
- "Giai thich vi sao SKU nay can dat hang ngay."
- "Top SKU co loi nhuan at risk cao nhat la gi?"
- "SKU nao dang khoa von ton kho nhieu nhat?"
- "Model hien co drift/sparse risk nao can chu y?"
- "Tao script demo 60 giay cho dashboard nay."

### 14.2. Context-aware bot

Bot widget tren dashboard nen nhan context:

- current page.
- selected SKU.
- selected budget.
- selected decision.

Neu khong lam duoc ngay:

- Button `Ask bot about this SKU` gui prompt prefilled.

### 14.3. Tooling can co

Tools:

- `getProfitRiskSummary`
- `getDecisionQueue`
- `optimizeReplenishmentBudget`
- `explainRecommendation`
- `getModelHealth`
- `getImplementationRoadmap`

### 14.4. Acceptance criteria P8

- Bot tra loi bang data cu the, khong chung chung.
- Bot khong lap lai token usage.
- Bot co the giai thich top decision trong 5 bullet.

## 15. Component System Can Tao

### 15.1. Core components

`MoneyKpiCard`

- props:
  - title.
  - value.
  - helper.
  - tone.
  - icon.
  - delta optional.
- used by dashboard/model trust/replenishment.

`CommandStrip`

- props:
  - headline.
  - subline.
  - primaryAction.
  - secondaryAction.

`DataLineageBadges`

- props:
  - competition.
  - forecast.
  - calendar.
  - enrichment.

`DecisionActionButton`

- props:
  - actionType.
  - disabled.
  - onClick.

`EvidenceDrawer`

- sections:
  - forecast.
  - inventory.
  - financial.
  - source.
  - assumptions.

`CompactMetric`

- for dense panels.

`RiskTab`

- type, count, impact, selected.

`TrustStatusCard`

- metric, value, status, caveat.

### 15.2. Shared formatting

Move repeated formatting to:

- `lib/format.ts`

Functions:

- `formatVnd(value)`
- `formatCompactVnd(value)`
- `formatQuantity(value)`
- `formatPct(value)`
- `formatDays(value)`

Reason:

- Current pages duplicate format functions.
- Consistent output reduces visual noise.

## 16. Copywriting Rules

### 16.1. Standard terminology

Use:

- "Lợi nhuận có nguy cơ mất"
- "Vốn bị khóa"
- "Lợi nhuận được bảo vệ"
- "Khuyến nghị đặt hàng"
- "Hàng cần xả"
- "Dữ liệu cuộc thi"
- "Danh mục bổ sung"
- "Ước tính demo"
- "N-BEATS forecast"
- "ROI-first simulation"

Avoid:

- "Tối ưu tuyệt đối" nếu đang dùng greedy.
- "Accuracy thật" nếu chưa có actual validation ground truth.
- "Dự báo cao hơn thực tế" nếu chỉ so với recent baseline.
- Long descriptions inside cards.

### 16.2. Label length targets

- Sidebar nav: <= 18 chars if possible.
- Card title: <= 32 chars.
- Table header: <= 16 chars.
- Button text: <= 18 chars.
- Tooltip/drawer for longer explanation.

## 17. Visual Design Direction

### 17.1. Look and feel

Target:

- Enterprise control room.
- Dense but calm.
- Money-first.
- Operational.

Not target:

- Marketing landing page.
- Decorative analytics poster.
- Technical report pasted into UI.

### 17.2. Color usage

Semantic colors:

- Red: urgent stockout/profit risk.
- Amber: overstock/locked capital.
- Emerald: protected profit/approved.
- Blue: forecast/model.
- Violet: AI/assistant only if needed, not dominant.
- Slate: neutral/system/data lineage.

### 17.3. Layout rhythm

- Page padding: 24 desktop, 16 tablet/mobile.
- Card padding: 16-20.
- Grid gap: 16 for dense dashboard, 24 for content sections.
- Section max width: dashboards full width; text-heavy detail pages constrained.

### 17.4. Tables

Tables should:

- Use sticky header if long.
- Have compact row height.
- Right-align numeric columns.
- Use monospace for SKU only.
- Put long explanation in drawer.
- Limit visible columns to decision-critical.

## 18. Implementation Order

### Sprint A - Make Dashboard Real

Priority: highest.

Status: completed in code; needs visual smoke test before final demo sign-off.

Tasks:

- [x] Rename dashboard title to "Control Tower" or "Điều hành lợi nhuận" consistently.
- [x] Replace 6 KPI cards with 4 outcome KPIs.
- [x] Add command strip at top.
- [x] Make top decisions table central.
- [x] Add today's recommendation side panel.
- [x] Convert data source section to compact lineage strip.
- [x] Add CTAs linking to forecast/replenishment/decision queue.

Files:

- `app/dashboard/page.tsx`
- possible new components under `components/dashboard/`

Acceptance:

- [x] First viewport works as executive dashboard in code structure.
- [x] Text reduced by at least 40% on first screen.
- [ ] Visual smoke test at 1440x900 confirms no awkward scroll/wrap.

### Sprint B - Demo Flow Links

Status: completed in code; needs verification.

Tasks:

- [x] Add URL param support for selected SKU in forecast.
- [x] Add URL param support/highlight in replenishment.
- [x] Add `View forecast` and `Simulate budget` buttons from dashboard/decision queue.
- [x] Ensure approved state can be shown in decision queue.

Files:

- `app/dashboard/forecast/page.tsx`
- `app/dashboard/replenishment/page.tsx`
- `components/dashboard/decision-detail-drawer.tsx`
- `app/dashboard/page.tsx`

Acceptance:

- [x] One SKU can be followed across dashboard -> forecast -> replenishment in URL-param flow.
- [x] Approval state persists across dashboard/decision/replenishment session.

### Sprint C - Reduce Text on Forecast/Replenishment

Status: completed in code; needs visual smoke test.

Tasks:

- [x] Forecast: chart + action panel first viewport.
- [x] Forecast: move drivers/data lineage into tabs.
- [x] Forecast: make AI 5 bullet panel compact.
- [x] Replenishment: scenario bar + basket + trade-off.
- [x] Replenishment: table below, compact by default.

Acceptance:

- Both pages can be explained in 45 seconds each.

### Sprint D - Model Trust Dashboard

Status: completed in code; needs visual smoke test.

Tasks:

- [x] Convert model health to trust cards + tabs.
- [x] Move narrative into accordions.
- [x] Fix all labels to proxy/estimate where needed.
- [x] Add clear technical score/narrative for PDF part 1.

Acceptance:

- [x] Judge can see technical credibility without reading paragraphs.
- [ ] Visual smoke test confirms tabs/cards are readable at 1440x900.

### Sprint E - Roadmap Page

Status: completed in code; needs visual smoke test.

Tasks:

- [x] Add `/dashboard/roadmap`.
- [x] Add sidebar nav.
- [x] Add 3-phase roadmap.
- [x] Add resources, budget estimate, KPI targets, risks.
- [x] Add explicit cost ranges and assumptions for demo budget.
- [x] Add delivery checkpoints for POC sign-off, pilot adoption, and rollout gate.

Acceptance:

- [x] Covers PDF part 3 in one page.
- [x] Includes phase, timeline, resource, cost, KPI, risk, and assumptions in code.
- [ ] Visual smoke test confirms roadmap can be demoed in under 90 seconds.

### Sprint F - Bot Workflow

Status: completed in code; needs verification.

Tasks:

- [x] Add context-aware prompt buttons.
- [x] Add tools for decision/replenishment/model health if missing.
- [x] Add "Ask bot about this SKU" in drawer/action panels.

Acceptance:

- [x] Bot supports operational questions, not only general Q&A.
- [ ] Verify chat tool calls and prefilled prompts in browser.

## 19. QA Checklist

### 19.1. Functional

- [ ] Dashboard loads without runtime error.
- [ ] Top decisions sorted by financial impact.
- [ ] Click from dashboard to forecast selects correct SKU.
- [ ] Click from forecast to replenishment carries correct SKU.
- [ ] Budget 0 behaves as no spend.
- [ ] Unlimited budget behaves as all eligible.
- [ ] Watchlist search works by SKU and product name.
- [ ] AI recommendation max 5 bullets.
- [ ] No token usage text in UI.
- [ ] Model health returns use absolute return quantity.

### 19.2. Visual

- [ ] No text overlap at 1440x900.
- [ ] No text overlap at 1280x720.
- [ ] No text overlap mobile 390x844.
- [ ] First viewport of dashboard is meaningful without scroll.
- [ ] Tables have horizontal scroll if needed.
- [ ] Buttons do not wrap awkwardly.
- [ ] Color semantics consistent.
- [ ] No giant paragraphs on dashboard pages.

### 19.3. Build

- [ ] `pnpm.cmd exec tsc --noEmit --incremental false`
- [ ] `pnpm.cmd build` or large-heap build if normal build OOMs.
- [ ] Manual smoke test in browser.

### 19.4. Demo

- [ ] 15-minute script rehearsed.
- [ ] 60-second dashboard opening rehearsed.
- [ ] Q&A answers prepared:
  - data assumptions.
  - WRMSSE/backtest limitation.
  - sparse SKU handling.
  - returns handling.
  - ERP integration.
  - why ROI-first not exact knapsack.

## 20. Concrete Definition of Done

UI revamp considered done when:

- `/dashboard` looks and behaves like the primary product dashboard.
- Demo has one complete path from alert to decision to replenishment approval.
- Model Trust page covers technical criteria without overwhelming text.
- Roadmap page covers implementation criteria from PDF.
- All demo claims are traceable to:
  - competition data.
  - N-BEATS forecast.
  - external calendar.
  - explicitly labelled demo enrichment.
- First-time viewer can understand the product in under 60 seconds.

## 21. Open Questions

- Co can giu ten brand "AutoParts Intelligence Platform" hay doi thanh "Profit Control Tower"?
- Co can thiet ke them role persona: CEO, logistics manager, purchasing manager?
- Co nen gom Watchlist vao Decisions de giam nav?
- Co can lam mobile polish hay chi tap trung desktop demo?
- Co co official WRMSSE tu round 2 khong? Neu co, can dua vao Model Trust thay proxy.

## 22. Recommended Next Action

Bat dau voi Sprint A:

1. Sua `/dashboard` truoc.
2. Tao component KPI/command strip/table/panel nho.
3. Giam text first viewport.
4. Them CTA sang decision/forecast/replenishment.

Ly do: day la man hinh dau tien trong demo va la noi hien tai gay cam giac "chua co dashboard" manh nhat.
