# Stream B: Treatment Tracking & History

**Est. Total:** ~12-16 hours across 4 phases
**Priority:** 🟢 Medium
**Tests:** +30-50 new/updated tests across all phases

---

## Current State

- ✅ ServiceCard component fully built and integrated in BookingDetailPage
- ✅ Start/Complete treatment buttons work (update ServiceRequest status)
- ✅ Consent signing flow works
- ✅ Treatment pages exist per service type (Botox, Filler, Laser, Consultation)
- ✅ Treatment detail pages have injection maps, areas, units, product info
- ⬜ `onUpdateTreatmentData` in ServiceCard just logs to console — does not persist
- ⬜ Photos load as empty array — not wired to real Media resources
- ⬜ No treatment history view for patients
- ⬜ `onUploadPhotos` shows "coming soon" notification

---

## Phase B1: Treatment Data Persistence

**Goal:** Make the ServiceCard's treatment form actually save clinical data to FHIR.

### App Changes

#### 1. Implement `onUpdateTreatmentData` in ServiceCard
Currently the handler just logs to console. Replace with:
- Read the ServiceRequest's linked Procedure (via `linked-appointment` → Appointment → Procedure)
- Or create a Procedure if one doesn't exist yet
- Save treatment data (injection maps, areas, units, product, notes) as Procedure extensions
- Call `recordTreatmentMilestone()` AuditEvent

#### 2. Save clinical details to FHIR
- `treatment-areas` → valueString on Procedure
- `units-used` → valueInteger on Procedure
- `product-brand` → valueString on Procedure
- `injection-map` → complex extension on Procedure
- Clinical notes → FHIR Observation resources linked to Procedure

#### 3. Wire up `useTreatmentData.ts`
- The existing hook already loads Procedure data from FHIR
- Need to add save/update functionality
- Return loading/error states for UI feedback

### Tests
- Update ServiceCard test to verify save flow
- Test Procedure creation on first save
- Test extension values are correct
- Test AuditEvent recording

### Success Criteria (Verify After)
- [ ] Fill in treatment form → click Save → data persists
- [ ] Refresh page → data still there
- [ ] Injection maps, units, areas, product all saved
- [ ] Audit trail shows treatment milestone recorded

---

## Phase B2: Photo Gallery Integration

**Goal:** Wire up before/after photo gallery with real Media resources.

### App Changes

#### 1. Load photos from FHIR
Replace empty array with real query:
```typescript
const photos = await medplum.search('Media', {
  basedOn: `Procedure/${procedureId}`,
});
```

#### 2. Upload flow
- Upload creates Media resource with Binary storage
- Links to Procedure via `related-procedure` extension
- PhotoUploadSection already has the upload logic — just needs wiring

#### 3. Delete flow
- Deletes Media resource
- UI confirms before deletion

### Tests
- Test photo loading
- Test upload creates Media resource
- Test delete removes Media resource
- Test photo count badge updates

### Success Criteria (Verify After)
- [ ] Treatment with photos → gallery shows them
- [ ] Upload photo → appears immediately
- [ ] Delete photo → removed from gallery
- [ ] Photo count badge updates correctly

---

## Phase B3: Treatment History View

**Goal:** Patient-level timeline of all past procedures.

### New Files
- `packages/app/src/nurse-mel/TreatmentHistoryTab.tsx` — procedure timeline component
- `packages/app/src/nurse-mel/TreatmentHistoryTab.test.tsx` — tests

### App Changes

#### 1. Create TreatmentHistoryTab
- Load all Procedures for the patient
- Group by date (with section headers)
- Show per-treatment: service name, date, provider, areas treated, units, products
- Expandable to show injection maps and photos

#### 2. Add "Treatment History" tab
- Add to Patient resource tabs in ResourcePage.tsx
- Route: `/Patient/:id/treatment-history`

### Tests
- Test procedure loading and grouping
- Test rendering of treatment details
- Test tab navigation

### Success Criteria (Verify After)
- [ ] Patient with past treatments → timeline shows them
- [ ] Each treatment shows service name, date, provider
- [ ] Expand to see injection maps, areas, photos
- [ ] Tab visible on Patient page

---

## Phase B4: Booking Detail Polish

**Goal:** Polish the existing experience.

### App Changes

#### 1. Edit Booking Button
- Ensure button is properly visible on BookingDetailPage
- Navigate to CreateAppointmentModalV3 in edit mode
- Already exists — just verify it works end-to-end

#### 2. Service Status Progression
- `pending → in-progress → completed`
- UI reflects current status with clear visual indicators
- Disable buttons appropriately for each status

#### 3. Consent Flow
- Auto-refresh consent status when signed
- Clear "Consent Required" vs "Consent Signed" visual

### Tests
- Update existing tests for polish items
- Test status progression UI states

### Success Criteria (Verify After)
- [ ] Edit Booking button opens modal with correct data
- [ ] Service status shows correctly at each stage
- [ ] Signing consent updates UI immediately
