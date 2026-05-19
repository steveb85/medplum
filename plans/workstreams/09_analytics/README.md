# Workstream 9: Analytics & Reporting

> **Goal**: Convert all the operational data into insight. Know your business performance at a glance.

---

## Problem Statement

Melissa runs the practice blind. She knows how busy she is, but she doesn't know:
- How much revenue she made this month vs. last month
- How many patients didn't show up
- Which marketing channels are worth the money
- Which providers are most productive
- What her most profitable services are
- How often patients return

---

## Reports Needed

### 1. Today's Dashboard (Quick View)
- Appointments scheduled today
- Revenue collected today (deposits + final)
- New patients today
- No-shows today
- Outstanding balances to collect

### 2. Revenue Report
- By day / week / month / custom range
- By service type (Botox, Filler, Laser, etc.)
- By provider (who generated how much revenue)
- By payment method (Stripe, cash, check)
- Deposit conversion rate (paid / links sent)
- Average booking value

### 3. No-Show / Cancellation Report
- No-show rate by month, by service, by provider
- Late cancellation rate
- Revenue lost to no-shows (estimated average)

### 4. Provider Utilization
- Hours scheduled vs. available
- Procedures completed per day/week
- Revenue per provider
- Patient satisfaction per provider (from surveys)

### 5. Room/Equipment Utilization
- Hours per room per day/week
- Bottlenecks (peak demand)
- Equipment downtime (scheduled maintenance)

### 6. Patient Analytics
- Acquisition source → conversion funnel
- Repeat visit rate
- Average spend per visit
- Lifetime value (LTV)
- Churn (patients who used to come but stopped)

### 7. Lead Analytics
- Leads created by source
- Conversion rate by source
- Time to conversion (days from inquiry to booking)
- Lost leads by reason (if tracked)

### 8. Inventory Report (once built in WS3)
- Product usage by month
- Waste/giveaway volume
- Cost of goods sold (COGS)
- Low stock alerts

---

## Tasks

| # | Task | AC | Effort |
|---|------|---|--------|
| 9.1 | Dashboard widget: today's appointments + revenue | Visible on home page | 2.5h |
| 9.2 | Revenue report with date range | Bar chart by service/period; sum of Invoice resources | 3h |
| 9.3 | No-show / cancellation rate | Metric cards + trend; sources data from Appointment statuses | 1.5h |
| 9.4 | Provider utilization | Pie chart of hours; revenue per hour | 2h |
| 9.5 | Room / equipment utilization | Heatmap of room hours; idle time | 1.5h |
| 9.6 | Patient acquisition & conversion funnel | Funnel chart; source → lead → booked → repeat | 2h |
| 9.7 | Patient retention & LTV | Time between visits; average spend | 2h |
| 9.8 | Export to CSV | Every report has "Export to CSV" button | 1h |
| 9.9 | Lead analytics | Source breakdown; conversion rates | 1.5h |
| 9.10 | Inventory report (once WS3 done) | Product usage, waste, COGS | 2h |

**Total**: 21 hours

---

## Acceptance Criteria

1. Melissa opens the app → sees today's dashboard: 4 appointments, $1,200 collected, 1 no-show
2. Opens Revenue report → selects "This Month" → sees bar chart
3. Sees: Botox $8,500, Filler $3,200, Laser $1,100
4. Opens No-Show report → sees: "No-show rate: 8%, Lost revenue: $320"
5. Opens Provider report → sees: Jennifer revenue $4,200 (85% utilization); Melissa revenue $8,500 (92%)
6. Opens Patient report → sees: Avg. patient LTV: $3,200; Retention rate: 64% come back within 6 months
7. Opens Lead report → sees: Instagram: 17 leads → 4 booked (23.5%) | Google: 12 → 2 (16.6%)
8. Exports Revenue report to CSV → opens in Excel with full breakdown

---

## Open Questions

1. Should reports be real-time or cached (e.g., refresh every hour)?
2. Who can access reports? (Admin only, or all staff?)
3. Do we need PDF export, or CSV is enough?
4. Should the dashboard be the home page, or a separate page?
