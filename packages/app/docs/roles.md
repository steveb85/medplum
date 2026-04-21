# Nurse Mel MedSpa - Role-Based Access Control

> **Document Purpose**: Defines the role hierarchy, permissions, and UI filtering for the Nurse Mel aesthetic practice EMR system.

**Last Updated**: April 21, 2026
**Status**: Phase 1 - Implementation
**Applies To**: packages/app (Provider App)

---

## Table of Contents

1. [Role Hierarchy](#role-hierarchy)
2. [Permission Matrix](#permission-matrix)
3. [AccessPolicy Templates](#accesspolicy-templates)
4. [UI Filtering Rules](#ui-filtering-rules)
5. [Implementation Notes](#implementation-notes)

---

## Role Hierarchy

```
Super Admin (Platform Level)
    │
    └── Project Admin (Project Level)
            │
            ├── Provider (Clinical)
            │
            └── Coordinator (Operations)
```

### Role Definitions

#### 1. Super Admin
- **Identifier**: `medplum.isSuperAdmin()` returns `true`
- **Scope**: Platform-wide access across all projects
- **Users**: Development team, DevOps
- **Access**: Everything - full system access

#### 2. Project Admin
- **Identifier**: `medplum.isProjectAdmin()` returns `true`
- **Scope**: Full control within assigned project
- **Users**: Melissa Knudson (practice owner), IT administrator
- **Access**: All project settings, user management, billing, security

#### 3. Provider
- **Identifier**: AccessPolicy name contains "Provider" OR UserConfiguration.option with `id='userType'` and `valueString='provider'`
- **Scope**: Clinical care and patient documentation
- **Users**: Nurse Mel, other injectors/aesthetic providers
- **Access**:
  - Full patient records (read/write)
  - Treatment documentation (Botox, etc.)
  - Appointment schedules (view all)
  - Before/after photos (upload/view)
  - Intake forms (view responses)
  - Billing records (view only)

#### 4. Coordinator
- **Identifier**: Default role (no specific AccessPolicy match) OR AccessPolicy name contains "Coordinator" OR UserConfiguration.option with `id='userType'` and `valueString='coordinator'`
- **Scope**: Operations and patient support (non-clinical)
- **Users**: Front desk staff, patient coordinators
- **Access**:
  - Patient records (read-only)
  - Appointment scheduling (full management)
  - Before/after photos (upload/view for appointments)
  - Intake forms (distribute, track completion)
  - Billing/accounts (manage payments)
  - Treatment workflows (read-only view)

---

## Permission Matrix

| Feature | Super Admin | Project Admin | Provider | Coordinator |
|---------|:-----------:|:-------------:|:--------:|:-----------:|
| **Project Settings** |
| Invite users | ✅ | ✅ | ❌ | ❌ |
| Manage access policies | ✅ | ✅ | ❌ | ❌ |
| Configure integrations | ✅ | ✅ | ❌ | ❌ |
| View audit logs | ✅ | ✅ | ❌ | ❌ |
| **Patient Management** |
| Create patients | ✅ | ✅ | ✅ | ❌ |
| Edit patient info | ✅ | ✅ | ✅ | ❌ |
| View patient records | ✅ | ✅ | ✅ | ✅ |
| Delete patients | ✅ | ✅ | ❌ | ❌ |
| **Clinical** |
| Treatment documentation | ✅ | ✅ | ✅ | ❌ |
| View treatment history | ✅ | ✅ | ✅ | ✅ |
| Write clinical notes | ✅ | ✅ | ✅ | ❌ |
| **Appointments** |
| View all schedules | ✅ | ✅ | ✅ | ✅ |
| Create appointments | ✅ | ✅ | ✅ | ✅ |
| Edit appointments | ✅ | ✅ | ✅ | ✅ |
| Cancel appointments | ✅ | ✅ | ✅ | ✅ |
| **Photos/Media** |
| Upload before/after | ✅ | ✅ | ✅ | ✅ |
| View photos | ✅ | ✅ | ✅ | ✅ |
| Delete photos | ✅ | ✅ | ❌ | ❌ |
| **Forms** |
| Distribute intake forms | ✅ | ✅ | ✅ | ✅ |
| View form responses | ✅ | ✅ | ✅ | ✅ |
| Edit form templates | ✅ | ✅ | ❌ | ❌ |
| **Billing** |
| View accounts | ✅ | ✅ | ✅ | ✅ |
| Process payments | ✅ | ✅ | ❌ | ✅ |
| View reports | ✅ | ✅ | ✅ | ✅ |
| **System** |
| Access raw JSON | ✅ | ❌ | ❌ | ❌ |
| View resource history | ✅ | ✅ | ✅ | ❌ |
| Export data | ✅ | ❌ | ❌ | ❌ |
| Run bots | ✅ | ✅ | ❌ | ❌ |

**Legend**: ✅ = Allowed, ❌ = Denied

---

## AccessPolicy Templates

### Provider AccessPolicy

```json
{
  "resourceType": "AccessPolicy",
  "name": "MedSpa Provider Policy",
  "resource": [
    {
      "resourceType": "Patient",
      "criteria": "Patient",
      "readonly": false
    },
    {
      "resourceType": "Practitioner",
      "criteria": "Practitioner",
      "readonly": true
    },
    {
      "resourceType": "Appointment",
      "criteria": "Appointment",
      "readonly": false
    },
    {
      "resourceType": "Encounter",
      "criteria": "Encounter",
      "readonly": false
    },
    {
      "resourceType": "Procedure",
      "criteria": "Procedure",
      "readonly": false
    },
    {
      "resourceType": "Observation",
      "criteria": "Observation",
      "readonly": false
    },
    {
      "resourceType": "Media",
      "criteria": "Media",
      "readonly": false
    },
    {
      "resourceType": "DocumentReference",
      "criteria": "DocumentReference",
      "readonly": false
    },
    {
      "resourceType": "Questionnaire",
      "criteria": "Questionnaire",
      "readonly": true
    },
    {
      "resourceType": "QuestionnaireResponse",
      "criteria": "QuestionnaireResponse",
      "readonly": true
    },
    {
      "resourceType": "Consent",
      "criteria": "Consent",
      "readonly": false
    },
    {
      "resourceType": "Invoice",
      "criteria": "Invoice",
      "readonly": true
    },
    {
      "resourceType": "PaymentReconciliation",
      "criteria": "PaymentReconciliation",
      "readonly": true
    }
  ]
}
```

### Coordinator AccessPolicy

```json
{
  "resourceType": "AccessPolicy",
  "name": "MedSpa Coordinator Policy",
  "resource": [
    {
      "resourceType": "Patient",
      "criteria": "Patient",
      "readonly": true
    },
    {
      "resourceType": "Practitioner",
      "criteria": "Practitioner",
      "readonly": true
    },
    {
      "resourceType": "Appointment",
      "criteria": "Appointment",
      "readonly": false
    },
    {
      "resourceType": "Encounter",
      "criteria": "Encounter",
      "readonly": true
    },
    {
      "resourceType": "Procedure",
      "criteria": "Procedure",
      "readonly": true
    },
    {
      "resourceType": "Observation",
      "criteria": "Observation",
      "readonly": true
    },
    {
      "resourceType": "Media",
      "criteria": "Media",
      "readonly": false
    },
    {
      "resourceType": "DocumentReference",
      "criteria": "DocumentReference",
      "readonly": true
    },
    {
      "resourceType": "Questionnaire",
      "criteria": "Questionnaire",
      "readonly": true
    },
    {
      "resourceType": "QuestionnaireResponse",
      "criteria": "QuestionnaireResponse",
      "readonly": true
    },
    {
      "resourceType": "Consent",
      "criteria": "Consent",
      "readonly": true
    },
    {
      "resourceType": "Invoice",
      "criteria": "Invoice",
      "readonly": false
    },
    {
      "resourceType": "PaymentReconciliation",
      "criteria": "PaymentReconciliation",
      "readonly": false
    }
  ]
}
```

---

## UI Filtering Rules

### Implementation Approach

We use **role-based UI filtering** to complement the backend AccessPolicy:

1. **Security Layer**: AccessPolicy (enforced server-side)
2. **UX Layer**: UI filtering (cosmetic, client-side)

This ensures:
- Users can't access unauthorized resources (AccessPolicy)
- Users see a clean, focused interface (UI filtering)

### Role Detection

```typescript
// In auth/role.ts (to be created)
export type MedSpaRole = 'super-admin' | 'project-admin' | 'provider' | 'coordinator';

export function getMedSpaRole(medplum: MedplumClient): MedSpaRole {
  if (medplum.isSuperAdmin()) {
    return 'super-admin';
  }
  if (medplum.isProjectAdmin()) {
    return 'project-admin';
  }
  // Check UserConfiguration for custom role
  const config = medplum.getUserConfiguration();
  const userType = config?.option?.find(o => o.id === 'userType')?.valueString;
  if (userType === 'coordinator') {
    return 'coordinator';
  }
  return 'provider'; // Default
}

export function canAccess(
  role: MedSpaRole,
  feature: 'labs' | 'bots' | 'clients' | 'admin-settings' | 'clinical-docs' | 'billing-edit'
): boolean {
  const permissions: Record<MedSpaRole, string[]> = {
    'super-admin': ['*'],
    'project-admin': ['*'],
    'provider': ['clinical-docs', 'labs-view'],
    'coordinator': ['scheduling', 'photos', 'billing-edit', 'intake-forms']
  };
  
  if (permissions[role].includes('*')) return true;
  return permissions[role].includes(feature);
}
```

### Features to Hide by Role

#### For Providers (`provider` role)

**Hidden Sidebar Menu Items:**
- ❌ Lab/Assays
- ❌ Lab/Panels
- ❌ Admin/Clients (OAuth)
- ❌ Admin/Bots
- ❌ Admin/Secrets
- ❌ Admin/Sites
- ❌ Resource type search for: ServiceRequest, DiagnosticReport, AccessPolicy, Subscription

**Hidden Patient Tabs:**
- ❌ Event (audit)
- ❌ Blame
- ❌ JSON
- ❌ Apps
- ❌ Profiles
- ❌ Export

**Visible Patient Tabs:**
- ✅ Timeline
- ✅ Details
- ✅ Edit
- ✅ History
- ✅ Botox Treatment (custom)
- ✅ Accounts

#### For Coordinators (`coordinator` role)

**Hidden Sidebar Menu Items:**
- ❌ Lab/Assays
- ❌ Lab/Panels
- ❌ Admin/* (all admin pages)
- ❌ Clinical resource types in search

**Hidden Patient Tabs:**
- ❌ Event (audit)
- ❌ Blame
- ❌ JSON
- ❌ Apps
- ❌ Profiles
- ❌ Export
- ❌ Edit (patient editing - read-only)

**Visible Patient Tabs (Read-only):**
- ✅ Timeline
- ✅ Details (view only)
- ✅ History
- ✅ Botox Treatment (view only)
- ✅ Accounts

#### For Project Admins & Super Admins

**All features visible**

---

## Implementation Notes

### Files to Modify

1. **Create new file**: `src/auth/role.ts`
   - Role detection functions
   - Permission checking utilities

2. **Modify**: `src/App.tsx`
   - Filter menu items based on role
   - Hide resource type search options

3. **Modify**: `src/AppRoutes.tsx`
   - Conditionally render admin routes
   - Add role guards

4. **Modify**: `src/resource/ResourcePage.tsx`
   - Filter tabs based on role
   - Hide edit button for read-only roles

5. **Modify**: `src/HomePage.utils.ts`
   - Filter default search fields for coordinators

### Best Practices

1. **Always check AccessPolicy first** - UI filtering is cosmetic only
2. **Use medplum.isLoading()** before checking roles to avoid flash of incorrect UI
3. **Graceful degradation** - If role unknown, default to most restrictive (coordinator)
4. **Document changes** - Comment why features are hidden

### Security Warning

> ⚠️ **UI filtering is NOT a security measure**
>
> Always implement proper AccessPolicy on the backend. UI filtering only improves UX by hiding irrelevant options. Determined users could still access hidden routes directly via URL manipulation.

---

## Role Assignment & Setup

### How Roles Are Determined

The application uses a hierarchical role detection system:

```
1. Check medplum.isSuperAdmin() → Super Admin
2. Check medplum.isProjectAdmin() → Project Admin
3. Check AccessPolicy name → Provider or Coordinator
4. Check UserConfiguration.option → Provider or Coordinator
5. Default → Coordinator (safest)
```

### Assigning Roles to Users

There are two methods to assign roles to users:

#### Method 1: AccessPolicy Assignment (Recommended)

When inviting a new user, assign them to the appropriate AccessPolicy:

1. **Navigate to**: Admin → Users → Invite New User
2. **Fill in user details**
3. **Select AccessPolicy**:
   - For Providers: Select "MedSpa Provider Policy"
   - For Coordinators: Select "MedSpa Coordinator Policy"
4. **Send invitation**

The AccessPolicy name is used to infer the role on login. The application checks:
- `AccessPolicy.name` contains "Provider" → Provider role
- `AccessPolicy.name` contains "Coordinator" → Coordinator role

#### Method 2: UserConfiguration (Alternative)

For existing users, set the role in their UserConfiguration:

```json
{
  "resourceType": "UserConfiguration",
  "option": [
    {
      "id": "userType",
      "valueString": "provider" // or "coordinator"
    }
  ]
}
```

### Creating AccessPolicies

#### Step 1: Create Provider AccessPolicy

In the Medplum app, navigate to AccessPolicy resources and create:

```
Resource Type: AccessPolicy
Name: MedSpa Provider Policy
```

Paste the JSON template from the [AccessPolicy Templates](#accesspolicy-templates) section above.

#### Step 2: Create Coordinator AccessPolicy

```
Resource Type: AccessPolicy
Name: MedSpa Coordinator Policy
```

Paste the coordinator JSON template.

#### Step 3: Assign to ProjectMemberships

When inviting users or editing existing memberships:

1. Go to Admin → Users
2. Click on a user's membership
3. Set the AccessPolicy field to the appropriate policy
4. Save

### Role Verification

To verify a user's role is correctly detected:

1. Log in as the user
2. Open browser DevTools console
3. Run:

```javascript
import { getMedSpaRole } from './auth/role';
const role = getMedSpaRole(medplum);
console.log('Detected role:', role);
```

Expected outputs:
- `"super-admin"` - Full platform access
- `"project-admin"` - Full project access
- `"provider"` - Clinical access
- `"coordinator"` - Operations access (default)

### Troubleshooting

**Issue**: User shows as Coordinator but should be Provider
- **Check**: Verify the AccessPolicy name contains "Provider" (case-insensitive)
- **Check**: Ensure the ProjectMembership has the correct AccessPolicy assigned
- **Workaround**: Set `UserConfiguration.option` with `id: 'userType'` and `valueString: 'provider'`

**Issue**: User cannot see expected UI features
- **Check**: Verify the AccessPolicy grants read/write permissions for required resources
- **Check**: Confirm role detection using console method above
- **Note**: UI filtering is cosmetic only - AccessPolicy enforces actual security

**Issue**: Changes to AccessPolicy not reflected
- **Solution**: Log out and log back in - role is determined at login
- **Note**: AccessPolicy changes take effect immediately for API calls

## Migration Path

### Phase 1: UI Filtering (Current)
- Hide irrelevant UI elements
- Keep all backend permissions open (for testing)
- Role detection via AccessPolicy name or UserConfiguration

### Phase 2: AccessPolicy Implementation
- Create AccessPolicy resources for each role (see templates above)
- Attach to ProjectMemberships
- Test that backend properly enforces restrictions
- Update all existing users with appropriate AccessPolicy

### Phase 3: User Configuration
- Create UI for role assignment (optional - can use existing invite flow)
- Store role in UserConfiguration.option as backup
- Allow admins to change roles

---

**Document Version**: 1.1
**Next Review**: After Phase 1 completion
**Author**: OpenCode AI Assistant
**Stakeholders**: Melissa Knudson, RN
