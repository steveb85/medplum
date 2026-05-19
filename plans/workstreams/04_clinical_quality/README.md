# Workstream 4: Clinical Quality

> **Goal**: Elevate from "booking tool" to "medical EMR" — aftercare delivery, patient assessment, adverse event tracking, outcome measurement.

---

## Problem Statement

The system is currently strong on scheduling but weak on clinical quality. For patient safety, medico-legal protection, and competitive differentiation, we need:

1. **Aftercare delivery**: Patients leave with structured instructions
2. **Pre-treatment assessment**: Quick point-of-care check before treatment
3. **Adverse event reporting**: Document complications
4. **Outcome measurement**: Prove results
5. **Before/after photo timeline**: Show progression
6. **Waste/disposal documentation**: Required for controlled substances and medical waste compliance
7. **Treatment refusal documentation**: Covered medico-legally

---

## Tasks

| # | Task | AC | Effort |
|---|------|---|--------|
| 4.1 | Per-treatment aftercare: add to ServiceConfig | Configurable HTML per service (Botox aftercare, Filler aftercare, Laser aftercare) | 3h |
| 4.2 | Aftercare delivery cron | Sends specific aftercare via SMS/Email 1-4h post-treatment; avoids generic "how are you feeling" | 2h |
| 4.3 | Pre-treatment assessment form | Skin type, pregnancy confirmation, photosensitivity, contraindication recheck | 3h |
| 4.4 | Adverse event form | Type (bruising, swelling, infection, vascular occlusion), severity, description, photo upload | 3h |
| 4.5 | Adverse event notifications | Creates Observation + Communication (staff alert) + AuditEvent | 1.5h |
| 4.6 | Patient satisfaction survey | Simple 1-5 + comment box; sent 7 days post-treatment; stored as QuestionnaireResponse | 2.5h |
| 4.7 | Treatment refusal workflow | "Patient declined" button with reason, signature | 2h |
| 4.8 | Waste/disposal attestation | Checkbox on Botox save: "Disposed per medical waste protocol" | 1h |
| 4.9 | Before/after photo timeline | Side-by-side chronological view across visits | 3h |
| 4.10 | Multi-visit photo comparison | Select two visits, compare before/after | Bonus: 2h |

**Total**: 21 hours (23h with bonus)

---

## Aftercare Per Treatment Type

Stored as HTML in ServiceConfig extensions and sent via SMS/Email post-treatment:

| Treatment | Aftercare Content |
|-----------|-------------------|
| **Botox** | No lying down for 4h; no exercise 24h; no rubbing injection sites 24h |
| **Filler** | No pressure on treated areas 48h; ice as needed; avoid heat/sauna 48h |
| **Laser** | Avoid sun 2 weeks; SPF 50+; no retinoids; no exfoliants; gentle cleanser only |
| **Consultation** | Follow-up appointment scheduled; contact us with questions |

---

## Pre-Treatment Assessment

Quick form (takes < 2 minutes), shown before treatment begins:

| Question | Purpose |
|----------|---------|
| Skin type (Fitzpatrick 1-6, radio) | Determines treatment parameters |
| Photosensitivity today? | Safety, esp. for laser |
| Current medications / allergies (review from chart) | Safety |
| Pregnancy / breastfeeding status | Contraindication |
| Recent sun exposure? | Safety, esp. for laser |
| Procedure consent valid? (not expired) | Legal |

---

## Open Questions

1. Does NY State require specific informed consent language for injectables?
2. Are adverse events reported to any regulatory body (FDA MedWatch for Botox/Dysport)?
3. Should satisfaction surveys include photos? (FACE-Q uses photos)
4. Pre-treatment assessment: should it require a second witness signature?
