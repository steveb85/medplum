# Phase 1 → Phase 2 Migration Plan

> **Strategy**: Complete Replacement (Option 1)  
> **Reason**: All data is test data, not in production  
> **Goal**: Replace single-service booking with multi-service architecture

---

## Files to DELETE

### Booking Creation (REMOVE entirely)

| File | Reason | Replacement |
|------|--------|-------------|
| `/packages/app/src/components/CreateAppointmentModal.tsx` | Single-service booking | NEW: Multi-service booking modal |

### Booking Pages (REBUILD)

| File | Action | Notes |
|------|--------|-------|
| `/packages/app/src/pages/CalendarPage.tsx` | MODIFY | Keep calendar, rebuild event handling |
| `/packages/app/src/pages/BookingsPage.tsx` | MODIFY | Keep list view, rebuild data fetching |

### Treatment Pages (PRESERVE treatment workflows, MODIFY booking integration)

| File | Action | Notes |
|------|--------|-------|
| `/packages/app/src/nurse-mel/BotoxTreatmentPage.tsx` | MODIFY | Keep treatment workflow, remove old booking refs |
| `/packages/app/src/treatments/FillerTreatmentPage.tsx` | MODIFY | Keep treatment workflow, remove old booking refs |
| `/packages/app/src/treatments/LaserTreatmentPage.tsx` | MODIFY | Keep treatment workflow, remove old booking refs |
| `/packages/app/src/treatments/ConsultationTreatmentPage.tsx` | MODIFY | Keep treatment workflow, remove old booking refs |

---

## Files to KEEP (Preserve Working Code)

### Treatment Workflows (KEEP - These Work Well)

| File | Purpose | Status |
|------|---------|--------|
| `/packages/app/src/nurse-mel/PhotoUploadSection.tsx` | Before/after photo handling | ✅ Keep as-is |
| `/packages/app/src/treatment-map/` | Injection mapping for Botox | ✅ Keep as-is |
| `/packages/app/src/nurse-mel/TreatmentsTab.tsx` | Patient treatments list | MODIFY for ServiceRequests |

### Shared Components (KEEP - Reusable)

| File | Purpose | Notes |
|------|---------|-------|
| `/packages/app/src/components/` | Shared UI components | Keep, may add new ones |
| `/packages/app/src/treatments/shared/` | Treatment shared components | Keep TreatmentHeader, TreatmentStatusAlert |
| `/packages/app/src/auth/role.ts` | Role detection | ✅ Keep as-is |

### Utilities (KEEP - Reusable)

| File | Purpose | Notes |
|------|---------|-------|
| `/packages/app/src/notifications/` | Notification system | Keep, extend for SMS |
| `/packages/app/src/utils/` | Helper functions | Keep, add new utilities |

---

## Database Changes

### Tables to Clear (Test Data)

```sql
-- Appointment table - will be repopulated with new structure
TRUNCATE "Appointment" CASCADE;

-- Procedure table - will be recreated via ServiceRequest → Procedure
TRUNCATE "Procedure" CASCADE;

-- ServiceRequest - new table, will be empty initially
-- Task - new table, will be empty initially
-- ActivityDefinition - new table, seeded with services
```

### New Tables/Resources to Create

| Resource | Purpose | Seeded? |
|----------|---------|---------|
| `ActivityDefinition` | Service catalog | YES - Botox, Filler, Laser, Consult |
| `ServiceRequest` | Ordered services | NO - Created per booking |
| `Task` | Numbing sub-tasks | NO - Created when needed |
| `Location` | Rooms | YES - Room 1, Room 2 |
| `Schedule` | Provider availability | YES - Mel's schedule |

### Patient Extensions (NEW)

Add to existing Patient resources:
- `consult-tracking` extension
- `gfe-categories` extension

---

## Code Migration Steps

### Step 1: Preparation (Day 1)

1. **Backup current code**
   ```bash
   git checkout -b phase-1-archive
   git push origin phase-1-archive
   ```

2. **Create new branch**
   ```bash
   git checkout -b phase-2-multi-service
   ```

3. **Document current API**
   - Note any existing Appointment/Procedure extensions
   - Document current linked-appointment pattern

### Step 2: Deletion (Day 1-2)

1. **Remove CreateAppointmentModal**
   - Delete file
   - Remove imports from treatment pages
   - Remove from exports

2. **Clean up booking references**
   - Find all imports of CreateAppointmentModal
   - Remove "Edit Booking" buttons temporarily
   - Will re-add with new modal

3. **Verify build still works**
   ```bash
   npm run build
   ```

### Step 3: Seed Data (Day 2)

1. **Create ActivityDefinitions**
   - `/packages/server/src/seed/serviceCatalog.ts`
   - Services: Botox, Filler, Laser, Consult

2. **Create Locations**
   - Room 1, Room 2
   - Equipment references (laser machine in Room 2)

3. **Create Schedules**
   - Mel's availability
   - Room availability

4. **Add Patient extensions**
   - Migration script to add consult-tracking to existing patients

### Step 4: Rebuild (Day 3-5)

1. **New CreateAppointmentModal**
   - Multi-service selection
   - Service compatibility checking
   - GFE validation
   - Room assignment
   - Numbing Task creation

2. **Update Calendar**
   - Display ServiceRequests, not just Appointments
   - Show numbing Tasks
   - Color-coding by service type

3. **Update Booking List**
   - Show multi-service bookings
   - Status per ServiceRequest
   - Total duration calculation

4. **Re-add Edit Booking**
   - New modal integrated with multi-service

### Step 5: Integration (Day 6-7)

1. **Connect to existing treatment workflows**
   - When treatment starts: ServiceRequest → Procedure
   - Link photos to ServiceRequest
   - Track status per service

2. **Test end-to-end**
   - Book multi-service appointment
   - Verify Tasks created
   - Complete treatment workflow

---

## Testing Checklist

### After Deletion
- [ ] App builds without errors
- [ ] Can navigate to all pages
- [ ] Patient search works
- [ ] Treatment pages load (without Edit Booking button)

### After Rebuild
- [ ] Can create multi-service booking
- [ ] Service compatibility checks work
- [ ] GFE warnings display
- [ ] Room auto-assigns correctly
- [ ] Numbing Task creates automatically
- [ ] Assistant sees Task in dashboard
- [ ] Calendar shows all events correctly
- [ ] Can edit existing booking
- [ ] Treatment workflow completes end-to-end

---

## Rollback Plan

**If critical issues found:**

1. Switch back to `phase-1-archive` branch
2. Restore database from backup
3. Re-run seed data

**Since data is test data, rollback is simple.**

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Deletion | 1-2 days | Clean slate, build passes |
| Seed Data | 1 day | ActivityDefinitions, Locations |
| Rebuild Booking | 3-4 days | New CreateAppointmentModal, Calendar |
| Integration | 2 days | Treatment workflow connection |
| Testing | 2 days | End-to-end validation |
| **Total** | **8-10 days** | Phase 2A complete |

---

## Questions?

- See **TECHNICAL_SPEC.md** for architecture details
- See **AGENTS.md** for current implementation status
- See **INSTRUCTIONS.md** for development environment
