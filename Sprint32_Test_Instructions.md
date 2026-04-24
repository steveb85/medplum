# Sprint 3.2 Browser Tests

## Setup
```bash
# Start the dev environment
cd packages/server && npm run dev
cd packages/app && npm run dev
```
Navigate to: http://localhost:3000

---

## Test 1: Create a New Booking

**Steps:**
1. Login as **Coordinator** (coordinator@melissaknudson.com / medplum_coord)
2. Go to **Calendar**
3. Click **"New Appointment"**
4. Select patient "Sarah Chen"
5. Select "Botox Cosmetic" service
6. Select tomorrow's date, 3:00 PM
7. Select Melissa Knudson as Main Provider
8. Select Lauren Chen as Assistant
9. Click "Create Booking"

**Expected:**
- Success notification "Booking Requested"
- Modal closes
- Calendar refreshes

---

## Test 2: Booking Appears in Pending

**Steps:**
1. Go to **Bookings** page
2. Click **"Pending Approval"** tab

**Expected:**
- New booking appears with "Pending" status (yellow badge)
- Shows "Approve" button (green)
- Shows action menu (three dots)

---

## Test 3: Approve Booking

**Steps:**
1. Find the pending booking
2. Click **"Approve"** button

**Expected:**
- Success notification "Booking approved"
- Booking moves to "Upcoming" tab
- Status changes to "Booked" (blue badge)
- **Check Notifications**: Assigned providers receive notification

---

## Test 4: Provider Receives Notification

**Steps:**
1. Login as **Provider** (melissa@melissaknudson.com / medplum_provider)
2. Click the **Notifications** icon (bell) in header

**Expected:**
- Shows "Appointment Approved" notification
- Message: "Botox Cosmetic for Sarah Chen on [date] at [time] has been approved"
- Badge shows unread count

---

## Test 5: Mark as Arrived

**Steps:**
1. Go to **Bookings** → **Upcoming** tab
2. Find the approved booking
3. Click the **three dots** menu
4. Click **"Mark as Arrived"**

**Expected:**
- Status changes to "Arrived" (teal badge)
- Success notification shown
- Booking still visible in Upcoming

---

## Test 6: Cancel Booking

**Steps:**
1. Create another booking (or use existing)
2. In **Upcoming** tab, click **three dots**
3. Click **"Cancel Booking"**
4. Enter reason: "Patient requested reschedule"
5. Click "Cancel Booking" to confirm

**Expected:**
- Modal closes
- Status changes to "Cancelled" (red badge)
- Booking moves to "Past" tab
- **Check Notifications**: Providers receive cancellation notification

---

## Test 7: Mark as No-Show

**Steps:**
1. Create a booking for today
2. Approve it
3. Click **three dots**
4. Click **"Mark as No-Show"**

**Expected:**
- Status changes to "No Show" (gray badge)
- Booking moves to "Past" tab

---

## Test 8: Audit Trail

**Steps:**
1. Open browser DevTools → Network tab
2. Perform a status change (approve/cancel)
3. Look for the FHIR API call

**Expected:**
- Appointment resource includes `status-change-audit` extension:
```json
{
  "url": "http://melissaknudson.com/fhir/StructureDefinition/status-change-audit",
  "extension": [
    { "url": "from", "valueString": "pending" },
    { "url": "to", "valueString": "booked" },
    { "url": "changedAt", "valueDateTime": "2026-04-24T..." },
    { "url": "changedBy", "valueReference": { "reference": "Practitioner/..." } }
  ]
}
```

---

## Test 9: Status Transition Restrictions

**Steps:**
1. Find a "Cancelled" booking in Past tab
2. Try to change status

**Expected:**
- No action menu available (no status transitions from cancelled)
- Same for "Fulfilled" and "No Show"

---

## Test 10: Permission Check

**Steps:**
1. Login as **Coordinator**
2. Try to approve a booking

**Expected:**
- Coordinator CAN approve bookings
- All status changes available

---

## Summary Checklist

- [ ] Create booking as coordinator
- [ ] Booking appears in Pending tab
- [ ] Approve booking works
- [ ] Provider receives notification on approve
- [ ] Mark as Arrived works
- [ ] Mark as No-Show works
- [ ] Cancel booking with reason works
- [ ] Provider receives notification on cancel
- [ ] Status badges show correct colors
- [ ] Audit trail extension created
- [ ] Status transition restrictions work

**All tests pass? Ready for Sprint 3.3 (Patient Communications)!**
