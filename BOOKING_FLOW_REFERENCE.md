# Booking Flow Reference - Actions, Storage, Notifications

**Created**: May 7, 2026  
**Purpose**: Complete reference table for all booking actions, where they're stored, how they appear in activity history, and notification details.  
**Last Updated**: May 7, 2026

---

## Complete Booking Actions Table

| # | Action | Trigger Location | Storage Method | Activity History Display | Reason Requested? | Notification Sent? | Notification Type | Notification Wording | Recipients |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Booking Created** | `CreateAppointmentModalV3.tsx` (~line 780) | AuditEvent via `recordBookingCreated()` | "Booking created by [name]: [service names]" | No | ✅ Yes | `appointment-created` | "New Appointment: [service] scheduled for [name] on [date] at [time]" | ALL practitioners (broadcast) |
| 2 | **Booking Edited** | `CreateAppointmentModalV3.tsx` (~line 773) | AuditEvent via `recordBookingEdited()` | "Booking edited: [changes]" or "Booking edited from modal" | No | ❌ No | N/A | N/A | None |
| 3 | **Deposit: Send Payment Link** | `BookingDetailPage.tsx` (~line 1410) | AuditEvent via `recordDepositRequested()` | "Payment link sent: Amount: $X • Via: [method]" | No | ✅ Yes | `deposit-payment-link` (TBD) | "Payment link sent for [service] - [name]" | Patient (SMS/Email) |
| 4 | **Deposit: Amount Changed** | `BookingDetailPage.tsx` (~line 690) | AuditEvent via `recordDepositAmountChanged()` | "Deposit amount changed: From $X to $Y" | Yes (in modal) | ❌ No | N/A | N/A | None |
| 5 | **Deposit: Mark as Paid (Manual)** | `BookingDetailPage.tsx` (~line 1420) | AuditEvent via `recordDepositPaid()` | "Deposit paid via manual by [name]: Amount: $X" | No | ✅ Yes | `appointment-approved` | "Appointment Approved: [name] on [date] at [time] has been approved" | Assigned providers + assistants |
| 6 | **Deposit: Paid Online (Stripe)** | Stripe webhook → `recordDepositPaid()` | AuditEvent via `recordDepositPaid()` | "Deposit paid via online by [name]: Amount: $X" | No | ✅ Yes | `appointment-approved` | "Appointment Approved: [name] on [date] at [time] has been approved" | Assigned providers + assistants |
| 7 | **Deposit: Waive** | `BookingDetailPage.tsx` (~line 1430) | AuditEvent via `recordDepositWaived()` | "Deposit waived: [reason]" | Yes (in modal) | ❌ No | N/A | N/A | None |
| 8 | **Deposit: Undo Payment** | `BookingDetailPage.tsx` (~line 1456) | AuditEvent via `recordPaymentUndone()` | "Payment undone by [name]: [reason]" | Yes (in modal) | ❌ No | N/A | N/A | None |
| 9 | **Deposit: Refund** | `BookingDetailPage.tsx` (~line 1440) | AuditEvent via `recordRefundIssued()` | "Refund of $X issued by [name]: [reason]" | Yes (in modal) | ❌ No | N/A | N/A | None |
| 10 | **Status: Pending → Booked** | `updateStatus('booked')` (line ~673) | AuditEvent via `recordBookingStatusChange()` + Appointment.status = 'booked' | "Status changed: Pending → Booked" | No* | ✅ Yes (as "Appointment Approved") | `appointment-approved` | "Appointment Approved: [name] on [date] at [time] has been approved" | Assigned providers + assistants |
| 11 | **Status: Booked → Arrived** | `updateStatus('arrived')` (line ~1343) | AuditEvent via `recordBookingStatusChange()` + Appointment.status = 'arrived' | "Status changed: Booked → Arrived" | No | ❌ No | N/A | N/A | None |
| 12 | **Status: Arrived → Fulfilled** | Via ServiceCard "Complete" button | AuditEvent via `recordServiceCompleted()` or `recordTreatmentMilestone()` | "Treatment service completed" | No | ❌ No | N/A | N/A | None |
| 13 | **Status: Booked → No-Show** | `updateStatus('noshow')` (line ~1352) | AuditEvent via `recordBookingStatusChange()` + Appointment.status = 'noshow' | "Status changed: Booked → No-Show" | No | ❌ No | N/A | N/A | None |
| 14 | **Status: No-Show → Undo** | `updateStatus('booked')` (line ~1361) | AuditEvent via `recordBookingStatusChange()` + Appointment.status = 'booked' | "Status changed: No-Show → Booked" | Yes (in modal) | ❌ No | N/A | N/A | None |
| 15 | **Status: Any → Cancelled** | `updateStatus('cancelled')` (line ~1469) | AuditEvent via `recordBookingStatusChange()` + Appointment.status = 'cancelled' + `cancellation-reason` extension | "Status changed: [X] → Cancelled" | Yes (in modal) | ✅ Yes (as "Appointment Cancelled") | `appointment-cancelled` | "Appointment Cancelled: [name] on [date] has been cancelled" | Assigned providers + assistants |
| 16 | **Status: Cancelled → Uncancel** | `updateStatus(targetStatus)` (line ~1370) | AuditEvent via `recordBookingStatusChange()` + Appointment.status restored to previous (pending/booked/arrived) + `uncancel-reason` extension | "Status changed: Cancelled → [Previous Status]" | Yes (in modal) | ❌ No | N/A | N/A | None |
| 17 | **Consent: Signed** | `ConsentModal.tsx` (~line 210) | AuditEvent via `recordConsentSigned()` | "Consent Signed: Service: [service name]" | No | ❌ No | N/A | N/A | None |
| 18 | **Service: Start** | ServiceCard "Start Treatment" button | AuditEvent via `recordServiceStarted()` or `recordTreatmentMilestone()` | "Treatment service started" | No | ❌ No | N/A | N/A | None |
| 19 | **Service: Complete** | ServiceCard "Complete Treatment" button | AuditEvent via `recordServiceCompleted()` or `recordTreatmentMilestone()` | "Treatment service completed" | No | ❌ No | N/A | N/A | None |
| 20 | **Room/Equipment Changed** | Edit Booking (if detected) | AuditEvent via `recordBookingEdited()` (in changes description) | "Room changed from X to Y for service Z" | No | ❌ No | N/A | N/A | None |
| 21 | **Final Payment: Requested** | ❌ MISSING | ❌ MISSING | ❌ MISSING | N/A | ❌ MISSING | `final-payment-requested` (TBD) | "Final payment requested for [name]" | Patient (SMS/Email) |
| 22 | **Final Payment: Received (Manual)** | ❌ MISSING | ❌ MISSING | ❌ MISSING | N/A | ❌ MISSING | `final-payment-received` (TBD) | "Final payment received for [name]" | Assigned providers + assistants |
| 23 | **Final Payment: Received (Online)** | ❌ MISSING | ❌ MISSING | ❌ MISSING | N/A | ❌ MISSING | `final-payment-received` (TBD) | "Final payment received for [name]" | Assigned providers + assistants |
| 24 | **Booking: Completed (Final)** | ❌ MISSING | Appointment.status = 'fulfilled' | "Booking completed - all services done + final payment received" | No | ❌ MISSING | `booking-completed` (TBD) | "Booking completed for [name]" | Assigned providers + assistants |
| 25 | **Deposit: Undo Waive** | ❌ MISSING | AuditEvent via `recordPaymentUndone()` | "Deposit waived undone by [name]: [reason]" | Yes (needed) | ❌ MISSING | `deposit-waive-undone` (TBD) | "Deposit waived undone for [name]" | Assigned providers + assistants |

---

## Key Notes:

### Status: Pending → Booked Trigger
This transition happens when:
- Deposit is **waived** (status → 'booked' directly)
- Deposit is **marked paid (manual)** (status → 'booked' + notification sent)
- Deposit is **paid online (Stripe)** (status → 'booked' + notification sent)

All three use the same `appointment-approved` notification template currently. Consider separate templates:
- `'deposit-waived'` → "Deposit waived for [name], booking confirmed"
- `'deposit-paid-manual'` → "Deposit paid manually for [name], booking confirmed"
- `'deposit-paid-online'` → "Deposit paid online for [name], booking confirmed"

### Uncancel Behavior
When uncancelling, the system restores to the **previous state BEFORE cancellation**:
- If cancelled while **PENDING** (deposit not paid) → restore to **PENDING**
- If cancelled while **BOOKED** (deposit paid) → restore to **BOOKED**
- If cancelled while **ARRIVED** → restore to **ARRIVED**

This is tracked via `pre-cancellation-status` extension.

### Undo Waive Behavior (To Be Implemented)
Similar to "Undo Payment" but for waived deposits:
- Should revert deposit status to `'requested'`
- Should keep ALL notifications (history is never hidden)
- Users should see: "Deposit waived" → "Deposit waived undone" in activity history

### Final Payment System (To Be Implemented)
When ALL services are completed, a **final payment** may be required (separate from deposit):
- Tracks total treatment cost vs deposit already paid
- Can be requested, received (manual/online), or refunded
- When final payment is received → Booking status = `'fulfilled'`

### Notification Implementation
- **Currently**: In-app only (FHIR Communication resources)
- **Future**: Can extend to SMS/Email by modifying notification templates
- **Comment in code** where SMS/Email integration would be added

---

## Current Implementation Status:

### ✅ Complete (Working)
- Rows 1-20 (except missing notifications for some actions)

### ❌ Missing Features
- Row 21: Final Payment Requested
- Row 22: Final Payment Received (Manual)
- Row 23: Final Payment Received (Online)
- Row 24: Booking Completed (Final)
- Row 25: Undo Waive Deposit

### 🔴 Critical Bug
- **AuditEvent descriptions not showing in activity history** (all show as `undefined`)
- Root cause: `parseEntityDetails()` not properly reading description from extension

---

## File Locations for Reference:

| Component | File Path |
|---|---|
| Booking Detail Page | `packages/app/src/pages/BookingDetailPage.tsx` |
| Create Appointment Modal | `packages/app/src/components/CreateAppointmentModalV3.tsx` |
| Service Card | `packages/app/src/components/ServiceCard.tsx` |
| Consent Modal | `packages/app/src/components/ConsentModal.tsx` |
| Audit Events Utils | `packages/app/src/utils/audit-events.ts` |
| Notification Templates | `packages/app/src/notifications/templates.ts` |
| Notification Utils | `packages/app/src/notifications/utils.ts` |
| Payment Utils | `packages/app/src/utils/payments.ts` |

---

**Delete this file when all features are complete and tested!**
