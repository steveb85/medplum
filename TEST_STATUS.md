# Test Status Report - May 9, 2026

## Summary

**Total Test Suites:** 77
**Passing:** 64 (83%)
**Failing:** 13 (17%)
**Total Tests:** 1,067
- Passing: 335
- Failing: 36
- Todo (new scaffold): 696

---

## ✅ PASSING (64 suites)

All existing core Medplum tests pass, including:
- Authentication tests
- FHIR resource tests
- Core component tests
- API tests
- Utility tests

---

## ❌ FAILING (13 suites, 36 tests)

### Root Cause
Most failures are caused by **role-based tab filtering** in `auth/role.ts`:
- `filterPatientTabs()` hides tabs for non-admin users
- `filterMenuLinks()` hides certain menu items
- Tests run as regular users, so tabs are filtered out

### Failing Tests by Category

#### 1. Tab Filtering Issues (11 suites)
These tests look for tabs that are now hidden for non-admin users:

| Test File | Missing Tab | Filtered By |
|-----------|-------------|-------------|
| `EditPage.test.tsx` | Edit | filterPatientTabs |
| `ResourcePage.test.tsx` | History | filterPatientTabs |
| `PreviewPage.test.tsx` | Preview | filterPatientTabs |
| `AppsPage.test.tsx` | Apps | filterPatientTabs |
| `ChecklistPage.test.tsx` | Checklist | filterPatientTabs |
| `BotEditor.test.tsx` | Editor | filterPatientTabs |
| `ToolsPage.test.tsx` | Tools | filterPatientTabs |
| `SubscriptionsPage.test.tsx` | Subscriptions | filterPatientTabs |
| `QuestionnaireResponsePage.test.tsx` | Sort menu | UI change |
| `ProjectPage.test.tsx` | Users | Menu filtering |
| `SitesPage.test.tsx` | Project Sites | Menu filtering |

**Fix:** Mock `isProjectAdmin()` or `isSuperAdmin()` in tests to show all tabs.

#### 2. Menu/Text Changes (2 suites)
Tests looking for text that may have changed:

| Test File | Issue |
|-----------|-------|
| `App.test.tsx` | "Active Orders" not found - menu changed? |
| `HomePage.test.tsx` | "New..." button text changed |

**Fix:** Update text matchers or check for new UI text.

#### 3. Mock Configuration (1 suite)
Test infrastructure issue:

| Test File | Issue |
|-----------|-------|
| `SignInPage.test.tsx` | `Cannot read properties of undefined (reading 'superAdmin')` |

**Fix:** MockClient needs superAdmin method configured.

---

## 🔧 REQUIRED FIXES

### High Priority (Breaking Tests)
These tests need to be fixed to maintain CI/CD:

1. **All tab-related tests** - Add admin mocking
2. **SignInPage.test.tsx** - Fix mock configuration

### Medium Priority (Nice to have)
These are less critical but should be fixed:

3. **Text-based tests** - Update text matchers
4. **HomePage.test.tsx** - Update button selectors

---

## 📊 FIX ESTIMATES

| Fix Type | Count | Est. Time |
|----------|-------|-----------|
| Add admin mocking | 11 tests | 2-3 hours |
| Fix mock configuration | 1 test | 30 min |
| Update text matchers | 2 tests | 1 hour |
| **TOTAL** | **14 tests** | **3-4 hours** |

---

## ✅ ALREADY FIXED

- ✅ `AuditEventPage.test.tsx` - Added `isProjectAdmin()` mock

---

## 🎯 RECOMMENDATION

### Option A: Quick Fix (Today)
Fix the 13 failing tests by adding admin mocking:
1. Add `jest.spyOn(medplum, 'isProjectAdmin').mockReturnValue(true)` to each test
2. Fix SignInPage mock issue
3. Commit fixes

**Time:** 3-4 hours
**Result:** All 77 test suites passing

### Option B: Skip for Now
Skip these tests temporarily and focus on new tests:
1. Add `.skip` to failing tests
2. Note in AGENTS.md
3. Come back later

**Time:** 30 minutes
**Result:** Clean test run, but tech debt

### Option C: Comprehensive Fix
Review all role-based filtering and update tests properly:
1. Audit all tab/menu filtering
2. Create role-specific test variants
3. Test both admin and non-admin views

**Time:** 1-2 days
**Result:** Thorough test coverage for role filtering

---

## 📝 NOTES

### Why These Tests Fail
Your `filterPatientTabs()` function removes tabs for non-admin users:
```typescript
const adminOnlyTabs = ['Event', 'Blame', 'JSON', 'Apps', 'Profiles', 'Export', 'History', 'Accounts'];
```

Tests run as regular users (MockClient default), so these tabs don't exist.

### The Fix Pattern
```typescript
// Before (fails)
test('Renders', async () => {
  // ... setup
  const historyTab = screen.getByRole('tab', { name: 'History' }); // FAILS
});

// After (passes)
test('Renders', async () => {
  jest.spyOn(medplum, 'isProjectAdmin').mockReturnValue(true); // ADD THIS
  // ... setup
  const historyTab = screen.getByRole('tab', { name: 'History' }); // PASSES
});
```

### Alternative: Test Filtered View
Instead of mocking as admin, test that tabs ARE filtered for regular users:
```typescript
test('Hides admin tabs for regular users', async () => {
  // ... setup as regular user
  expect(screen.queryByRole('tab', { name: 'History' })).not.toBeInTheDocument();
});
```

---

## 🚀 NEXT STEPS

**Immediate:**
1. Decide: Fix, skip, or comprehensive fix?
2. If fixing: I can batch-fix all 13 test files
3. If skipping: Add `.skip` and document

**After fixes:**
1. Run full test suite to verify all pass
2. Commit fixes
3. Continue with new test implementation (Phase A)

---

**Last Updated:** May 9, 2026
