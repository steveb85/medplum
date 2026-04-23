# Nurse Mel Medplum - AI Agent Context Document

> **Purpose**: Living document providing context for AI agents working on this project. Updated after each session with current status, recent changes, and architectural decisions.

**Last Updated**: April 23, 2026
**Current Phase**: Phase 1 - Data Model Validation (Complete)
**Next Phase**: Phase 2 - Patient Portal & Integrations

**Build Plan**: See [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) for complete implementation plan

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
├── components/                    # Shared components
│   ├── CreateAppointmentModal.tsx # Booking creation & editing (EDIT MODE ADDED)
│   └── ...
├── nurse-mel/                     # Nurse Mel specific features
│   ├── BotoxTreatmentPage.tsx     # Botox workflow (EDIT BUTTON ADDED)
│   ├── PhotoUploadSection.tsx     # Before/after photo handling
│   ├── TreatmentsTab.tsx          # Patient treatments list
│   └── ...
├── treatments/                    # Treatment detail pages
│   ├── FillerTreatmentPage.tsx
│   ├── LaserTreatmentPage.tsx
│   ├── ConsultationTreatmentPage.tsx
│   └── shared/                    # Shared treatment components
│       ├── useTreatmentData.ts
│       ├── TreatmentHeader.tsx
│       ├── TreatmentStatusAlert.tsx
│       └── getTreatmentType.ts    # Service type routing logic
├── pages/                         # Top-level pages
│   ├── CalendarPage.tsx           # Scheduling with momentLocalizer
│   └── BookingsPage.tsx           # Practice-wide bookings list
└── auth/
    └── role.ts                    # getMedSpaRole() - Provider vs Coordinator
```

---

## 4. Current Implementation Status

### ✅ COMPLETED (As of April 23, 2026)

**Core Workflows:**
- ✅ Botox treatment workflow (before photos → treatment → after photos)
- ✅ Patient management with search
- ✅ Calendar scheduling with `momentLocalizer` (switched from dayjs for timezone handling)
- ✅ Appointment booking with patient, providers, date/time, service type
- ✅ Role-based access control (Provider vs Coordinator permissions)
- ✅ Treatment status: `preparation` → `in-progress` → `completed`
- ✅ **Edit booking functionality** - coordinators can edit scheduled treatments
- ✅ Service type change detection with navigation to correct treatment page
- ✅ Audit trail extensions (`last-edited`, `edited-by`)
- ✅ Provider assignment stored in `procedure.performer[]` (index 0 = main, index 1 = assistant)

**FHIR Compliance:**
- ✅ Custom extensions for aesthetic data (injection maps, treatment areas, units used)
- ✅ `linked-appointment` extension on Procedure references Appointment
- ✅ Proper `performer` array for provider assignments
- ✅ `subject` references to Patient
- ✅ Media resources for photos with related-procedure extension

**Photo Workflow:**
- ✅ Before/after photo upload via PhotoUploadSection
- ✅ Photos linked to Procedure via `http://melissaknudson.com/fhir/StructureDefinition/related-procedure`
- ✅ ReadOnly mode based on treatment status

### 🔄 IN PROGRESS

- 🔄 Testing edit modal provider prefilling (main provider works, assistant needs verification)

### ⏭️ UPCOMING (Phase 2)

- ⏭️ Patient portal (separate domain, public-facing)
- ⏭️ SMS reminders via Twilio
- ⏭️ Email notifications via Resend
- ⏭️ Stripe integration for deposits
- ⏭️ Bot intake questionnaires
- ⏭️ Automated follow-up workflows

---

## 5. Recent Changes (April 23, 2026)

### Edit Booking Feature Implementation

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
