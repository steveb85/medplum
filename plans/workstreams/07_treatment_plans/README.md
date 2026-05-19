# Workstream 7: Treatment Plans & Series

> **Goal**: Move from one-off appointments to "6 sessions, every 4 weeks." Support packaged treatments and recurring care.

---

## Problem Statement

Aesthetics is about courses, not single visits. A laser hair removal client needs 6-8 sessions. A Botox client comes every 3-4 months. The system has no concept of a "plan" — each booking is independent. This means:
- No progress tracking across visits
- No package pricing (pre-pay for 6 sessions at discount)
- No automated "ready for your next session" reminders
- No "you have 3 sessions remaining" display

---

## CarePlan Data Model

FHIR `CarePlan` already exists in the Medplum platform (type definitions and database schema). It was built for this purpose. We will use it.

### CarePlan (standard FHIR) + Extensions

```
CarePlan
  ├─ status: active | completed | on-hold | revoked
  ├─ intent: plan
  ├─ subject: Patient
  ├─ period.start: when plan started
  ├─ period.end: when plan ends (or null if open)
  ├─ careTeam: [Provider(s)]
  ├─ goal: ["Complete 6 laser sessions", "Smooth results on underarms"]
  ├─ activity: [
  │   ├─ reference: ServiceRequest (individual session)
  │   ├─ detail: {
  │   │   ├─ code: ActivityDefinition reference
  │   │   ├─ scheduled[x]: every 4 weeks
  │   │   └─ status: scheduled | in-progress | completed | skipped
  │   └─ }
  │ ]
  └─ extension: totalSessions, completedSessions, remainingSessions, intervalWeeks, packagePrice
```

---

## Tasks

| # | Task | AC | Effort |
|---|------|---|--------|
| 7.1 | CarePlan data model + extensions | totalSessions, completedSessions, intervalWeeks, packagePrice | 4h |
| 7.2 | Admin UI: create treatment plan template | "Laser Hair Removal — 6 sessions — every 4-6 weeks — $2400" | 2.5h |
| 7.3 | Patient-side view: "My Treatment Plan" | Progress bar, next session date, sessions remaining | 2h |
| 7.4 | Create plan from consultation | "Save as Treatment Plan" button on completed consult | 2h |
| 7.5 | Pre-pay for package | Stripe checkout for full package amount; records in AuditEvents | 2.5h |
| 7.6 | Auto-suggest next booking when current completes | Popup: "Schedule session 4 of 6, recommended date: May 30" | 2h |
| 7.7 | Link each visit to CarePlan | ServiceRequest references CarePlan | 1.5h |
| 7.8 | Reminder before next session | Automated SMS: "Your next Botox session is due in 2 weeks" | 1.5h |

**Total**: 18 hours

---

## Acceptance Criteria

1. Patient books "Laser Hair Removal — 6 sessions package" for $2400
2. System creates CarePlan with: totalSessions=6, intervalWeeks=4, packagePrice=2400
3. Patient has first session → system marks activity as "completed"
4. Patient profile shows: "Treatment Plan: 1 of 6 completed, 5 remaining"
5. One week before next scheduled date, patient receives SMS: "Your next laser session is coming up. Book now."
6. After 6th session, CarePlan status = `completed`
7. Package savings are displayed vs. individual booking (if applicable)

---

## Open Questions

1. Should packages be pre-pay only, or pay-per-session?
2. What happens if a patient wants to transfer remaining sessions to another person? (Generally not allowed in medspa)
3. Should intervals be exact (every 4 weeks) or a range (4-6 weeks)? The system should probably suggest but not enforce.
4. Do we support memberships ("unlimited Botox between sessions"), or only prepaid session counts?
