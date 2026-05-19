# Workstream 2: Invoicing & Final Payments

> **Goal**: Build the complete financial lifecycle so that every booking generates a bill, deducts the deposit, allows balance payment, and produces a receipt.

---

## Problem Statement

The deposit system works end-to-end (Stripe checkout → payment confirmation → status change). But there is no invoice, no final payment, and no balance calculation.

Current state:
- Service prices exist in ServiceConfig (`minPrice`, `maxPrice`) but never displayed
- `Invoice` FHIR resource has permissions but zero UI/business logic
- `recordFinalPaymentReceived()` exists in `audit-events.ts` but is never called
- `issueRefund()` marks AuditEvents only — no actual Stripe API call

---

## Flow Diagram

```
Booking Created
  ├─→ Appointment.status = pending
  │
  ├─→ Deposit requested ($250) → Stripe checkout
  │   ├─→ Patient pays → Appointment.status = booked
  │   └─→ Records saved as AuditEvents
  │
  ├─→ Treatment completed
  │   ├─→ Invoice created with line items
  │   ├─→ Total price calculated
  │   ├─→ Balance due = Total - Deposit
  │   └─→ "Send Final Payment Request" created
  │
  └─→ Final payment
      ├─→ Patient pays balance → Invoice paid
      ├─→ Receipt sent via Email
      ├─→ Appointment.status = fulfilled
      └─→ All recorded in AuditEvents
```

---

## Tasks

| # | Task | AC | Effort |
|---|------|---|--------|
| 2.1 | Pricing calculation utility | `calculateTotalPrice(serviceRequests)`, `calculateBalanceDue(total, deposit)` | 2h |
| 2.2 | Invoice creation | FHIR `Invoice` + `InvoiceLineItem` per service | 2h |
| 2.3 | Price display on BookingDetailPage | Total, deposit paid, balance due visible | 1.5h |
| 2.4 | "Send Final Payment Request" button | Stripe checkout with multi-line items, SMS/Email sent | 3h |
| 2.5 | "Mark as Paid" for final balance | Manual entry (cash/check/ etc.), `recordFinalPaymentReceived()` called | 2h |
| 2.6 | Wire orphaned `recordFinalPaymentReceived` | Called from Mark as Paid flow | 1h |
| 2.7 | Implement Stripe refund via API | Actual Stripe API call in `issueRefund()` | 2h |
| 2.8 | Email receipt generation | Line items breakdown, deposit, tax, total | 2h |
| 2.9 | Edge cases | Overpayment → credit notes; split tender | 2h |

**Total**: 16 hours

---

## Prerequisites

- Service prices must be configured in ServiceCatalog (already true)
- Deposit status must be tracked (already true via AuditEvents)

---

## Acceptance Criteria

1. Nurse books 2 services totalling $1,500
2. Patient pays $250 deposit
3. After treatment, BookingDetailPage shows: Total $1,500, Deposit $250, Balance $1,250
4. Nurse clicks "Send Payment Request"
5. Patient receives Stripe link via SMS/Email for $1,250
6. Patient pays
7. BookingDetailPage shows green "Paid in Full"
8. Staff see notification: "Final payment received"
9. Email receipt arrives with breakdown
10. If patient pays cash: nurse clicks "Mark as Paid", enters $1,250, notes "Cash"
11. Refund request actually calls Stripe API and processes partial or full refund

---

## Open Questions

1. Should tax be calculated? If yes, do we store tax rate in practice settings?
2. Do we need per-provider pricing (providerRates exists in ServiceConfig but unused)?
3. Do packages/treatment series get invoiced all at once or per-visit?
4. Should receipts be stored as FHIR Binary or PDF generation at request time?
