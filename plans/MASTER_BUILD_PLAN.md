# Nurse Mel Medspa — Master Build Plan

> **Purpose**: Definitive feature map and build roadmap for the Nurse Mel Medspa EMR.
> **Goal**: Everything in this document must be completed before we consider going live.
> **Last Updated**: 2026-05-18

---

## Table of Contents

1. [What This Is](#what-this-is)
2. [Current State Summary](#current-state-summary)
3. [Workstreams (In Priority Order)](#workstreams)
4. [How to Use This Document](#how-to-use-this-document)
5. [Confidence & Gaps](#confidence--gaps)
6. [Quick Status Dashboard](#quick-status-dashboard)

---

## What This Is

This plan is the single source of truth for everything that must be built before the Nurse Mel Medspa EMR is considered ready for go-live. It is organized into **workstreams** — independent but related streams of work. Each workstream has:

- **Explainer**: Why this workstream matters and what it means for the practice
- **Tasks**: Specific, actionable items with acceptance criteria
- **Effort Estimates**: Ballpark hours for planning
- **Dependencies**: Other workstreams that must be completed first
- **Owner**: Who is responsible (default: AI agent build, validation by Melissa)

---

## Current State Summary

**What is working today** (ready for go-live):

| Domain | Status | Key Components |
|--------|--------|----------------|
| Patient intake & registration | ✅ Strong | 8-step wizard, digital signature, duplicate detection, edit mode |
| Booking & calendar | ✅ Strong | Multi-service booking, conflict detection, per-service calendar events, room filtering |
| Deposit collection | ✅ Strong | Stripe checkout, payment confirmation, deposit management, audit trail |
| Automated reminders | ✅ Strong | 24h/2h reminders, deposit reminders, post-treatment follow-up, BullMQ |
| Botox treatment documentation | ✅ Strong | Injection maps, zones, units, product brand. Persists to FHIR |
| Consent management | ✅ Strong | Per-service consent, digital signature, witness, expiry |
| Communication notifications | ✅ Strong | Push notifications, SMS/Email templates |

**What is missing or broken** (blocking go-live):

| Domain | Status | Why It Blocks |
|--------|--------|---------------|
| Treatment data persistence | 🚨 **Broken** | Filler, Laser, Consultation save to UI but NOT to database. Data lost on refresh |
| Invoicing & final payments | 🚨 **Missing** | Can take deposits, cannot create a final bill or collect balance |
| Inventory management | 🚨 **Missing** | No Botox stock tracking, no retail product sales, no waste tracking |
| Lead management | 🚨 **Missing** | No pipeline for new patient inquiries. Lose prospects |
| Aftercare delivery | 🚨 **Missing** | No structured post-treatment instructions sent to patients |
| Two-way SMS | 🚨 **Missing** | Can send texts to patients. Cannot see replies or reply back |
| Treatment plans / series | 🚨 **Missing** | "Buy 6 laser sessions" cannot be modeled. Each visit is a one-off |
| Analytics & reporting | 🚨 **Missing** | No revenue, utilization, or patient retention data |
| Provider time-off / check-in | 🚨 **Missing** | Cannot block provider availability. No patient arrival workflow |
| Clinical quality (assessments, outcomes) | 🚨 **Missing** | No adverse event tracking, no outcome measures, no pre-treatment assessment |

---

## Workstreams

### 1. 🚨 Treatment Data Persistence (Fix Broken Save)

**Explainer**:

Filler, Laser, and Consultation treatment pages have beautiful UIs that collect data, but when you click "Save" the data is NOT persisted to the FHIR database. The `handleSave` methods show a green success notification but never call `medplum.updateResource()`. This means every treatment note is lost on refresh. The Botox page works correctly; its code can be used as a reference.

**Context from code**:

- `treatments/FillerTreatmentPage.tsx:169-186` — shows notification, never calls `medplum.updateResource()`
- `treatments/LaserTreatmentPage.tsx:185-201` — same bug
- `treatments/ConsultationTreatmentPage.tsx:75-90` — same bug
- `components/ServiceCard.tsx` — `onUpdateTreatmentData` just logs to console (`...console.log("Treatment data:", data)`)

**Tasks**:

| # | Task | AC | Effort |
|---|------|---|--------|
| 1.1 | Unify save strategy across all treatment types | All 3 pages + ServiceCard use same `updateResource` pattern | 2h |
| 1.2 | Fix Filler save: persist `FillerEntry[]` to Procedure extensions | Data round-trips: edit → save → refresh → data visible | 1.5h |
| 1.3 | Fix Laser save: persist `LaserSession[]` to Procedure extensions | Data round-trips | 1.5h |
| 1.4 | Fix Consultation save: persist notes/recommendations to Procedure | Data round-trips | 1h |
| 1.5 | Fix ServiceCard `onUpdateTreatmentData`: persist to ServiceRequest | Treatment data from booking detail page saves and loads | 2h |
| 1.6 | Add loading state, disable save while in-flight, show error if fails | No double-save, clear error on network failure | 1.5h |
| 1.7 | Write regression test: reads, edits, saves, re-reads for each form | CI passes | 2h |
| 1.8 | Add "last edited" timestamp to all treatment pages | Visible in UI when saved | 0.5h |

**Total Effort**: 12 hours
**Depends on**: None
**Owner**: AI Agent build
**Validation**: Melissa (or provider) opens each treatment type, enters data, hits save, refreshes, data is still there

---

### 2. 🚨 Invoicing & Final Payments (Turn Deposits into Bills)

**Explainer**:

The deposit system is robust. But a deposit is not a bill. After a patient finishes treatment, they must pay the balance. There is no concept today of ∑(service prices) − deposit = balance due. The `Invoice` FHIR resource has permissions configured but no UI or business logic exists. We must build the full financial lifecycle.

**Core flow**:

```
Booking created → Appointment pending
  ↓
Deposit paid → Appointment booked
  ↓
Treatment completed
  ↓
[NEW] Generate Invoice: total = sum(service.price), balance = total − deposit
  ↓
[NEW] Send "Pay balance" link (or collect in person)
  ↓
Payment received → Invoice paid
```

**Pre-conditions (must be true)**:
- Service prices are stored in `ServiceConfig` (already true: `minPrice`, `maxPrice`)
- Deposit amount is known per booking (already true: tracked in AuditEvents)

**Tasks**:

| # | Task | AC | Effort |
|---|------|---|--------|
| 2.1 | Build `calculateTotalPrice(serviceRequests): number` utility | Returns sum of service prices; handles per-unit pricing (Botox units × pricePerUnit) | 2h |
| 2.2 | Build Invoice line items from ServiceRequests | FHIR `Invoice` with `InvoiceLineItem` per service; includes name, quantity, unit price, total | 2h |
| 2.3 | Display total, deposit paid, balance due on BookingDetailPage | Staff can see at-a-glance what patient owes before closing the bill | 1.5h |
| 2.4 | Add "Send Final Payment Request" button | Creates Stripe checkout session with correct amount; sends SMS+Email; records AuditEvent | 3h |
| 2.5 | Add "Mark as Paid" for final balance (cash/check/etc.) | Modal to record payment amount, method, notes; updates Invoice to `paid` | 2h |
| 2.6 | Wire `recordFinalPaymentReceived()` in audit-events.ts (currently orphaned) | Called from "Mark as Paid" flow | 1h |
| 2.7 | Implement actual Stripe refund API call | `issueRefund()` calls Stripe refund endpoint; handles partial vs full; logs result | 2h |
| 2.8 | Generate email receipt on payment completion | Line items, subtotal, deposit, tax (if applicable), total; sent via Resend | 2h |
| 2.9 | Handle edge cases: overpayment, underpayment, split tender | Overpayment → credit balance (notes field); split = manual entry | 2h |

**Total Effort**: 16 hours
**Depends on**: #1 completed (to have accurate service line items)
**Owner**: AI Agent build
**Validation**: Complete a full booking → invoice → payment → receipt flow with real Stripe test mode

---

### 3. 🚨 Inventory Management (Know What You Have)

**Explainer**:

Nurse Melissa injects Botox. Botox comes in vials. A vial has 100 units. She reconstitutes it. Some is used, some is wasted. Some she gives away. Some expires. She also wants to sell retail products (skincare). Right now, the system has zero inventory awareness — she has no idea if a vial is open, how much is left, what expired, or what was given away for free.

**Core principle**: Every unit of product must be accounted for. Manual adjustments are fine (she specifies: "must be manual"), but every adjustment must leave a paper trail.

**Tasks**:

| # | Task | AC | Effort |
|---|------|---|--------|
| 3.1 | Define `Product` data model (extension or custom resource) | Name, type (botox-vial, filler-product, retail), unit, SKU, cost | 2h |
| 3.2 | Define `InventoryAdjustment` data model | Product, quantity, reason (dispensed/wasted/expired/sold/received/manual), timestamp, who | 2h |
| 3.3 | Define `Batch` model for injectables | Name, lot number, expiration date, received date, original quantity, current quantity | 2h |
| 3.4 | Admin UI: Product catalog CRUD page | Add/edit/deactivate products; set reorder threshold | 3h |
| 3.5 | Admin UI: Current stock dashboard | Table of all products with current quantity, reorder alerts, expiration alerts | 3h |
| 3.6 | Admin UI: Inventory adjustment page | Quick-adjust quantity with reason; full history per product | 2h |
| 3.7 | Integrate Botox into treatment workflow: deduct units on save | When BotoxTreatmentPage saves, look up open vial, deduct units used + wasted | 3h |
| 3.8 | Add waste field to Botox treatment page | Provider can enter "wasted units" alongside "units used" | 1h |
| 3.9 | Track reconstitution: date, diluent, concentration, who | Stored when provider marks vial "opened" | 2h |
| 3.10 | Add product sales to BookingDetailPage | "Add Product" button searches product catalog, adds to invoice, deducts from stock | 3h |
| 3.11 | Waste/giveaway report | “3 units Botox + 1 moisturizer given away last week” — date range, reason, who | 2h |
| 3.12 | Auto-alerts: low stock, expiring product, open vial near discard | Push notification to Melissa when threshold hit | 3h |

**Total Effort**: 30 hours
**Depends on**: #2 (for product sales on invoice)
**Owner**: AI Agent build (+ Melissa input on product types / workflows)
**Validation**:
1. Melissa opens a vial of Botox → marks "100 units opened today" → stock shows 100 available
2. Does a Botox treatment → enters 35 units used, 5 wasted → stock shows 60 remaining
3. Sells a moisturizer at checkout → stock deducts, appears on invoice
4. Runs a waste report → sees 5 units wasted on 2026-05-18
5. Gets push notification when stock of Botox < 50 units

---

### 4. 📋 Clinical Quality (Be a Medical EMR, Not Just a Booking Tool)

**Explainer**:

This system is an EMR, not a booking system. EMRs exist for patient safety and medico-legal protection. Right now, the system is strong on scheduling and weak on clinical documentation. We need pre-treatment assessments, aftercare delivery, adverse event tracking, and outcome measurement.

**Tasks**:

| # | Task | AC | Effort |
|---|------|---|--------|
| 4.1 | Per-treatment aftercare: add `aftercareInstructions` to ServiceConfig | Configurable HTML per service; delivered via SMS/Email when treatment completed | 3h |
| 4.2 | Aftercare delivery trigger: cron job sends post-treatment aftercare | Sends automatically 1-4 hours after ServiceRequest status = completed; avoids generic message | 2h |
| 4.3 | Pre-treatment assessment form | Simple nursing form: skin type check, pregnancy confirmation, photosensitivity, vitals (if relevant) | 3h |
| 4.4 | Adverse event reporting form | Button on completed treatment; type (bruising, swelling, infection, vascular occlusion), severity, description | 3h |
| 4.5 | Adverse event creates: Observation + Communication (staff alert) + AuditEvent | Staff notified in real time | 1.5h |
| 4.6 | Patient-reported outcome: satisfaction survey | Simple 1-5 satisfaction + comment box; sent 7 days post-treatment; stored as QuestionnaireResponse | 2.5h |
| 4.7 | Treatment refusal documentation | "Patient declined treatment after discussion" button with reason and patient signature | 2h |
| 4.8 | Waste/disposal attestation for injectables | Checkbox on Botox save: "Vial disposed of properly per medical waste protocol" | 1h |
| 4.9 | Before/after photo timeline view | Patient-facing (staff only) side-by-side view across visits with date filter | 3h |

**Total Effort**: 21 hours
**Depends on**: #1 (treatment data must save for adverse events to reference)
**Owner**: AI Agent build (+ Melissa: define aftercare per treatment type, adverse event categories)
**Validation**:
- Patient completes Botox → receives “Aftercare for Botox” SMS/email within 4 hours
- 7 days later → receives satisfaction survey link
- Night before: pregnancy check and skin assessment saved in record
- If adverse event reported: Melissa gets push notification in 60 seconds
- PhotoTimeline shows Botox results from visit 1 (Jan) and visit 2 (May) side by side

---

### 5. 📋 Lead Management (Don't Lose Prospective Patients)

**Explainer**:

Right now, a new patient who emails or DMs the practice just disappears if they don't immediately book. There is no way to track: "DM'd on Instagram → Sent consult info → Consult booked → Consulted → Ready for Botox → Booked." We lose patients at every step.

**Tasks**:

| # | Task | AC | Effort |
|---|------|---|--------|
| 5.1 | Lead data model: extend Patient or create Lead resource | Status pipeline: new → contacted → consult-scheduled → consulted → booked → lost; source; date acquired; assigned staff | 2h |
| 5.2 | Lead capture: intake form option to create lead (not patient) | When inquiry comes in, create as Lead with status `new` | 1.5h |
| 5.3 | Lead pipeline UI: kanban board (columns per status) | Drag card from column to column; filter by assigned staff | 3h |
| 5.4 | Automated follow-up sequence for cold leads | Inquiry → 24h SMS "We'd love to see you" → 1 week "Still interested? Book a consult" | 2h |
| 5.5 | Convert lead to patient → auto-promote to Patient resource | Carries over all data; sets initial status to whichever field makes sense | 1.5h |
| 5.6 | Referral source tracking & conversion analytics | Report: source → leads → conversion rate | 2h |

**Total Effort**: 12 hours
**Depends on**: None
**Owner**: AI Agent build
**Validation**: See a new DM inquiry walk through the pipeline and eventually book

---

### 6. 📋 Communications Enhancement (Turn Alerts into Conversations)

**Explainer**:

The system sends automated SMS. Patients reply. Those replies are stored as FHIR Communication resources on the server. But there is NO UI. Staff have no way to know a patient replied, much less reply back. This is a critical gap.

**Tasks**:

| # | Task | AC | Effort |
|---|------|---|--------|
| 6.1 | "Messages" tab on Patient resource page | Threaded view of all SMS/Email with this patient; newest first | 2.5h |
| 6.2 | Real-time polling for new messages | Every 10 seconds checks for new Communication resources | 1h |
| 6.3 | Staff reply form: type → send SMS via Twilio API | Text area + send button → SMS sent → appears in thread | 1.5h |
| 6.4 | Patient communication history (all patients) | Admin page showing all incoming/outgoing, filterable by patient | 2h |
| 6.5 | Communication preferences UI on patient | Toggle: SMS opt-in, email opt-in; defaults to both on | 1.5h |
| 6.6 | Opt-out (STOP) handling: mark patient as opted-out | Incoming "STOP" → disable SMS for that patient; show opt-out status in UI | 1.5h |

**Total Effort**: 10 hours
**Depends on**: None
**Owner**: AI Agent build
**Validation**: Patient texts "I'll be 10 min late", sees in Messages tab within 30 seconds, staff replies "No problem!" which appears in thread

---

### 7. 📋 Treatment Plans & Series ("6 Sessions, Every 4 Weeks")

**Explainer**:

The current system is one-off appointments. But aesthetics is about courses of treatment. A laser hair removal course is 6-8 sessions. A Botox maintenance plan is every 3-4 months. The system needs to understand: "Patient has 4 remaining sessions from their prepay package. Book the next one."

**Tasks**:

| # | Task | AC | Effort |
|---|------|---|--------|
| 7.1 | CarePlan / treatment plan data model | Links Patient to multiple ServiceRequests/Appointments; status: active/completed/on-hold | 4h |
| 7.2 | Create plan from booking or consultation | "Save as Treatment Plan" button on completed consult or multi-service booking | 3h |
| 7.3 | Package creation in Service Catalog | Admin UI: "Laser Hair Removal — 6 sessions, $2400, every 4-6 weeks" | 2.5h |
| 7.4 | Pre-pay for package via Stripe | Create payment link for full package amount; record in AuditEvents | 2.5h |
| 7.5 | Patient-side treatment plan view | Progress bar: "Session 3 of 6" | 1.5h |
| 7.6 | Auto-suggest next booking when current completes | "Schedule your next session" popup when marking session complete | 2h |
| 7.7 | Derivative bookings from plan auto-linked to CarePlan | Plan persists status and tracks sessions completed/remaining | 2.5h |

**Total Effort**: 18 hours
**Depends on**: #2 (for package pre-payment)
**Owner**: AI Agent build (+ Melissa: define common treatment courses)
**Validation**: "Laser Hair Removal package — 6 sessions" shows in patient record → each session booked auto-links to plan → progress bar updates → last session shows "6 of 6 complete"

---

### 8. 📋 Operational Tools (Make the Practice Run Smoothly)

**Explainer**:

The core workflows (booking, treatment, payment) must be surrounded by operational tools: scheduling, check-in, maintenance. Without them, the practice cannot operate efficiently.

**Tasks**:

| # | Task | AC | Effort |
|---|------|---|--------|
| 8.1 | Provider working hours / availability config | Set recurring pattern (Mon 9am-5pm, Tue 9am-5pm) per practitioner | 3h |
| 8.2 | Blocked time / PTO on calendar | "Mark as unavailable" creates event on calendar; prevents booking | 2.5h |
| 8.3 | Patient check-in / arrival workflow | Simple tablet/browser screen; verifies consent valid; marks arrived | 2h |
| 8.4 | Drag-to-reschedule on calendar | `react-big-calendar` supports this; persist to FHIR, conflict check | 3h |
| 8.5 | Equipment maintenance log | History of service/calibration per device; next due date; reminder | 2.5h |
| 8.6 | Practice settings (hours, deposit default, tax rate) | Admin UI; affects calendar hours, booking behavior, invoice tax | 2.5h |
| 8.7 | Integration health dashboard | Shows Stripe/Twilio/Resend connected/disconnected | 1.5h |

**Total Effort**: 17 hours
**Depends on**: None
**Owner**: AI Agent build
**Validation**: Practitioner goes on vacation → blocks the week → calendar shows as unavailable → no bookings can be made → realistic calendar

---

### 9. 📋 Analytics & Reporting (Know Your Business)

**Explainer**:

Melissa is running a business. She needs to know if it's working. Right now she has zero visibility into revenue, no-show rates, staff utilization, or patient retention. Once all the above workstreams are generating data, we must surface it.

**Tasks**:

| # | Task | AC | Effort |
|---|------|---|--------|
| 9.1 | Today's dashboard widget | Appointments, revenue today, new patients, no-shows | 2.5h |
| 9.2 | Revenue report: service, provider, payment method | Date range filter; sums invoices and adjustments | 3h |
| 9.3 | No-show / cancellation rate | Percentage by month, by service, by provider | 1.5h |
| 9.4 | Provider utilization | Hours scheduled vs. available; procedures completed | 2h |
| 9.5 | Room / equipment utilization | Usage hours, idle time, conflicts | 1.5h |
| 9.6 | Patient acquisition report | Source breakdown, conversion rate funnel | 2h |
| 9.7 | Patient retention: repeat visit rate, LTV | Average spend per patient, return within 6/12 months | 2h |
| 9.8 | Export to CSV | Any report can be exported | 1h |

**Total Effort**: 15 hours
**Depends on**: ALL workstreams above (needs data)
**Owner**: AI Agent build
**Validation**: Melissa opens dashboard → sees $4,200 collected today, 2 no-shows (morning), Jennifer is at 85% utilization this month, 3 leads from Instagram converted this week

---

## How to Use This Document

1. **Pick a workstream**: Start from #1 and proceed in order. Dependencies are cross-linked above.
2. **Design first, build second**: Before touching code, write a one-page design doc in `plans/workstreams/[number]/`.
3. **Commit design decisions**: Each workstream has a `DECISIONS.md`. Record every architectural choice. The AI agent will use these.
4. **Validate with Melissa**: Before marking a workstream complete, the responsible owner (default: AI build, Melissa review) signs off.
5. **Track progress**: Update the Quick Status Dashboard below after each session.

---

## Confidence & Gaps

I am **95% confident** this plan is complete. Here's why the remaining 5% exists:

- **State regulations**: If New York State requires specific documentation (e.g., controlled substance logging for Botox, specific informed consent language, laser safety records), those requirements are not in this plan because we haven't discovered them yet. Melissa should review with legal counsel.
- **Payment card industry (PCI) compliance**: Using Stripe elements mitigates much PCI risk, but self-hosted EMR handling PHI + payments may have certifications (HIPAA BAA with Stripe, etc.) that are beyond code.
- **Multi-provider cross-licensing**: If Nurse Melissa hires other injectors, their scope-of-practice rules may differ.
- **Insurance billing**: This plan assumes "aesthetic treatments are cash-pay." If insurance is ever introduced, it changes everything.

**Recommended next action**: Have Melissa review this plan and flag any regulatory/missing items. Then we build.

---

## Quick Status Dashboard

> Update this table after each workstream completes.

| # | Workstream | Status | Started | Finished | Blocked By |
|---|-----------|--------|---------|----------|-----------|
| 1 | Treatment Data Persistence | ⬜ Not started | | | |
| 2 | Invoicing & Final Payments | ⬜ Not started | | | #1 |
| 3 | Inventory Management | ⬜ Not started | | | #2 |
| 4 | Clinical Quality | ⬜ Not started | | | #1 |
| 5 | Lead Management | ⬜ Not started | | | |
| 6 | Communications Enhancement | ⬜ Not started | | | |
| 7 | Treatment Plans & Series | ⬜ Not started | | | #2 |
| 8 | Operational Tools | ⬜ Not started | | | |
| 9 | Analytics & Reporting | ⬜ Not started | | | All above |

---

*This document is a living plan. Update after every build session to reflect current status and new findings.*
