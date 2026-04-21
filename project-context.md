# Nurse Mel Practice Tech Stack Architecture

> **Document Purpose**: Comprehensive technical architecture and implementation plan for Melissa Knudson's independent aesthetic nursing practice. This document is designed to be copied to a new repository and provide full context for any developer joining the project.

**Last Updated**: April 21, 2026  
**Status**: Phase 1 - Data Model Validation (Local Development)  
**Primary Platform**: Medplum (Self-Hosted on AWS)  
**Backup Platform**: OpenEMR (if Medplum proves unsuitable)

---

## Table of Contents

1. [Background & Context](#background--context)
2. [Executive Summary](#executive-summary)
3. [Platform Selection](#platform-selection)
4. [Architecture Overview](#architecture-overview)
5. [Three-Phase Implementation Plan](#three-phase-implementation-plan)
6. [Development Workflow](#development-workflow)
7. [Data Model (FHIR)](#data-model-fhir)
8. [AWS Production Deployment](#aws-production-deployment)
9. [Current Repository Context](#current-repository-context)
10. [Next Steps](#next-steps)

---

## Background & Context

### Business Overview

**Client**: Melissa Knudson, RN  
**Business**: Independent aesthetic nursing practice in NYC (Tribeca area, 116 Chambers St)  
**Prior Experience**: Co-founder of Skin Solutions Collective (esthetic practice)  
**Transition**: Launching solo practice with focus on undetectable, conservative aesthetic treatments

### Competitive Landscape

**Current Market:**
- Dominant players: Large med spas, dermatology practices
- Common patient complaints: Overdone results, pushy upselling, rushed appointments
- **Mel's Differentiation**: "No-filler filler look", conservative approach, personalized care

**Technology Gap:**
- Most competitors use generic booking systems (Acuity, Squarespace)
- No sophisticated patient portals with treatment history visualization
- Before/after galleries often poorly organized or not patient-accessible

### Why Custom Technology Matters

1. **Patient Retention**: Treatment history + personalized follow-up = loyalty
2. **Operational Efficiency**: Automated reminders, streamlined documentation
3. **Competitive Moat**: Tech-forward patient experience differentiates from competitors
4. **Data Ownership**: Long-term patient relationship data stays with practice

### Current Status

**Pre-Launch Phase**:
- ✅ Website built (see [Current Repository Context](#current-repository-context))
- ✅ EMR platform selected (Medplum)
- 🔄 EMR customization in progress (this document)
- ❌ Live patient data (awaiting launch)
- ❌ HIPAA compliance audit (Phase 3)

---

## Executive Summary

### Core Decision

Use **Medplum Self-Hosted** on AWS (~$150-200/mo) as the EMR backend, with custom React frontend for patient portal. This provides modern FHIR-based architecture at a fraction of Aesthetic Record's cost ($300-500/mo) with full API access for customization.

### Why Not Aesthetic Record (Original Plan)

**Original consideration**: Aesthetic Record is purpose-built for aesthetic practices with before/after galleries and treatment-specific workflows.

**Decision to NOT use AR**:
- ❌ Limited API access (widget-only integration)
- ❌ No custom patient portal possible
- ❌ Vendor lock-in (proprietary system)
- ❌ Cannot build competitive differentiation
- ❌ Cannot integrate with custom booking flows

### Why Not OpenEMR (Alternative Considered)

**Advantages**:
- ✅ Lower cost (~$50-150/mo)
- ✅ Mature, 20+ year track record
- ✅ Large community

**Disadvantages**:
- ❌ Dated PHP/Smarty UI
- ❌ Heavy customization required
- ❌ Longer development timeline
- ❌ Modern React stack unavailable

**Verdict**: OpenEMR kept as fallback if Medplum customization proves too complex.

### Why Medplum (Selected Platform)

- ✅ Modern React/TypeScript stack (aligns with our skills)
- ✅ Production-ready Provider App (Mel can use immediately)
- ✅ Patient Portal template (Foo Medical) for customization
- ✅ Full FHIR R4 API with GraphQL
- ✅ Self-hosted = cost control + data ownership
- ✅ Apache 2.0 license (permissive, no GPL copyleft)
- ✅ Included billing features (superbills, Stripe integration)

### Cost Comparison

| Platform | Monthly | Setup Time | Customization | Status |
|----------|---------|------------|---------------|--------|
| **Medplum (Selected)** | ~$150-200 | Days | Full | 🟢 Primary |
| Aesthetic Record | ~$300-500 | Hours | Limited | 🔴 Rejected |
| OpenEMR (Backup) | ~$50-150 | Weeks | Requires PHP | 🟡 Fallback |

---

## Architecture Overview

### High-Level Flow

```
Patient Journey:
1. Discovers practice via marketing site
2. Books appointment via patient portal
3. Receives SMS reminders (Cloudflare Workers)
4. Visits clinic
5. Mel documents treatment in Provider App
6. Photos uploaded (S3 via Medplum)
7. Patient views history in portal
8. Automated follow-up via SMS/email
```

### Component Breakdown

#### Marketing Website (Existing)
**Status**: ✅ Built and deployed  
**Stack**: Next.js + TinaCMS + Vercel  
**URL**: melissaknudson.com

**Purpose**:
- SEO-driven content (Home, About, Treatments, Blog)
- Lead generation
- Links to Patient Portal
- Managed via TinaCMS visual editor

**NOT part of this EMR project** - kept separate for content team access.

---

#### Patient Portal (Custom Build - Phase 2)
**Status**: 🔄 Phase 2 (not started)  
**Stack**: Next.js + Medplum React SDK + Medplum API  
**URL**: portal.melissaknudson.com

**Features**:
- Authentication (SMS-based login)
- Treatment timeline
- Photo upload (before/after)
- Appointment booking
- Before/after comparison viewer (custom component)
- Payment history

**Why Custom**: Competitive differentiation. Generic portals don't offer treatment-specific experiences.

---

#### Staff Interface (Medplum Provider App - Customized)
**Status**: 🔄 Phase 1 (customization in progress)  
**Stack**: Medplum Provider App (forked) + React + TypeScript  
**URL**: staff.melissaknudson.com

**Base**: `github.com/medplum/medplum/examples/medplum-provider`  
**Customization**: Remove unused features (Labs, Medications if not needed), add aesthetic treatment forms

**Why Fork**: Medplum Provider App is production-ready. Forking allows:
- Branding customization
- Feature hiding (remove Labs/Meds if not used)
- Custom aesthetic workflow additions
- Still benefits from upstream updates

---

#### Backend (Medplum Self-Hosted)
**Status**: 🔄 Phase 1 (local Docker) → Phase 3 (AWS)  
**Stack**: Medplum Server (Node.js + TypeScript) + PostgreSQL + Redis + S3

**Components**:
- **Medplum Server**: FHIR API, authentication, audit logging
- **PostgreSQL**: Patient data, FHIR resources
- **Redis**: Session cache, background jobs
- **S3**: Photo storage (with presigned URLs)
- **CloudFront**: CDN for fast photo delivery

**Self-Hosting Rationale**:
- Cost: $150-200/mo vs $2,000/mo Medplum Cloud
- Control: Full access to logs, backups, customization
- Compliance: Direct AWS BAA, no third-party BAA chain

---

#### Automation Layer (Cloudflare Workers)
**Status**: 🔄 Phase 2 (not started)  
**Stack**: Cloudflare Workers + KV + Queues

**Responsibilities**:
- API proxy to Medplum (rate limiting, auth)
- SMS reminders (Twilio integration)
- Email automation (Resend integration)
- Payment webhooks (Stripe)
- Session caching (KV)

**Why Cloudflare**:
- Edge deployment = low latency globally
- Free tier sufficient for startup
- Workers = serverless, no maintenance

---

## Three-Phase Implementation Plan

### Phase 1: Prove Data Model (1-2 weeks)

**Goal**: Validate that Medplum's FHIR data model supports aesthetic workflows end-to-end.

**Environment**: Local Docker (medplum repo, docker-compose.full-stack.yml)

**Scope**: Single treatment type (Botox) - complete flow

**Deliverables**:

| Step | FHIR Resource | Description | Status |
|------|---------------|---------------|--------|
| 1 | Patient + Appointment | Book Botox appointment | 🔄 In Progress |
| 2 | Questionnaire + QuestionnaireResponse | Custom intake form (aesthetic history) | 🔄 In Progress |
| 3 | DocumentReference + Binary | Digital consent form | 🔄 In Progress |
| 4 | Media | Before photo upload | 🔄 In Progress |
| 5 | Procedure + Observation | Document treatment (units, area, product) | 🔄 In Progress |
| 6 | Media | After photo upload | 🔄 In Progress |
| 7 | Invoice (future) | Payment reference (Phase 2) | ⏭️ Phase 2 |

**Success Criteria**:
- [ ] Complete Botox workflow works end-to-end
- [ ] Photos uploaded and retrievable via API
- [ ] Custom Questionnaire renders correctly
- [ ] Data model feels natural for aesthetic practice
- [ ] Mel approves the Provider App interface

**Failure Criteria** (triggers OpenEMR fallback):
- Cannot customize Provider App without excessive work
- FHIR extensions too complex for aesthetic data
- Photo workflow too slow or cumbersome

---

### Phase 2: Prove UX (2-3 weeks)

**Goal**: Build and validate the patient-facing booking experience.

**Environment**: Local development + staging deployment

**Scope**: Booking flow + basic patient portal

**Deliverables**:

1. **Booking Frontend**
   - Public booking page
   - Treatment selection (Botox only for MVP)
   - Date/time picker (integrates with Medplum scheduling)
   - Patient info collection

2. **Appointment Flow**
   - Create Appointment in Medplum
   - Link to Patient record
   - Send confirmation SMS

3. **Intake Form Completion**
   - Patient fills Questionnaire before appointment
   - Data stored in Medplum
   - Mel sees responses in Provider App

4. **Photo Upload Flow**
   - Patient uploads before photo
   - System creates Media resource
   - Photo linked to upcoming appointment

5. **Stripe Integration (Optional for Phase 2)**
   - Deposit collection at booking
   - Webhook creates Encounter in Medplum
   - ⏭️ Can defer to Phase 3 if time-constrained

**Success Criteria**:
- [ ] Patient can book appointment without staff intervention
- [ ] Intake form completed before visit
- [ ] Before photos uploaded automatically
- [ ] Mel receives notification of new booking
- [ ] UX feels "elegant" to test patients

---

### Phase 3: Production Hardening (2-3 weeks)

**Goal**: Move from local Docker to AWS with proper security, monitoring, and compliance.

**Environment**: AWS Production

**Scope**: Production infrastructure + HIPAA compliance

**Deliverables**:

1. **AWS Deployment**
   - ECS/Fargate for Medplum Server
   - RDS PostgreSQL (encrypted)
   - ElastiCache Redis
   - S3 for photos (encrypted, versioning)
   - CloudFront CDN
   - Route 53 DNS
   - Application Load Balancer

2. **Security & Compliance**
   - AWS BAA signed
   - TLS/SSL certificates (ACM)
   - Secrets management (AWS Secrets Manager)
   - Network isolation (VPC, security groups)
   - Backup automation (RDS snapshots, S3 versioning)
   - Disaster recovery plan

3. **Monitoring**
   - CloudWatch logs/metrics
   - RDS performance insights
   - S3 access logs
   - Error alerting (PagerDuty/Slack)

4. **HIPAA Documentation**
   - Risk assessment
   - Data flow diagrams
   - Incident response plan
   - Staff training materials

**Success Criteria**:
- [ ] Production deployment passes security audit
- [ ] HIPAA compliance documentation complete
- [ ] Backup/recovery tested
- [ ] Mel trained on system
- [ ] Launch ready

---

## Development Workflow

### Phase 1: Local Development Setup

**Repository Structure** (new repo, NOT in current smel repo):

```
nurse-mel-medplum/
├── README.md
├── docker-compose.full-stack.yml    # Medplum's full stack
├── packages/
│   ├── app/                        # 👉 Provider App (customize this)
│   ├── server/                     # 👉 Medplum Server (usually don't touch)
│   └── react/                      # React components (reference only)
├── examples/
│   └── foomedical/                 # 👉 Patient portal template (Phase 2)
└── docs/
    └── fhir-extensions.md          # Custom aesthetic extensions
```

**Fork Process**:

```bash
# 1. Fork Medplum repo on GitHub, then clone:
git clone https://github.com/YOUR_USERNAME/medplum.git
cd medplum

# 2. Add upstream remote for updates:
git remote add upstream https://github.com/medplum/medplum.git

# 3. Create working branch:
git checkout -b nurse-mel-phase-1

# 4. Run full stack:
docker-compose -f docker-compose.full-stack.yml up -d

# Access:
# - Provider App: http://localhost:3000
# - API Server: http://localhost:8103
```

**Hot Reload Development**:

For Phase 1, we'll use **Docker volume mounts** for hot reload:

```yaml
# In docker-compose.full-stack.yml, add volumes to medplum-app:
medplum-app:
  volumes:
    - ./packages/app/src:/usr/src/app/src:ro  # Mount local source
    - /usr/src/app/node_modules                # Preserve container deps
  environment:
    - CHOKIDAR_USEPOLLING=true                # Enable hot reload
```

Then edit files locally, changes reflect in browser automatically.

**Alternative: Hybrid Local Dev**

If Docker hot reload is too slow, can run:
- Postgres + Redis in Docker
- Medplum Server locally (Node.js)
- Provider App locally (Vite dev server)

This gives fastest reload times but more complex setup.

---

### Phase 2: Custom Components

**Patient Portal (Foo Medical Fork)**:

```bash
# Fork foomedical example
cd examples/foomedical
npm install
npm run dev  # Local dev server
```

**Custom Components to Build**:
- `PhotoComparison.tsx` - Before/after slider
- `TreatmentTimeline.tsx` - Visual timeline of treatments
- `BookingForm.tsx` - Custom booking flow

**Integration with Medplum**:
- Use `@medplum/react` hooks: `useResource`, `useSearch`
- Use `@medplum/core` SDK for API calls
- Authentication via Medplum's OAuth2

---

### Phase 3: AWS Deployment

**Option A: Medplum's AWS CDK (Recommended)**

Medplum provides CDK templates:

```bash
cd packages/infra
cd deploy  # Deploys to your AWS account
```

This sets up:
- VPC + subnets
- ECS/Fargate clusters
- RDS PostgreSQL
- ElastiCache Redis
- S3 buckets
- CloudFront distribution
- Route 53
- Application Load Balancer

**Option B: Manual Terraform/CloudFormation**

If CDK doesn't meet needs, can write custom Terraform.

**Configuration Changes for Production**:

```yaml
# Production env vars
MEDPLUM_BASE_URL: 'https://api.melissaknudson.com'
MEDPLUM_APP_BASE_URL: 'https://staff.melissaknudson.com'
MEDPLUM_STORAGE_BASE_URL: 'https://storage.melissaknudson.com'
MEDPLUM_DATABASE_HOST: '[RDS endpoint]'
MEDPLUM_REDIS_HOST: '[ElastiCache endpoint]'
MEDPLUM_BINARY_STORAGE: 's3://medplum-photos-bucket'
```

---

## Data Model (FHIR)

### Core Resources for Aesthetic Practice

#### Patient
```json
{
  "resourceType": "Patient",
  "id": "patient-001",
  "identifier": [{
    "system": "http://melissaknudson.com/patient-id",
    "value": "NM001"
  }],
  "name": [{"family": "Smith", "given": ["Jane"]}],
  "telecom": [
    {"system": "phone", "value": "212-555-0100", "use": "mobile"},
    {"system": "email", "value": "jane@email.com"}
  ],
  "gender": "female",
  "birthDate": "1985-03-15",
  "photo": [{"url": "Binary/photo-001"}]
}
```

#### Appointment
```json
{
  "resourceType": "Appointment",
  "id": "appt-001",
  "status": "booked",
  "serviceType": [{"text": "Botox Consultation"}],
  "start": "2024-05-15T14:00:00Z",
  "end": "2024-05-15T14:30:00Z",
  "participant": [
    {"actor": {"reference": "Patient/patient-001"}},
    {"actor": {"reference": "Practitioner/melissa-001"}}
  ]
}
```

#### Procedure (Treatment Documentation)
```json
{
  "resourceType": "Procedure",
  "id": "proc-001",
  "status": "completed",
  "code": {
    "text": "Botox - Forehead",
    "coding": [{"system": "http://melissaknudson.com/treatments", "code": "botox-forehead"}]
  },
  "subject": {"reference": "Patient/patient-001"},
  "encounter": {"reference": "Encounter/visit-001"},
  "performedDateTime": "2024-05-15",
  "extension": [
    {
      "url": "http://melissaknudson.com/fhir/StructureDefinition/treatment-area",
      "valueCodeableConcept": {
        "coding": [{"code": "forehead", "display": "Forehead"}]
      }
    },
    {
      "url": "http://melissaknudson.com/fhir/StructureDefinition/units-used",
      "valueInteger": 20
    },
    {
      "url": "http://melissaknudson.com/fhir/StructureDefinition/product-brand",
      "valueString": "Botox Cosmetic"
    },
    {
      "url": "http://melissaknudson.com/fhir/StructureDefinition/before-photo-id",
      "valueReference": {"reference": "Media/before-001"}
    },
    {
      "url": "http://melissaknudson.com/fhir/StructureDefinition/after-photo-id",
      "valueReference": {"reference": "Media/after-001"}
    }
  ]
}
```

#### Media (Photos)
```json
{
  "resourceType": "Media",
  "id": "media-before-001",
  "status": "completed",
  "type": {"coding": [{"system": "http://melissaknudson.com/photo-type", "code": "before"}]},
  "subject": {"reference": "Patient/patient-001"},
  "encounter": {"reference": "Encounter/visit-001"},
  "created": "2024-05-15T13:45:00Z",
  "operator": {"reference": "Practitioner/melissa-001"},
  "content": {
    "contentType": "image/jpeg",
    "url": "Binary/photo-before-001",
    "title": "Before - Botox Forehead"
  }
}
```

#### Questionnaire (Intake Form)
```json
{
  "resourceType": "Questionnaire",
  "id": "aesthetic-intake",
  "name": "Aesthetic Treatment Intake",
  "status": "active",
  "item": [
    {
      "linkId": "treatment-history",
      "text": "Have you had Botox before?",
      "type": "boolean"
    },
    {
      "linkId": "concerns",
      "text": "What are your primary concerns?",
      "type": "choice",
      "answerOption": [
        {"valueCoding": {"code": "wrinkles", "display": "Fine lines/wrinkles"}},
        {"valueCoding": {"code": "volume", "display": "Volume loss"}}
      ]
    },
    {
      "linkId": "medications",
      "text": "Current medications",
      "type": "string"
    }
  ]
}
```

---

## AWS Production Deployment

### Estimated Monthly Costs (Production)

| Service | Cost | Notes |
|---------|------|-------|
| ECS Fargate (2 tasks) | ~$60 | Medplum Server + Provider App |
| RDS PostgreSQL (db.t3.medium) | ~$50 | Encrypted, automated backups |
| ElastiCache Redis | ~$15 | Session cache |
| S3 | ~$10-20 | Photo storage (depends on volume) |
| CloudFront | ~$5 | CDN for photos |
| ALB | ~$20 | Load balancer |
| Route 53 | ~$1 | DNS |
| Cloudflare Workers | ~$0-5 | Free tier likely sufficient |
| Twilio SMS | ~$50-100 | Depends on volume |
| Resend Email | ~$0-20 | Free tier + overages |
| **Total** | **~$200-300/mo** | Scales with usage |

### HIPAA Compliance Checklist

**Technical Safeguards**:
- [x] Encryption at rest (AWS RDS encryption)
- [x] Encryption in transit (TLS 1.2+)
- [x] Access controls (Medplum RBAC)
- [x] Audit logging (Medplum AuditEvent resources)
- [ ] Automatic session timeout (configure)
- [ ] Password complexity requirements (configure)

**Administrative Safeguards**:
- [ ] Risk assessment
- [ ] Staff training documentation
- [ ] Incident response plan
- [ ] Business Associate Agreements (AWS, Twilio, Stripe, etc.)

**Physical Safeguards**:
- [x] AWS data center security (automatic)
- [ ] Device encryption policy (for Mel's devices)

### Required BAAs

| Vendor | Service | Action |
|--------|---------|--------|
| AWS | Infrastructure | Sign AWS BAA (free) |
| Twilio | SMS | HIPAA plan (included) |
| Stripe | Payments | Included in service |
| Resend | Email | Request BAA |
| Cloudflare | Edge/CDN | Request BAA |

---

## Current Repository Context

### SMEL Repository (Existing)

**Location**: `/Users/stephenbartlett/Git/smel`  
**Status**: ✅ Production deployed  
**URL**: https://smel-five.vercel.app (staging)  
**Stack**: Next.js 15 + TinaCMS 3.7 + React 18 + Tailwind v4

**Contents**:
- Marketing website (Home, About, Treatments, Blog, Contact)
- 14 block components (Hero, Features, Testimonials, etc.)
- TinaCMS integration for content management
- 8+ blog posts
- Responsive, SEO-optimized

**Relationship to EMR Project**:
- **Separate**: Marketing site stays in SMEL repo, continues as-is
- **Links**: CTAs on marketing site point to Patient Portal (separate domain)
- **No overlap**: EMR project is entirely separate codebase

### Why Separate Repositories?

**SMEL Repo**:
- Marketing-focused
- TinaCMS for content team
- Static site generation
- No patient data (PHI)

**Medplum EMR Repo** (to be created):
- Healthcare-focused
- Real-time patient data
- HIPAA compliance required
- Dynamic, API-driven

**Benefits of Separation**:
- Security: PHI only in healthcare repo
- Compliance: Clear data boundaries
- Team: Marketing team can edit SMEL without touching EMR
- Deployment: Independent CI/CD pipelines

---

## Next Steps

### Immediate (This Week)

1. [ ] **Fork Medplum repo** to personal/organization GitHub
2. [ ] **Clone locally** and run `docker-compose -f docker-compose.full-stack.yml up -d`
3. [ ] **Verify** Provider App loads at http://localhost:3000
4. [ ] **Create** first Questionnaire for Botox intake
5. [ ] **Test** patient creation and appointment booking

### Phase 1 Completion Criteria

- [ ] Botox workflow works end-to-end
- [ ] Photos uploaded and retrievable
- [ ] Custom Questionnaire renders
- [ ] Mel reviews Provider App
- [ ] Decision: Proceed to Phase 2 or fallback to OpenEMR

### Open Questions

1. **Labs/Medications**: Does Mel need lab ordering or e-prescribing? (If no, hide from Provider App)
2. **Billing**: Purely cosmetic (cash) or some insurance? (Affects if we keep billing features)
3. **Mobile**: Need native app or is PWA sufficient?
4. **Stripe**: Include deposit in Phase 2, or defer to Phase 3?

### Contact & Support

- **Medplum Discord**: https://discord.gg/medplum (active community)
- **Medplum Docs**: https://www.medplum.com/docs
- **Storybook**: https://storybook.medplum.com
- **GitHub**: https://github.com/medplum/medplum

---

**Document Version**: 3.0  
**Status**: Ready for Phase 1 Implementation  
**Last Updated**: April 21, 2026  
**Next Review**: After Phase 1 completion (estimated 1-2 weeks)

**Authors**: OpenCode AI Assistant  
**Stakeholders**: Melissa Knudson, RN (end user)  
**Technical Lead**: [To be assigned]

---

## Appendix: Prior Ideas (Deprecated)

The following were considered but **NOT selected** for the current architecture:

<!-- 
DEPRECATED: Aesthetic Record Integration
- Widget-only approach lacked API flexibility
- Could not build custom patient portal
- Cost: $300-500/mo with no customization option
-->

<!-- 
DEPRECATED: OpenEMR as Primary
- Dated PHP/Smarty UI required heavy customization
- Longer development timeline
- Kept as fallback only if Medplum fails
-->

<!-- 
DEPRECATED: Full Custom Patient Portal in SMEL Repo
- Patient portal will be separate repo (nurse-mel-medplum)
- SMEL repo remains marketing-only
- Separation of concerns: PHI only in healthcare repo
-->

<!-- 
DEPRECATED: Cloudflare D1 for PHI Storage
- D1 not HIPAA compliant
- All PHI stays in Medplum (PostgreSQL)
- D1/KV only for non-PHI: session cache, rate limiting
-->

<!-- 
DEPRECATED: Knack/AppSheet as EMR
- Not real EMRs, would need to build everything from scratch
- Insufficient for healthcare compliance
-->
