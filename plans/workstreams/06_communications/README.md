# Workstream 6: Communications Enhancement

> **Goal**: Turn one-way automated alerts into a real two-way conversation system. Staff can see patient replies, view SMS history, and reply without leaving the EMR.

---

## Problem Statement

We send automated SMS reminders, payment requests, and follow-ups. Patients reply:
- "I can't make it tomorrow, can I reschedule?"
- "I'm running 10 minutes late."
- "STOP"

These replies are received by Twilio and stored as `Communication` FHIR resources on the server (`/packages/server/src/webhooks/twilio.ts`). But there is NO UI to see them, and no way for staff to reply. Staff must check their own phones.

Additionally, there is no per-patient opt-in/opt-out management.

---

## Tasks

| # | Task | AC | Effort |
|---|------|---|--------|
| 6.1 | "Messages" tab on Patient resource | Tab shows all SMS/Email for patient in threaded view, newest first | 2.5h |
| 6.2 | Real-time polling for new messages | Every 10-30 seconds, query Communication resources for new ones | 1h |
| 6.3 | Staff reply form | Text area + send → calls Twilio API from server → appears in thread | 1.5h |
| 6.4 | Patient communication history page | All messages across all patients; filter by type, date, patient | 2h |
| 6.5 | Communication preferences on patient | Toggle: SMS on/off, Email on/off; API respects these | 1.5h |
| 6.6 | "STOP" handling | Twilio webhook marks patient as opted-out; all senders check before sending | 1.5h |
| 6.7 | Message status indicators | "sent", "delivered", "failed" per message (via Twilio status callback) | 1.5h |

**Total**: 13 hours

---

## Data Model

Already exists: `Communication` FHIR resources are created by the Twilio webhook. We just need to expose them in the UI.

The Twilio webhook at `/packages/server/src/webhooks/twilio.ts` creates:
- `Communication` (incoming SMS from patient)
- Sets `recipient` = practice, `sender` = patient phone

We will add:
- `Communication` (outgoing SMS from staff)
- Sets `sender` = practice, `recipient` = patient phone

---

## Acceptance Criteria

1. Patient texts "I'll be 10 min late"
2. Within 30 seconds, the message appears in the Messages tab on their patient page
3. A badge appears on the Messages tab: "1 new unread"
4. Staff clicks Messages tab → sees full thread
5. Staff types "No problem, see you soon!" and hits Send
6. SMS is sent via Twilio API
7. Message appears in thread as "staff sent"
8. Patient receives it on their phone
9. Patient replies "Thanks!" — appears in thread
10. Coordinator opens Patient page → sees "Communication preferences: SMS ON, Email ON". Toggles SMS off.
11. System will no longer send SMS to this patient but will continue with Email

---

## Open Questions

1. Should messages also trigger push notifications to assigned staff?
2. Do we need an "inbox" page (all new patient messages, unread count)?
3. How long should message history be retained? (Indefinitely, server-side)
4. Should email conversations also be threaded alongside SMS?
