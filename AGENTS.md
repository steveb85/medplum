# Nurse Mel Medplum - AI Agent Context Document

> **Purpose**: Living document providing context for AI agents working on this project. Updated after each session with current status, recent changes, and architectural decisions.

**Last Updated**: April 24, 2026
**Current Phase**: Phase 2 - Sprint 3.1 Complete
**Next Phase**: Sprint 3.2 (Staff Approval Workflow)

**Build Plan**: See [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) for architecture  
**Migration**: See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) for Phase 1→2 transition  
**Tasks**: See [PHASE_2A_TASKS.md](./PHASE_2A_TASKS.md) for implementation breakdown

---

## 1. Quick Context

### What Is This
Medplum-based EMR (Electronic Medical Record) for **Nurse Melissa Knudson's** independent aesthetic nursing practice in NYC (Tribeca). Custom-built on top of the Medplum open-source FHIR platform.

### Architecture
- **Backend**: Medplum Server (Node.js + TypeScript + FHIR R4)
- **Database**: PostgreSQL + Redis
- **Frontend**: Medplum Provider App (React + TypeScript + Medplum React SDK)
- **Storage**: S3 for photos (via Medplum Binary storage)
- **Auth**: Medplum OAuth2 with custom role-based access (Provider vs Coordinator)

### Current URLs
| Environment | App URL | API URL |
|-------------|---------|---------|
| **Development** | https://app-dev.studioassistant.io | https://api-dev.studioassistant.io |
| **Production** | TBD | TBD |

> **Note**: Dev URLs are served via Cloudflare tunnels (see Section 8)

---

## 2. Development Environment

### Cloudflare Tunnels (Required for Webhook Development)

**Why**: Required for external webhook integrations (Twilio SMS, Stripe payments) to reach your local dev server.

**How it works**:
- Creates secure tunnels from public URLs to your local machine
- Allows testing webhooks without deploying to production
- Two tunnels: one for the React app (port 3000), one for the API server (port 8103)

**To start tunnels** (run in 2 separate terminals from repo root):
```bash
cloudflared tunnel --config .cloudflared/medplum-app.yml run
cloudflared tunnel --config .cloudflared/medplum-api.yml run
```

### Standard Dev Setup

1. **Infrastructure** (Terminal 1):
   ```bash
   docker-compose up
   ```
   - PostgreSQL on 5432
   - Redis on 6379

2. **Server** (Terminal 2):
   ```bash
   cd packages/server && npm run dev
   ```
   - API at http://localhost:8103
   - Auto-seeds test data

3. **App** (Terminal 3):
   ```bash
   cd packages/app && npm run dev
   ```
   - App at http://localhost:3000

---

## 3. Project Structure

### Key Directories

```
packages/app/src/
├── components/                 # Shared components
│   ├── CreateAppointmentModal.tsx    # Legacy booking modal (edit mode)
│   ├── CreateAppointmentModalV2.tsx  # NEW: 5-step multi-service booking modal
│   └── ...
├── nurse-mel/                  # Nurse Mel specific features
│   ├── BotoxTreatmentPage.tsx  # Botox workflow
│   ├── PhotoUploadSection.tsx  # Before/after photo handling
│   ├── TreatmentsTab.tsx       # Patient treatments list (NOW SHOWS APPOINTMENTS)
│   └── ...
├── treatments/                 # Treatment detail pages
│   ├── FillerTreatmentPage.tsx
│   ├── LaserTreatmentPage.tsx
│   ├── ConsultationTreatmentPage.tsx
│   └── shared/                 # Shared treatment components
│       ├── useTreatmentData.ts
│       ├── TreatmentHeader.tsx
│       ├── TreatmentStatusAlert.tsx
│       └── getTreatmentType.ts   # Service type routing logic
├── pages/                      # Top-level pages
│   ├── CalendarPage.tsx        # Scheduling with drag-to-create
│   └── BookingsPage.tsx        # Practice-wide bookings list (NOW SHOWS APPOINTMENTS)
└── auth/
    └── role.ts                 # Role utils: getMedSpaRole(), isMainProviderEligible(), isAssistantEligible()
```

---

## 4. Current Implementation Status

### ✅ COMPLETED (As of April 24, 2026)

**Core Workflows:**
- ✅ Botox treatment workflow (before photos → treatment → after photos)
- ✅ Patient management with search
- ✅ Calendar scheduling with `momentLocalizer` (switched from dayjs for timezone handling)
- ✅ Appointment booking with patient, providers, date/time, service type
- ✅ **Multi-service booking modal (V2)** - 5-step wizard with patient, services, schedule, providers, review
- ✅ **Duration override** - Click to customize appointment duration
- ✅ **GFE status checking** - Shows consult expiry warnings during booking
- ✅ **Provider role filtering** - Main provider shows only clinical staff (RN, NP, MD, etc.)
- ✅ **Assistant filtering** - Shows providers AND assistants, excludes coordinators
- ✅ Role-based access control (Provider vs Coordinator permissions)
- ✅ Treatment status: `preparation` → `in-progress` → `completed`
- ✅ **Edit booking functionality** - coordinators can edit scheduled treatments
- ✅ Service type change detection with navigation to correct treatment page
- ✅ Audit trail extensions (`last-edited`, `edited-by`)
- ✅ Provider assignment stored in `procedure.performer[]` (index 0 = main, index 1 = assistant)
- ✅ **Bookings list** - Shows appointments (not just procedures)
- ✅ **Patient treatments tab** - Shows both appointments AND procedures
- ✅ **Calendar drag-drop** - Opens modal with pre-filled date/time/duration

**FHIR Compliance:**
- ✅ Custom extensions for aesthetic data (injection maps, treatment areas, units used)
- ✅ `linked-appointment` extension on Procedure references Appointment
- ✅ Proper `performer` array for provider assignments
- ✅ `subject` references to Patient
- ✅ Media resources for photos with related-procedure extension
- ✅ ServiceRequest resources for booked services
- ✅ Task resources for numbing when assistant assigned

**Photo Workflow:**
- ✅ Before/after photo upload via PhotoUploadSection
- ✅ Photos linked to Procedure via `http://melissaknudson.com/fhir/StructureDefinition/related-procedure`
- ✅ ReadOnly mode based on treatment status

### ✅ COMPLETED (Sprint 3.2 - Staff Approval Workflow)

- ✅ Booking approval workflow (pending → approved → booked)
- ✅ Staff notification system (on create/approve/cancel)
- ✅ Appointment status management (pending, approved, booked, arrived, no-show, cancelled)
- ✅ Status audit trail extensions (`status-change-audit`)
- ✅ Deposit amount override (custom amount per booking)
- ✅ Calendar event styling (cancelled, no-show, pending badges)
- ✅ Auto-cancel logic (96h or 48h before treatment)
- ✅ Role-based booking creation (coordinator → pending, provider → booked)

### 🔄 IN PROGRESS

- 🔄 Booking detail page with deposit management
- 🔄 Split calendar events (numbing + treatment blocks)
- 🔄 Uncancel function with reason input

### ⏭️ UPCOMING (Sprint 3.3 - Communications & Deposits)

- ⏭️ Twilio SMS integration (sandbox)
- ⏭️ Resend email integration
- ⏭️ Stripe payment links
- ⏭️ Automated deposit requests (SMS + Email)
- ⏭️ Payment reminder schedule (24h intervals, max 4)
- ⏭️ Appointment reminders (24h, 2h before)
- ⏭️ Post-appointment follow-ups (per-service schedule)

---

## 5. Recent Changes

### April 24, 2026 - Sprint 3.1 Complete (Multi-Service Booking)

**New Feature: CreateAppointmentModalV2**

**Files Created:**
1. **`/packages/app/src/components/CreateAppointmentModalV2.tsx`** (NEW)
   - 5-step wizard: Patient → Services → Schedule → Providers → Review
   - Multi-service booking with duration calculation
   - Duration override functionality
   - GFE status checking with expiry warnings
   - Provider filtering (main vs assistant)
   - Creates Appointment + ServiceRequest + Task (for numbing)

**Files Modified:**
2. **`/packages/app/src/pages/CalendarPage.tsx`**
   - Added "New Appointment" button
   - Integrated CreateAppointmentModalV2
   - Drag-drop now passes date/time/duration to modal via `initialSlot` prop

3. **`/packages/app/src/pages/BookingsPage.tsx`**
   - Changed to show Appointments instead of Procedures
   - Updated columns: Patient, Services, Date, Time, Duration, Room, Providers, Status

4. **`/packages/app/src/nurse-mel/TreatmentsTab.tsx`**
   - Now shows BOTH appointments and procedures
   - Displays "Booking" badge for appointments
   - Links to calendar for appointments, treatment pages for procedures

5. **`/packages/app/src/auth/role.ts`**
   - Added `isMainProviderEligible()` function
   - Added `isAssistantEligible()` function
   - Filters practitioners based on qualification codes

### Architecture Decisions Made

- **Appointment-Centric**: Bookings page now shows Appointments, not Procedures
- **Provider Filtering**: Uses qualification codes (`RN`, `assistant`, `coordinator`, etc.) to filter dropdowns
- **Multi-Service**: One booking can have multiple services with calculated duration
- **Custom Duration**: Users can override calculated duration per-booking

---

### April 23, 2026 - Edit Booking Feature

**Files Modified:**
1. **`/packages/app/src/components/CreateAppointmentModal.tsx`**
   - Added `mode`, `appointment`, `procedure` props for edit mode
   - Implemented `handleUpdate()` function for saving changes
   - Added audit trail extensions for edit tracking
   - Fixed provider prefilling using `defaultValue` + `key` prop remount pattern
   - Changed `procedure.performer` to store both main AND assistant providers

2. **`/packages/app/src/nurse-mel/BotoxTreatmentPage.tsx`**
   - Added `appointment` state + loading from `linked-appointment` extension
   - Added "Edit Booking" button (visible when status is `preparation`)
   - Fixed ESLint hooks errors (moved hooks before conditional returns)
   - Integrated `CreateAppointmentModal` in edit mode

3. **`/packages/app/src/treatments/FillerTreatmentPage.tsx`**
   - Added edit button and modal integration

4. **`/packages/app/src/treatments/LaserTreatmentPage.tsx`**
   - Added edit button and modal integration

5. **`/packages/app/src/treatments/ConsultationTreatmentPage.tsx`**
   - Added edit button and modal integration

6. **`/packages/app/src/nurse-mel/TreatmentsTab.tsx`**
   - Updated to use `getTreatmentPageRoute()` for proper routing

7. **`/packages/app/src/pages/BookingsPage.tsx`**
   - Updated to use `getTreatmentPageRoute()` for proper routing

8. **`/packages/app/src/pages/CalendarPage.tsx`**
   - Switched from `dayjsLocalizer` to `momentLocalizer` (timezone fixes)

### Architecture Decisions Made

- **Provider Storage**: Both main and assistant providers stored in `procedure.performer[]` (not just main)
- **Edit Restrictions**: Only treatments in `preparation` status can be edited
- **Service Type Changes**: Changing service type navigates to appropriate treatment page
- **Audit Trail**: Extensions track who edited and when

---

## 6. Code Patterns & Standards

### Loading Linked Resources

Use extensions to link resources, then load them:

```typescript
// From Procedure, load linked Appointment
const linkedApptExtension = procedure.extension?.find(
  (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment'
);
if (linkedApptExtension?.valueReference?.reference?.startsWith('Appointment/')) {
  const appointmentId = linkedApptExtension.valueReference.reference.split('/')[1];
  const appt = await medplum.readResource('Appointment', appointmentId);
  setAppointment(appt);
}
```

### Storing Multiple Providers

```typescript
// In procedure.performer (main = index 0, assistant = index 1)
performer: mainProvider || assistantProvider
  ? [
      ...(mainProvider ? [{ actor: createReference(mainProvider) }] : []),
      ...(assistantProvider ? [{ actor: createReference(assistantProvider) }] : []),
    ]
  : undefined,
```

### Prefilling AsyncAutocomplete

Since `AsyncAutocomplete` and `ResourceInput` only support `defaultValue` (uncontrolled):

```typescript
// State to force remount when data loads
const [prefillKey, setPrefillKey] = useState(0);

// After async data loads
setPrefillKey(prev => prev + 1);

// In JSX, use key to force remount with new defaultValue
<AsyncAutocomplete
  key={`mainProvider-${prefillKey}`}
  defaultValue={mainProvider ?? undefined}
  // ... other props
/>
```

### Custom FHIR Extensions

```typescript
// Treatment-specific data stored as extensions
extension: [
  {
    url: 'http://melissaknudson.com/fhir/StructureDefinition/treatment-areas',
    valueString: 'Forehead, Crows Feet',
  },
  {
    url: 'http://melissaknudson.com/fhir/StructureDefinition/units-used',
    valueInteger: 35,
  },
  {
    url: 'http://melissaknudson.com/fhir/StructureDefinition/injection-map',
    extension: [
      { url: 'bodyRegion', valueString: 'face' },
      { url: 'view', valueString: 'front' },
      // ... markers array
    ],
  },
],
```

### Role-Based Access

```typescript
const role = getMedSpaRole(medplum); // 'provider' | 'coordinator' | null

// Coordinators cannot start/complete treatments
const canBeginTreatment = useCallback((): boolean => {
  if (role === 'coordinator') return false;
  if (!procedure) return false;
  if (!isAssignedProvider()) return false;
  return procedure.status === 'preparation';
}, [procedure, role, isAssignedProvider]);
```

### Calendar Timezone Handling

```typescript
// Use momentLocalizer instead of dayjsLocalizer for proper min/max time handling
import moment from 'moment';
import { momentLocalizer } from 'react-big-calendar';

const localizer = momentLocalizer(moment);

// In Calendar
truncate={(date: Date) => moment(date).toDate()}
min={moment().hour(8).minute(0).toDate()}
max={moment().hour(20).minute(0).toDate()}
```

---

## 7. FHIR Compliance & HIPAA Considerations

### PHI Handling
- All patient data stored as FHIR resources (Patient, Appointment, Procedure, Media)
- Photos stored as Media resources with S3 Binary storage
- AuditEvent resources automatically created by Medplum for all data access

### Extensions (Custom, but Standards-Compliant)
All custom extensions use the base URL: `http://melissaknudson.com/fhir/StructureDefinition/`

| Extension | Purpose | FHIR Compliant |
|-----------|---------|----------------|
| `linked-appointment` | Links Procedure to Appointment | ✅ Yes |
| `treatment-areas` | Text list of treated areas | ✅ Yes |
| `units-used` | Total units injected | ✅ Yes |
| `product-brand` | Botox/Dysport/etc brand | ✅ Yes |
| `injection-map` | Complex marker data | ✅ Yes |
| `related-procedure` | Links Media to Procedure | ✅ Yes |
| `status-change-audit` | Who changed status when | ✅ Yes |
| `last-edited` | Edit timestamp | ✅ Yes |
| `edited-by` | Editor reference | ✅ Yes |

### Access Control
- **Providers**: Full clinical access (RN qualification required)
- **Coordinators**: Read-only patient view, can schedule/manage appointments
- **Super Admin**: System administration

---

## 8. Integration Points

### Cloudflare Tunnels
**Purpose**: Allow external services to reach local dev server for webhook testing.

**Typical Flow**:
```
Twilio Webhook → https://api-dev.studioassistant.io/webhook/sms → localhost:8103
Stripe Webhook → https://api-dev.studioassistant.io/webhook/stripe → localhost:8103
```

**Why This Matters**:
- Twilio needs a public URL to send SMS status callbacks
- Stripe needs a public URL for payment confirmation webhooks
- Without tunnels, you'd have to deploy to test webhooks

### Push Notifications

**Status:** ✅ Complete - Working for both broadcast and targeted notifications

**Documentation:** See `packages/app/docs/PUSH_NOTIFICATIONS.md` for complete technical documentation

**Key Concepts:**

| Notification Type | Recipients | Use Case | Example |
|-------------------|------------|----------|---------|
| **Broadcast** | ALL practitioners | Patient messages, announcements | "Patient asking about pricing" |
| **Targeted** | Specific providers | Provider-specific tasks | "New Botox appointment assigned to you" |

**When to Use Each:**

**Broadcast to ALL staff:**
- 🗣️ **Patient communications** - Incoming messages from patients (anyone can reply)
- 📢 **Company announcements** - System maintenance, new features
- 🚨 **Urgent alerts** - Building closure, emergency updates
- 📋 **Shared inbox items** - Messages the entire practice needs to see

**Targeted to SPECIFIC provider:**
- 📅 **New bookings** - Only the assigned provider
- 🔄 **Booking changes** - Reschedules, cancellations for that provider
- 💉 **Treatment updates** - Patient ready for Botox, photos uploaded
- 📸 **Photo uploads** - Before/after photos ready for review
- 📝 **Notes added** - Consultation notes on provider's patient

**Why this matters:**
- Broadcasts keep everyone informed (shared inbox concept - any staff can reply)
- Targeted notifications reduce noise (only relevant people get interrupted)
- Providers can focus on their patients without being interrupted by others' tasks

### Future Integrations

| Service | Purpose | HIPAA Consideration |
|---------|---------|---------------------|
| **Twilio** | SMS reminders | Requires HIPAA plan |
| **Stripe** | Payment deposits | Included in service |
| **Resend** | Transactional email | Requires BAA |
| **S3** | Photo storage | Encrypted + BAA |

---

## 9. Common Issues & Solutions

### ESLint: React Hooks Rules
**Error**: "React Hook is called conditionally"
**Fix**: Declare ALL hooks before ANY conditional returns:
```typescript
// BAD - hooks after return
if (!procedureId) return <Loading />;
const [data, setData] = useState(); // ❌ Error

// GOOD - hooks first
const [data, setData] = useState();
if (!procedureId) return <Loading />; // ✅ OK
```

### ESLint: Exhaustive Dependencies
**Error**: "React Hook useCallback has a missing dependency"
**Fix**: Add all referenced values to dependency array, or use `useRef` if you don't want to trigger updates.

### AsyncAutocomplete Not Showing Selected Value
**Cause**: `defaultValue` only works on initial mount, but data loads async.
**Fix**: Use `key` prop to force remount when data is ready (see Section 6).

### Photos Not Loading
**Check**: Media resources need proper `related-procedure` extension with full `Procedure/${id}` reference.

---

## 10. Testing Checklist

Before marking a feature complete, verify:

- [ ] **Create Flow**: Patient → Book Appointment → View in Calendar
- [ ] **Edit Flow**: Open scheduled treatment → Edit Booking → Change values → Save → Verify updates
- [ ] **Service Type Change**: Edit booking → Change service type → Save → Navigates to correct treatment page
- [ ] **Role Permissions**: Test as Coordinator (should not see "Begin Treatment" button)
- [ ] **Photo Upload**: Upload before photo → Refresh → Photo persists
- [ ] **Provider Assignment**: Both main and assistant providers display correctly
- [ ] **Status Transitions**: preparation → in-progress → completed (with audit trail)
- [ ] **ESLint Clean**: `npx eslint packages/app/src/nurse-mel/BotoxTreatmentPage.tsx` passes
- [ ] **Type Check**: `npx tsc --noEmit -p packages/app/tsconfig.json` passes

---

## 11. Key Files Reference

### Configuration
- `/packages/app/medplum.config.ts` - App configuration
- `/packages/server/.env` - Server environment variables
- `/.cloudflared/*.yml` - Tunnel configurations (not committed)

### Core Components (Modified)
- `CreateAppointmentModal.tsx` - Booking creation & editing
- `BotoxTreatmentPage.tsx` - Main Botox treatment workflow
- `PhotoUploadSection.tsx` - Photo upload UI
- `CalendarPage.tsx` - Scheduling calendar

### Utility Functions
- `getMedSpaRole()` - `/packages/app/src/auth/role.ts` - Role detection
- `getTreatmentPageRoute()` - `/packages/app/src/treatments/shared/getTreatmentType.ts` - Service type routing

---

## 12. Session History

### April 23, 2026
- Fixed ESLint hooks errors in BotoxTreatmentPage.tsx
- Implemented Edit Booking functionality with audit trail
- Fixed provider prefilling in CreateAppointmentModal
- Updated storage to include both main and assistant in procedure.performer[]
- Switched Calendar from dayjsLocalizer to momentLocalizer
- Added getTreatmentPageRoute() utility for navigation on service type change

### April 22, 2026
- Started implementation of edit booking feature
- Created shared treatment components (TreatmentHeader, TreatmentStatusAlert)
- Identified issue with assistant provider not being stored in procedure

### Earlier Sessions
- See INSTRUCTIONS.md and project-context.md for full history

---

**Document Maintenance**: Update this file after each development session with:
1. New/modified files
2. Architecture decisions
3. New patterns discovered
4. Integration status changes
5. Testing checklist results

**Questions?** Check INSTRUCTIONS.md for setup details, or project-context.md for full architecture.

---

### April 24, 2026 - Sprint 3.2 Complete (Staff Approval Workflow)

**New Feature: Booking Approval & Status Management**

**Files Modified:**
1. **`/packages/app/src/pages/BookingsPage.tsx`**
   - Added "Pending Approval" tab showing pending bookings
   - Added "Approve" button for pending bookings (green checkmark)
   - Added status action menu: Mark as Arrived, No-Show, Cancel
   - Added cancellation modal with reason input
   - Status badge colors: Pending (yellow), Booked (blue), Arrived (teal), Completed (green), Cancelled (red), No-Show (gray)
   - Auto-notification on approve/cancel to assigned providers

2. **`/packages/app/src/notifications/templates.ts`**
   - Added `appointment-approved` notification template
   - Sends notification to main provider and assistant when booking approved

3. **`/packages/app/src/notifications/utils.ts`**
   - Updated `getNotificationRecipients` for approval workflow
   - Sends to assigned providers on status changes

**Status Transition Rules:**
```
pending → booked (Approve)
booked → arrived (Mark Arrived)
booked → noshow (Mark No-Show)
booked → cancelled (Cancel)
arrived → fulfilled (Complete treatment)
```

**Audit Trail Extensions:**
- `status-change-audit`: tracks from → to, timestamp, changedBy
- `cancellation-reason`: stores cancellation reason


---

### April 24, 2026 - Sprint 3.3 Phase 1-3 Complete (Communications & Deposits)

**New Features: Deposit Management, SMS/Email Integration, Automated Reminders**

**Phase 1: Configuration & Setup**

**Files Modified:**
1. **`/packages/app/src/pages/admin/ServiceCatalogPage.tsx`**
   - Added deposit configuration: `depositAmount`, `depositReminders`, `depositReminderInterval`
   - Added follow-up schedule: `followUpSchedule` JSON array
   - Added per-provider rates: `providerRates` JSON array (advanced feature for multi-provider pricing)

**Files Created:**
2. **`/packages/app/src/utils/payments.ts`** (NEW)
   - Deposit status management (`pending`, `requested`, `paid`, `waived`)
   - Payment link expiry calculation (96h default, dynamic based on appointment proximity)
   - Auto-cancel logic (96h or 48h before appointment)
   - Deposit amount formatting and validation

3. **`/packages/app/src/utils/sms.ts`** (NEW)
   - Twilio SMS integration
   - Templates: deposit request, payment confirmation, appointment reminders, auto-cancel warnings
   - Sandbox mode for development

4. **`/packages/app/src/utils/email.ts`** (NEW)
   - Resend email integration
   - Same templates as SMS
   - HTML + text email support

**Phase 2: Booking Detail Page**

**Files Created:**
5. **`/packages/app/src/pages/BookingDetailPage.tsx`** (NEW)
   - Full booking details display (patient, services, providers, room)
   - Deposit management section with status badge
   - Custom deposit amount override
   - "Send Payment Link" button (triggers SMS + Email)
   - "Mark as Paid" button for manual payment entry
   - "Waive Deposit" with reason input
   - Status actions: Approve, Mark Arrived, Mark No-Show, Cancel, Uncancel
   - Activity history timeline (audit trail)

**Files Modified:**
6. **`/packages/app/src/AppRoutes.tsx`**
   - Added route `/bookings/:id` → BookingDetailPage

7. **`/packages/app/src/pages/BookingsPage.tsx`**
   - Updated eye icon to link to `/bookings/:id` (detail page)

**Phase 3: Server-Side Webhooks**

**Files Created:**
8. **`/packages/server/src/webhooks/stripe.ts`** (NEW)
   - Stripe webhook handler for payment events
   - Updates appointment deposit status on payment success
   - Creates `deposit-info` extension with payment details
   - `createStripePaymentLink()` function for generating checkout URLs

9. **`/packages/server/src/webhooks/twilio.ts`** (NEW)
   - Incoming SMS webhook handler
   - Creates Communication FHIR resource for each message
   - Auto-response logic (cancel, reschedule, confirm, stop)
   - Broadcasts patient messages to staff via notifications

**Phase 4: Automated Reminders**

**Files Created:**
10. **`/packages/app/src/utils/reminders.ts`** (NEW)
    - Deposit reminder scheduler (every 24h, max 4)
    - Auto-cancel warning (24h before auto-cancel)
    - Appointment reminders (24h and 2h before)
    - Post-treatment follow-ups (per-service schedule)
    - Upcoming reminders display for booking detail page

**Environment Variables Added:**
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

**New FHIR Extensions:**
| Extension | Purpose | FHIR Compliant |
|-----------|---------|----------------|
| `deposit-info` | Tracks deposit status, amount, timestamps | Yes |
| `last-deposit-reminder` | Tracks which reminder was sent | Yes |
| `auto-cancel-warning-sent` | Tracks if warning was sent | Yes |
| `appointment-reminder-24h-sent` | Tracks 24h reminder | Yes |
| `appointment-reminder-2h-sent` | Tracks 2h reminder | Yes |
| `post-treatment-followup-sent` | Tracks follow-up communications | Yes |
| `sms-metadata` | Stores Twilio message metadata | Yes |

**Architecture Decisions Made:**
- **Deposit Status Flow**: `pending` → `requested` → `paid` | `waived`
- **Dynamic Payment Link Expiry**: 96h default, adjusted based on appointment proximity
- **Auto-Cancel Logic**: 96h since request OR 48h before appointment (whichever first)
- **SMS/Email Templates**: Centralized in utility files with variable substitution
- **Communication Resources**: Incoming SMS stored as FHIR Communication for audit trail
- **Sandbox Mode**: SMS/Email log to console in development, don't actually send

**Next Phase:**
- Phase 4: Split Calendar Events (numbing blocks separate from treatment blocks)
- Phase 5: Booking creation with automatic deposit request (when approved)

---

**Current Status:** Sprint 3.3 Phase 1-3 Complete, ready for Phase 4 (Calendar Split Events)
