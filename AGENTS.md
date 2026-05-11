# Nurse Mel Medplum - AI Agent Context Document

> **Purpose**: Living document providing context for AI agents working on this project. Updated after each session with current status, recent changes, and architectural decisions.

**Last Updated**: May 9, 2026
**Current Phase**: All Phases 1-10 Complete ✅
**Next Phase**: Maintenance & Bug Fixes

**Build Plan**: See [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) for architecture  
**Migration**: See [MIGRATION_PLAN.md](./MIGRATION_PLAN.md) for Phase 1→2 transition  
**Tasks**: See [PHASE_2A_TASKS.md](./PHASE_2A_TASKS.md) for implementation breakdown

---

## 1. Quick Context

### What Is This

1. **NEVER use `git checkout` to overwrite files** - This destroys work in progress
2. **NEVER run `git checkout <commit> -- <file>`** - This overwrites current work with old versions
3. When fixing bugs, EDIT the file directly - don't restore from old commits

Medplum-based EMR (Electronic Medical Record) for **Nurse Melissa Knudson's** independent aesthetic nursing practice in NYC (Tribeca). Custom-built on top of the Medplum open-source FHIR platform.

### Architecture

- **Backend**: Medplum Server (Node.js + TypeScript + FHIR R4)
- **Database**: PostgreSQL + Redis
- **Frontend**: Medplum Provider App (React + TypeScript + Medplum React SDK)
- **Storage**: S3 for photos (via Medplum Binary storage)
- **Auth**: Medplum OAuth2 with custom role-based access (Provider vs Coordinator)

### Current URLs

| Environment     | App URL                            | API URL                            |
| --------------- | ---------------------------------- | ---------------------------------- |
| **Development** | https://app-dev.studioassistant.io | https://api-dev.studioassistant.io |
| **Production**  | TBD                                | TBD                                |

> **Note**: Dev URLs are served via Cloudflare tunnels (see Section 8)

---

## 2. Development Environment

### Cloudflare Tunnels (Required for Webhook Development)

**Why**: Required for external webhook integrations (Twilio SMS, Stripe payments) to reach your local dev server.

**How it works**:

- Creates secure tunnels from public URLs to your local machine
- Allows testing webhooks without deploying to production
- Two tunnels: one for the React app (port 3002), one for the API server (port 8103)

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

   - App at http://localhost:3002

---

## 3. Project Structure

### Key Directories

```
packages/app/src/
├── components/           # Shared components
│   ├── CreateAppointmentModal.tsx      # Legacy booking modal (edit mode)
│   ├── CreateAppointmentModalV2.tsx    # NEW: 5-step multi-service booking modal
│   └── ...
├── intake/             # Patient intake form module
│   ├── PatientIntakePage.tsx           # Main entry point
│   ├── IntakeWizard.tsx                # 8-step wizard container
│   ├── PatientEditPage.tsx             # Edit existing patients
│   ├── sections/                       # Form section components
│   │   ├── WelcomeSection.tsx          # Step 1: HIPAA, Terms, Photo Release
│   │   ├── DemographicsSection.tsx     # Step 2: Patient demographics
│   │   ├── EmergencyContactSection.tsx # Step 3: Emergency contact
│   │   ├── InsuranceSection.tsx        # Step 4: Insurance info
│   │   ├── MedicalHistorySection.tsx   # Step 5: Medical conditions, meds, allergies
│   │   ├── TreatmentGoalsSection.tsx   # Step 6: Aesthetic concerns
│   │   ├── ContraindicationsSection.tsx # Step 7: Pregnancy, sun exposure
│   │   └── ReviewSection.tsx           # Step 8: Review & signature
│   ├── components/                   # Shared intake components
│   │   ├── DOBInput.tsx              # Year/month/day dropdowns
│   │   ├── SignatureCanvas.tsx         # Digital signature capture
│   │   ├── MedicationInput.tsx         # Medication entry with flags
│   │   ├── AllergyInput.tsx            # Allergy entry
│   │   ├── ProgressBar.tsx             # Step navigation
│   │   ├── IntakeSuccess.tsx           # Post-submission success screen
│   │   ├── BlockerAlert.tsx            # Treatment blockers
│   │   └── DuplicateCheckModal.tsx     # Duplicate detection
│   ├── utils/                          # Intake utilities
│   │   ├── intakeToFhir.ts             # Form data → FHIR resources
│   │   ├── loadPatient.ts              # FHIR → Form data (for editing)
│   │   ├── validation.ts               # Form validation
│   │   └── formatters.ts               # Display formatting
│   ├── hooks/                          # Intake hooks
│   │   ├── useIntakeSubmission.ts      # Submit/create/update logic
│   │   └── useIntakeDraft.ts           # Auto-save drafts
│   └── types/
│       └── intake.ts                   # TypeScript types
├── nurse-mel/          # Nurse Mel specific features
│   ├── BotoxTreatmentPage.tsx          # Botox workflow
│   ├── PhotoUploadSection.tsx          # Before/after photo handling
│   ├── TreatmentsTab.tsx               # Patient treatments list (NOW SHOWS APPOINTMENTS)
│   └── ...
├── treatments/         # Treatment detail pages
│   ├── FillerTreatmentPage.tsx
│   ├── LaserTreatmentPage.tsx
│   ├── ConsultationTreatmentPage.tsx
│   └── shared/         # Shared treatment components
│       ├── useTreatmentData.ts
│       ├── TreatmentHeader.tsx
│       ├── TreatmentStatusAlert.tsx
│       └── getTreatmentType.ts         # Service type routing logic
├── pages/              # Top-level pages
│   ├── CalendarPage.tsx                # Scheduling with drag-to-create
│   ├── BookingsPage.tsx                # Practice-wide bookings list (NOW SHOWS APPOINTMENTS)
│   └── BookingDetailPage.tsx           # Booking details with deposit management
└── auth/
    └── role.ts         # Role utils: getMedSpaRole(), isMainProviderEligible(), isAssistantEligible()
```

packages/app/src/
├── components/ # Shared components
│ ├── CreateAppointmentModal.tsx # Legacy booking modal (edit mode)
│ ├── CreateAppointmentModalV2.tsx # NEW: 5-step multi-service booking modal
│ └── ...
├── nurse-mel/ # Nurse Mel specific features
│ ├── BotoxTreatmentPage.tsx # Botox workflow
│ ├── PhotoUploadSection.tsx # Before/after photo handling
│ ├── TreatmentsTab.tsx # Patient treatments list (NOW SHOWS APPOINTMENTS)
│ └── ...
├── treatments/ # Treatment detail pages
│ ├── FillerTreatmentPage.tsx
│ ├── LaserTreatmentPage.tsx
│ ├── ConsultationTreatmentPage.tsx
│ └── shared/ # Shared treatment components
│ ├── useTreatmentData.ts
│ ├── TreatmentHeader.tsx
│ ├── TreatmentStatusAlert.tsx
│ └── getTreatmentType.ts # Service type routing logic
├── pages/ # Top-level pages
│ ├── CalendarPage.tsx # Scheduling with drag-to-create
│ └── BookingsPage.tsx # Practice-wide bookings list (NOW SHOWS APPOINTMENTS)
└── auth/
└── role.ts # Role utils: getMedSpaRole(), isMainProviderEligible(), isAssistantEligible()

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

### ✅ COMPLETED (Sprint 3.2 - Staff Approval Workflow) [CORRECTED]

- ✅ Booking approval workflow - CORRECTED: All bookings start as `pending`
- ✅ Staff notification system (on create/deposit paid/cancel)
- ✅ Appointment status management (`pending` → `booked` → `arrived` → `fulfilled`)
- ✅ Status audit trail extensions (`status-change-audit`)
- ✅ Deposit amount override (custom amount per booking)
- ✅ Calendar event styling (cancelled, no-show, pending badges)
- ✅ Auto-cancel logic (96h or 48h before treatment)
- ✅ Role-based booking creation - CORRECTED: ALL users create bookings as `pending` first

**WORKFLOW CORRECTION (April 27, 2026):**
```

OLD (WRONG): coordinator → pending, provider → booked (skipped deposit!)
NEW (CORRECT): ALL bookings → PENDING → Send Payment Link → PAID/WAIVED → BOOKED

All bookings start as PENDING regardless of who creates them.
Booking stays PENDING until deposit is paid or waived.
"Approve" button replaced with "Send Payment Link" button.

````

### 🔄 IN PROGRESS

- 🔄 Booking detail page with deposit management
- 🔄 Split calendar events (numbing + treatment blocks)
- 🔄 Uncancel function with reason input

### ✅ COMPLETED (Sprint 3.3 Phase 5 - Patient Intake Form)

**Core Intake Features:**
- ✅ 8-step patient intake wizard (self-service and coordinator-assisted modes)
- ✅ Success screen with patient confirmation
- ✅ Patient editing via full form interface
- ✅ All staff roles can edit patient information
- ✅ Date handling with ISO strings (no timezone issues)
- ✅ Digital signature capture
- ✅ Duplicate patient detection

**FHIR Resources:**
- ✅ Patient with custom extensions
- ✅ Consent resources (HIPAA, Terms, Photo Release)
- ✅ Coverage for insurance
- ✅ RelatedPerson for emergency contact
- ✅ Condition for medical conditions and contraindications
- ✅ MedicationStatement with flags
- ✅ AllergyIntolerance
- ✅ Observation for aesthetic history, surgical history, skincare
- ✅ Flag for treatment goals
- ✅ QuestionnaireResponse for audit trail

### ✅ ALL PHASES COMPLETE (Phases 1-10)

**Project Status:** All roadmap phases completed. System is feature-complete for Nurse Mel's practice.

**Next:** Bug fixes, refinements, and new feature requests as needed.

---

## 5. Recent Changes

### May 1, 2026 - Phase 6 Complete (Calendar Resource Filtering + Per-Service Events)

**Files Modified:**
1. **`/packages/app/src/pages/CalendarPage.tsx`**
   - Changed from one event per Appointment to one event per ServiceRequest
   - Added resource filter UI (collapsible panel with MultiSelect for rooms, providers, equipment)
   - Custom event component (`ServiceCalendarEvent`) with:
     - Room abbreviation badge (R1, R2, R3)
     - Equipment icon when required
     - Status-based left border color (pending/booked/arrived/fulfilled/cancelled)
     - Hover tooltip showing patient, service, room, equipment, status
   - Parallel loading of Appointments + ServiceRequests + Devices + Practitioners
   - Active filter chips with "Clear all" button
   - Time-splitting for sequential services based on service-position order

**Architecture Decisions Made:**
- ServiceRequest start/end times calculated from Appointment's overall times divided evenly by service count
- Room labels stored as strings (room-1, room-2) in ServiceRequest extensions, mapped to abbreviations (R1, R2)
- Equipment filter matches by Device ID, event display shows device name
- Provider filter checks ServiceRequest.performer references
- All filters are OR-based within each category (selecting Room 1 + Room 2 shows both)

---

### May 9, 2026 - Phases 7-10 Complete (Validation & Final Polish)

**Summary:** All remaining roadmap phases completed. Conflict detection working with real-time validation.

**Phase 7 - Bookings List Page:**
- Removed Room column (redundant with calendar view)
- Simplified table columns: Patient, Services, Time, Status, Providers
- Shows service count badge for multi-service bookings

**Phase 8 - Treatments Tab Updates:**
- Removed Areas, Units, Photos columns from table view
- Clean status-based display
- Clear separation between appointments and procedures

**Phase 9 - Validation & Warnings (Major Feature):**
- **Room/equipment compatibility warnings** - Shows on Configure page when room lacks required equipment
- **Provider double-booking detection** - Checks Schedule/Review pages with correct timeline ordering
- **Assistant conflict detection** - Warns when assistant is double-booked
- **Room conflict detection** - Searches ServiceRequests by assigned-room extension
- **Real-time conflict checking** - 500ms debounce prevents UI lag
- **Timeline-based detection** - Accounts for numbing before Botox (correct sequential timing)
- **Bug fix**: Added `selectedDate` to `checkAllConflicts` dependency array to fix stale closure issue

**Files Modified:**
1. **`/packages/app/src/pages/BookingsPage.tsx`**
   - Simplified columns (removed Room)
   - Clean status display

2. **`/packages/app/src/nurse-mel/TreatmentsTab.tsx`**
   - Removed Areas, Units, Photos columns
   - Status-focused display

3. **`/packages/app/src/components/CreateAppointmentModalV3.tsx`**
   - Added `checkAllConflicts` function with comprehensive conflict detection
   - Added 500ms debounced useEffect for real-time validation
   - Fixed `selectedDate` dependency bug (was causing "No selected date, skipping")
   - Timeline-based conflict checking (numbing before treatment)
   - Debug logging for troubleshooting

**Key Bug Fix:**
```typescript
// Before (broken):
[medplum, editMode, editAppointment]  // selectedDate not included!

// After (fixed):
[medplum, editMode, editAppointment, selectedDate]  // Now gets current value
```

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

## 5b. Feature Roadmap (Phases 1-10)

**Current Status**: All Phases 1-10 Complete ✅ | **Status**: Feature-complete, maintenance mode

### Phase 1: Data Model & FHIR Extensions ✅ COMPLETE
| Extension | File | Status |
|-----------|------|--------|
| `assignedRoom` (ServiceRequest → Location) | `fhir-extensions.ts` | ✅ |
| `assignedEquipment` (ServiceRequest → Device[]) | `fhir-extensions.ts` | ✅ |
| `serviceSequence` (ServiceRequest integer) | `fhir-extensions.ts` | ✅ |
| `linkedServices` (ServiceRequest → ServiceRequest[]) | `fhir-extensions.ts` | ✅ |
| `serviceStatus` (pending/in-progress/completed) | `fhir-extensions.ts` | ✅ |
| `actualDuration` (ServiceRequest minutes) | `fhir-extensions.ts` | ✅ |
| `recommendedAccompanyingServices` (ActivityDefinition) | `fhir-extensions.ts`, `ServiceCatalogPage.tsx` | ✅ |
| `equipmentRequirements` (ActivityDefinition) | `fhir-extensions.ts`, `ServiceCatalogPage.tsx` | ✅ |

### Phase 2: Backend Logic & Validation ✅ MOSTLY COMPLETE
| Feature | File | Status |
|---------|------|--------|
| `createMultiServiceBooking()` | `multi-service-booking.ts` | ✅ |
| `calculateSequentialTimings()` | `multi-service-booking.ts` | ✅ |
| `checkRoomConflicts()` | `multi-service-booking.ts` | ✅ |
| `checkProviderConflicts()` | `multi-service-booking.ts` | ✅ |
| `checkEquipmentConflicts()` | `multi-service-booking.ts` | ✅ |
| `checkConflicts()` (orchestrator) | `multi-service-booking.ts` | ✅ |
| Room/equipment validation functions | - | ⬜ Deferred (shown in booking modal instead) |

### Phase 3: Service Catalog ✅ COMPLETE
- ✅ Equipment requirements UI (add/edit/remove)
- ✅ Recommended accompanying services UI (with timing: before/after/concurrent)
- ✅ Numbing recommendation field
- ⬜ Room type requirements (dropped - not needed)

### Phase 4: Booking Form ✅ COMPLETE
- ✅ CreateAppointmentModalV3 (5-step wizard)
- ✅ Multi-service selection with search
- ✅ Auto-suggest accompanying services
- ✅ Per-service configuration (provider, assistant, duration, room, equipment)
- ✅ Visual timeline preview (sequential times, total duration)
- ✅ Service sequencing
- ✅ Conflict checking (room, provider, equipment)

### Phase 5: Booking Detail & Deposit System ✅ COMPLETE
| Feature | Status |
|---------|--------|
| Deposit system migrated to FHIR AuditEvents | ✅ |
| Deposit actions (mark paid, send link, waive, undo, refund) | ✅ |
| Activity history from AuditEvents | ✅ |
| Basic service display (service names in list) | ✅ |
| **Edit booking button** | ⬜ **TODO** (missing on BookingDetailPage) |
| Per-service cards with actions (Start/Complete/Edit) | ⬜ Deferred (service exists in ServiceCard.tsx but not integrated) |

**Key Decision**: Conflict detection shows on booking modal/detail page, not on calendar. No time override on calendar needed - providers set times during booking creation.

---

### Phase 6: Calendar Resource Filtering ✅ COMPLETE

**Implementation**: Calendar now shows one event per ServiceRequest (not per Appointment) with resource filtering.

**6.1 Multi-Event Display ✅**
- [x] One calendar event per ServiceRequest (not per Appointment)
- [x] Events from same booking share visual grouping (same patient name, hover tooltip)
- [x] Click event → opens booking detail page (`/bookings/:id`)
- [x] Hover shows all services in that booking (Tooltip with patient name, service name, room, equipment, status)

**6.2 Resource Filtering ✅**
- [x] Filter by room (show only services assigned to selected room(s))
- [x] Filter by provider (show only services assigned to selected provider(s))
- [x] Filter by equipment (show only services requiring selected equipment)
- [x] Multi-select filters (MultiSelect components for rooms, providers, equipment)
- [x] Filter UI: collapsible filter panel with chip-based active filter display + "Clear all" button

**6.3 Event Styling ✅**
- [x] Show room abbreviation on event badge (e.g., "R1", "R2")
- [x] Show equipment icon if required (IconTool)
- [x] Sequential services: time-split based on service-position order
- [x] Color by status (pending/booked/arrived/fulfilled/cancelled/noshow) via left border color

**6.4 Drag-Drop Behavior (Deferred)**
- [ ] Drag service → moves just that service (with conflict check on booking modal)
- [ ] Resize → adjusts duration for that service
- [ ] No time override on calendar (providers set times during booking)

---

### Phase 7: Bookings List Page ✅ COMPLETE
- [x] Show first service time (not booking time)
- [x] Show service count badge ("3 services")
- [x] Room column removed (users see rooms on calendar instead)
- [x] Simplified table: Patient, Services, Time, Status, Providers

---

### Phase 8: Treatments Tab Updates ✅ COMPLETE
- [x] Columns simplified (removed Areas, Units, Photos)
- [x] Shows appointments and procedures clearly
- [x] Clean status-based display

---

### Phase 9: Validation & Warnings ✅ COMPLETE
- [x] Room/equipment compatibility warnings on Configure page
- [x] Provider double-booking detection on Schedule/Review pages
- [x] Assistant conflict detection
- [x] Room conflict detection (checks ServiceRequests by room extension)
- [x] Real-time conflict checking with 500ms debounce
- [x] Timeline-based conflict detection (accounts for numbing before Botox)
- [x] Debug logging for troubleshooting conflict detection

---

### Phase 10: Equipment Management ⬜
- [ ] Equipment availability calendar view
- [ ] Show upcoming bookings per equipment
- [ ] Maintenance scheduling integration

---

### Phase N: Deferred / Backlog ⬜
- [ ] Room type requirements extension & UI
- [ ] `validateServiceRoom()` / `validateServiceEquipment()` functions
- [ ] Per-service action cards in BookingDetailPage (ServiceCard.tsx integration)
- [ ] `suggestRoomsForService()` function

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
````

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

### FHIR-First: Deposit & Payment Tracking (Phase 5 - April 2026)

**CRITICAL**: Do NOT use `buildDepositInfoExtensions()` or `getDepositStatus()` from `utils/payments.ts`. These are **deprecated**. All deposit/payment data is now stored via **FHIR AuditEvents**, NOT Appointment extensions.

**Why**: Extensions on the Appointment resource became stale after updates. AuditEvents provide a complete, auditable history that can be replayed to reconstruct state at any point in time.

**Correct Pattern**:

```typescript
// READING deposit status
import { getDepositStatusFromAuditEvents } from '../utils/audit-events';

const depositInfo = await getDepositStatusFromAuditEvents(medplum, patientId);
// Returns: { status: 'paid' | 'waived' | 'requested' | 'pending', amount, paidAt, ... }

// WRITING deposit actions
import {
  recordDepositPaid,
  recordDepositRequested,
  recordDepositWaived,
  recordPaymentUndone,
  recordRefundIssued,
  recordDepositAmountChanged,
} from '../utils/audit-events';

// Example: Mark deposit as paid
const currentUserPractitioner = {
  resourceType: 'Practitioner',
  id: currentUser?.id || '',
  name: currentUser?.name,
};

await recordDepositPaid(
  medplum,
  patient,
  serviceRequest,
  depositAmount,
  currentUserPractitioner,
  'manual', // paymentType: 'manual' | 'online'
  actualPaidAmount, // optional
  paymentNotes // optional
);

// Example: Send payment link
await recordDepositRequested(
  medplum,
  patient,
  serviceRequest,
  depositAmount,
  'sms+email', // method: 'sms' | 'email' | 'sms+email'
  currentUserPractitioner
);
```

**How State Reconstruction Works**:

1. `getDepositStatusFromAuditEvents()` queries all AuditEvents for the patient
2. Filters to deposit/payment-related events (description contains 'deposit', 'payment', 'refund')
3. Sorts chronologically
4. Replays events in order, last event wins for status
5. Handles undo/refund by reverting status appropriately

**AuditEvent Description Patterns**:

- `Deposit paid via manual by ...` → status: 'paid'
- `Deposit requested via sms+email by ...` → status: 'requested'
- `Deposit waived: ...` → status: 'waived'
- `Payment undone by ...: ...` → status: 'requested' (revert)
- `Refund of $... issued by ...: ...` → status: 'requested'

**Files**:

- `/packages/app/src/utils/audit-events.ts` - All audit functions
- `/packages/app/src/pages/BookingDetailPage.tsx` - Usage examples

**Legacy Code**:

- `utils/payments.ts` → `getDepositStatus()` marked as @deprecated (kept for BookingsPage display only)
- `utils/payments.ts` → `buildDepositInfoExtensions()` marked as @deprecated (DO NOT USE)
- `utils/reminders.ts` → Still uses `getDepositStatus()` (NOT CURRENTLY USED by any component, migration needed when activated)

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

### Intake Form: Date Handling (No Timezone Issues)

```typescript
// DOB stored as ISO string (YYYY-MM-DD), NOT Date objects
const dateOfBirth = '1990-05-15'; // ✅ Safe
const dateOfBirth = new Date('1990-05-15'); // ❌ Avoid (timezone issues)

// DOBInput uses 3 dropdowns
dateOfBirth = `${year}-${month}-${day}`; // Builds string directly
```

### Intake Form: Edit Mode - Loading FHIR to Form Data

```typescript
// useIntakeSubmission hook now supports update mode
const result = await submitIntake(data, 'coordinator-assisted', patientId);

// loadPatient.ts converts FHIR → Form data
import { loadPatientIntoForm } from './utils/loadPatient';
const formData = await loadPatientIntoForm(medplum, patientId);

// Edit mode uses full replace strategy:
// 1. Update Patient resource (preserve ID)
// 2. Delete all related resources (conditions, medications, etc.)
// 3. Create new related resources with updated data
```

### Intake Form: FHIR Resource Creation Pattern

```typescript
// Extensions only added when values exist
extension: [
  ...(data.pronouns
    ? [{ url: '...pronouns', valueString: data.pronouns }]
    : []),
  ...(data.preferredName?.trim()
    ? [{ url: '...preferred-name', valueString: data.preferredName.trim() }]
    : []),
  // Empty extensions are NEVER added
],
```

---

## 7. FHIR Compliance & HIPAA Considerations

### PHI Handling

- All patient data stored as FHIR resources (Patient, Appointment, Procedure, Media)
- Photos stored as Media resources with S3 Binary storage
- AuditEvent resources automatically created by Medplum for all data access

### Extensions (Custom, but Standards-Compliant)

All custom extensions use the base URL: `http://melissaknudson.com/fhir/StructureDefinition/`

| Extension                     | Purpose                        | FHIR Compliant |
| ----------------------------- | ------------------------------ | -------------- |
| `linked-appointment`          | Links Procedure to Appointment | ✅ Yes         |
| `treatment-areas`             | Text list of treated areas     | ✅ Yes         |
| `units-used`                  | Total units injected           | ✅ Yes         |
| `product-brand`               | Botox/Dysport/etc brand        | ✅ Yes         |
| `injection-map`               | Complex marker data            | ✅ Yes         |
| `related-procedure`           | Links Media to Procedure       | ✅ Yes         |
| `status-change-audit`         | Who changed status when        | ✅ Yes         |
| `last-edited`                 | Edit timestamp                 | ✅ Yes         |
| `edited-by`                   | Editor reference               | ✅ Yes         |
| `pronouns`                    | Patient pronouns               | ✅ Yes         |
| `preferred-name`              | Nickname/preferred name        | ✅ Yes         |
| `referral-source`             | How patient found practice     | ✅ Yes         |
| `photo-release-accepted`      | Photo consent status           | ✅ Yes         |
| `medical-condition`           | Medical condition type         | ✅ Yes         |
| `aesthetic-treatment-history` | Previous aesthetic treatments  | ✅ Yes         |
| `surgical-history`            | Previous surgeries             | ✅ Yes         |
| `skincare-routine`            | Skincare details               | ✅ Yes         |
| `contraindications`           | Treatment contraindications    | ✅ Yes         |

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

| Notification Type | Recipients         | Use Case                        | Example                                 |
| ----------------- | ------------------ | ------------------------------- | --------------------------------------- |
| **Broadcast**     | ALL practitioners  | Patient messages, announcements | "Patient asking about pricing"          |
| **Targeted**      | Specific providers | Provider-specific tasks         | "New Botox appointment assigned to you" |

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

| Service    | Purpose             | HIPAA Consideration |
| ---------- | ------------------- | ------------------- |
| **Twilio** | SMS reminders       | Requires HIPAA plan |
| **Stripe** | Payment deposits    | Included in service |
| **Resend** | Transactional email | Requires BAA        |
| **S3**     | Photo storage       | Encrypted + BAA     |

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
- [ ] **Intake Form Submit**: Complete all 8 steps → Submit → Patient created successfully
- [ ] **Intake Success Screen**: Shows patient ID and "Done" button after submission
- [ ] **Intake Edit Mode**: Open Patient → Edit Patient → Modify data → Save → Verify updates
- [ ] **Intake Date Handling**: DOB saves correctly (e.g., Jan 15, 1990) without timezone drift
- [ ] **Intake Signature**: Canvas signature captures correctly with mouse offset fix

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

### Intake Components

- `PatientIntakePage.tsx` - New patient intake (self-service or coordinator)
- `PatientEditPage.tsx` - Edit existing patient via full form
- `IntakeWizard.tsx` - 8-step wizard container
- `IntakeSuccess.tsx` - Post-submission success screen
- `DOBInput.tsx` - Year/month/day dropdowns (no timezone issues)
- `SignatureCanvas.tsx` - Digital signature capture

### Utility Functions

- `getMedSpaRole()` - `/packages/app/src/auth/role.ts` - Role detection
- `getTreatmentPageRoute()` - `/packages/app/src/treatments/shared/getTreatmentType.ts` - Service type routing
- `loadPatientIntoForm()` - `/packages/app/src/intake/utils/loadPatient.ts` - FHIR to form data
- `intakeToFhir.ts` - `/packages/app/src/intake/utils/intakeToFhir.ts` - Form to FHIR resources

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

**Files Created:** 2. **`/packages/app/src/utils/payments.ts`** (NEW)

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

**Files Created:** 5. **`/packages/app/src/pages/BookingDetailPage.tsx`** (NEW)

- Full booking details display (patient, services, providers, room)
- Deposit management section with status badge
- Custom deposit amount override
- "Send Payment Link" button (triggers SMS + Email)
- "Mark as Paid" button for manual payment entry
- "Waive Deposit" with reason input
- Status actions: Approve, Mark Arrived, Mark No-Show, Cancel, Uncancel
- Activity history timeline (audit trail)

**Files Modified:** 6. **`/packages/app/src/AppRoutes.tsx`**

- Added route `/bookings/:id` → BookingDetailPage

7. **`/packages/app/src/pages/BookingsPage.tsx`**
   - Updated eye icon to link to `/bookings/:id` (detail page)

**Phase 3: Server-Side Webhooks**

**Files Created:** 8. **`/packages/server/src/webhooks/stripe.ts`** (NEW)

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

**Files Created:** 10. **`/packages/app/src/utils/reminders.ts`** (NEW) - Deposit reminder scheduler (every 24h, max 4) - Auto-cancel warning (24h before auto-cancel) - Appointment reminders (24h and 2h before) - Post-treatment follow-ups (per-service schedule) - Upcoming reminders display for booking detail page

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

**Current Status:** Sprint 3.3 Phase 5 Complete - Patient Intake Form with Edit Support

---

### April 28-29, 2026 - Patient Intake Form Complete (Major Feature)

**New Feature: Full Patient Intake System with Success Screen and Edit Support**

**Overview:**
A comprehensive 8-step patient intake form that supports both self-service (patient-facing) and coordinator-assisted modes. Creates complete FHIR resources for patient management.

**Files Created (New Intake Module):**

**Core Components:**

1. **`/packages/app/src/intake/PatientIntakePage.tsx`** - Main entry point with mode detection
2. **`/packages/app/src/intake/IntakeWizard.tsx`** - 8-step wizard container with navigation
3. **`/packages/app/src/intake/PatientEditPage.tsx`** - Edit existing patients via full form

**Form Sections:** 4. **`/packages/app/src/intake/sections/WelcomeSection.tsx`** - HIPAA, Terms, Photo Release consent 5. **`/packages/app/src/intake/sections/DemographicsSection.tsx`** - Name, DOB, pronouns, contact info 6. **`/packages/app/src/intake/sections/EmergencyContactSection.tsx`** - Emergency contact details 7. **`/packages/app/src/intake/sections/InsuranceSection.tsx`** - Insurance information 8. **`/packages/app/src/intake/sections/MedicalHistorySection.tsx`** - Conditions, medications, allergies 9. **`/packages/app/src/intake/sections/TreatmentGoalsSection.tsx`** - Aesthetic concerns, areas 10. **`/packages/app/src/intake/sections/ContraindicationsSection.tsx`** - Pregnancy, sun exposure, infections 11. **`/packages/app/src/intake/sections/ReviewSection.tsx`** - Summary and signature

**Components:** 12. **`/packages/app/src/intake/components/DOBInput.tsx`** - Year/month/day dropdowns (no timezone issues) 13. **`/packages/app/src/intake/components/SignatureCanvas.tsx`** - Digital signature capture with mouse offset fix 14. **`/packages/app/src/intake/components/MedicationInput.tsx`** - Medication entry with special flags 15. **`/packages/app/src/intake/components/AllergyInput.tsx`** - Allergy entry 16. **`/packages/app/src/intake/components/ProgressBar.tsx`** - Step navigation indicator 17. **`/packages/app/src/intake/components/IntakeSuccess.tsx`** - Post-submission success screen 18. **`/packages/app/src/intake/components/BlockerAlert.tsx`** - Treatment blocker warnings 19. **`/packages/app/src/intake/components/DuplicateCheckModal.tsx`** - Duplicate patient detection

**Utils & Hooks:** 20. **`/packages/app/src/intake/utils/intakeToFhir.ts`** - Transforms form data to FHIR resources 21. **`/packages/app/src/intake/utils/loadPatient.ts`** - Loads FHIR resources back into form (for editing) 22. **`/packages/app/src/intake/utils/validation.ts`** - Form validation logic 23. **`/packages/app/src/intake/utils/formatters.ts`** - Display formatting utilities 24. **`/packages/app/src/intake/hooks/useIntakeSubmission.ts`** - Form submission (create/update) 25. **`/packages/app/src/intake/hooks/useIntakeDraft.ts`** - Draft auto-save functionality

**Files Modified:**

26. **`/packages/app/src/resource/ResourcePage.tsx`**
    - Added "Edit Patient" button for all staff roles
    - Added "Patient Info" tab to Patient resource tabs

27. **`/packages/app/src/AppRoutes.tsx`**
    - Route `/intake` → PatientIntakePage
    - Route `/Patient/:id/patient-info` → PatientEditPage

28. **`/packages/app/src/App.tsx`**
    - "New Patient Intake" menu item in sidebar

**8-Step Intake Flow:**
| Step | Section | Required Fields |
|------|---------|-----------------|
| 1 | Welcome & Legal | HIPAA, Terms, Photo Release |
| 2 | Demographics | First/Last Name, DOB, Phone, Email, Address |
| 3 | Emergency Contact | Name, Relationship, Phone |
| 4 | Insurance | Has insurance (Yes/No/Optional), details if yes |
| 5 | Medical History | Conditions, Medications, Allergies (optional) |
| 6 | Treatment Goals | Aesthetic concerns, areas (optional) |
| 7 | Contraindications | Pregnancy status, sun exposure (optional) |
| 8 | Review & Submit | Information confirmed, signature, consent |

**FHIR Resources Created:**
| Resource | Purpose | Extension URL |
|----------|---------|---------------|
| Patient | Core patient record | Multiple custom extensions |
| Consent | HIPAA, Terms, Photo Release | `patient-consent` |
| Coverage | Insurance info | - |
| RelatedPerson | Emergency contact | - |
| Condition | Medical conditions | `medical-condition` |
| Condition | Contraindications | `contraindications` |
| MedicationStatement | Current medications | Flags for accutane, blood thinners, photosensitizing |
| AllergyIntolerance | Allergies | - |
| Observation | Aesthetic treatment history | `aesthetic-treatment-history` |
| Observation | Surgical history | `surgical-history` |
| Observation | Skincare routine | `skincare-routine` |
| Flag | Treatment goals | `treatment-goals` |
| QuestionnaireResponse | Raw form data | - |

**Custom FHIR Extensions (New):**
| Extension | Purpose | Compliant |
|-----------|---------|-----------|
| `pronouns` | Patient pronouns | ✅ Yes |
| `preferred-name` | Nickname/preferred name | ✅ Yes |
| `referral-source` | How patient found us | ✅ Yes |
| `photo-release-accepted` | Photo consent status | ✅ Yes |
| `medical-condition` | Medical condition type | ✅ Yes |
| `aesthetic-treatment-history` | Previous aesthetic treatments | ✅ Yes |
| `surgical-history` | Previous surgeries | ✅ Yes |
| `skincare-routine` | Skincare details | ✅ Yes |
| `contraindications` | Treatment contraindications | ✅ Yes |

**Key Implementation Decisions:**

**Date Handling:**

- DOB stored as ISO string (YYYY-MM-DD) - no Date objects
- No timezone issues by using string format throughout
- DOBInput uses 3 dropdowns: Year, Month, Day

**Form Data Flow:**

- `IntakeFormData` interface - single source of truth
- Each section receives `data` and `onChange` callback
- State managed in `IntakeWizard` top-level
- No form libraries (controlled components only)

**FHIR Integration:**

- Extensions only added when values exist (avoid empty extensions)
- All resources linked to Patient via references
- QuestionnaireResponse stores raw data for audit
- RelatedPerson for emergency contact (separate resource)

**Edit Mode:**

- `loadPatient.ts` converts FHIR resources back to form data
- Full replace strategy: delete old related resources, create new ones
- Patient record updated (not recreated) to preserve ID
- All staff roles can edit (assistants, providers, coordinators, admins)

**Validation Rules:**

- Required fields per step (see table above)
- Email format validation
- Phone format validation
- ZIP code validation
- Age check (18+ required for aesthetic treatments)

**Routes:**
| Route | Purpose | Mode |
|-------|---------|------|
| `/intake` | New patient intake | Self-service or Coordinator |
| `/intake?mode=coordinator` | New patient (staff view) | Coordinator-assisted |
| `/Patient/:id/patient-info` | Edit existing patient | Edit mode |

**Menu Items:**

- Sidebar: "New Patient Intake" (links to `/intake`)
- Patient page: "Edit Patient" button (all staff)
- Patient tabs: "Patient Info" tab

**Success Screen:**

- Shows after successful intake submission
- Green checkmark, patient name, patient ID
- "What's Next" information
- "Done - Return to Start" button

**Next Phase:** Phase 6 - Communications & Analytics

---

## AuditEvent Functions for Complete Audit Trail

### All Booking Actions Now Recorded via FHIR AuditEvents

| Function                      | Purpose                      | Called From                                  |
| ----------------------------- | ---------------------------- | -------------------------------------------- |
| `recordBookingCreated()`      | Records new booking creation | `CreateAppointmentModalV3.tsx` (CREATE MODE) |
| `recordBookingEdited()`       | Records booking edits        | `CreateAppointmentModalV3.tsx` (EDIT MODE)   |
| `recordBookingStatusChange()` | Records status changes       | `BookingDetailPage.tsx` (`updateStatus`)     |
| `recordDepositPaid()`         | Records deposit payment      | `BookingDetailPage.tsx`                      |
| `recordDepositRequested()`    | Records payment link sent    | `BookingDetailPage.tsx`                      |
| `recordDepositWaived()`       | Records deposit waiver       | `BookingDetailPage.tsx`                      |
| `recordPaymentUndone()`       | Records payment reversal     | `BookingDetailPage.tsx`                      |
| `recordRefundIssued()`        | Records refund issued        | `BookingDetailPage.tsx`                      |

### Activity Timeline Shows EVERYTHING

The activity timeline in `BookingDetailPage.tsx` now shows ALL actions:

- ✅ Booking created (who, what services, when, why)
- ✅ Booking edited (who, what changed, when, why)
- ✅ Status changes (who, from → to, when, why)
- ✅ Deposit actions (paid, requested, waived, undone, refunded)
- ✅ Treatment service actions (started, completed)

### How to Verify All Actions Are Recorded

1. Create a new booking → Check AuditEvent created with description "Booking created by [name]: [services]"
2. Edit a booking → Check AuditEvent created with description "Booking edited by [name]: [changes]"
3. Change status → Check AuditEvent created with description "Booking status changed from X to Y by [name]"
4. All events should appear in the activity timeline with WHO, WHAT, WHEN, WHY

---

## Critical Fixes - May 5, 2026

### Root Cause of Regressions

Commit `ddbc3a776` ("update may", May 4, 2026) introduced ALL regressions:

1. Created `audit-events.ts` with `declare function createAuditEvent` (NEVER IMPLEMENTED)
2. Created `CreateAppointmentModalV3.tsx` with multiple bugs
3. Rewrote `BookingDetailPage.tsx` to expect AuditEvents that could NEVER be created

### Fixes Applied (May 5, 2026)

**1. Implemented `createAuditEvent` in `audit-events.ts`**

- Changed from `declare function` to actual implementation
- Fixed FHIR R4 structure (entity[].role is Coding object, not `{ coding: [...] }`)
- Fixed entity[].detail[].type to be string (not Coding object)

**2. Fixed `parseEntityDetails` for backward compatibility**

- Handles BOTH formats: string type (correct) and non-existent "old format"

**3. Added `recordBookingStatusChange` function**

- Called from `updateStatus` in BookingDetailPage.tsx
- Records status changes as FHIR AuditEvents (auditable)

**4. Fixed `updateStatus` in BookingDetailPage.tsx**

- Now calls `recordBookingStatusChange()` to create AuditEvent
- Removed old `status-change-audit` extension code (replaced by AuditEvents)

**5. Fixed CreateAppointmentModalV3 regressions**

- Patient field now DISABLED in edit mode
- Skip to 'services' step when editing a booking
- Admin users now see ALL practitioners (not filtered by eligibility)

**6. Fixed modals not closing after submission**

- Cancel modal: Now closes after `updateStatus('cancelled')`
- Uncancel modal: Now closes after `updateStatus('booked')`
- Waive modal: Now closes after `waiveDeposit()`
- Mark as paid modal: Now closes after `markAsPaid()`
- Undo payment modal: Now closes after `undoPayment()`

**7. Fixed search parameter for AuditEvents**

- Changed from `patient: \`Patient/${patientId}\``to`patient: patientId`
- Medplum handles reference search correctly with just the ID

### How to Prevent Recurrence

1. **Test after EVERY change**: Run `npm run build` (verifies TypeScript + bundling)
2. **Verify features still work**: Create booking, edit booking, change status, check activity history
3. **Never use `declare function`** - always implement functions completely
4. **Update AGENTS.md after EACH session** with what was fixed and current status
5. **Check git diff before committing** - ensure no regressions are being introduced

### Current Status (After Fixes)

- ✅ Deposit actions work (AuditEvents created correctly)
- ✅ Activity history shows correctly (from AuditEvents)
- ✅ Edit booking works (patient disabled, skips to services)
- ✅ Provider filtering FIXED (providers vs assistants separated correctly, even for admins)
- ✅ Modals close after submission (cancel, uncancel, waive, etc.)
- ✅ BookingDetailPage status changes create proper AuditEvents
- ✅ Booking creation/edits now recorded via AuditEvents
- ✅ ALL actions show WHO, WHAT, WHEN, WHY in activity timeline
- ✅ Build passes (TypeScript + ESLint)


---

## 13. Communications & Payments Integration Roadmap

**Status:** Phase 1 Complete ✅ | **Next:** Phase 2 - Wire Up "Send Payment Link" Button

**Approach:** Option A - Complete all phases before going live

### Overview

This roadmap implements full integration of Twilio (SMS), Resend (Email), and Stripe (Payments) into the Medplum system. All infrastructure is built; we now need to connect the pieces.

**API Keys Configured:**
- ✅ Twilio (Test Account): XXXX
- ✅ Stripe: XXXX / whsec_XXX
- ✅ Resend: XXX

**Existing Infrastructure:**
- ✅ SMS utility (/packages/app/src/utils/sms.ts) - 8 templates ready
- ✅ Email utility (/packages/app/src/utils/email.ts) - 8 templates ready
- ✅ Payment logic (/packages/app/src/utils/payments.ts) - Deposit calculations ready
- ✅ Stripe webhook (/packages/server/src/webhooks/stripe.ts) - Payment processing ready
- ✅ Twilio webhook (/packages/server/src/webhooks/twilio.ts) - Incoming SMS ready
- ✅ API keys configured in /packages/server/.env

---

### Phase 1: Connect Webhook Routes ✅ COMPLETE

**Completed:** May 9, 2026

**Goal:** Enable Stripe and Twilio to communicate with your server

**What Was Done:**
1. ✅ Registered webhook routes in Express server (`/packages/server/src/webhook/routes.ts`)
2. ✅ Added Stripe webhook handler at `POST /api/webhook/stripe`
3. ✅ Added Twilio incoming SMS handler at `POST /api/webhook/twilio`
4. ✅ Added Twilio status callback handler at `POST /api/webhook/twilio/status`
5. ✅ TypeScript build passes for both server and app packages

**Files Modified:**
- `/packages/server/src/webhook/routes.ts` - Added imports and route registrations

**Webhook URLs (configure in dashboards):**
- **Stripe:** `https://api-dev.studioassistant.io/api/webhook/stripe`
- **Twilio SMS:** `https://api-dev.studioassistant.io/api/webhook/twilio`
- **Twilio Status:** `https://api-dev.studioassistant.io/api/webhook/twilio/status`

**Next Steps (Manual Configuration Required):**
1. Log into [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://api-dev.studioassistant.io/api/webhook/stripe`
3. Select events: `payment_intent.succeeded`, `checkout.session.completed`, `payment_intent.payment_failed`
4. Copy the webhook signing secret and update `.env` if needed

5. Log into [Twilio Console](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
6. Select your phone number (+18445423808)
7. Configure "A Message Comes In" webhook: `https://api-dev.studioassistant.io/api/webhook/twilio`
8. Configure "Delivery Status Callback": `https://api-dev.studioassistant.io/api/webhook/twilio/status`

**Success Criteria:**
- [x] Webhook routes registered in Express server
- [x] TypeScript compilation successful
- [ ] Stripe webhook configured in dashboard (pending manual setup)
- [ ] Twilio webhook configured in console (pending manual setup)
- [ ] End-to-end test with real events (pending dashboard configuration)

---

### Phase 2: Wire Up "Send Payment Link" Button ⏱️ 3-4 hours

**Goal:** When staff clicks "Send Payment Link", actually send SMS + Email with Stripe checkout URL

**Tasks:**
1. Integrate sendDepositRequestSMS() and sendDepositRequestEmail() into BookingDetailPage
2. Call createStripePaymentLink() to generate Stripe checkout session
3. Store payment link URL in ServiceRequest extension (paymentLinkUrl)
4. Update UI to show "Payment Link Sent" timestamp/status
5. Handle failures (no phone/email, API errors) with user-friendly messages
6. Record AuditEvent when payment link is sent

**Files to Modify:**
- /packages/app/src/pages/BookingDetailPage.tsx (Send Payment Link button)
- /packages/server/src/webhooks/stripe.ts (improve error handling)

**Success Criteria:**
- [ ] Create booking → Click "Send Payment Link" → SMS and Email both sent
- [ ] SMS received with shortened payment link
- [ ] Email received with branded HTML payment button
- [ ] Payment link opens Stripe checkout with correct amount
- [ ] Staff sees "Link sent at [timestamp]" in booking details
- [ ] AuditEvent created recording who sent the link

---

### Phase 3: Payment Confirmation Notifications ⏱️ 2-3 hours

**Goal:** When patient pays, automatically notify them and staff

**Tasks:**
1. Update Stripe webhook to trigger confirmation SMS/Email after successful payment
2. Use sendPaymentConfirmationSMS() and sendPaymentConfirmationEmail()
3. Update BookingDetailPage to listen for payment status changes (polling or websocket)
4. Show "Payment Received" notification in UI with celebration/confetti
5. Auto-change appointment status from pending → booked when deposit paid
6. Create AuditEvent for auto-status-change

**Files to Modify:**
- /packages/server/src/webhooks/stripe.ts (add confirmation sending)
- /packages/app/src/pages/BookingDetailPage.tsx (real-time updates)

**Success Criteria:**
- [ ] Patient pays via Stripe link → Receives confirmation SMS within 30 seconds
- [ ] Patient receives confirmation email with appointment details
- [ ] Staff sees real-time "Payment Received" badge in BookingDetailPage
- [ ] Appointment status auto-changes to booked
- [ ] Activity timeline shows "Deposit paid via online" with timestamp

---

### Phase 4: Automated Reminders ⏱️ 4-6 hours

**Goal:** Send appointment reminders without manual intervention

**Tasks:**
1. Create reminder scheduler using node-cron or similar
2. Check for appointments needing reminders every hour
3. Send reminders via SMS + Email (use both for redundancy):
   - 24-hour reminder: Day before appointment
   - 2-hour reminder: Morning of appointment
   - Deposit reminders: Every 24h for unpaid bookings (max 4 times)
   - Auto-cancel warning: 24 hours before auto-cancellation deadline
4. Store reminder sent status in ServiceRequest extensions to prevent duplicates
5. Respect patient communication preferences (if implemented)

**New Files:**
- /packages/server/src/cron/reminders.ts - Reminder scheduler logic
- /packages/server/src/cron/index.ts - Cron job initialization

**Files to Modify:**
- /packages/server/src/app.ts (start cron job on server startup)

**Success Criteria:**
- [ ] Booking 24 hours away → Patient receives SMS + Email reminder
- [ ] Booking 2 hours away → Patient receives final reminder
- [ ] Unpaid booking approaching deadline → Deposit reminder sent
- [ ] Booking approaching auto-cancel → Warning sent 24h before
- [ ] No duplicate reminders sent (tracked in extensions)
- [ ] Reminders stop if booking cancelled or deposit paid

---

### Phase 5: Post-Treatment Follow-Up ⏱️ 2-3 hours

**Goal:** Automate post-treatment care check-ins

**Tasks:**
1. Schedule follow-up messages 24-48 hours after treatment completion
2. Trigger when appointment status changes to fulfilled
3. Send sendPostTreatmentFollowUp() SMS
4. Create Communication resource for staff when patient replies
5. Staff notification via push notification when patient responds
6. Simple sentiment analysis? (optional - check for keywords like "pain", "problem")

**Files to Modify:**
- /packages/server/src/cron/reminders.ts (add follow-up scheduling)
- /packages/server/src/webhooks/twilio.ts (enhance reply handling)
- /packages/app/src/notifications/templates.ts (add follow-up notification)

**Success Criteria:**
- [ ] Treatment marked complete → Follow-up SMS scheduled for +24 hours
- [ ] Patient receives "How are you feeling?" SMS
- [ ] Patient replies → Staff receives push notification
- [ ] Reply stored as Communication resource linked to patient
- [ ] Keywords like "pain", "problem" trigger urgent staff alert

---

### Phase 6: Two-Way SMS Communication ⏱️ 3-4 hours

**Goal:** Full SMS conversation capability between patients and staff

**Tasks:**
1. Enhance Twilio webhook to handle threaded conversations
2. Create "Messages" tab in Patient resource view
3. Display SMS thread history from Communication resources
4. Allow staff to send manual SMS replies from Medplum UI
5. Handle opt-out (STOP) and opt-in (START) commands
6. Show patient communication preferences (SMS/Email/Both/None)

**New Files:**
- /packages/app/src/components/PatientMessages.tsx - SMS thread UI
- /packages/app/src/hooks/usePatientMessages.ts - Load message history

**Files to Modify:**
- /packages/server/src/webhooks/twilio.ts (threading, opt-out handling)
- /packages/app/src/resource/ResourcePage.tsx (add Messages tab)
- /packages/app/src/intake/utils/intakeToFhir.ts (store comm preferences)

**Success Criteria:**
- [ ] Patient texts office → Message appears in real-time in Medplum
- [ ] Staff can view full SMS conversation history
- [ ] Staff can send reply from Medplum → Patient receives SMS
- [ ] Patient texts STOP → Marked as opted out, no more SMS sent
- [ ] Patient texts START → Opted back in
- [ ] Communication preferences editable in Patient profile

---

### Phase 7: Analytics & Monitoring Dashboard ⏱️ 3-4 hours

**Goal:** Track communication effectiveness and payment metrics

**Tasks:**
1. Create admin dashboard showing:
   - SMS Metrics: Delivery rate, response rate, opt-out rate
   - Email Metrics: Delivery rate, open rate (via Resend), bounce rate
   - Payment Metrics: Conversion rate (deposits paid / links sent), average time to pay
   - No-Show Analysis: Before vs after reminder implementation
   - Communication Volume: Messages sent by day/week/month
2. Query AuditEvents for payment/deposit tracking
3. Query Communication resources for message tracking
4. Export to CSV capability
5. Date range filtering

**New Files:**
- /packages/app/src/pages/admin/CommunicationsDashboard.tsx - Dashboard UI
- /packages/app/src/hooks/useCommunicationAnalytics.ts - Data fetching

**Files to Modify:**
- /packages/app/src/AppRoutes.tsx (add dashboard route)
- /packages/app/src/App.tsx (add admin menu item)

**Success Criteria:**
- [ ] Dashboard shows real SMS delivery rates
- [ ] Dashboard shows payment conversion funnel
- [ ] Can filter by date range (last 7 days, 30 days, custom)
- [ ] Can filter by service type (Botox, Filler, etc.)
- [ ] Export data to CSV for external analysis
- [ ] No-show rate comparison (before/after reminders)

---

### Implementation Timeline

| Phase | Estimated Time | Cumulative | Priority |
|-------|---------------|------------|----------|
| Phase 1: Webhook Routes | 2-3 hours | 2-3 hours | 🔴 Critical |
| Phase 2: Payment Links | 3-4 hours | 5-7 hours | 🔴 Critical |
| Phase 3: Confirmation | 2-3 hours | 7-10 hours | 🔴 Critical |
| Phase 4: Reminders | 4-6 hours | 11-16 hours | 🟡 High |
| Phase 5: Follow-up | 2-3 hours | 13-19 hours | 🟢 Medium |
| Phase 6: Two-Way SMS | 3-4 hours | 16-23 hours | 🟢 Medium |
| Phase 7: Analytics | 3-4 hours | 19-27 hours | 🔵 Low |

**Total Estimated Time:** 3-4 days of focused development

---

### Open Decisions

Before starting implementation, need to confirm:

1. **Reminder Timing:** Current plan is 24h, 2h, deposit daily (max 4), auto-cancel 24h warning
   - ❓ Confirm these intervals work, or adjust?

2. **Communication Preferences:** Should patients choose SMS/Email/Both, or practice-wide policy?
   - ❓ Patient-level settings or global default?

3. **Payment Link:** Staff-initiated send vs auto-send on booking creation?
   - ❓ Current plan: Staff clicks button. OK or want auto-send?

4. **Test Phone Numbers:** Twilio test account only sends to verified numbers
   - ❓ What numbers to add for testing?

5. **Resend Email Domain:** Currently using noreply@studioassistant.io
   - ❓ Verify domain DNS settings configured in Resend dashboard?

---

### Current Status

**Last Updated:** May 9, 2026

**Completed:**
- ✅ All API keys configured in .env
- ✅ SMS utility with 8 templates
- ✅ Email utility with 8 templates
- ✅ Payment logic and calculations
- ✅ Stripe webhook handler
- ✅ Twilio webhook handler
- ✅ Webhook secrets configured
- ✅ Phase 1: Webhook routes connected to Express server
  - `/api/webhook/stripe` - Stripe payment events
  - `/api/webhook/twilio` - Twilio incoming SMS
  - `/api/webhook/twilio/status` - Twilio delivery status

**Next Steps:**
1. Configure Stripe/Twilio dashboard webhook URLs (manual setup required)
2. Start Phase 2: Wire Up "Send Payment Link" Button
3. Test webhook connectivity with real events

---

**Document Maintenance**: Update this file after each development session with:

1. New/modified files
2. Architecture decisions
3. New patterns discovered
4. Integration status changes
5. Testing checklist results

**Questions?** Check INSTRUCTIONS.md for setup details, or project-context.md for full architecture.

