# Booking Page Fix - Task List

**Created**: May 6, 2026  
**Goal**: Fix all booking page issues and restore full functionality  
**Testing**: Run `npm run build` in `packages/app` after each task

---

## 🔴 P0 - Critical (Fix Immediately)

### TODO 1: Fix Activity History Parser ✅ COMPLETE
**File**: `packages/app/src/pages/BookingDetailPage.tsx` (lines 336-344)  
**Problem**: Uses old `entity.detail` format, new AuditEvents store in `extension`  
**Solution**: 
- Import `parseEntityDetails` from `../utils/audit-events`
- Replace broken parser (lines 336-344) with shared function
- Remove the `event.entity?.forEach` block
- Keep the `action` mapping logic (lines 346-418)

**Status**: ✅ COMPLETE (commit: e8c3d2a)

---

### TODO 2: Implement ServiceCard Start/Complete Actions ✅ COMPLETE
**File**: `packages/app/src/pages/BookingDetailPage.tsx` (lines 174-270)  
**Problem**: Handlers were placeholders (`console.log` only)  
**Solution**:
- `handleStartService(serviceRequestId)`:
  - Update ServiceRequest extension `service-status` to `in-progress`
  - Call `recordTreatmentMilestone()` with "started"
  - Refresh data via `loadData()`

- `handleCompleteService(serviceRequestId)`:
  - Update ServiceRequest extension `service-status` to `completed`
  - Call `recordTreatmentMilestone()` with "completed"
  - Refresh data via `loadData()`

**Status**: ✅ COMPLETE (commit: pending)

---

## 🟠 P1 - High Priority (Fix This Week)

### TODO 3: Integrate ConsentModal ✅ COMPLETE
**File**: `packages/app/src/pages/BookingDetailPage.tsx` + `ServiceCard.tsx`  
**Problem**: ConsentModal existed but not used in BookingDetailPage  
**Solution**:
- Import `ConsentModal` in `BookingDetailPage.tsx`
- Added state: `consentModalOpen`, `currentConsentServiceRequest`, `currentConsentService`
- Added `onSignConsent` prop to ServiceCard
- Added "Sign Consent" button in ServiceCard when consent required and not signed
- When clicked, opens ConsentModal with service context
- On success, calls `loadData()` to refresh and show in activity history

**Status**: ✅ COMPLETE (commit: pending)

---

### TODO 4: Fix Edit Booking Flow ⬜ PENDING
**File**: `packages/app/src/pages/BookingDetailPage.tsx` + `CreateAppointmentModalV3.tsx`  
**Problem**: Edit button exists but may not pre-populate correctly  
**Solution**:
- Verify `CreateAppointmentModalV3` receives `appointment` prop
- Verify `mode="edit"` prop is passed
- Verify patient field is DISABLED in edit mode
- Verify all services pre-populated in `selectedServices` state
- Verify providers/rooms/equipment pre-populated
- Verify `recordBookingEdited()` is called on save

**Estimated Time**: 1 hour  
**Status**: ⬜ PENDING

---

## 🟡 P2 - Medium Priority (Fix Next Sprint)

### TODO 5: Add Activity History Entries for Consent ⬜ PENDING
**File**: `packages/app/src/utils/audit-events.ts` + `BookingDetailPage.tsx`  
**Goal**: Activity history shows "Consent signed by [name] on [date]"  
**Solution**:
- Already have `recordConsentSigned()` function
- Ensure ConsentModal calls it on success
- Verify `parseEntityDetails()` extracts consent data correctly
- Add mapping in BookingDetailPage.tsx activity parser:
  ```typescript
  if (desc.includes('consent signed')) {
    audits.push({
      timestamp,
      action: 'Consent Signed',
      details: `Service: ${details.serviceName || 'Unknown'}`,
      user,
    });
  }
  ```

**Estimated Time**: 30 minutes  
**Status**: ⬜ PENDING

---

### TODO 6: Fix Service Status Display ⬜ PENDING
**File**: `packages/app/src/components/ServiceCard.tsx` (lines 186-198)  
**Goal**: Show correct status badge (pending/in-progress/completed/cancelled)  
**Current State**: Status comes from `serviceStatus` extension, mapped to `ServiceStatus` type  
**Verification Needed**:
- Check status badge colors are correct (gray/orange/green/red)
- Check status transitions work (pending → in-progress → completed)
- Verify cancelled services show correctly

**Estimated Time**: 30 minutes  
**Status**: ⬜ PENDING

---

## 🟢 P3 - Nice to Have (Backlog)

### TODO 7: Add Room/Equipment Change Logging ⬜ PENDING
**Goal**: Activity history shows "Room changed from Room 1 to Room 2"  
**Solution**:
- In `CreateAppointmentModalV3`, when editing, detect room/equipment changes
- Call `recordBookingEdited()` with changes description
- Parse in activity history as "Room changed: Room 1 → Room 2"

**Estimated Time**: 1 hour  
**Status**: ⬜ PENDING

---

### TODO 8: Mobile Responsiveness for BookingDetailPage ⬜ PENDING
**Goal**: Page renders correctly on mobile devices  
**Solution**:
- Check ServiceCard mobile layout
- Check modals (waive, cancel, etc.) on mobile
- Check ConsentModal mobile rendering (already has some mobile support)

**Estimated Time**: 2 hours  
**Status**: ⬜ PENDING

---

## Testing Checklist

After EACH task:
- [ ] `npm run build` passes in `packages/app`
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Activity history shows expected entries
- [ ] Service cards show correct status
- [ ] Consent modal opens and signs correctly
- [ ] Edit booking pre-populates correctly
- [ ] All modals close after submission

---

## Summary

- **Total Tasks**: 8
- **Completed**: 1 ✅
- **Pending**: 7 ⬜
- **Estimated Total Time**: ~5-6 hours

---

**Delete this file when ALL tasks are complete and tested!**
