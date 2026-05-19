# Workstream 8: Operational Tools

> **Goal**: Build the day-to-day operational infrastructure — scheduling, check-in, equipment maintenance — so the practice runs smoothly.

---

## Problem Statement

- A provider is sick on Monday but appointments are still bookable for Monday (no PTO blocking)
- A patient arrives but there's no check-in workflow (just a "Mark as Arrived" button in the app)
- Calendar events cannot be dragged to reschedule (must open edit modal, re-enter everything)
- Equipment was last calibrated 6 months ago but nobody remembers
- Practice hours are hardcoded (8am-8pm) with no admin configuration

---

## Tasks

| # | Task | AC | Effort |
|---|------|---|--------|
| 8.1 | Provider working hours config | Set recurring hours per provider (Mon/Tue/Wed/Thu/Fri blocks) with lunch and breaks | 3h |
| 8.2 | Blocked time / PTO on calendar | "Unavailable" blocks prevent booking; shown on calendar (gray) | 2.5h |
| 8.3 | Patient check-in workflow | Simple browser/tablet screen: patient name → consent check → photos → mark arrived | 2h |
| 8.4 | Drag-to-reschedule on calendar | react-big-calendar `onEventDrop` + conflict detection + persist to FHIR | 3h |
| 8.5 | Equipment maintenance log | Calendar of service/calibration per device; next due date; reminders | 2.5h |
| 8.6 | Practice settings admin | Default deposit, hours (affects calendar), tax rate, email/SMS templates | 2.5h |
| 8.7 | Integration health dashboard | Shows Stripe/Twilio/Resend connected vs. disconnected | 1.5h |

**Total**: 17 hours

---

## Acceptance Criteria

### Provider Time Off
1. Nurse Melissa says "I'm on vacation May 25-29"
2. Enters PTO into calendar → block appears in gray
3. Coordinator tries to book May 26 → conflict warning: "Provider unavailable"
4. Calendar shows "Palm Springs" in block (optional)

### Patient Check-In
1. Patient walks in and says "I'm Sarah L., here for Botox"
2. Reception taps "Check In", searches Sarah → sees intake complete ✓, consent valid ✓
3. Taps "Confirm Check-In" → Appointment auto-marks as `arrived`
4. Notification sent to assigned provider: "Sarah L. has arrived and is ready in Room 1"

### Drag-to-Reschedule
1. Provider drops 10am Botox to 2pm
2. System checks conflicts → if none, saves
3. Patient automatically notified: "Your appointment moved to 2pm"
4. If conflict → red border animation, reverts, shows error

---

## Open Questions

1. Check-in: should it be a dedicated tablet (browser with locked URL), or a desktop app action?
2. Drag-to-reschedule: should this be per-ServiceRequest (drag one service) or per-Appointment (move all services)?
3. Equipment maintenance: do we need to track maintenance per laser type, or generic scheduling is enough?
