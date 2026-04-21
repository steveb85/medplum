# Implementation Plan: Calendar + Treatments Integration

**Status:** Ready for Implementation  
**Last Updated:** April 21, 2026  
**Estimated Time:** 20-25 hours  
**Author:** OpenCode AI Assistant

---

## Overview

Integration of Medplum's scheduling system with custom aesthetic treatment workflow. The Calendar shows all appointments, the Treatments tab shows procedure documentation with a status-based workflow that allows coordinators to create bookings and upload photos while restricting clinical documentation to providers.

---

## Architecture

### Navigation Structure

```
Main Navigation:
┌─────────────────────────────────────────────────────────────┐
│  Home  │  Patients  │  Calendar  │  Billing  │  Admin       │
└─────────────────────────────────────────────────────────────┘
                  │
                  └─ Shows ALL appointments (all patients)
                     Click appointment → Open/Creates treatment

Patient Detail Page:
├─ Details Tab
├─ Timeline Tab (events/comments)
├─ Treatments Tab ← NEW: List of Procedures with status badges
│   └─ Click row → BotoxTreatmentPage
├─ Botox-Treatment Tab ← Modified: Single treatment view
└─ ...
```

### Data Model Linkage

```typescript
// When Coordinator creates booking:

Appointment (Calendar Event)
├── status: 'booked' | 'fulfilled' | 'cancelled'
├── start: "2025-05-15T14:00:00Z"  // Scheduled time
├── end: "2025-05-15T14:30:00Z"
├── serviceType: [{ text: "Botox Cosmetic" }]
└── participant: [
      { actor: Patient/123, status: 'accepted' },
      { actor: Practitioner/mel, status: 'accepted' }
    ]

    ↓ (Auto-created via CreateAppointmentModal)

Procedure (Treatment Documentation)
├── resourceType: "Procedure"
├── status: "preparation"  // ← Status 0
├── code: {
│     text: "Botox Cosmetic Treatment",
│     coding: [{ system: "http://melissaknudson.com/treatments", code: "botox-cosmetic" }]
│   }
├── subject: { reference: "Patient/123" }
├── performedPeriod: {
│     start: null,  // Set when provider starts
│     end: null     // Set when provider completes
│   }
├── extension: [
│     {
│       url: "http://melissaknudson.com/fhir/StructureDefinition/treatment-status",
│       valueString: "preparation"  // 0 | 1 | 2 mapping
│     },
│     {
│       url: "http://melissaknudson.com/fhir/StructureDefinition/linked-appointment",
│       valueReference: { reference: "Appointment/456" }
│     },
│     {
│       url: "http://melissaknudson.com/fhir/StructureDefinition/created-by",
│       valueReference: { reference: "Practitioner/coord" }
│     }
│   ]
└── ...
```

### Status Workflow

```
Status 0: 'preparation' (Scheduled)
├── Created by: Coordinator
├── Actions: Upload before photos, view
├── Next: Provider clicks "Start Treatment" → Status 1

Status 1: 'in-progress' (Active)
├── Created by: Provider transition
├── Actions: Mark injections, upload after photos, add notes
├── Next: Provider clicks "Complete Treatment" → Status 2

Status 2: 'completed' (Done)
├── Created by: Provider transition
├── Actions: View only (read-only for all)
└── Locked: No further modifications
```

---

## Role-Based Permissions Matrix

| Action | Coordinator (Status 0) | Provider (Status 0) | Coordinator (Status 1) | Provider (Status 1) | Coordinator (Status 2) | Provider (Status 2) |
|--------|------------------------|---------------------|------------------------|---------------------|----------------------|---------------------|
| **View treatment** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Upload before photos** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Upload after photos** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Mark injection points** | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Edit units/product** | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Add clinical notes** | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Transition status** | ❌ | ✅ (0→1) | ❌ | ✅ (1→2) | ❌ | ❌ |

**Key Rules:**
- Coordinators can ONLY upload photos (never edit clinical data)
- Providers control status transitions
- Completed treatments are locked for everyone
- Photos can be uploaded during preparation and in-progress phases

---

## Files to Create/Modify

### 1. NEW: `CalendarPage.tsx`

**Location:** `/packages/app/src/pages/CalendarPage.tsx`

**Responsibilities:**
- Main calendar view accessible from side navigation
- Displays appointments for all patients (filtered by date range)
- Shows booked appointments and available slots
- Uses `react-big-calendar` (ported from medplum-provider example)
- Supports Month, Week, and Day views

**Features:**
- Click appointment → open BotoxTreatmentPage with that procedure
- Click empty slot → open CreateAppointmentModal
- Color-coded events (Botox=blue, Filler=green, etc.)
- Role-based: Coordinators can create, Providers can view/start

**Props/State:**
```typescript
interface CalendarPageState {
  appointments: Appointment[];
  slots: Slot[];
  selectedDate: Date;
  view: 'month' | 'week' | 'day';
  isCreateModalOpen: boolean;
  selectedSlot: Slot | null;
}
```

**Dependencies:** `react-big-calendar`, `dayjs`, `@tabler/icons-react`

---

### 2. NEW: `TreatmentsTab.tsx`

**Location:** `/packages/app/src/nurse-mel/TreatmentsTab.tsx`

**Responsibilities:**
- Patient page tab showing list of all Procedures
- Displays treatments in table format with status badges
- Supports filtering and sorting (incomplete first)

**Table Columns:**
| Column | Description |
|--------|-------------|
| Date | performedDateTime or scheduled date |
| Status | Color-coded badge (prep/orange, in-progress/blue, completed/green) |
| Type | Botox Cosmetic, Filler, etc. |
| Areas | Forehead, Glabella, etc. |
| Units | Total units used |
| Photos | Before/after count badges |
| Actions | "Open" button for all, "Continue" for providers |

**Features:**
- "New Treatment" button → creates Appointment + Procedure
- Sort by: Incomplete treatments first
- Filter by: Status, Type, Date range

**Props:**
```typescript
interface TreatmentsTabProps {
  patientId: string;
}
```

---

### 3. MAJOR MODIFY: `BotoxTreatmentPage.tsx`

**Location:** `/packages/app/src/nurse-mel/BotoxTreatmentPage.tsx`

**Changes:**

#### A. URL Parameter Support
```typescript
// Support viewing existing treatment
// URL: /Patient/:id/botox-treatment?procedureId=:procedureId

const [searchParams] = useSearchParams();
const procedureId = searchParams.get('procedureId');
const mode = procedureId ? 'view' : 'create';
const isReadOnly = role === 'coordinator' || (procedure?.status === 'completed');
```

#### B. Remove Treatment History Accordion
- Delete lines 506-593 (accordion showing past treatments)
- Treatments list now lives in TreatmentsTab

#### C. Add Status Transition UI
```typescript
// Status transition buttons
{procedure?.status === 'preparation' && role === 'provider' && (
  <Button
    leftSection={<IconPlay size={16} />}
    onClick={() => transitionStatus('in-progress')}
    color="blue"
  >
    Start Treatment
  </Button>
)}

{procedure?.status === 'in-progress' && role === 'provider' && (
  <Button
    leftSection={<IconCheck size={16} />}
    onClick={() => transitionStatus('completed')}
    color="green"
  >
    Complete Treatment
  </Button>
)}
```

#### D. Role-Based Component Visibility
```typescript
// Photo upload for coordinators (status 0 & 1 only)
{(procedure?.status === 'preparation' || procedure?.status === 'in-progress') && (
  <PhotoUploadSection
    title="Before Photos"
    readOnly={role === 'coordinator' && procedure?.status !== 'preparation'}
    // ...
  />
)}

// Treatment map for providers only
{role === 'provider' && procedure?.status !== 'completed' && (
  <TreatmentMap
    readOnly={false}
    // ...
  />
)}
```

#### E. Add Procedure Loading Logic
```typescript
// Load existing procedure if procedureId provided
useEffect(() => {
  if (procedureId) {
    loadProcedure(procedureId);
  }
}, [procedureId]);
```

---

### 4. NEW: `CreateAppointmentModal.tsx`

**Location:** `/packages/app/src/components/CreateAppointmentModal.tsx`

**Responsibilities:**
- Modal for creating new appointments from Calendar
- Creates both Appointment AND linked Procedure

**Form Fields:**
- Patient selection (ResourceInput)
- Date picker (CalendarInput)
- Time slot selection
- Service type (Select: Botox, Filler, Laser, etc.)
- Provider selection
- Notes (optional)

**On Save:**
```typescript
// 1. Create Appointment
const appointment = await medplum.createResource<Appointment>({
  resourceType: 'Appointment',
  status: 'booked',
  serviceType: [{ text: serviceType }],
  start: selectedDateTime.toISOString(),
  end: endDateTime.toISOString(),
  participant: [
    { actor: createReference(patient), status: 'accepted' },
    { actor: createReference(provider), status: 'accepted' },
  ],
});

// 2. Create linked Procedure
const procedure = await medplum.createResource<Procedure>({
  resourceType: 'Procedure',
  status: 'preparation',
  code: {
    text: serviceType,
    coding: [{ system: 'http://melissaknudson.com/treatments', code: getCode(serviceType) }],
  },
  subject: createReference(patient),
  extension: [
    {
      url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
      valueReference: createReference(appointment),
    },
    {
      url: 'http://melissaknudson.com/fhir/StructureDefinition/treatment-status',
      valueString: 'preparation',
    },
  ],
});
```

---

### 5. NEW: `TreatmentListItem.tsx`

**Location:** `/packages/app/src/nurse-mel/TreatmentListItem.tsx`

**Responsibilities:**
- Single row component for Treatments table
- Displays treatment summary with status badge

**Status Badges:**
```typescript
const statusConfig = {
  preparation: { color: 'orange', label: 'Scheduled' },
  'in-progress': { color: 'blue', label: 'In Progress' },
  completed: { color: 'green', label: 'Completed' },
};
```

**Actions:**
- "Open" button (all roles) → navigates to BotoxTreatmentPage
- "Continue" button (providers, status 0/1) → same as Open
- Photo count badges (before: gray, after: green)

---

### 6. MODIFY: `ResourcePage.tsx`

**Location:** `/packages/app/src/resource/ResourcePage.tsx`

**Changes:**

Line 100-102 - Add Treatments tab:
```typescript
// Patient-specific tabs
if (resourceType === 'Patient') {
  // Add Treatments tab before Botox-Treatment
  result.push('Treatments');

  // Botox Treatment visible to all roles
  result.push('Botox-Treatment');

  // ... rest of tabs
}
```

---

### 7. MODIFY: `AppRoutes.tsx`

**Location:** `/packages/app/src/AppRoutes.tsx`

**Changes:**

Add imports:
```typescript
import { CalendarPage } from './pages/CalendarPage';
import { TreatmentsTab } from './nurse-mel/TreatmentsTab';
```

Add routes (around line 184):
```typescript
// Main calendar page
<Route path="calendar" element={<CalendarPage />} />

// Patient tabs
<Route path="treatments" element={<TreatmentsTab patientId={id} />} />
<Route path="botox-treatment" element={<BotoxTreatmentPage />} />
```

---

### 8. MODIFY: `TreatmentMap.tsx`

**Location:** `/packages/app/src/treatment-map/components/TreatmentMap.tsx`

**Changes:**

Add `readOnly` prop:
```typescript
interface TreatmentMapProps {
  // ... existing props
  readOnly?: boolean;
}
```

When `readOnly=true`:
- Disable click-to-add markers
- Disable save button
- Show markers in view-only mode
- Disable zone entry popup

---

### 9. MODIFY: `PhotoUploadSection.tsx`

**Location:** `/packages/app/src/nurse-mel/PhotoUploadSection.tsx`

**Changes:**

Add `readOnly` prop:
```typescript
interface PhotoUploadSectionProps {
  // ... existing props
  readOnly?: boolean;
}
```

When `readOnly=true`:
- Hide upload button
- Show photos in read-only grid
- Disable delete functionality

---

### 10. MODIFY: Side Navigation

**Location:** `/packages/app/src/components/SideNav.tsx` (or similar)

**Changes:**

Add "Calendar" link to main navigation:
```typescript
const mainNavLinks = [
  { href: '/', label: 'Home', icon: IconHome },
  { href: '/Patient', label: 'Patients', icon: IconUsers },
  { href: '/calendar', label: 'Calendar', icon: IconCalendar }, // NEW
  { href: '/billing', label: 'Billing', icon: IconReceipt },
  // ...
];
```

---

## Dependencies

Add to `/packages/app/package.json`:

```json
{
  "dependencies": {
    "react-big-calendar": "^1.19.4",
    "@types/react-big-calendar": "^1.16.3",
    "dayjs": "^1.11.13"
  }
}
```

Install:
```bash
cd /packages/app
npm install react-big-calendar @types/react-big-calendar dayjs
```

---

## Workflow Scenarios

### Scenario 1: Coordinator Books Appointment

1. Coordinator clicks "Calendar" in side nav
2. Calendar page loads with week view
3. Coordinator clicks empty time slot (e.g., May 15, 2:00 PM)
4. CreateAppointmentModal opens
5. Coordinator selects:
   - Patient: Sarah Chen
   - Service: Botox Cosmetic
   - Provider: Melissa Knudson
   - Duration: 30 minutes
6. Clicks "Book Appointment"
   - Creates Appointment (status: 'booked')
   - Creates Procedure (status: 'preparation')
7. Modal closes, calendar refreshes
8. Coordinator navigates to Patient → Treatments tab
9. Sees new treatment with "Scheduled" (orange) badge
10. Clicks "Open" → BotoxTreatmentPage
11. Uploads before photos
12. Cannot mark injections or add notes (UI disabled)
13. Treatment ready for provider

### Scenario 2: Provider Starts Treatment

1. Provider opens Calendar page
2. Sees appointment at 2:00 PM for Sarah Chen
3. Clicks appointment
4. BotoxTreatmentPage opens with procedure loaded
5. Sees:
   - Status: "preparation" (orange badge)
   - Before photos uploaded
   - "Start Treatment" button visible
6. Reviews before photos with patient
7. Clicks "Start Treatment"
   - Updates Procedure.status → 'in-progress'
   - Sets performedPeriod.start
8. Page refreshes, now shows "In Progress" (blue badge)
9. Marks injection points on SVG template
10. Enters units per zone
11. Administers treatment
12. Uploads after photos
13. Adds clinical notes (angle, technique, etc.)
14. Clicks "Complete Treatment"
    - Updates Procedure.status → 'completed'
    - Sets performedPeriod.end
15. Treatment locked, view-only

### Scenario 3: Provider Views Completed Treatment

1. Provider opens Patient → Treatments tab
2. Sees completed treatment (green badge)
3. Clicks "Open"
4. BotoxTreatmentPage opens in read-only mode
5. Can view:
   - Injection map with all markers
   - Before/after photos
   - Units and notes
6. Cannot edit anything (all inputs disabled)
7. Can add addendum note (optional future feature)

### Scenario 4: Coordinator Uploads After Photos

1. Coordinator opens Treatments tab
2. Sees treatment with "In Progress" status
3. Clicks "Open"
4. BotoxTreatmentPage opens
5. Can see injection map (read-only)
6. Can upload after photos (allowed for status 1)
7. Cannot edit clinical data
8. Uploads photos
9. Treatment remains "In Progress" until provider completes

---

## Component Hierarchy

```
App
├── SideNav (add Calendar link)
│   └── Links: Home, Patients, Calendar, Billing...
│
├── Routes
│   ├── /calendar → CalendarPage
│   │   ├── ReactBigCalendar
│   │   │   ├── Appointment events (blue)
│   │   │   └── Slot backgrounds (green/gray)
│   │   ├── CalendarToolbar (Month/Week/Day)
│   │   └── CreateAppointmentModal
│   │       ├── Patient Select
│   │       ├── Date/Time Pickers
│   │       └── Service Type Select
│   │
│   └── /Patient/:id/*
│       ├── ResourcePage
│       │   ├── PatientHeader
│       │   ├── LinkTabs
│       │   │   ├── Details
│       │   │   ├── Timeline
│       │   │   ├── Treatments → TreatmentsTab
│       │   │   │   └── TreatmentListItem[]
│       │   │   │       ├── Status badge
│       │   │   │       ├── Photo count badges
│       │   │   │       └── Action buttons
│       │   │   │
│       │   │   └── Botox-Treatment → BotoxTreatmentPage
│       │       ├── TreatmentMap (SVG template)
│       │       │   ├── FaceTemplate (front/profile)
│       │       │   └── Injection markers
│       │       ├── PhotoUploadSection (before)
│       │       ├── PhotoUploadSection (after)
│       │       ├── ZoneList (sidebar)
│       │       ├── ZoneEntryPopup (edit marker)
│       │       └── StatusActions (Start/Complete buttons)
│       │
└── Modals
    └── CreateAppointmentModal
```

---

## Design Decisions

### 1. Why Procedure.status Instead of Custom Extension?

Using FHIR's native `Procedure.status` with values:
- `preparation` = scheduled (matches FHIR definition: "The process is being prepared")
- `in-progress` = during treatment (FHIR: "The process has started")
- `completed` = done (FHIR: "The process is complete")

Benefits:
- Standard FHIR compliance
- No custom coding needed
- Tools/reports understand these statuses
- Audit trail built-in

### 2. Why Auto-Create Procedure with Appointment?

Ensures:
- Treatment documentation exists before photos
- Clear linkage from calendar → treatment
- No orphaned appointments without procedures
- Status tracking from day 0

### 3. Why Keep Photos in BotoxTreatmentPage?

- Photos are part of treatment documentation
- Clinical context (which treatment do these photos belong to)
- Before/after comparison in one view
- Easier to find treatment → photos than timeline → photos

### 4. Why Calendar Page in Main Nav?

- Global view of all appointments
- Quick scheduling
- Provider can see day-at-a-glance
- Coordinator can manage bookings

---

## Open Questions (Answer Before Implementation)

### 1. Slot Management Strategy
**Options:**
- **A. Free-form**: Click any time, create appointment (simpler)
- **B. Pre-defined slots**: Use `$find` operation to discover available slots

**Recommendation:** Start with free-form, add `$find` later for complex scheduling.

### 2. Visual Coding
**Question:** Color-code appointments by service type?
- Botox = Blue
- Filler = Green
- Laser = Purple
- Consultation = Gray

**Recommendation:** Yes, adds visual clarity.

### 3. Notifications
**Question:** Real-time notifications?
- Coordinator uploads photo → Provider notified?
- Provider completes treatment → Coordinator notified?

**Recommendation:** Start without, add later using FHIR Subscriptions.

### 4. Default Calendar View
**Options:**
- Week view (shows schedule clearly)
- Day view (busy days)
- Month view (overview)

**Recommendation:** Week view as default (most clinical use).

### 5. Cancel/Delete Appointments
**Question:** Who can cancel?
- Coordinator: Cancel any appointment they created?
- Provider: Cancel any appointment?
- What happens to linked Procedure?

**Recommendation:**
- Coordinator: Can cancel status 0 (preparation) only
- Provider: Can cancel status 0 or 1
- Cancelled → Procedure.status = 'cancelled'

### 6. Encounter Linking
**Question:** Create FHIR Encounter resource?
- Links Appointment → Encounter → Procedure
- Or direct Appointment → Procedure via extension?

**Recommendation:** Direct link via extension (simpler). Add Encounter later if needed for billing.

### 7. Multi-Provider Support
**Question:** Can multiple providers be assigned to one appointment?
- Botox + Filler (Nurse Mel + Assistant)?
- Or single provider only?

**Recommendation:** Single provider for MVP. Multi-provider later.

---

## Implementation Order

### Phase 1: Foundation (4-5 hours)
1. Install dependencies (react-big-calendar, dayjs)
2. Create CalendarPage.tsx (basic structure)
3. Add Calendar link to SideNav
4. Create TreatmentsTab.tsx (basic table)
5. Add Treatments tab to ResourcePage
6. Add routes to AppRoutes

### Phase 2: Core Features (6-8 hours)
1. Create CreateAppointmentModal
2. Implement appointment + procedure creation
3. Modify BotoxTreatmentPage to load existing procedures
4. Implement status transition UI (Start/Complete buttons)
5. Create TreatmentListItem component
6. Link calendar events to treatments

### Phase 3: Role-Based Permissions (3-4 hours)
1. Add readOnly mode to TreatmentMap
2. Add readOnly mode to PhotoUploadSection
3. Implement role-based UI in BotoxTreatmentPage
4. Enforce photo upload permissions by status
5. Hide/show status transition buttons by role

### Phase 4: Polish & Testing (4-5 hours)
1. Style calendar (colors, toolbar)
2. Add status badges to treatments list
3. Test all role/status combinations
4. Handle edge cases (no appointments, loading states)
5. Add error handling
6. Verify FHIR extensions save correctly

---

## Testing Checklist

### Unit Tests
- [ ] CreateAppointmentModal creates both Appointment and Procedure
- [ ] TreatmentListItem shows correct status badge
- [ ] Status transitions update Procedure correctly
- [ ] Role check utility functions work correctly

### Integration Tests
- [ ] Calendar shows appointments
- [ ] Click appointment opens treatment
- [ ] Create appointment flows to Treatments tab
- [ ] Photo upload respects status/role

### E2E Scenarios
- [ ] Coordinator: Create → Upload before → View (cannot complete)
- [ ] Provider: Start → Inject → Complete → Locked
- [ ] Provider: View completed (read-only)
- [ ] Coordinator: View completed (read-only)

### Edge Cases
- [ ] Cancel appointment (status changes)
- [ ] Delete photos (who can delete?)
- [ ] Multiple treatments per day
- [ ] Change appointment time
- [ ] No provider assigned

---

## Success Criteria

- [ ] Coordinator can create appointment from Calendar
- [ ] Creating appointment auto-creates Procedure (status 0)
- [ ] Treatments tab shows all procedures for patient
- [ ] Status badges correctly reflect treatment state
- [ ] Coordinator can upload before photos (status 0)
- [ ] Provider can start treatment (status 0→1)
- [ ] Coordinator can upload after photos (status 1)
- [ ] Provider can complete treatment (status 1→2)
- [ ] Completed treatments are read-only for all
- [ ] Calendar shows all appointments with color coding
- [ ] Clicking appointment opens correct treatment
- [ ] Role-based permissions enforced in UI

---

## Future Enhancements

1. **Recurring Appointments**: Weekly Botox touch-ups
2. **Waitlist**: Fill cancellations
3. **Notifications**: Push notifications on status change
4. **Analytics**: Treatment volume by month
5. **Multi-provider**: Assign multiple providers
6. **Insurance**: Link Coverage to Appointment
7. **Reminders**: SMS/email reminders
8. **Online Booking**: Patient self-scheduling

---

## Notes for Implementation

- **Keep server-side AccessPolicy permissive**: Coordinators need `create` on Procedure
- **Enforce restrictions via UI**: Use Procedure.status + role checks
- **FHIR compliance**: Use standard resources, custom extensions only for links
- **Error handling**: Always show user-friendly messages
- **Loading states**: Show spinners while fetching data
- **Optimistic updates**: Update UI immediately, rollback on error

---

## Phase 5: Testing (NEW FINAL PHASE)

### Overview

Comprehensive testing for all new and modified components. This phase ensures the calendar, treatments workflow, and role-based permissions work correctly before production deployment.

**DO NOT PROCEED TO PHASE 2 UNTIL MANUAL TESTING IS COMPLETE**

---

### Test Categories

#### 1. Unit Tests

**A. CalendarPage.test.tsx**
```
Tests:
- Renders without crashing
- Shows calendar with default week view
- Month/Week/Day view selector works
- Navigation buttons (prev/next/today) update date
- "New Appointment" button is visible
- Appointments load and display as events
- Clicking appointment navigates to patient treatments
- Loading state shown while fetching
- Error handling for failed API calls
```

**B. TreatmentsTab.test.tsx**
```
Tests:
- Renders table with all columns
- Loading state shown initially
- Empty state shown when no treatments
- Treatments sorted by status (incomplete first)
- Status badges show correct colors:
  - preparation → orange
  - in-progress → blue
  - completed → green
  - cancelled → red
- Photo count badges display correctly
- "New Treatment" button navigates to botox-treatment
- "Open" action navigates with procedureId param
- Data refreshes after treatment creation
- Error handling for failed FHIR searches
```

**C. CreateAppointmentModal.test.tsx**
```
Tests:
- Renders form with all fields
- Patient selection works
- Date/time validation
- Service type selection
- Form validation (required fields)
- Submit creates Appointment + Procedure
- Procedure created with status='preparation'
- Links Appointment to Procedure via extension
- Success notification shown
- Modal closes on success
- Error handling for API failures
```

**D. BotoxTreatmentPage.test.tsx** (Refactored)
```
Tests:
- Creates new treatment (no procedureId)
- Loads existing treatment (with procedureId)
- Role-based UI visibility:
  - Coordinator sees photo upload, no injection editing
  - Provider sees all editing controls
- Status transition buttons:
  - "Start Treatment" visible for provider (status 0)
  - "Complete Treatment" visible for provider (status 1)
  - No buttons for completed (status 2)
- Photo upload respects status:
  - Before photos: status 0 or 1
  - After photos: status 1 only
- Saves Procedure with correct extensions
- Saves Media resources linked to Procedure
- Error handling for save failures
```

**E. TreatmentMap.test.tsx**
```
Tests:
- Renders SVG template
- Click adds marker (when not readOnly)
- Markers display with correct colors by product
- Selected marker opens ZoneEntryPopup
- readOnly=true disables click-to-add
- readOnly=true disables marker editing
- View mode shows existing markers
- Status badge shows total units
- Zone list displays all markers
- Product color legend displays
```

**F. PhotoUploadSection.test.tsx**
```
Tests:
- Renders upload button (when not readOnly)
- readOnly=true hides upload button
- Shows photo grid when photos exist
- Remove button works (when not readOnly)
- readOnly=true disables remove
- Fallback image shows when photo fails
- Photo count displays correctly
- Upload success shows notification
```

**G. Role/Permission Tests**
```
Tests (in auth/role.test.ts):
- getMedSpaRole returns correct role
- canAccess allows/denies features by role
- Provider can access clinical features
- Coordinator cannot access clinical editing
- filterMenuLinks hides restricted links
- filterPatientTabs hides restricted tabs
- canCreateClinicalDocs returns correct values
- Role detection from AccessPolicy
- Role detection from UserConfiguration
```

#### 2. Integration Tests

**A. Calendar → Treatments Flow**
```
Tests:
- Create appointment from Calendar
- Appointment appears on Calendar
- Navigate to patient Treatments tab
- New treatment appears in table
- Click treatment opens BotoxTreatmentPage
- Treatment data loads correctly
```

**B. Status Workflow Flow**
```
Tests:
- Coordinator creates appointment (status 0)
- Coordinator uploads before photos
- Provider starts treatment (status 0→1)
- Provider marks injections
- Coordinator uploads after photos (status 1)
- Provider completes treatment (status 1→2)
- Treatment locked, view-only
```

**C. Role-Based Permission Flow**
```
Tests (as Coordinator):
- Can see Calendar
- Can create appointment
- Can see Treatments tab
- Can upload before photos (status 0)
- Can upload after photos (status 1)
- Cannot edit injection points
- Cannot transition status

Tests (as Provider):
- Can see Calendar
- Can see all treatments
- Can edit injection points
- Can transition status
- Can complete treatment
```

#### 3. E2E Tests

**A. Happy Path: Complete Treatment**
```
1. Coordinator logs in
2. Navigates to Calendar
3. Clicks time slot
4. Creates appointment for Patient A
5. Navigates to Patient A → Treatments
6. Opens new treatment
7. Uploads before photos
8. Logs out
9. Provider logs in
10. Navigates to Calendar
11. Clicks appointment
12. Clicks "Start Treatment"
13. Marks injection points
14. Enters units
15. Uploads after photos
16. Clicks "Complete Treatment"
17. Verifies treatment locked
```

**B. Cancellation Flow**
```
1. Coordinator creates appointment
2. Provider cancels with comment
3. Treatment shows "Cancelled" status
4. Comment appears in patient timeline
5. Cannot edit cancelled treatment
```

**C. Multi-Provider Assignment**
```
1. Create appointment with Main + Assistant
2. Both providers can edit treatment
3. Completion requires Main provider
```

#### 4. Component Tests

**A. TreatmentListItem.test.tsx**
```
- Renders all data correctly
- Status badge shows correct color
- Photo badges count correctly
- Action buttons visible based on role
- Click "Open" navigates correctly
```

**B. ZoneEntryPopup.test.tsx**
```
- Renders with marker data
- Product selection works
- Units validation (positive number)
- Notes textarea works
- Save updates marker
- Delete removes marker
- Close button works
```

**C. CalendarToolbar.test.tsx**
```
- Renders label correctly
- View selector changes view
- Navigation buttons work
- Create appointment button visible
```

#### 5. Accessibility Tests
```
Tests:
- Keyboard navigation works
- ARIA labels on buttons
- Screen reader compatible
- Color contrast sufficient
- Focus indicators visible
```

#### 6. Performance Tests
```
Tests:
- Calendar loads < 2 seconds
- Treatments tab loads < 1 second
- Large patient lists don't freeze UI
- Image loading optimized
```

---

### Test File Locations

| Component | Test File |
|-----------|-----------|
| CalendarPage | `/packages/app/src/pages/CalendarPage.test.tsx` |
| TreatmentsTab | `/packages/app/src/nurse-mel/TreatmentsTab.test.tsx` |
| CreateAppointmentModal | `/packages/app/src/components/CreateAppointmentModal.test.tsx` |
| BotoxTreatmentPage | `/packages/app/src/nurse-mel/BotoxTreatmentPage.test.tsx` |
| TreatmentMap | `/packages/app/src/treatment-map/components/TreatmentMap.test.tsx` |
| PhotoUploadSection | `/packages/app/src/nurse-mel/PhotoUploadSection.test.tsx` |
| TreatmentListItem | `/packages/app/src/nurse-mel/TreatmentListItem.test.tsx` |
| ZoneEntryPopup | `/packages/app/src/treatment-map/components/ZoneEntryPopup.test.tsx` |
| Role utilities | `/packages/app/src/auth/role.test.ts` |

---

### Testing Utilities

Existing test utilities in `/packages/app/src/test-utils/render.tsx`:
- `render()` - Wraps with MantineProvider
- `renderAppRoutes()` - Full router + MedplumProvider setup
- MockClient for FHIR API mocking

---

### Manual Testing Checklist

**MUST COMPLETE BEFORE PHASE 2**

#### Calendar Page
- [x] "Calendar" link appears in side navigation
- [x] Calendar page loads without errors
- [x] Week view shows by default
- [X] Month/Week/Day buttons switch views correctly
- [X] Today/Prev/Next buttons navigate correctly
- [X] "New Appointment" button is visible
- [X] Existing appointments display on calendar
- [X] Clicking appointment navigates to patient treatments
- [X] Loading state shown while fetching

#### Treatments Tab
- [X] "Treatments" tab visible on Patient page
- [X] Tab loads without errors
- [ ] Table displays with columns: Status, Date, Areas, Units, Photos, Actions
- [ ] Status badges show correct colors (orange/blue/green/red)
- [ ] Photo count badges display (before/after)
- [ ] "New Treatment" button visible and clickable
- [ ] "Open" action button navigates to BotoxTreatmentPage
- [ ] Empty state shown when no treatments
- [ ] Treatments sorted by status (incomplete first)

#### Role-Based Permissions (as Coordinator)
- [ ] Can see Calendar link
- [ ] Can create appointment from Calendar
- [ ] Can see Treatments tab
- [ ] Can upload before photos (treatment status 0)
- [ ] Can upload after photos (treatment status 1)
- [ ] **CANNOT** edit injection points
- [ ] **CANNOT** transition status

#### Role-Based Permissions (as Provider)
- [ ] Can see Calendar
- [ ] Can see all treatments
- [ ] Can edit injection points
- [ ] Can transition status (Start/Complete)
- [ ] Can complete treatment

#### Tab Navigation
- [ ] Patient page → Treatments tab loads
- [ ] Click "New Treatment" → BotoxTreatmentPage
- [ ] Click "Open" on treatment → BotoxTreatmentPage with procedureId
- [ ] Back navigation works

#### Error Handling
- [ ] Graceful error when API fails
- [ ] User-friendly error messages
- [ ] Loading states work

---

### Coverage Targets

- Unit tests: 80%+ coverage
- Integration tests: Critical paths covered
- E2E tests: Happy paths covered

---

### Estimated Time

- Unit tests: 6-8 hours
- Integration tests: 3-4 hours
- Manual testing: 2-3 hours
- **Total: 11-15 hours**

---

## Success Criteria

- [ ] Coordinator can create appointment from Calendar
- [ ] Creating appointment auto-creates Procedure (status 0)
- [ ] Treatments tab shows all procedures for patient
- [ ] Status badges correctly reflect treatment state
- [ ] Coordinator can upload before photos (status 0)
- [ ] Provider can start treatment (status 0→1)
- [ ] Coordinator can upload after photos (status 1)
- [ ] Provider can complete treatment (status 1→2)
- [ ] Completed treatments are read-only for all
- [ ] Calendar shows all appointments with color coding
- [ ] Clicking appointment opens correct treatment
- [ ] Role-based permissions enforced in UI

---

## Future Enhancements

1. **Recurring Appointments**: Weekly Botox touch-ups
2. **Waitlist**: Fill cancellations
3. **Notifications**: Push notifications on status change
4. **Analytics**: Treatment volume by month
5. **Multi-provider**: Assign multiple providers
6. **Insurance**: Link Coverage to Appointment
7. **Reminders**: SMS/email reminders
8. **Online Booking**: Patient self-scheduling

---

## Notes for Implementation

- **Keep server-side AccessPolicy permissive**: Coordinators need `create` on Procedure
- **Enforce restrictions via UI**: Use Procedure.status + role checks
- **FHIR compliance**: Use standard resources, custom extensions only for links
- **Error handling**: Always show user-friendly messages
- **Loading states**: Show spinners while fetching data
- **Optimistic updates**: Update UI immediately, rollback on error
- **Notification markers**: Comments added in code for future notification points:
  - CalendarPage.tsx: 3 notification opportunities marked
  - Future: Photo upload notifications
  - Future: Treatment completion notifications

---

**Document Version:** 1.1
**Status:** Phase 1 Complete - Ready for Manual Testing
**Next Step:** Complete Manual Testing Checklist Above, Then Proceed to Phase 2
