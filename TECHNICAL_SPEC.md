# Nurse Mel Medplum - Technical Specifications

> **Purpose**: Complete build plan for Phase 2 - Patient Portal & Practice Management System  
> **Companion to**: AGENTS.md (living project context)  
> **Status**: Ready for implementation  
> **Last Updated**: April 23, 2026

---

## Quick Reference

### ⚠️ COMPLETE REPLACEMENT STRATEGY

**Phase 1 booking system is INCOMPATIBLE with Phase 2 architecture. We are doing a complete replacement.**

### What Gets PRESERVED (Working Well)
- ✅ Botox treatment workflow (photos, injection mapping, status transitions)
- ✅ Patient management (search, profiles)
- ✅ Role-based access (Provider/Coordinator)
- ✅ Calendar infrastructure (react-big-calendar, momentLocalizer)
- ✅ Photo upload system (PhotoUploadSection, S3 storage)

### What Gets REPLACED (Completely Rebuilt)
- ❌ `CreateAppointmentModal` - Single-service booking
- ❌ Booking creation logic - Creates Appointment + Procedure
- ❌ Current `Appointment` model - No multi-service support
- ❌ Current calendar event handling - No Task/numbing display

### New Architecture (Phase 2)

| Aspect | Old (Being Deleted) | New (Being Built) |
|--------|---------------------|-------------------|
| Booking | Appointment = 1 Service | Appointment = Container + Multiple Services |
| Services | Static array in code | ActivityDefinition catalog |
| Creation | Creates Procedure directly | Creates ServiceRequests → Procedures later |
| Numbing | Part of duration | Separate Task resource |
| Room | Not tracked | Location/room assignment |
| Consult | Not tracked | Patient extensions + GFE tracking |

### Phase 2A (Immediate Priority)
1. DELETE old booking code
2. CREATE Service Catalog (ActivityDefinitions)
3. BUILD new multi-service booking flow
4. IMPLEMENT numbing Task automation
5. ADD annual consult/GFE tracking

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ THE BOOKING MODEL - FINAL ARCHITECTURE                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  BOOKING = Appointment (time container)                                     │
│  ├── Patient                                                               │
│  ├── Start/End Time                                                        │
│  ├── Location (Room)                                                       │
│  └── Participants (Mel, Assistant, Patient)                              │
│                                                                             │
│  SERVICES = Multiple ServiceRequests (basedOn: Appointment)               │
│  ├── ServiceRequest #1: Botox                                              │
│  ├── ServiceRequest #2: Filler                                            │
│  └── ServiceRequest #3: Consult (if needed)                                │
│                                                                             │
│  SUB-STEPS = Tasks (optional, linked to ServiceRequest)                   │
│  └── Task: Numbing (forAssistant: true, duration: from ActivityDefinition) │
│                                                                             │
│ EXECUTION = Procedures (when performed)                                   │
│ └── ServiceRequest becomes Procedure when staff starts treatment        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Service Catalog (ActivityDefinitions)

### 1.1 ActivityDefinition Structure

**File**: `/packages/app/src/services/serviceCatalog.ts`

```typescript
export interface ServiceConfig {
  // Core properties
  id: string;
  name: string;
  title: string;
  description?: string;
  
  // Timing
  defaultDuration: number; // minutes
  numbingTime: number; // 0-120 minutes, 0 = no numbing
  
  // Requirements
  requiresConsult: boolean; // GFE requirement
  gfeCategory: 'botox' | 'filler' | 'laser' | 'consult';
  
  // Resources
  defaultRoom: string; // Location/room reference
  roomMovable: boolean; // Can override room assignment
  
  // Pricing
  pricing: {
    minPrice: number; // dollars
    maxPrice?: number;
    pricePerUnit?: boolean; // Botox = per unit, Filler = per syringe
    unitType?: 'unit' | 'syringe' | 'area' | 'session';
  };
  
  // Staff
  requiredQualifications: Array<{
    type: 'RN' | 'assistant' | 'MD' | 'NP';
    role: 'primary' | 'assistant';
  }>;
  
  // Incompatibilities
  incompatibleServices?: string[]; // Service IDs that cannot be combined
  
  // Extensions for UI
  icon?: string;
  color?: string;
  category: 'injection' | 'laser' | 'consult' | 'other';
}
```

### 1.2 Seed Service Definitions

**File**: `/packages/server/src/seed/serviceCatalog.ts`

Create these ActivityDefinitions on server startup:

| Service | Duration | Numbing | Default Room | Price | GFE |
|---------|----------|---------|--------------|-------|-----|
| Botox | 30 min | 0 min | Room 1 | $300-800 (per unit) | botox |
| Filler | 45 min | 30 min | Room 1 | $600-1200 (per syringe) | filler |
| Laser | 45 min | 45 min | Room 2 | $250-500 (per area) | laser |
| Consult | 30 min | 0 min | Room 1 | $150 (fixed) | consult |

### 1.3 Admin Service Catalog UI

**File**: `/packages/app/src/pages/admin/ServiceCatalogPage.tsx`

**Features:**
- View all services in table
- Edit service properties inline
- Add new service (form with all fields)
- Toggle service active/inactive
- Visual indicator for services requiring numbing
- Incompatibility matrix (which services can't be combined)

---

## 2. Multi-Service Booking Flow

### 2.1 Booking Creation Process

**Step-by-step:**

1. **Patient Selection**
   - Search Patient (existing)
   - Check: Patient has active consult? (warning if not)
   - Show: Patient header with consult status

2. **Service Selection**
   - Multi-select dropdown (ActivityDefinitions)
   - Dynamic total duration calculation
   - Compatibility check: Show incompatible services
   - Suggest: "Add Annual Consult" if due

3. **Date/Time Selection**
   - Calendar with Mel's availability
   - Show: Existing appointments (conflict detection)
   - Calculate: Start time = Selected time, End time = Start + total duration

4. **Room Assignment**
   - Auto-assigned based on primary service's defaultRoom
   - Manual override dropdown (Room 1, Room 2)
   - Warning: If room already booked (conflict detection)

5. **Provider Assignment**
   - Main Provider: Mel (default, can override to other RN)
   - Assistant: Optional (based on numbing requirements)
   - System suggests assistant if any service needs numbing

6. **Review & Confirm**
   - Summary: Patient + Services + Total Duration + Room + Providers
   - Numbing breakdown: "Numbing starts at 2:30 PM for Filler"
   - Deposit required: $250
   - Notes field

### 2.2 FHIR Resources Created on Submit

**Create in order:**

```typescript
// 1. Appointment
{
  resourceType: 'Appointment',
  status: 'pending', // Staff must approve
  serviceType: [{ text: 'Botox + Filler' }], // Combined label
  start: '2026-04-25T15:00:00-04:00',
  end: '2026-04-25T16:30:00-04:00',
  participant: [
    { actor: { reference: 'Patient/123' }, status: 'tentative' },
    { actor: { reference: 'Practitioner/melissa' }, status: 'tentative' },
    { actor: { reference: 'Practitioner/assistant' }, status: 'tentative' }
  ],
  extension: [
    { url: 'http://melissaknudson.com/fhir/StructureDefinition/room', valueString: 'room-1' },
    { url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-required', valueMoney: { value: 250, currency: 'USD' } },
    { url: 'http://melissaknudson.com/fhir/StructureDefinition/total-services', valueInteger: 2 }
  ]
}

// 2. ServiceRequest for each service
{
  resourceType: 'ServiceRequest',
  status: 'draft',
  intent: 'order',
  code: { coding: [{ system: 'http://melissaknudson.com/services', code: 'botox-cosmetic' }] },
  subject: { reference: 'Patient/123' },
  requester: { reference: 'Practitioner/coordinator' },
  authoredOn: '2026-04-23T10:00:00Z',
  supportingInfo: [{ reference: 'Appointment/456' }],
  extension: [
    { url: 'http://melissaknudson.com/fhir/StructureDefinition/service-position', valueInteger: 1 }, // Order of services
    { url: 'http://melissaknudson.com/fhir/StructureDefinition/numbing-required', valueBoolean: false }
  ]
}

// 3. Task for numbing (if any service needs it)
{
  resourceType: 'Task',
  status: 'draft',
  intent: 'order',
  code: { text: 'Apply numbing cream' },
  focus: { reference: 'ServiceRequest/filler' }, // Links to specific service
  for: { reference: 'Patient/123' },
  requester: { reference: 'Practitioner/coordinator' },
  owner: { reference: 'Practitioner/assistant' },
  executionPeriod: {
    start: '2026-04-25T14:30:00-04:00',
    end: '2026-04-25T15:00:00-04:00'
  },
  extension: [
    { url: 'http://melissaknudson.com/fhir/StructureDefinition/numbing-duration', valueInteger: 30 }
  ]
}
```

### 2.3 Staff Approval Workflow

**Files to modify/create:**
- `/packages/app/src/pages/PendingBookingsPage.tsx` (NEW)
- `/packages/app/src/components/booking/PendingBookingCard.tsx` (NEW)

**Features:**
- List of pending bookings
- Card view: Patient, Services, Time, Deposit, Conflicts
- Quick actions: Approve / Modify / Reject
- Approve: Status → 'booked', triggers payment link SMS
- Modify: Opens modal to edit time/services/room
- Reject: Sends SMS with reason

---

## 3. Annual Consult & GFE Tracking

### 3.1 Patient Extension Structure

**File**: `/packages/app/src/types/patientExtensions.ts`

```typescript
export interface PatientConsultTracking {
  lastConsultDate: string; // ISO date
  lastConsultType: 'virtual' | 'in-person';
  consultExpiryDate: string;
  gfeCategories: Array<{
    category: 'botox' | 'filler' | 'laser' | 'consult';
    gfeExpiryDate: string;
    gfeProvider: string; // Practitioner reference
  }>;
}
```

**Storage**: Patient resource extension

```typescript
// Patient.extension
extension: [
  {
    url: 'http://melissaknudson.com/fhir/StructureDefinition/consult-tracking',
    extension: [
      { url: 'lastConsultDate', valueDate: '2025-03-15' },
      { url: 'lastConsultType', valueString: 'virtual' },
      { url: 'consultExpiryDate', valueDate: '2026-03-15' },
      {
        url: 'gfeCategories',
        extension: [
          {
            url: 'category',
            extension: [
              { url: 'type', valueString: 'botox' },
              { url: 'expiry', valueDate: '2026-03-15' },
              { url: 'provider', valueReference: { reference: 'Practitioner/gfe-doctor' } }
            ]
          }
        ]
      }
    ]
  }
]
```

### 3.2 UI Implementation

**Patient Header** (`/packages/app/src/components/PatientHeader.tsx`):
```
[Name] [DOB] [Phone] [Consult Status: ✅ Current / ⚠️ Expires in 30 days / ❌ Expired]
```

**Consult Status Logic:**
```typescript
const getConsultStatus = (patient: Patient): ConsultStatus => {
  const tracking = getConsultTracking(patient);
  const daysUntilExpiry = dayjs(tracking.consultExpiryDate).diff(dayjs(), 'days');
  
  if (daysUntilExpiry < 0) return { status: 'expired', color: 'red' };
  if (daysUntilExpiry <= 30) return { status: 'warning', color: 'orange' };
  return { status: 'current', color: 'green' };
};
```

**Booking Flow Warnings:**
- If consult expired: Warning modal "Annual consult required"
- If consult expires within 30 days: Warning "Consult expires in X days"
- Checkbox: "Add Annual Consult to booking" (suggested)

### 3.3 GFE Per Category

**Rules:**
- Consult appointment → Updates ALL category GFE dates
- Individual service → Updates only that category
- Patient can book filler even if botox GFE expired
- System tracks each category separately

**File**: `/packages/app/src/utils/gfeTracking.ts`

```typescript
export function checkGFEStatus(
  patient: Patient, 
  serviceId: string
): { valid: boolean; expiresIn?: number } {
  const tracking = getConsultTracking(patient);
  const service = getServiceById(serviceId);
  const categoryGFE = tracking.gfeCategories.find(
    g => g.category === service.gfeCategory
  );
  
  if (!categoryGFE) return { valid: false };
  
  const daysUntilExpiry = dayjs(categoryGFE.gfeExpiryDate).diff(dayjs(), 'days');
  return { valid: daysUntilExpiry > 0, expiresIn: daysUntilExpiry };
}
```

---

## 4. Numbing Task Automation

### 4.1 Task Creation Rules

**File**: `/packages/app/src/utils/numbingTasks.ts`

```typescript
export interface NumbingTaskConfig {
  serviceId: string;
  numbingDuration: number; // minutes
  defaultAssignee: 'assistant' | 'primary-provider';
}

export function shouldCreateNumbingTask(serviceIds: string[]): boolean {
  const services = serviceIds.map(id => getServiceById(id));
  return services.some(s => s.numbingTime > 0);
}

export function calculateNumbingStartTime(
  appointmentStart: Date,
  services: ServiceConfig[]
): Date {
  const maxNumbingTime = Math.max(...services.map(s => s.numbingTime));
  return dayjs(appointmentStart).subtract(maxNumbingTime, 'minutes').toDate();
}

export function createNumbingTask(
  appointment: Appointment,
  serviceRequest: ServiceRequest
): Task {
  const service = getServiceById(getServiceCode(serviceRequest.code));
  const numbingStart = calculateNumbingStartTime(
    new Date(appointment.start),
    [service]
  );
  
  return {
    resourceType: 'Task',
    status: 'draft',
    intent: 'order',
    code: { text: `Apply numbing for ${service.name}` },
    focus: { reference: `ServiceRequest/${serviceRequest.id}` },
    for: appointment.participant.find(p => p.actor?.reference?.startsWith('Patient/'))?.actor,
    requester: { reference: getCurrentUserRef() },
    owner: service.requiredQualifications.find(q => q.role === 'assistant') 
      ? { reference: 'Practitioner/assistant' } // Will be assigned later
      : undefined,
    executionPeriod: {
      start: numbingStart.toISOString(),
      end: appointment.start
    },
    extension: [
      { url: 'http://melissaknudson.com/fhir/StructureDefinition/numbing-duration', 
        valueInteger: service.numbingTime },
      { url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
        valueReference: { reference: `Appointment/${appointment.id}` } }
    ]
  };
}
```

### 4.2 Assistant Dashboard

**File**: `/packages/app/src/pages/AssistantDashboard.tsx` (NEW)

**Features:**
- Today's schedule view
- Task list: "Apply numbing for [Patient] - [Service]"
- Timer: Shows time until numbing should start
- Quick actions: "Start Numbing" → "Mark Complete"
- Notifications: Push notification when numbing due

### 4.3 Calendar Display

**Patient View (Portal):**
```
3:00 PM - Filler Treatment (45 min)
  Numbing begins at 2:30 PM
```

**Staff View (Provider App):**
```
┌────────────────────────────────────────────────────┐
│ 2:30 PM - 3:00 PM                                   │
│   Assistant: Sarah Chen - Filler Numbing           │
│   Room: Room 1                                     │
├────────────────────────────────────────────────────┤
│ 3:00 PM - 3:45 PM                                   │
│   Mel: Sarah Chen - Filler Treatment              │
│   Room: Room 1                                     │
└────────────────────────────────────────────────────┘
```

---

## 5. Communication System

### 5.1 SMS Architecture

**Pattern**: Medplum Bot + Twilio webhook

**File**: `/packages/app/src/bots/twilioWebhook.ts`

```typescript
import { BotEvent, MedplumClient } from '@medplum/core';

export async function handler(
  medplum: MedplumClient,
  event: BotEvent
): Promise<void> {
  const { From, Body, MessageSid } = event.input;
  
  // 1. Find patient by phone number
  const patient = await findPatientByPhone(medplum, From);
  
  // 2. Create Communication resource
  await medplum.createResource({
    resourceType: 'Communication',
    status: 'completed',
    category: [{ coding: [{ system: 'http://melissaknudson.com/communication-category', 
                             code: 'patient-sms' }] }],
    subject: { reference: `Patient/${patient.id}` },
    sender: { reference: `Patient/${patient.id}` },
    recipient: [{ reference: 'Organization/melissa-knudson' }],
    payload: [{ contentString: Body }],
    sent: new Date().toISOString(),
    extension: [
      { url: 'http://melissaknudson.com/fhir/StructureDefinition/twilio-message-id', 
        valueString: MessageSid }
    ]
  });
  
  // 3. Send notification to staff
  await notifyStaffOfPatientMessage(medplum, patient, Body);
}
```

### 5.2 SMS Templates

**File**: `/packages/app/src/notifications/smsTemplates.ts`

| Template | Trigger | Content |
|----------|---------|---------|
| booking-request-received | Patient submits booking | "Thanks {name}! Your booking request for {services} on {date} has been received. We'll confirm shortly. - Mel" |
| payment-link | Booking approved | "Your appointment is confirmed! Please complete your $250 deposit to finalize: {paymentLink}" |
| booking-confirmed | Payment received | "All set! See you on {date} at {time} for {services}. Reply with any questions. - Mel" |
| reminder-24h | 24 hours before | "Reminder: You have {services} tomorrow at {time}. See you then! - Mel" |
| reminder-2h | 2 hours before | "Coming up: {services} at {time}. We're looking forward to seeing you! - Mel" |
| forms-reminder | 48h after booking, if forms incomplete | "Hi {name}, please complete your treatment forms before your appointment: {formsLink}" |
| running-late | Patient SMS "running late" received | Acknowledge receipt |

### 5.3 Staff In-App Messaging

**File**: `/packages/app/src/components/communication/StaffMessaging.tsx`

**Features:**
- Patient timeline with Communication resources
- Reply box: Type message → Creates Communication.response
- Auto-sends SMS to patient via Twilio bot
- Photo attachment: Staff can request photos (sends secure link)
- Message templates: Quick replies for common responses

### 5.4 Patient Timeline Integration

**File**: `/packages/app/src/components/timeline/PatientTimeline.tsx`

**Data Sources:**
```typescript
const timelineItems = useMemo(() => {
  return [
    ...procedures.map(p => ({ type: 'procedure', date: p.performedDateTime, data: p })),
    ...serviceRequests.map(s => ({ type: 'service-request', date: s.authoredOn, data: s })),
    ...communications.map(c => ({ type: 'communication', date: c.sent, data: c })),
    ...media.map(m => ({ type: 'media', date: m.created, data: m })),
    ...documentReferences.map(d => ({ type: 'document', date: d.date, data: d }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}, [procedures, serviceRequests, communications, media, documentReferences]);
```

---

## 6. Payment & Stripe Integration

### 6.1 Deposit Flow

**File**: `/packages/app/src/payments/stripeIntegration.ts`

```typescript
export async function createDepositPayment(
  medplum: MedplumClient,
  appointment: Appointment
): Promise<string> {
  const patient = getPatientFromAppointment(appointment);
  const amount = 25000; // $250.00 in cents
  
  // Create PaymentIntent in Stripe
  const response = await fetch('/api/stripe/create-payment-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      metadata: {
        appointmentId: appointment.id,
        patientId: patient.id,
        type: 'deposit'
      }
    })
  });
  
  const { clientSecret, paymentIntentId } = await response.json();
  
  // Store payment intent reference
  await medplum.updateResource({
    ...appointment,
    extension: [
      ...(appointment.extension || []),
      { url: 'http://melissaknudson.com/fhir/StructureDefinition/stripe-payment-intent',
        valueString: paymentIntentId },
      { url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-amount',
        valueMoney: { value: 250, currency: 'USD' } },
      { url: 'http://melissaknudson.com/fhir/StructureDefinition/payment-status',
        valueString: 'pending' }
    ]
  });
  
  // Return payment link for SMS
  return `${process.env.VITE_PAYMENT_URL}/pay?client_secret=${clientSecret}`;
}
```

### 6.2 Stripe Webhook Handler

**File**: `/packages/server/src/webhooks/stripe.ts`

```typescript
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object);
      break;
  }
  
  res.json({ received: true });
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  const { appointmentId } = paymentIntent.metadata;
  
  // Update appointment
  const appointment = await medplum.readResource('Appointment', appointmentId);
  await medplum.updateResource({
    ...appointment,
    status: 'booked',
    extension: updateExtension(
      appointment.extension,
      'http://melissaknudson.com/fhir/StructureDefinition/payment-status',
      { valueString: 'deposit-received' }
    )
  });
  
  // Send confirmation SMS
  await sendBookingConfirmationSMS(appointment);
}
```

### 6.3 Outstanding Payments Dashboard

**File**: `/packages/app/src/pages/billing/OutstandingPaymentsPage.tsx`

**Filters:**
- All unpaid deposits
- Over 24 hours
- Over 48 hours
- Cancelled (failed to pay)

**Actions:**
- Send reminder SMS
- Cancel booking
- Call patient
- Mark as paid (if paid offline)

---

## 7. Patient Portal (Phase 2E)

### 7.1 Repository Structure

**New Repository**: `nurse-mel-portal` (separate from main medplum repo)

```
nurse-mel-portal/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── PhoneAuth.tsx          # SMS code login
│   │   ├── booking/
│   │   │   ├── ServiceSelector.tsx    # Multi-select services
│   │   │   ├── DateTimePicker.tsx     # Calendar with availability
│   │   │   └── BookingConfirmation.tsx
│   │   ├── timeline/
│   │   │   └── PatientTimeline.tsx    # Treatment history
│   │   └── photos/
│   │       └── PhotoUpload.tsx        # Secure link upload
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── BookAppointmentPage.tsx
│   │   ├── TreatmentHistoryPage.tsx
│   │   ├── FormsPage.tsx              # Digital consent forms
│   │   └── PaymentPage.tsx
│   ├── hooks/
│   │   └── usePatientData.ts
│   └── utils/
│       └── secureLink.ts              # S3 presigned URLs
├── package.json
└── README.md
```

### 7.2 Authentication: SMS-Based

**Flow:**
1. Patient enters phone number
2. System sends 6-digit code via Twilio
3. Patient enters code
4. System validates, creates session
5. Patient sees their data

**File**: `/src/components/auth/PhoneAuth.tsx`

```typescript
const handleSendCode = async (phone: string): Promise<void> => {
  // Find patient by phone
  const patient = await medplum.searchOne('Patient', { phone });
  if (!patient) throw new Error('Patient not found');
  
  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Store code temporarily (Redis or secure cache)
  await storeAuthCode(patient.id, code, { expiresIn: '5 minutes' });
  
  // Send SMS
  await twilio.messages.create({
    body: `Your Nurse Mel verification code is: ${code}`,
    to: phone,
    from: twilioPhoneNumber
  });
};
```

### 7.3 Photo Upload via Secure Link

**Flow:**
1. Staff requests photo in app → System generates secure link
2. SMS sent to patient: "Please upload your before photo: [Secure Link]"
3. Link expires in 24 hours, can only be used once
4. Patient uploads → Creates Media resource
5. Photo appears in patient timeline

**File**: `/src/utils/secureLink.ts`

```typescript
export async function generatePhotoUploadLink(
  patientId: string,
  photoType: 'before' | 'after'
): Promise<string> {
  // Generate presigned S3 URL
  const uploadUrl = await s3.getSignedUrlPromise('putObject', {
    Bucket: 'melissa-knudson-photos',
    Key: `uploads/${patientId}/${photoType}/${uuid()}.jpg`,
    Expires: 86400 // 24 hours
  });
  
  // Store in database with metadata
  const linkId = await storeUploadLink({
    patientId,
    photoType,
    uploadUrl,
    expiresAt: dayjs().add(24, 'hours').toISOString()
  });
  
  return `${portalUrl}/upload/${linkId}`;
}
```

---

## 8. Phase Implementation Plan

### Phase 2A: Service Catalog & Multi-Service Booking (Weeks 1-2)

**Tasks:**
- [ ] Create ActivityDefinition seed data
- [ ] Build ServiceCatalogPage (admin)
- [ ] Update CreateAppointmentModal for multi-service
- [ ] Implement service compatibility checking
- [ ] Add consult/GFE validation warnings
- [ ] Update Appointment creation to handle multiple services
- [ ] Build PendingBookingsPage for staff approval
- [ ] Test: Create booking with Botox + Filler

**Deliverables:**
- Multi-service booking works end-to-end
- Service catalog is configurable via admin UI
- Consult warnings display correctly
- Staff can approve/reject bookings

### Phase 2B: Numbing Tasks (Week 3)

**Tasks:**
- [ ] Create Task resources for numbing
- [ ] Build AssistantDashboard
- [ ] Implement Task notifications (in-app + SMS)
- [ ] Update calendar to show numbing blocks
- [ ] Add Task completion workflow
- [ ] Link Tasks to ServiceRequests

**Deliverables:**
- Numbing Task auto-creates for services that need it
- Assistant can see and complete Tasks
- Calendar shows numbing time separately
- Notifications when numbing is due

### Phase 2C: Communication (Weeks 4-5)

**Tasks:**
- [ ] Set up Twilio account
- [ ] Build SMS webhook handler
- [ ] Create Communication resources
- [ ] Build StaffMessaging component
- [ ] Implement patient → staff SMS flow
- [ ] Add message templates
- [ ] Build patient timeline with communications

**Deliverables:**
- Two-way SMS works
- Patient messages appear in timeline
- Staff can reply via app → SMS
- Message templates in place

### Phase 2D: Payments & Consents (Weeks 6-7)

**Tasks:**
- [ ] Set up Stripe account
- [ ] Build deposit payment flow
- [ ] Create Stripe webhook handler
- [ ] Build OutstandingPaymentsPage
- [ ] Create digital consent form Questionnaires
- [ ] Implement consent form completion tracking
- [ ] Add checkout flow for treatments

**Deliverables:**
- $250 deposit auto-requested on approval
- Payment dashboard for coordinators
- Digital consent forms work
- Checkout flow for treatment completion

### Phase 2E: Patient Portal (Weeks 8-10)

**Tasks:**
- [ ] Create new repository
- [ ] Implement SMS authentication
- [ ] Build patient booking flow
- [ ] Create treatment history view
- [ ] Implement photo upload via secure link
- [ ] Add digital consent forms (patient-facing)
- [ ] Test end-to-end patient journey

**Deliverables:**
- Patient can book online
- Patient can view treatment history
- Patient can upload photos
- Patient can complete forms

### Phase 2F: Notifications & Polish (Weeks 11-12)

**Tasks:**
- [ ] Build reminder system (24h, 2h)
- [ ] Add post-treatment follow-up automation
- [ ] Create annual consult reminder bot
- [ ] Polish UI/UX
- [ ] Add loading states and error handling
- [ ] Test all workflows end-to-end

**Deliverables:**
- All notifications work
- Automated reminders
- Follow-up workflows
- Production-ready polish

---

## 9. File Structure Summary

### Modified Files (Phase 2A)

| File | Change |
|------|--------|
| `/packages/app/src/components/CreateAppointmentModal.tsx` | Multi-service support |
| `/packages/app/src/pages/CalendarPage.tsx` | Conflict detection |
| `/packages/app/src/pages/BookingsPage.tsx` | Add pending status filter |
| `/packages/app/src/nurse-mel/TreatmentsTab.tsx` | Show ServiceRequests |

### New Files (Phase 2A)

| File | Purpose |
|------|---------|
| `/packages/app/src/services/serviceCatalog.ts` | Service definitions |
| `/packages/app/src/pages/admin/ServiceCatalogPage.tsx` | Admin UI |
| `/packages/app/src/pages/PendingBookingsPage.tsx` | Staff approval queue |
| `/packages/app/src/components/booking/PendingBookingCard.tsx` | Booking card |
| `/packages/app/src/utils/gfeTracking.ts` | GFE checking logic |
| `/packages/app/src/utils/numbingTasks.ts` | Task creation logic |
| `/packages/app/src/components/PatientHeader.tsx` | Consult status indicator |
| `/packages/server/src/seed/serviceCatalog.ts` | Seed data |

---

## 10. Testing Checklist Per Phase

### Phase 2A
- [ ] Create ActivityDefinition for new service via admin
- [ ] Book patient with Botox + Filler
- [ ] System calculates correct total duration
- [ ] System warns if consult expired
- [ ] Room auto-assigned correctly
- [ ] Pending booking appears in staff queue
- [ ] Staff can approve/modify/reject

### Phase 2B
- [ ] Numbing Task auto-creates for services that need it
- [ ] Assistant sees Task in dashboard
- [ ] Task status updates: draft → in-progress → completed
- [ ] Calendar shows numbing time block

### Phase 2C
- [ ] Patient SMS arrives in timeline
- [ ] Staff reply sends SMS to patient
- [ ] Communication creates Communication resource

### Phase 2D
- [ ] Deposit payment intent creates
- [ ] Payment link sends via SMS
- [ ] Payment success updates Appointment status
- [ ] Consent form completion tracked

### Phase 2E
- [ ] Patient logs in with SMS code
- [ ] Patient can book appointment
- [ ] Patient can view history
- [ ] Secure photo upload works

### Phase 2F
- [ ] Reminder sends 24h before
- [ ] Reminder sends 2h before
- [ ] Follow-up sends after treatment

---

## References

### Related Documents
- **AGENTS.md** - Living project context, current status, patterns
- **INSTRUCTIONS.md** - Development environment setup
- **project-context.md** - Full architecture overview

### Medplum Examples Used
- **medplum-provider** - Calendar, scheduling patterns
- **foomedical** - Patient portal template
- **medplum-chat-demo** - Communication threading
- **medplum-demo-bots** - Twilio integration

### FHIR Resources Used
- ActivityDefinition - Service catalog
- Appointment - Booking container
- ServiceRequest - Ordered services
- Procedure - Performed services
- Task - Numbing sub-steps
- Communication - Patient messaging
- DocumentReference - Consent forms
- Media - Photos
- Questionnaire/Response - Forms

---

**Next Step**: Begin Phase 2A - Service Catalog implementation

**Questions?** Review AGENTS.md for current implementation status, or INSTRUCTIONS.md for dev environment setup.
