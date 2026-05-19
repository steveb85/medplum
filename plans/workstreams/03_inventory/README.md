# Workstream 3: Inventory Management

> **Goal**: Track every unit of every product — Botox vials, filler syringes, retail skincare — including waste, giveaways, and manual adjustments.

---

## Problem Statement

Absolutely no inventory management exists. Aesthetic injectables and retail products are untracked. When Botox is reconstituted, the system has no idea. When units are wasted, nothing is recorded. When a moisturizer is sold, stock is not deducted.

As Melissa said: *"There must be manual adjustment and not just exactly what was taken in the appointment, however tracking this adjustment is also nice... we gave away three units of botox and a bottle of moisturiser last week is good information."*

---

## Core Principle

> Every unit accounted for. Manual adjustments fine, but every adjustment leaves an audit trail.

---

## Data Model

### Product

| Field | Type | Notes |
|-------|------|-------|
| id | string | FHIR extension or custom resource |
| name | string | "Botox Cosmetic", "Juvederm Ultra XC", "SkinCeuticals Vitamin C Serum" |
| type | enum | `injectable` (botox, filler), `retail`, `consumable` |
| brand | string | "Botox", "Dysport", "Juvederm", etc. |
| unit | string | "unit" (Botox), "syringe" (filler), "bottle" / "tube" (retail), "ml" |
| sku | string | Internal SKU |
| costPerUnit | number | Cost basis |
| reorderThreshold | number | Alert when stock < this |

### Batch (for injectables — required for lot tracking)

| Field | Type |
|-------|------|
| id | string |
| productId | string (reference to Product) |
| lotNumber | string |
| expirationDate | Date |
| receivedDate | Date |
| originalQuantity | number |
| currentQuantity | number |
| reconstitutionDate | Date (injectables only) |
| diluent | string (injectables only) |
| concentration | string (injectables only) |
| status | `active` | `used_up` | `expired` | `discarded` |

### InventoryAdjustment

| Field | Type |
|-------|------|
| id | string |
| productId | reference |
| batchId | reference (nullable) |
| quantity | number (positive = in, negative = out) |
| reason | `dispensed` | `wasted` | `expired` | `sold` | `received` | `reconstituted` | `manual` | `giveaway` |
| referenceId | reference to Procedure/Invoice/Appointment (provenance) |
| notes | string (free text reason) |
| date | Date |
| actor | reference to Practitioner |

---

## Tasks

| # | Task | AC | Effort |
|---|------|---|--------|
| 3.1 | Define Product data model | Extension or resource; name, type, brand, unit, SKU, cost | 2h |
| 3.2 | Define Batch model for injectables | Lot, expires, original/current qty, reconstitution data | 2h |
| 3.3 | Define InventoryAdjustment model | Product, qty, reason, reference, timestamp, actor | 2h |
| 3.4 | Admin UI: Product catalog CRUD | Add/edit/deactivate; set reorder threshold | 3h |
| 3.5 | Admin UI: Stock dashboard | Products × quantities; reorder alerts | 3h |
| 3.6 | Admin UI: Adjustment page + history | Quick adjust with reason; full history per product | 2h |
| 3.7 | Integrate Botox page: deduct on save | On `handleSave`, deduct `unitsUsed + unitsWasted` from active batch | 3h |
| 3.8 | Add waste field to Botox page | "Waste (units):" input alongside "Total Units" | 1h |
| 3.9 | Reconstitution tracking | UI to mark vial "opened today", record diluent & concentration | 2h |
| 3.10 | Product sales on BookingDetailPage | "Add Product" search → add to invoice line items → stock deduct | 3h |
| 3.11 | Waste/giveaway report | Filtered by date; shows products, quantities, reasons | 2h |
| 3.12 | Auto-alerts (low stock, expiring, stale open vial) | Push notification when thresholds hit | 3h |

**Total**: 30 hours

---

## Acceptance Criteria (User Stories)

### Story 1: Opening a vial
1. Nurse receives 100-unit Botox vial (lot: ABC123, expires 2026-10-01)
2. Enters it in system → stock shows 100 units
3. Opens vial → marks "reconstituted today with 2.0ml preservative-free saline"
4. System creates `Batch` with status `active`, current qty 100

### Story 2: Treatment usage
1. Patient gets Botox treatment
2. Nurse records: 35 units used, 5 wasted
3. Hits Save → stock shows 60 remaining
4. System creates 2 InventoryAdjustments: `dispensed` -35, `wasted` -5, both linked to Procedure

### Story 3: Product sale
1. At checkout, nurse says "Would you like a vitamin C serum?"
2. Clicks "Add Product" → searches → selects → adds to invoice
3. Stock of the serum decreases by 1
4. Item appears on invoice as separate line item

### Story 4: Give-away
1. Nurse wants to give a sample moisturizer to patient
2. Clicks "Add Product" → selects sample → marks "giveaway" reason
3. Stock decreases; notes "Complimentary after Botox session" saved

### Story 5: Waste report
1. Nurse opens weekly waste report
2. Sees: "5 units Botox wasted, 1 serum sample given away" with dates and reasons

### Story 6: Alert
1. Stock of Botox falls to 45 units (threshold = 50)
2. Melissa receives push notification: "Botox stock low (45 units) — reorder needed"

---

## Open Questions

1. Should injectables auto-deduce on treatment save (using Botox page as model), or should it be a separate "Dispense from stock" step?
2. For reconstituted Botox: discard after how many hours? (Industry standard: use within 24 hours)
3. Do we need to handle partial vial tracking? (e.g., 30 units used from one vial Monday, 25 from same vial Wednesday)
4. Should retail products ever be "dispensed" as part of treatment (like a complimentary serum), or only sold?
