# Phase 3: Notification System Plan

## Executive Summary

This document outlines a comprehensive notification system for the MedSpa practice management application. The plan is organized into 5 phases, from in-app notifications to SMS and email communication. Each phase is self-contained and can be deployed independently, allowing for incremental value delivery.

The notification system leverages Medplum's FHIR-native architecture, using:
- **FHIR Subscriptions** for event detection
- **WebSocket connections** for real-time updates
- **Communication resources** for notification storage
- **Medplum Bots** for automated actions

---

## Notification Types Needed

### 1. In-App Notifications (Phase 3A - Immediate)

**Use Case:** Practice staff receive notifications within the app

**Tech:** FHIR Subscriptions + WebSocket + Communication resources

**Events:**
- New appointment booked
- Appointment cancelled/rescheduled
- Treatment started
- Treatment completed
- Photos uploaded
- Notes added

**Implementation:**
- Create Subscription resources for each event type
- Use Medplum's WebSocket subscriptions for real-time updates
- Store notifications as Communication resources
- Show notification bell/badge in UI
- Display notification feed

**Effort:** Medium (2-3 days)

---

### 2. Browser Push Notifications (Phase 3B - Short-term)

**Use Case:** Practice staff get push notifications even when app is closed

**Tech:** Service Worker + Web Push API + Medplum Bot

**Events:** Same as in-app + urgent notifications

**Implementation:**
- Register service worker
- Request push permission
- Store subscription on server
- Create Medplum Bot to trigger push
- Fallback to in-app if push blocked

**Challenges:**
- Requires HTTPS (already done)
- Browser support varies
- iOS Safari limited support

**Effort:** Medium-High (3-5 days)

---

### 3. SMS Patient Reminders (Phase 3C - Medium-term)

**Use Case:** Patients get appointment reminders via SMS

**Tech:** Twilio integration via Medplum Bot

**Events:**
- 24 hours before appointment
- 2 hours before appointment
- Appointment confirmed
- Appointment cancelled

**Implementation:**
- Store patient phone numbers in Patient.telecom
- Create Subscription for Appointment changes
- Bot sends SMS via Twilio API
- Track delivery status
- Log in Communication resource

**Challenges:**
- Twilio account + phone number
- SMS compliance (opt-in required)
- Cost per message
- International numbers

**Effort:** Medium (2-3 days)

---

### 4. SMS Two-Way Communication (Phase 3D - Long-term)

**Use Case:** Patients can reply to SMS, practice can respond

**Tech:** Twilio webhook → Medplum Bot → Communication resource

**Events:**
- Patient replies to reminder
- Practice sends follow-up questions
- Pre/post care instructions

**Implementation:**
- Twilio webhook endpoint in Medplum
- Parse incoming SMS
- Create Communication resource linked to Patient
- Show in patient timeline
- Allow practice to respond

**Challenges:**
- Phone number masking (Twilio number vs practice number)
- Message threading
- Cost for two-way
- Message length limits

**Effort:** High (5-7 days)

---

### 5. Email Notifications (Phase 3E - Medium-term)

**Use Case:** Major events and transactional emails

**Tech:** Medplum native email or SendGrid

**Events:**
- Initial booking confirmation
- Appointment reminders (backup to SMS)
- Invoice/receipt generated
- Treatment summary after completion
- Password reset (essential)
- Monthly summary (optional)

**Implementation:**
- Create email templates
- Use Subscription to trigger on relevant events
- Send via Medplum email service or SendGrid
- Log in Communication resource
- Respect email preferences

**Note:** Email is secondary to SMS due to inbox overload, but still important for:
- Detailed information (treatment summaries)
- Official receipts/invoices
- Users who prefer email
- Fallback when SMS fails

**Effort:** Medium (2-3 days)

---

## Technical Architecture

### Client-Side (React/Medplum)
```
NotificationProvider (context)
├── SubscriptionManager (WebSocket)
├── NotificationBell (UI component)
├── NotificationFeed (dropdown)
└── Toast notifications (Mantine)
```

### Server-Side (Medplum)
```
FHIR Subscription → Medplum Bot → Action
├── WebSocket → Client
├── Email → SMTP/SendGrid
├── SMS → Twilio
└── Communication → Store for timeline
```

## Data Model

### Communication Resource for Notifications
```typescript
{
  resourceType: "Communication",
  status: "completed",
  category: [{
    coding: [{
      system: "http://melissaknudson.com/notification-type",
      code: "appointment-created",
      display: "Appointment Created"
    }]
  }],
  priority: "routine" | "urgent" | "asap" | "stat",
  subject: { reference: "Patient/123" },
  recipient: [{ reference: "Practitioner/456" }], // Who should see this
  sender: { reference: "Practitioner/789" }, // Who triggered it
  sent: "2026-04-22T10:00:00Z",
  payload: [{
    contentString: "New appointment scheduled for Sarah Chen on Apr 24 at 9:00 AM"
  }],
  extension: [{
    url: "http://melissaknudson.com/fhir/StructureDefinition/related-appointment",
    valueReference: { reference: "Appointment/abc" }
  }, {
    url: "http://melissaknudson.com/fhir/StructureDefinition/notification-read",
    valueBoolean: false
  }]
}
```

## Implementation Priority

### Phase 3A: In-App Notifications (Week 1)
1. Create NotificationProvider context
2. Subscribe to relevant resources
3. Create Communication resources on events
4. Build notification UI (bell + feed)
5. Mark notifications as read

### Phase 3B: Browser Push (Week 2-3)
1. Service worker setup
2. Push subscription management
3. Medplum Bot for push triggers
4. UI for push preferences

### Phase 3C: SMS Reminders (Week 4)
1. Twilio account setup
2. Bot for appointment reminders
3. Patient phone number validation
4. Preference management (opt-in/out)

### Phase 3D: SMS Two-Way (Future)
1. Twilio webhook
2. Message parsing
3. Response workflow
4. Timeline integration

### Phase 3E: Email Notifications (Week 5-6)
1. Email template system
2. Transactional emails (bookings, invoices)
3. Preference center
4. Delivery tracking

## Configuration Needed

### Environment Variables
```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
SENDGRID_API_KEY=
WEB_PUSH_PUBLIC_KEY=
WEB_PUSH_PRIVATE_KEY=
```

### Medplum Bots
1. `appointment-notification-bot` - Creates Communication resources
2. `sms-reminder-bot` - Sends Twilio SMS
3. `push-notification-bot` - Triggers browser push
4. `email-notification-bot` - Sends transactional emails

## Questions for Discussion

1. Should patients see their Communication history in portal?
2. Do we need notification preferences per user?
3. Should urgent notifications bypass quiet hours?
4. Who pays for SMS costs (practice or Medplum)?
5. Do we need audit logging for HIPAA compliance?
6. What happens if both SMS and email fail?
7. Should providers get different notifications than coordinators?

## Current Code Comments to Preserve

The following comments should remain in code until Phase 3:

### CreateAppointmentModal.tsx
```typescript
// NOTIFICATION_OPPORTUNITY: When a new appointment is created,
// we could notify the assigned provider via Communication resource or in-app notification
// Location: After successful creation of Appointment + Procedure
```

### BotoxTreatmentPage.tsx
```typescript
// NOTIFICATION_OPPORTUNITY: When status changes, notify relevant parties
// Location: In handleStartTreatment and handleCompleteTreatment
```

## Notification Preference System (Future)

```typescript
interface NotificationPreferences {
  userId: string;
  channels: {
    inApp: boolean;
    browserPush: boolean;
    sms: boolean;
    email: boolean;
  };
  events: {
    appointmentCreated: string[]; // ['inApp', 'push']
    appointmentReminder: string[]; // ['sms', 'email']
    treatmentStarted: string[];
    treatmentCompleted: string[];
    photosUploaded: string[];
  };
  quietHours: {
    enabled: boolean;
    start: string; // "18:00"
    end: string;   // "08:00"
    timezone: string;
  };
}
```

## Conclusion

This plan provides a roadmap for building a comprehensive notification system that:
- Starts with in-app (Phase 3A) - immediate value
- Adds browser push (Phase 3B) - better engagement
- Expands to SMS (Phase 3C/D) - patient communication
- Includes email (Phase 3E) - transactional and fallback

Each phase is self-contained and can be deployed independently.

**Excluded:** Apple Business Chat and Google Business Messages - deemed overkill for current needs.
