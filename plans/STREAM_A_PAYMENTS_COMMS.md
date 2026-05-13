# Stream A: Payments & Communications Integration

**Est. Total:** ~16-20 hours across 5 phases
**Priority:** 🔴 Critical (Phases A1-A2), 🟡 High (A3-A4), 🟢 Medium (A5)
**Tests:** +40-50 new/updated tests across all phases

---

## Current State

- ✅ SMS utility (`sms.ts`) — 8 templates, sandbox mode, real Twilio API calls, **already wired into BookingDetailPage**
- ✅ Email utility (`email.ts`) — 8 templates, sandbox mode, real Resend API calls, **already wired into BookingDetailPage**
- ✅ Stripe webhook handler (`stripe.ts`) — handles payment_intent.succeeded, checkout.session.completed, payment_failed
- ✅ Twilio webhook handler (`twilio.ts`) — incoming SMS, auto-response, staff notifications
- ✅ Webhook routes registered + fully tested (97 tests passing)
- ✅ `createStripePaymentLink()` function exists on server (calls Stripe API)
- ⬜ **Payment link is placeholder** `https://pay.studioassistant.io/d/{id}` — needs real Stripe checkout URL
- ⬜ No cron-based reminders
- ⬜ No two-way SMS UI
- ⬜ No analytics dashboard

---

## Phase A1: Real Payment Links

**Goal:** Replace the placeholder payment URL with real Stripe checkout sessions.

### Server Changes

#### 1. Add `createPaymentLinkHandler` to `stripe.ts`
New exported handler for creating Stripe checkout sessions:
- Accepts `{ appointmentId, amount, patientEmail, patientName }` in POST body
- Calls existing `createStripePaymentLink()` function
- Returns `{ url: string }` or `{ error: string }`
- Handles missing config gracefully (returns error, not crash)

#### 2. Add route in `webhook/routes.ts`
```
POST /webhook/create-payment-link → createPaymentLinkHandler
```

#### 3. Server tests (`stripe.test.ts`)
- Test handler returns 400 for missing required fields
- Test handler successfully creates payment link (mock fetch)
- Test handler returns error when Stripe not configured

### App Changes

#### 3. Update `BookingDetailPage.tsx` `sendPaymentLink()`
Replace:
```typescript
const paymentLink = `https://pay.studioassistant.io/d/${appointment.id}`;
```
With:
```typescript
const response = await fetch(medplum.getBaseUrl() + 'api/webhook/create-payment-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    appointmentId: appointment.id,
    amount: depositAmount,
    patientEmail: patientEmail,
    patientName: patientDisplayName,
  }),
});
const data = await response.json();
if (data.error) throw new Error(data.error);
const paymentLink = data.url;
```

#### 4. App tests (`BookingDetailPage.test.tsx`)
- Mock fetch for create-payment-link endpoint
- Test payment link generation succeeds
- Test error handling when Stripe not configured
- Test loading state

### Success Criteria (Verify After)
- [ ] Click "Send Payment Link" → calls server endpoint
- [ ] Server calls Stripe API and returns checkout URL
- [ ] SMS sent with real Stripe checkout link
- [ ] Email sent with real Stripe checkout link
- [ ] Error handled gracefully if Stripe not configured

---

## Phase A2: Payment Confirmation Flow

**Goal:** Auto-notify patient + auto-change appointment status on successful Stripe payment.

### Server Changes
1. Update `stripeWebhookHandler` to call SMS/Email confirmation functions after payment success
2. Add auto-change of Appointment status to `booked` on deposit paid webhook
3. Record AuditEvent for auto-status-change

### App Changes
1. Add polling/refresh in BookingDetailPage when payment is pending (periodic check)
2. Show real-time "Payment Received" status update
3. Celebration/confetti on payment confirmation

### Tests
- Server: Update stripe webhook tests for confirmation sending
- App: Test status refresh on payment received

### Success Criteria (Verify After)
- [ ] Patient pays via Stripe → receives confirmation SMS in <30s
- [ ] Patient receives confirmation email with details
- [ ] Appointment auto-changes to `booked`
- [ ] Staff sees updated status without manual refresh

---

## Phase A3: Automated Reminders

**Goal:** Cron-based reminder scheduling for appointments.

### Server Changes
1. Create `packages/server/src/cron/reminders.ts`
2. Hourly check for upcoming appointments needing reminders
3. Send SMS + Email for: 24h reminder, 2h reminder, deposit reminders (max 4x), auto-cancel warning
4. Store sent-flag in ServiceRequest extensions to prevent duplicates
5. Register cron job in `app.ts` on startup

### Tests
- New `reminders.test.ts` with unit tests for scheduling logic
- Test deduplication (reminders not sent twice)
- Test edge cases (appointment cancelled, status changes)

### Success Criteria (Verify After)
- [ ] 24h before appointment → patient receives reminder
- [ ] 2h before → final reminder
- [ ] Unpaid booking → deposit reminder sent daily (max 4)
- [ ] Auto-cancel warning sent 24h before deadline
- [ ] No duplicate reminders
- [ ] Reminders stop on cancel/payment

---

## Phase A4: Post-Treatment Follow-Up

**Goal:** Automated check-in after treatment completion.

### Server Changes
1. Add follow-up scheduling to `reminders.ts` (trigger on `fulfilled` status)
2. Send check-in SMS 24-48h after completion
3. Enhanced keyword detection in Twilio replies ("pain", "problem" → urgent staff alert)

### Tests
- Test follow-up scheduling
- Test keyword detection and alerting

### Success Criteria (Verify After)
- [ ] Treatment completed → follow-up scheduled for +24h
- [ ] Patient receives "How are you feeling?" SMS
- [ ] Patient replies with "pain" → staff gets urgent alert

---

## Phase A5: Two-Way SMS UI

**Goal:** Full SMS conversation capability between patients and staff.

### App Changes
1. Create `PatientMessages.tsx` component — SMS thread UI
2. Create `usePatientMessages.ts` hook — load/send messages
3. Add "Messages" tab to Patient resource page
4. Staff can send reply from Medplum

### Tests
- New component tests for message display
- Test send flow
- Test opt-out/opt-in handling

### Success Criteria (Verify After)
- [ ] Patient texts office → message appears in UI
- [ ] Staff can view full SMS history
- [ ] Staff can reply → patient receives SMS
- [ ] Patient texts STOP → opted out
- [ ] Patient texts START → opted back in
