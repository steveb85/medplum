# Workstream 1: Treatment Data Persistence

> **Goal**: Fix the critical bug where Filler, Laser, and Consultation treatment pages accept data from the UI but never save it to the FHIR database.

---

## Problem Statement

The following pages have `handleSave` / `handleSaveNotes` / `onUpdateTreatmentData` callbacks that show a green success notification but never call `medplum.updateResource()`. Data is lost on page refresh.

- `/packages/app/src/treatments/FillerTreatmentPage.tsx` (lines 169-186)
- `/packages/app/src/treatments/LaserTreatmentPage.tsx` (lines 185-201)
- `/packages/app/src/treatments/ConsultationTreatmentPage.tsx` (lines 75-90)
- `/packages/app/src/components/ServiceCard.tsx` (`onUpdateTreatmentData` - logs to console)

---

## References

- BotoxTreatmentPage: `/packages/app/src/nurse-mel/BotoxTreatmentPage.tsx:457-541` (working save handler)
- AuditEvent utils: `/packages/app/src/utils/audit-events.ts`
- FHIR Extensions: `/packages/app/src/utils/fhir-extensions.ts` (where treatment-related extensions must be defined)

---

## Tasks

| # | Task | AC | Effort |
|---|------|---|--------|
| 1.1 | Unify save strategy | All 3 pages + ServiceCard use same `updateResource` pattern | 2h |
| 1.2 | Fix Filler save | `FillerEntry[]` persisted to Procedure via extensions | 1.5h |
| 1.3 | Fix Laser save | `LaserSession[]` persisted to Procedure via extensions | 1.5h |
| 1.4 | Fix Consultation save | notes/recommendations/followUpDate persisted to Procedure | 1h |
| 1.5 | Fix ServiceCard save | `onUpdateTreatmentData` persists to ServiceRequest | 2h |
| 1.6 | Loading state + error handling | Save button disabled while in-flight; error toast on failure | 1.5h |
| 1.7 | Regression test: round-trip | Read → edit → save → re-read for each form type | 2h |
| 1.8 | Last-edited timestamp | Visible in UI when saved | 0.5h |

**Total**: 12 hours

---

## Design Notes

### Data Model

All treatment data should be stored on the `Procedure` resource (or `ServiceRequest` for booking-level data) using custom FHIR extensions. The Botox page uses:

- `http://melissaknudson.com/fhir/StructureDefinition/treatment-areas` (String)
- `http://melissaknudson.com/fhir/StructureDefinition/units-used` (Integer)
- `http://melissaknudson.com/fhir/StructureDefinition/product-brand` (String)
- `http://melissaknudson.com/fhir/StructureDefinition/injection-map` (Complex: nested markers)

For Filler and Laser, we need analogous extensions:

**Filler:**
- `filler-entries` (extension: array of { area, product, volume, notes })
- `general-notes` (extension: String)

**Laser:**
- `laser-sessions` (extension: array of { area, laserType, settings, passes, skinType, notes })
- `general-notes` (extension: String)

**Consultation:**
- `consultation-concerns` (extension: String)
- `consultation-recommendations` (extension: String)
- `follow-up-date` (extension: Date)
- `general-notes` (extension: String)

### ServiceCard `onUpdateTreatmentData`

ServiceCard receives `onUpdateTreatmentData` callback which currently does nothing. It should populate the `ServiceRequest.extension` with treatment-specific data, or if the service already has a `Procedure`, update the Procedure.

---

## Dependencies

- None

---

## Acceptance Criteria (Full Flow)

1. Nurse opens a Filler treatment for a patient
2. Enters two filler entries (cheeks, Juvederm, 1.0ml each)
3. Clicks Save
4. Sees "Treatment details saved" toast
5. Refreshes the page
6. Both entries are still there
7. Same test passes for Laser and Consultation
8. Same test passes when treatment data is entered from BookingDetailPage ServiceCard

---

## Open Questions

1. Should we reuse a single generic extension like `treatment-summary` (JSON string) for all non-Botox treatments, or create specific extensions per treatment type?
2. Should data entered from ServiceCard in BookingDetailPage also be visible in the dedicated treatment page (and vice versa)?
