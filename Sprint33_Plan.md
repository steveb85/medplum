# Sprint 3.3 - Communications & Deposits

## Sprint Goal
Enable automated deposit collection via SMS/Email and implement appointment reminders with follow-up communications.

---

## Prerequisites

### Account Setup Required
1. **Twilio Account** - For SMS (sandbox available)
   - Sign up: https://www.twilio.com/try-twilio
   - Get Account SID, Auth Token
   - Purchase phone number or use trial number
   - Configure webhook URL for incoming SMS

2. **Stripe Account** - For payments
   - Sign up: https://dashboard.stripe.com/register
   - Enable Payment Links feature
   - Get Publishable Key, Secret Key
   - Configure webhook endpoint

3. **Resend Account** - For email
   - Sign up: https://resend.com
   - Get API key
   - Verify sender domain

---

## Task Sequence

### Phase 1: Configuration & Setup (Day 1-2)

| Task | Description | Files | Priority |
|------|-------------|-------|----------|
| 1.1 | Add deposit configuration to Service Catalog | `ServiceCatalogPage.tsx` | HIGH |
| 1.2 | Create environment variables for Twilio/Stripe/Resend | `.env` | HIGH |
| 1.3 | Add payment utility functions | `utils/payments.ts` | HIGH |
| 1.4 | Create SMS utility module | `utils/sms.ts` | HIGH |
| 1.5 | Create email utility module | `utils/email.ts` | MEDIUM |

**Deposit Configuration Fields:**
- `depositAmount`: number (default for service)
- `depositReminders`: number (default: 4, max: 4)
- `depositReminderInterval`: number (default: 24 hours)
- `followUpSchedule`: JSON [{hours: 24, message: "..."}, {hours: 72, message: "..."}]

---

### Phase 2: Booking Detail Page (Day 2-4)

| Task | Description | Files | Priority |
|------|-------------|-------|----------|
| 2.1 | Create BookingDetailPage route | `pages/BookingDetailPage.tsx` | HIGH |
| 2.2 | Display booking information | `BookingDetailPage.tsx` | HIGH |
| 2.3 | Add deposit management section | `BookingDetailPage.tsx` | HIGH |
| 2.4 | Implement custom deposit amount input | `BookingDetailPage.tsx` | HIGH |
| 2.5 | Add "Send Payment Link" button | `BookingDetailPage.tsx` | HIGH |
| 2.6 | Add "Mark as Paid" button | `BookingDetailPage.tsx` | MEDIUM |
| 2.7 | Add "Waive Deposit" checkbox with reason | `BookingDetailPage.tsx` | MEDIUM |
| 2.8 | Add "Uncancel" action with reason | `BookingDetailPage.tsx` | MEDIUM |
| 2.9 | Display audit trail | `BookingDetailPage.tsx` | LOW |
| 2.10 | Link from BookingsPage eye icon | `BookingsPage.tsx` | HIGH |

**Deposit UI Flow:**
```
Deposit Status: [Pending | Requested | Paid | Waived]
Amount: [$250.00] [Edit]
[Send Payment Link] [Mark as Paid] [Waive Deposit]
Payment History:
- 2026-04-24 14:30 - Payment link sent via SMS
- 2026-04-24 14:45 - Payment received via Stripe
```

---

### Phase 3: Stripe Payment Integration (Day 4-5)

| Task | Description | Files | Priority |
|------|-------------|-------|----------|
| 3.1 | Create Stripe payment link generator | `utils/stripe.ts` | HIGH |
| 3.2 | Build webhook handler for payment success | `server/webhooks/stripe.ts` | HIGH |
| 3.3 | Update booking deposit status on payment | `webhooks/stripe.ts` | HIGH |
| 3.4 | Create payment confirmation notification | `webhooks/stripe.ts` | MEDIUM |
| 3.5 | Handle payment failures/expired links | `webhooks/stripe.ts` | MEDIUM |

**Payment Link Expiry Logic:**
- Default: 96 hours
- If appointment < 96 hours away: Use (appointment_time - 48h) as expiry
- If appointment < 48 hours away: Use 24 hours
- If appointment < 24 hours away: Use 12 hours

---

### Phase 4: SMS Integration (Day 5-7)

| Task | Description | Files | Priority |
|------|-------------|-------|----------|
| 4.1 | Configure Twilio client | `utils/sms.ts` | HIGH |
| 4.2 | Create SMS message templates | `notifications/smsTemplates.ts` | HIGH |
| 4.3 | Implement send SMS function | `utils/sms.ts` | HIGH |
| 4.4 | Send deposit request SMS | `BookingDetailPage.tsx` | HIGH |
| 4.5 | Send payment confirmation SMS | `webhooks/stripe.ts` | MEDIUM |
| 4.6 | Build incoming SMS webhook | `server/webhooks/twilio.ts` | LOW |

**SMS Templates:**
```typescript
// Deposit Request
"Hi {patientName}, your appointment for {serviceType} on {date} at {time} is confirmed. Please pay your ${depositAmount} deposit within {hours} hours: {paymentLink}"

// Payment Confirmation
"Thank you {patientName}! Your deposit of ${amount} has been received. See you on {date} at {time} for your {serviceType}."

// Appointment Reminder (24h)
"Reminder: You have an appointment tomorrow ({date}) at {time} for {serviceType}. Please arrive 10 minutes early."

// Appointment Reminder (2h)
"Your appointment is in 2 hours ({time}). See you soon!"
```

---

### Phase 5: Email Integration (Day 6-8)

| Task | Description | Files | Priority |
|------|-------------|-------|----------|
| 5.1 | Configure Resend client | `utils/email.ts` | MEDIUM |
| 5.2 | Create email templates | `notifications/emailTemplates.ts` | MEDIUM |
| 5.3 | Implement send email function | `utils/email.ts` | MEDIUM |
| 5.4 | Send deposit request email (fallback) | `BookingDetailPage.tsx` | MEDIUM |
| 5.5 | Send payment confirmation email | `webhooks/stripe.ts` | LOW |
| 5.6 | Send appointment reminders via email | `utils/reminders.ts` | LOW |

---

### Phase 6: Automated Reminders (Day 8-10)

| Task | Description | Files | Priority |
|------|-------------|-------|----------|
| 6.1 | Build reminder scheduler | `utils/reminders.ts` | MEDIUM |
| 6.2 | Implement deposit reminder (every 24h, max 4) | `utils/reminders.ts` | HIGH |
| 6.3 | Implement appointment reminders (24h, 2h) | `utils/reminders.ts` | MEDIUM |
| 6.4 | Implement post-appointment follow-ups | `utils/reminders.ts` | MEDIUM |
| 6.5 | Build auto-cancel on no-deposit | `utils/reminders.ts` | HIGH |
| 6.6 | Create notification on auto-cancel | `utils/reminders.ts` | MEDIUM |

**Reminder Schedule:**
| Event | Timing | Action | Channel |
|-------|--------|--------|---------|
| Deposit Request | Immediately after approval | Send payment link | SMS + Email |
| Deposit Reminder 1 | 24h after request | Reminder | SMS |
| Deposit Reminder 2 | 48h after request | Reminder | SMS |
| Deposit Reminder 3 | 72h after request | Reminder | SMS |
| Deposit Reminder 4 | 96h after request OR 48h before appointment | Final warning | SMS |
| Auto-Cancel | 96h after request OR 48h before appointment | Cancel booking | SMS + Email |
| Appointment Reminder 1 | 24h before | Reminder | SMS |
| Appointment Reminder 2 | 2h before | Reminder | SMS |
| Post-Treatment | Per service config (e.g., 24h, 72h) | Follow-up | Email |

---

### Phase 7: Split Calendar Events (Day 10-12)

| Task | Description | Files | Priority |
|------|-------------|-------|----------|
| 7.1 | Create Numbing event type | `CalendarPage.tsx` | MEDIUM |
| 7.2 | Display numbing block separately | `CalendarPage.tsx` | MEDIUM |
| 7.3 | Color-code by provider/assistant | `CalendarPage.tsx` | MEDIUM |
| 7.4 | Add room indicator to events | `CalendarPage.tsx` | LOW |
| 7.5 | Handle numbing completion | `Task completion` | LOW |

**Calendar Display:**
```
2:30 PM - 3:00 PM | [Room 1] Numbing - Filler | Assistant: Lauren
3:00 PM - 3:45 PM | [Room 1] Filler Treatment | Provider: Melissa + Assistant: Lauren
```

---

## Testing Checklist

### Phase 1-2 Tests
- [ ] Can override deposit amount in booking detail
- [ ] Can waive deposit with reason
- [ ] Can mark deposit as paid manually
- [ ] Can uncancel booking with reason
- [ ] Audit trail shows all actions
- [ ] Navigation works from BookingsPage

### Phase 3-5 Tests
- [ ] Stripe payment link generates correctly
- [ ] Payment webhook updates booking status
- [ ] SMS sends successfully via Twilio sandbox
- [ ] Email sends successfully via Resend
- [ ] Payment link expiry calculated correctly

### Phase 6 Tests
- [ ] Deposit reminders sent every 24h
- [ ] Auto-cancel after 96h or 48h before
- [ ] Appointment reminders at 24h and 2h
- [ ] Post-treatment follow-ups sent
- [ ] All notifications trigger correctly

### Phase 7 Tests
- [ ] Numbing blocks show separately
- [ ] Calendar events color-coded correctly
- [ ] Room assignment visible
- [ ] Clicking numbing block shows Task details

---

## Environment Variables Required

```bash
# Twilio
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890

# Stripe
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Resend
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@studioassistant.io

# Payment Links
PAYMENT_LINK_EXPIRY_HOURS=96
PAYMENT_LINK_BASE_URL=https://api-dev.studioassistant.io/pay
```

---

## Files to Create/Modify

### New Files
- `packages/app/src/pages/BookingDetailPage.tsx`
- `packages/app/src/utils/payments.ts`
- `packages/app/src/utils/sms.ts`
- `packages/app/src/utils/email.ts`
- `packages/app/src/utils/stripe.ts`
- `packages/app/src/utils/reminders.ts`
- `packages/app/src/notifications/smsTemplates.ts`
- `packages/app/src/notifications/emailTemplates.ts`
- `packages/server/src/webhooks/stripe.ts`
- `packages/server/src/webhooks/twilio.ts`

### Modified Files
- `packages/app/src/pages/BookingsPage.tsx` - Link to detail page
- `packages/app/src/pages/CalendarPage.tsx` - Split events
- `packages/app/src/pages/admin/ServiceCatalogPage.tsx` - Deposit config
- `packages/app/src/components/CreateAppointmentModalV2.tsx` - Deposit amount
- `packages/server/src/seeds/nursemel.ts` - Service deposit defaults

---

## Notes

### Payment Link Expiry Logic
```typescript
function calculatePaymentLinkExpiry(appointmentStart: Date): Date {
  const now = dayjs();
  const appointment = dayjs(appointmentStart);
  const hoursUntilAppointment = appointment.diff(now, 'hours');
  
  // Default: 96 hours
  let expiryHours = 96;
  
  // If less than 96 hours away, use (appointment_time - 48h)
  if (hoursUntilAppointment < 96) {
    expiryHours = hoursUntilAppointment - 48;
  }
  
  // If less than 48 hours away, use 24 hours
  if (hoursUntilAppointment < 48) {
    expiryHours = 24;
  }
  
  // If less than 24 hours away, use 12 hours
  if (hoursUntilAppointment < 24) {
    expiryHours = 12;
  }
  
  return now.add(expiryHours, 'hours').toDate();
}
```

### Auto-Cancel Logic
```typescript
function shouldAutoCancel(appointment: Appointment): boolean {
  const depositStatus = getDepositStatus(appointment);
  const now = dayjs();
  const appointmentTime = dayjs(appointment.start);
  
  // Get deposit requested timestamp
  const requestedAt = getDepositRequestedAt(appointment);
  const hoursSinceRequest = requestedAt ? now.diff(requestedAt, 'hours') : 0;
  
  // Auto-cancel if:
  // 1. 96 hours have passed since deposit request
  // OR
  // 2. Within 48 hours of appointment and deposit not paid
  
  if (depositStatus === 'paid' || depositStatus === 'waived') {
    return false;
  }
  
  const hoursUntilAppointment = appointmentTime.diff(now, 'hours');
  
  return hoursSinceRequest >= 96 || hoursUntilAppointment <= 48;
}
```

---

**Ready to begin Sprint 3.3 implementation!**
