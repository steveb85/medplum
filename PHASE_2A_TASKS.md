# Phase 2A Implementation Tasks

> **Goal**: Complete replacement of booking system  
> **Duration**: 8-10 days  
> **Depends on**: MIGRATION_PLAN.md

---

## Overview

This is a **COMPLETE REPLACEMENT** of the Phase 1 booking system. We are not migrating - we are deleting and rebuilding.

### What Gets Deleted
- Single-service CreateAppointmentModal
- Current booking creation logic
- Test appointments and procedures

### What Gets Built
- Multi-service booking with ActivityDefinitions
- ServiceRequest-based architecture
- Numbing Task automation
- GFE/Consult tracking

---

## Sprint 1: Foundation (Days 1-2)

### Task 1.1: Backup & Branch
**Duration**: 0.5 days

- [ ] Create `phase-1-archive` branch and push
- [ ] Create `phase-2-multi-service` branch
- [ ] Document current Appointment/Procedure extensions
- [ ] Note existing test data for reference

**Deliverable**: Archive branch + clean working branch

---

### Task 1.2: Delete Old Booking System
**Duration**: 1 day

**Delete:**
- [ ] `/packages/app/src/components/CreateAppointmentModal.tsx`
- [ ] Remove imports from all treatment pages
- [ ] Remove "Edit Booking" buttons temporarily

**Verify:**
- [ ] `npm run build` passes
- [ ] App runs without errors
- [ ] Calendar loads (button may not work)
- [ ] Treatment pages load (no Edit button)

**Deliverable**: Clean slate

---

### Task 1.3: Clear Test Data
**Duration**: 0.5 days

```sql
TRUNCATE "Appointment" CASCADE;
TRUNCATE "Procedure" CASCADE;
```

- [ ] Document current test data
- [ ] Run truncate
- [ ] Verify seed still works

**Deliverable**: Empty tables

---

## Sprint 2: Service Catalog (Days 2-3)

### Task 2.1: ActivityDefinition Seed
**File**: `/packages/server/src/seed/serviceCatalog.ts`
**Duration**: 1 day

Create ActivityDefinitions:
- Botox (30min, 0 numbing, room-1)
- Filler (45min, 30min numbing, room-1)
- Laser (45min, 45min numbing, room-2)
- Consult (30min, 0 numbing, room-1)

Each with extensions for pricing, GFE category, etc.

**Deliverable**: Service catalog in database

---

### Task 2.2: Location Resources
**File**: `/packages/server/src/seed/locations.ts`
**Duration**: 0.5 days

Create:
- Room 1 (general)
- Room 2 (laser-equipped)

**Deliverable**: Rooms available

---

### Task 2.3: Admin UI
**File**: `/packages/app/src/pages/admin/ServiceCatalogPage.tsx`
**Duration**: 1.5 days

Features:
- Table view of services
- Edit duration, numbing time, prices
- Toggle active/inactive
- Add new service

**Deliverable**: Admin can manage catalog

---

## Sprint 3: Multi-Service Booking (Days 4-6)

### Task 3.1: New Booking Modal
**File**: `/packages/app/src/components/CreateAppointmentModalV2.tsx`
**Duration**: 2 days

Steps:
1. Patient selection + consult status
2. Multi-service selection + compatibility check
3. Date/time + conflict detection
4. Room auto-assign + override
5. Provider assignment
6. Review: services, duration, numbing breakdown

**Deliverable**: Working multi-service booking modal

---

### Task 3.2: FHIR Resource Creation
**Duration**: 1.5 days

On submit, create:
1. **Appointment** (status: 'pending')
2. **ServiceRequest** (per service, status: 'draft')
3. **Task** (if numbing needed)

**Deliverable**: Resources created correctly

---

### Task 3.3: Staff Approval
**Files**: 
- `PendingBookingsPage.tsx` (NEW)
- `PendingBookingCard.tsx` (NEW)
**Duration**: 1.5 days

Features:
- List pending bookings
- Card: patient, services, conflicts
- Actions: Approve / Modify / Reject
- Approve triggers payment SMS

**Deliverable**: Approval workflow working

---

## Sprint 4: Tasks & Calendar (Days 6-7)

### Task 4.1: Assistant Dashboard
**File**: `/packages/app/src/pages/AssistantDashboard.tsx`
**Duration**: 1 day

Features:
- Today's Task list
- Timer countdown
- Status: Start → In Progress → Complete
- Notifications

**Deliverable**: Assistant can manage numbing

---

### Task 4.2: Calendar Updates
**File**: `/packages/app/src/pages/CalendarPage.tsx`
**Duration**: 1 day

Changes:
- Query Tasks + Appointments
- Show numbing Tasks
- Color coding (Mel=blue, Assistant=green)

**Deliverable**: Calendar shows both

---

## Sprint 5: GFE Tracking (Days 7-8)

### Task 5.1: Patient Extensions
**File**: `/packages/app/src/types/patientExtensions.ts`
**Duration**: 1 day

Create:
- consult-tracking extension
- gfe-categories extension
- Helper functions

**Deliverable**: Extensions working

---

### Task 5.2: Patient Header
**File**: `/packages/app/src/components/PatientHeader.tsx`
**Duration**: 0.5 days

Show:
- Patient info
- Consult status (green/orange/red)

**Deliverable**: Visual status indicator

---

### Task 5.3: Booking Warnings
**Duration**: 0.5 days

- Warning if consult expired
- Suggest adding consult
- Per-service GFE check

**Deliverable**: Warnings in booking flow

---

## Sprint 6: Integration (Days 8-10)

### Task 6.1: Connect to Treatments
**Duration**: 2 days

- ServiceRequest → Procedure when treatment starts
- Link photos to ServiceRequest
- Status tracking per service

**Deliverable**: Treatment workflow connected

---

### Task 6.2: Testing
**Duration**: 2 days

- [ ] Book multi-service appointment
- [ ] Verify Tasks created
- [ ] Complete treatment end-to-end
- [ ] Check GFE warnings
- [ ] Verify calendar display
- [ ] Test staff approval

**Deliverable**: Phase 2A complete

---

## Timeline Summary

| Sprint | Days | Deliverable |
|--------|------|-------------|
| 1: Foundation | 2 | Clean slate |
| 2: Catalog | 2 | Service definitions |
| 3: Booking | 3 | Multi-service modal |
| 4: Tasks | 2 | Assistant dashboard |
| 5: GFE | 2 | Consult tracking |
| 6: Integration | 3 | End-to-end working |
| **Total** | **14 days** | Phase 2A |

---

## Key Files

### New Files
- `CreateAppointmentModalV2.tsx`
- `PendingBookingsPage.tsx`
- `ServiceCatalogPage.tsx`
- `AssistantDashboard.tsx`
- `PatientHeader.tsx`

### Modified Files
- `CalendarPage.tsx`
- `BookingsPage.tsx`
- `BotoxTreatmentPage.tsx` (remove old booking refs)
- Treatment pages (remove Edit button temporarily)

### Seed Files
- `serviceCatalog.ts`
- `locations.ts`

---

## Success Criteria

- [ ] Can book Botox + Filler in same appointment
- [ ] Numbing Task auto-creates for Filler
- [ ] Assistant sees Task in dashboard
- [ ] Calendar shows numbing + treatment
- [ ] GFE warnings display correctly
- [ ] Staff can approve/reject bookings
- [ ] Treatment workflow completes end-to-end
