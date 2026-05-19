# Workstream 5: Lead Management

> **Goal**: Never lose another prospective patient. Track them from first DM to booked appointment.

---

## Problem Statement

A prospect DMs the practice on Instagram: "Hi! Do you do Botox? How much?" → If they don't immediately book, they are lost forever. There is no pipeline, no follow-up, no way to know "we had 17 inquiries this month, 4 became patients."

---

## Lead Pipeline

```
NEW → CONTACTED → CONSULT-SCHEDULED → CONSULTED → READY-TO-BOOK → BOOKED → LOST
  ↑                   ↓
Drop-off             🔄 (can re-engage)
```

---

## Data Model

### Lead (extends Patient or standalone)

While a full Patient is created at intake, a **Lead** can be created earlier — before they come in. Options:

- **Option A**: Extend Patient with `lead_status` and `lead_source` (simpler, but pollutes patient DB)
- **Option B**: Create custom `Lead` resource that converts to Patient at intake
- **Recommendation**: Option A — extend Patient. Easier for existing queries and avoids migration headaches.

### Lead Fields

| Field | Type | Notes |
|-------|------|-------|
| leadStatus | enum | `new`, `contacted`, `consult-scheduled`, `consulted`, `booked`, `lost` |
| leadSource | string | `instagram`, `google`, `friend-referral`, `walk-in` |
| assignedPractitioner | reference | Staff member assigned to follow up |
| dateFirstContacted | Date | When we first heard from them |
| dateConverted | Date | When they became a booked patient |
| notes | string | Free text about lead |

### Lead Capture Points

| Source | How It Enters |
|--------|---------------|
| Website contact form | API creates Lead with status `new` |
| Instagram DM | Manual entry (or later, webhook) |
| Phone call | User manually creates lead |
| Walk-in | User manually creates lead |
| Referral card | User manually creates lead |

---

## Tasks

| # | Task | AC | Effort |
|---|------|---|--------|
| 5.1 | Lead data model (Patient extension) | `leadStatus`, `leadSource`, `assignedPractitioner`, dates | 2h |
| 5.2 | Lead capture: intake form has option to create lead before full intake | When inquiry comes in, create Lead with status `new` | 1.5h |
| 5.3 | Lead pipeline UI: Kanban board | Columns per status; drag card to change | 3h |
| 5.4 | Lead list with search and filter | Filter by status, source, assigned staff | 1.5h |
| 5.5 | Automated follow-up sequence | Inquiry → 24h → 1 week → 2 week SMS | 2h |
| 5.6 | Convert lead to Patient | Promote to full Patient; carry over all data | 1.5h |
| 5.7 | Referral source analytics | Report: source → leads → conversion rate | 2h |
| 5.8 | Lead-to-booking shortcut | From lead card: "Book Consultation" → opens CreateAppointmentModal | 1h |

**Total**: 16 hours

---

## Acceptance Criteria

1. Practice receives Instagram DM inquiry
2. Coordinator creates lead: name "Sarah L.", source "Instagram", status "new", assigned to Jennifer
3. Jennifer calls Sarah 2 hours later → marks status "contacted"
4. Sarah books consult → status "consult-scheduled"
5. After consult → status "consulted", Jennifer adds notes: "Recommended Botox, ready to proceed"
6. Sarah books Botox → status "booked" → system converts to full Patient
7. Monthly report shows: 17 leads from Instagram → 4 booked → 23.5% conversion rate
8. 5 leads are "lost" without booking → coordinators follow up: "Still interested? Here's $50 off"

---

## Open Questions

1. Should we auto-create leads from form submissions (website contact form → API → Lead)?
2. Is there an existing CRM the practice uses that we should integrate with?
3. What is the preferred follow-up time-frame between contact attempts?
