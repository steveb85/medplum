# Nurse Mel Phase 1: Local Development Setup

> **Quick Reference**: This document provides step-by-step instructions for setting up the Medplum development environment for Nurse Mel's aesthetic practice.

---

## Prerequisites

- **Node.js**: Version 22.18.0 or higher (via NVM)
- **Docker Desktop**: Running locally
- **Git**: For repository management
- **Termius** (optional): For multi-terminal management

---

## Quick Start

### IMPORTANT Tunnel access

in two seperate terminals from the root folder run

cloudflared tunnel --config .cloudflared/medplum-app.yml run
cloudflared tunnel --config .cloudflared/medplum-api.yml run

to set up tunnels

### Step 1: Set Node.js Version

```bash
# Install and use Node 22
nvm install 22
nvm use 22
node --version  # Should show v22.x.x
```

### Step 2: Start Infrastructure

Open **Terminal 1**:

```bash
docker-compose up
```

This starts:

- PostgreSQL on port `5432`
- Redis on port `6379`

**Wait for**: "database system is ready" message.

### Step 3: Install Dependencies

Open **Terminal 2**:

```bash
npm install
```

**This takes**: ~5-10 minutes first time.

### Step 4: Build Packages

```bash
npm run build
```

**This takes**: ~5 minutes.

### Step 5: Configure Environment (Optional)

The server automatically seeds test data by default. To control this:

```bash
# In packages/server/.env (this is the default - seeds test data)
MEDPLUM_SEED_DATA=true

# To disable seeding (production mode)
MEDPLUM_SEED_DATA=false
```

**Seeding behavior**:

- `MEDPLUM_SEED_DATA=true` or **not set** → Seeds Nurse Mel test data
- `MEDPLUM_SEED_DATA=false` → No test data, only Super Admin created

### Step 6: Start Medplum Server

In **Terminal 2**:

```bash
cd packages/server
npm run dev
```

**Wait for**:

- "Server running on port 8103"
- "Database seeded successfully" (includes Nurse Mel data)
- **Look for the login credentials in the console output**

**What happens automatically**:

1. Server connects to Postgres/Redis
2. Database is seeded with:
   - Super Admin user (admin@example.com / medplum_admin)
   - **Nurse Melissa Knudson** (Provider) - melissa@melissaknudson.com / medplum_provider
   - **Alice Smith** (Coordinator) - coordinator@melissaknudson.com / medplum_coord
   - **Organization**: Nurse Mel Aesthetics
   - **Access Policies**: Provider Policy & Coordinator Policy
   - FHIR R4 structure definitions
   - **Test Data**:
     - 3 sample patients (Sarah Chen, Jessica Rodriguez, Amanda Thompson)
     - Botox intake questionnaire
     - 4 sample appointments
     - Completed intake forms

### Step 7: Start Provider App

Open **Terminal 3**:

```bash
cd packages/app
npm run dev
```

**Wait for**: "Local: http://localhost:3000/"

---

## Access Points

| Service      | URL                   | Description        |
| ------------ | --------------------- | ------------------ |
| Provider App | http://localhost:3000 | Main web interface |
| API Server   | http://localhost:8103 | FHIR API endpoint  |

---

## Login Credentials

| User            | Email                          | Password         | Role               | Permissions                                 |
| --------------- | ------------------------------ | ---------------- | ------------------ | ------------------------------------------- |
| **Super Admin** | admin@example.com              | medplum_admin    | Full system access | Everything                                  |
| **Nurse Mel**   | melissa@melissaknudson.com     | medplum_provider | Clinical Provider  | Patient records, treatments, clinical notes |
| **Coordinator** | coordinator@melissaknudson.com | medplum_coord    | Operations         | Scheduling, billing, read-only patient view |

---

## Seeded Test Data

### Organization

- **Name**: Nurse Mel Aesthetics
- **Location**: 116 Chambers St, New York, NY 10007

### Practitioners

| Name                | Email                      | Role     |
| ------------------- | -------------------------- | -------- |
| Melissa Knudson, RN | melissa@melissaknudson.com | Provider |

### Staff (Coordinators)

| Name        | Email                          | Role        |
| ----------- | ------------------------------ | ----------- |
| Alice Smith | coordinator@melissaknudson.com | Coordinator |

### Patients

| Name              | Patient ID | Email                | Has Previous Botox |
| ----------------- | ---------- | -------------------- | ------------------ |
| Sarah Chen        | NM001      | sarah.chen@email.com | Yes                |
| Jessica Rodriguez | NM002      | jessica.r@email.com  | No                 |
| Amanda Thompson   | NM003      | amanda.t@email.com   | Yes                |

### Appointments

| Patient           | Date       | Service                        | Status    |
| ----------------- | ---------- | ------------------------------ | --------- |
| Sarah Chen        | 2025-03-15 | Botox - Forehead & Crows Feet  | Completed |
| Sarah Chen        | Tomorrow   | Botox Touch-up                 | Booked    |
| Jessica Rodriguez | Tomorrow   | Botox Consultation             | Booked    |
| Amanda Thompson   | 2025-04-25 | Botox - Crows Feet & Brow Lift | Booked    |

### Access Policies

| Policy                    | Role        | Description                           |
| ------------------------- | ----------- | ------------------------------------- |
| MedSpa Provider Policy    | Provider    | Full clinical access                  |
| MedSpa Coordinator Policy | Coordinator | Operations access, read-only clinical |

---

## Development Workflow

### Making Changes to Provider App

Edit files in `packages/app/src/` - changes auto-reload via Vite HMR.

### Custom Botox Components

Located in: `packages/app/src/nurse-mel/`

```
nurse-mel/
├── components/
│   ├── TreatmentForm.tsx      # Treatment documentation
│   ├── PatientIntake.tsx     # Custom intake view
│   └── PhotoGallery.tsx      # Before/after photos
└── index.ts
```

### Testing Different User Roles

To test role-based access:

1. **Log in as Nurse Mel** (melissa@melissaknudson.com):
   - Full access to patient records
   - Can create/edit treatments
   - Can write clinical notes

2. **Log in as Coordinator** (coordinator@melissaknudson.com):
   - Read-only patient view
   - Can manage appointments
   - Can process payments
   - Cannot edit clinical data

3. **Log in as Super Admin** (admin@example.com):
   - Full system access
   - Can manage users and permissions

### Restarting Server

If you modify server code:

```bash
# Server auto-restarts via tsx watch
# Just save your changes
```

### Re-seeding Data

To reset with fresh seed data:

```bash
# Stop everything
docker-compose down -v  # This removes the database volume

# Restart
docker-compose up

# In new terminal
cd packages/server && npm run dev
```

### Skipping Seed Data (Production Mode)

For production deployments, disable test data seeding:

```bash
# In packages/server/.env
MEDPLUM_SEED_DATA=false

# Or as environment variable
export MEDPLUM_SEED_DATA=false
npm run dev
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find and kill process using port 3000 or 8103
lsof -i :3000
kill -9 <PID>
```

### Database Connection Issues

```bash
# Reset Docker containers
docker-compose down
docker-compose up

# If needed, wipe database and start fresh
docker-compose down -v
docker-compose up
```

### Build Errors

```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

### Check Server Logs

Look for:

- "Database seeded successfully"
- "Seeding Nurse Mel test data..."
- "Created Nurse Mel practitioner: [id]"
- "Created patient: Sarah Chen"
- "Created appointment: Botox - ..."
- "Nurse Mel test data seeding complete"
- **"SEEDED LOGIN CREDENTIALS:"** section with all logins

---

## Terminus Multi-Terminal Setup

### Recommended Layout

```
┌─────────────┬─────────────┐
│ Terminal 1  │ Terminal 2  │
│ Docker      │ Server      │
│ (postgres,  │ (npm run    │
│  redis)     │  dev)       │
├─────────────┼─────────────┤
│ Terminal 3  │ Terminal 4  │
│ App         │ (optional)  │
│ (npm run    │ Git/Utils   │
│  dev)       │             │
└─────────────┴─────────────┘
```

### Commands

| Terminal | Command                             | Purpose                   |
| -------- | ----------------------------------- | ------------------------- |
| 1        | `docker-compose up`                 | Database infrastructure   |
| 2        | `cd packages/server && npm run dev` | API server + auto-seeding |
| 3        | `cd packages/app && npm run dev`    | Provider UI               |
| 4        | `git status`, etc.                  | Development utilities     |

---

## Next Steps After Setup

1. ✅ Open http://localhost:3000
2. ✅ Log in as **Nurse Mel** (melissa@melissaknudson.com / medplum_provider)
3. ✅ Click "Patient" in left sidebar to see 3 patients
4. ✅ Click on "Sarah Chen" to view her profile
5. ✅ Check "Appointments" to see scheduled treatments
6. ✅ View "Questionnaires" to see Botox intake form
7. ✅ Log out and test as **Coordinator** (coordinator@melissaknudson.com / medplum_coord)
8. 🔄 Begin customizing the Provider App for Botox workflow

---

## Reference

- [Medplum Docs](https://www.medplum.com/docs)
- [FHIR R4 Resources](https://hl7.org/fhir/R4/)
- [Medplum React Components](https://storybook.medplum.com/)
- [Role-Based Access Control](./packages/app/docs/roles.md)

---

**Document Version**: 3.0
**Last Updated**: April 21, 2026
**Phase**: 1 - Data Model Validation (Auto-seeded with role-based access)
