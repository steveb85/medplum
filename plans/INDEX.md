# Nurse Mel Medplum — Development Plans

**Last Updated:** May 12, 2026

This folder contains detailed implementation plans for the remaining work on the Nurse Mel Medplum EMR system.

## Active Streams

### Stream A: Payments & Communications Integration
**Status:** Phase A1 in progress
**Goal:** Wire up Stripe payment links, payment confirmations, automated reminders, two-way SMS, and analytics.
**Est. Total:** ~16-20 hrs across 5 phases
**Detail:** [STREAM_A_PAYMENTS_COMMS.md](./STREAM_A_PAYMENTS_COMMS.md)

### Stream B: Treatment Tracking & History
**Status:** Not started
**Goal:** Complete per-service action cards, treatment data persistence, photo gallery, and treatment history view.
**Est. Total:** ~12-16 hrs across 4 phases
**Detail:** [STREAM_B_TREATMENT_TRACKING.md](./STREAM_B_TREATMENT_TRACKING.md)

## Completed / Archived Streams

### Stream C: Calendar Drag-Drop
**Status:** 🗄️ Archived — not required
**Rationale:** Re-evaluate if needed post-launch

### Stream D: Equipment Management
**Status:** ✅ Core complete — enhancements deferred
**Note:** CRUD, calendar filter, service requirements, room counts, and conflict detection all built. Equipment availability calendar and maintenance scheduling are nice-to-have enhancements.

## Dependency Map

```
Stream A ──► Independent ──► No blocking dependencies on Stream B
Stream B ──► Independent ──► No blocking dependencies on Stream A

Both streams can be worked on in any order or in parallel.
```
