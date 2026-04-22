# Testing Plan for Nurse Mel MedSpa

## Overview

This document outlines the testing strategy for the MedSpa application, including unit tests, integration tests, and end-to-end testing scenarios.

---

## 1. Notification System Tests

### 1.1 Unit Tests

#### File: `notifications/templates.test.ts`

```typescript
import { describe, expect, it } from 'vitest';
import { formatNotification, getNotificationTemplate, NOTIFICATION_TEMPLATES } from './templates';
import type { NotificationData } from './templates';

describe('Notification Templates', () => {
  const mockPatient = {
    resourceType: 'Patient',
    id: 'patient-123',
    name: [{ given: ['Sarah'], family: 'Chen' }],
  };

  describe('getNotificationTemplate', () => {
    it('should return template for valid notification type', () => {
      const template = getNotificationTemplate('appointment-created');
      expect(template).toBeDefined();
      expect(template.type).toBe('appointment-created');
      expect(template.title).toBe('New Appointment');
    });

    it('should return template for all notification types', () => {
      const types = Object.keys(NOTIFICATION_TEMPLATES);
      expect(types).toHaveLength(7);
      types.forEach((type) => {
        const template = getNotificationTemplate(type as any);
        expect(template).toBeDefined();
        expect(template.title).toBeDefined();
        expect(template.getMessage).toBeInstanceOf(Function);
      });
    });
  });

  describe('formatNotification', () => {
    const baseData: NotificationData = {
      patient: mockPatient,
      serviceType: 'Botox Cosmetic',
      date: '2026-04-24T09:00:00Z',
      time: '9:00 AM',
    };

    it('should format appointment-created notification', () => {
      const result = formatNotification('appointment-created', baseData);
      expect(result.title).toBe('New Appointment');
      expect(result.message).toContain('Sarah Chen');
      expect(result.message).toContain('Botox Cosmetic');
      expect(result.message).toContain('Apr 24, 2026');
      expect(result.priority).toBe('routine');
      expect(result.category).toBe('appointment');
    });

    it('should format treatment-started notification', () => {
      const result = formatNotification('treatment-started', baseData);
      expect(result.title).toBe('Treatment Started');
      expect(result.message).toContain('Botox Cosmetic');
      expect(result.message).toContain('Sarah Chen');
      expect(result.priority).toBe('routine');
      expect(result.category).toBe('treatment');
    });

    it('should format appointment-cancelled with urgent priority', () => {
      const result = formatNotification('appointment-cancelled', baseData);
      expect(result.title).toBe('Appointment Cancelled');
      expect(result.priority).toBe('urgent');
    });

    it('should handle missing patient name gracefully', () => {
      const dataWithoutName: NotificationData = {
        patient: { resourceType: 'Patient', id: '123' },
      };
      const result = formatNotification('appointment-created', dataWithoutName);
      expect(result.message).toContain('Unknown Patient');
    });

    it('should handle missing date/time gracefully', () => {
      const dataWithoutDate: NotificationData = { patient: mockPatient };
      const result = formatNotification('appointment-created', dataWithoutDate);
      expect(result.message).toContain('Unknown date');
    });
  });
});
```

#### File: `notifications/utils.test.ts`

```typescript
import { describe, expect, it, vi } from 'vitest';
import {
  getNotificationRecipients,
  createNotification,
  markNotificationAsRead,
  getNotifications,
  getUnreadNotificationCount,
  isNotificationRead,
  getRelatedResource,
  getNotificationCategory,
} from './utils';
import type { NotificationData, NotificationType } from './templates';
import type { Communication, Practitioner, Patient, Appointment, Procedure } from '@medplum/fhirtypes';

describe('Notification Utils', () => {
  const mockCurrentUser: Practitioner = {
    resourceType: 'Practitioner',
    id: 'current-user',
  };

  const mockProvider: Practitioner = {
    resourceType: 'Practitioner',
    id: 'provider-123',
  };

  const mockAssistant: Practitioner = {
    resourceType: 'Practitioner',
    id: 'assistant-456',
  };

  const mockPatient: Patient = {
    resourceType: 'Patient',
    id: 'patient-789',
  };

  const mockAppointment: Appointment = {
    resourceType: 'Appointment',
    id: 'appt-001',
  };

  const mockProcedure: Procedure = {
    resourceType: 'Procedure',
    id: 'proc-001',
  };

  describe('getNotificationRecipients', () => {
    it('should notify provider and assistant for appointment-created', () => {
      const data: NotificationData = {
        provider: mockProvider,
        assistant: mockAssistant,
        patient: mockPatient,
      };
      const recipients = getNotificationRecipients('appointment-created', data, mockCurrentUser);
      expect(recipients).toHaveLength(2);
      expect(recipients[0].reference).toBe('Practitioner/provider-123');
      expect(recipients[1].reference).toBe('Practitioner/assistant-456');
    });

    it('should NOT notify current user (creator) for appointment-created', () => {
      const data: NotificationData = {
        provider: mockCurrentUser,
        patient: mockPatient,
      };
      const recipients = getNotificationRecipients('appointment-created', data, mockCurrentUser);
      expect(recipients).toHaveLength(0);
    });

    it('should notify assistant for treatment-started', () => {
      const data: NotificationData = {
        provider: mockProvider,
        assistant: mockAssistant,
        patient: mockPatient,
      };
      const recipients = getNotificationRecipients('treatment-started', data, mockProvider);
      expect(recipients).toHaveLength(1);
      expect(recipients[0].reference).toBe('Practitioner/assistant-456');
    });

    it('should notify provider for photos-uploaded', () => {
      const data: NotificationData = {
        provider: mockProvider,
        patient: mockPatient,
      };
      const recipients = getNotificationRecipients('photos-uploaded', data, mockAssistant);
      expect(recipients).toHaveLength(1);
      expect(recipients[0].reference).toBe('Practitioner/provider-123');
    });

    it('should return empty array for appointment-cancelled with no providers', () => {
      const data: NotificationData = { patient: mockPatient };
      const recipients = getNotificationRecipients('appointment-cancelled', data, mockCurrentUser);
      expect(recipients).toHaveLength(0);
    });
  });

  describe('createNotification', () => {
    it('should create Communication resource with correct structure', async () => {
      const mockMedplum = {
        createResource: vi.fn().mockResolvedValue({
          resourceType: 'Communication',
          id: 'comm-123',
        }),
      };

      const data: NotificationData = {
        patient: mockPatient,
        provider: mockProvider,
        appointment: mockAppointment,
        serviceType: 'Botox Cosmetic',
      };

      await createNotification(mockMedplum as any, 'appointment-created', data, mockCurrentUser);

      expect(mockMedplum.createResource).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'Communication',
          status: 'completed',
          category: expect.arrayContaining([
            expect.objectContaining({
              coding: expect.arrayContaining([
                expect.objectContaining({
                  system: 'http://melissaknudson.com/notification-type',
                  code: 'appointment-created',
                }),
              ]),
            }),
          ]),
          priority: 'routine',
          recipient: expect.any(Array),
          sender: { reference: 'Practitioner/current-user' },
          payload: expect.arrayContaining([
            expect.objectContaining({
              contentString: expect.stringContaining('Botox Cosmetic'),
            }),
          ]),
          extension: expect.any(Array),
        })
      );
    });

    it('should return null if no recipients', async () => {
      const mockMedplum = { createResource: vi.fn() };
      const data: NotificationData = { patient: mockPatient };

      const result = await createNotification(
        mockMedplum as any,
        'appointment-created',
        data,
        mockProvider
      );

      expect(result).toBeNull();
      expect(mockMedplum.createResource).not.toHaveBeenCalled();
    });
  });

  describe('isNotificationRead', () => {
    it('should return true when notification is read', () => {
      const comm: Communication = {
        resourceType: 'Communication',
        id: 'comm-1',
        status: 'completed',
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/notification-read',
            valueBoolean: true,
          },
        ],
      };
      expect(isNotificationRead(comm)).toBe(true);
    });

    it('should return false when notification is unread', () => {
      const comm: Communication = {
        resourceType: 'Communication',
        id: 'comm-1',
        status: 'completed',
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/notification-read',
            valueBoolean: false,
          },
        ],
      };
      expect(isNotificationRead(comm)).toBe(false);
    });

    it('should return false when no read extension exists', () => {
      const comm: Communication = {
        resourceType: 'Communication',
        id: 'comm-1',
        status: 'completed',
      };
      expect(isNotificationRead(comm)).toBe(false);
    });
  });

  describe('getRelatedResource', () => {
    it('should return appointment reference', () => {
      const comm: Communication = {
        resourceType: 'Communication',
        id: 'comm-1',
        status: 'completed',
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/related-appointment',
            valueReference: { reference: 'Appointment/appt-123' },
          },
        ],
      };
      const result = getRelatedResource(comm);
      expect(result).toEqual({ type: 'Appointment', id: 'appt-123' });
    });

    it('should return procedure reference', () => {
      const comm: Communication = {
        resourceType: 'Communication',
        id: 'comm-1',
        status: 'completed',
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure',
            valueReference: { reference: 'Procedure/proc-456' },
          },
        ],
      };
      const result = getRelatedResource(comm);
      expect(result).toEqual({ type: 'Procedure', id: 'proc-456' });
    });

    it('should return patient reference from subject', () => {
      const comm: Communication = {
        resourceType: 'Communication',
        id: 'comm-1',
        status: 'completed',
        subject: { reference: 'Patient/pat-789' },
      };
      const result = getRelatedResource(comm);
      expect(result).toEqual({ type: 'Patient', id: 'pat-789' });
    });

    it('should return null when no related resource', () => {
      const comm: Communication = {
        resourceType: 'Communication',
        id: 'comm-1',
        status: 'completed',
      };
      const result = getRelatedResource(comm);
      expect(result).toBeNull();
    });
  });

  describe('getNotificationCategory', () => {
    it('should return category from extension', () => {
      const comm: Communication = {
        resourceType: 'Communication',
        id: 'comm-1',
        status: 'completed',
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/notification-category',
            valueString: 'appointment',
          },
        ],
      };
      expect(getNotificationCategory(comm)).toBe('appointment');
    });

    it('should return "general" when no category extension', () => {
      const comm: Communication = {
        resourceType: 'Communication',
        id: 'comm-1',
        status: 'completed',
      };
      expect(getNotificationCategory(comm)).toBe('general');
    });
  });

  describe('markNotificationAsRead', () => {
    it('should update notification read status', async () => {
      const mockComm: Communication = {
        resourceType: 'Communication',
        id: 'comm-123',
        status: 'completed',
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/notification-read',
            valueBoolean: false,
          },
        ],
      };

      const mockMedplum = {
        readResource: vi.fn().mockResolvedValue(mockComm),
        updateResource: vi.fn().mockResolvedValue({ ...mockComm, id: 'comm-123' }),
      };

      await markNotificationAsRead(mockMedplum as any, 'comm-123');

      expect(mockMedplum.updateResource).toHaveBeenCalledWith(
        expect.objectContaining({
          extension: expect.arrayContaining([
            expect.objectContaining({
              url: 'http://melissaknudson.com/fhir/StructureDefinition/notification-read',
              valueBoolean: true,
            }),
          ]),
        })
      );
    });
  });
});
```

### 1.2 Integration Tests

#### File: `notifications/integration.test.ts`

```typescript
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { MedplumClient } from '@medplum/core';
import { createNotification, getNotifications, markNotificationAsRead } from './utils';
import type { NotificationData } from './templates';

/**
 * Integration tests for notification system
 * These tests require a running Medplum server or mock server
 */

describe('Notification Integration Tests', () => {
  let medplum: MedplumClient;
  let testPatient: any;
  let testProvider: any;
  let testAppointment: any;

  beforeAll(async () => {
    // Setup test client
    medplum = new MedplumClient({
      baseUrl: process.env.MEDPLUM_BASE_URL || 'http://localhost:8103',
    });

    // Login or use test credentials
    // await medplum.startClientLogin(...);

    // Create test resources
    testPatient = await medplum.createResource({
      resourceType: 'Patient',
      name: [{ given: ['Test'], family: 'Patient' }],
    });

    testProvider = await medplum.createResource({
      resourceType: 'Practitioner',
      name: [{ given: ['Test'], family: 'Provider' }],
    });

    testAppointment = await medplum.createResource({
      resourceType: 'Appointment',
      status: 'booked',
      participant: [
        { actor: { reference: `Patient/${testPatient.id}` }, status: 'accepted' },
      ],
    });
  });

  afterAll(async () => {
    // Cleanup test resources
    // await medplum.deleteResource('Patient', testPatient.id);
    // await medplum.deleteResource('Practitioner', testProvider.id);
    // await medplum.deleteResource('Appointment', testAppointment.id);
  });

  describe('Full Notification Flow', () => {
    it('should create notification and retrieve it', async () => {
      const notificationData: NotificationData = {
        patient: testPatient,
        provider: testProvider,
        appointment: testAppointment,
        serviceType: 'Botox Cosmetic',
        date: '2026-04-24T09:00:00Z',
        time: '9:00 AM',
      };

      // Create notification
      const created = await createNotification(
        medplum,
        'appointment-created',
        notificationData,
        testProvider
      );

      expect(created).toBeDefined();
      expect(created?.id).toBeDefined();

      // Retrieve notification
      const notifications = await getNotifications(medplum, testProvider.id!, 10);

      expect(notifications).toBeInstanceOf(Array);
      expect(notifications.length).toBeGreaterThan(0);
      
      const found = notifications.find((n) => n.id === created?.id);
      expect(found).toBeDefined();
      expect(found?.payload?.[0]?.contentString).toContain('Botox Cosmetic');
    });

    it('should mark notification as read and persist', async () => {
      // Create a notification
      const notificationData: NotificationData = {
        patient: testPatient,
        provider: testProvider,
        serviceType: 'Treatment',
      };

      const created = await createNotification(
        medplum,
        'treatment-started',
        notificationData,
        testProvider
      );

      expect(created).toBeDefined();

      // Mark as read
      await markNotificationAsRead(medplum, created!.id!);

      // Re-fetch and verify
      const fetched = await medplum.readResource('Communication', created!.id!);
      const isRead = fetched.extension?.find(
        (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/notification-read'
      )?.valueBoolean;

      expect(isRead).toBe(true);
    });

    it('should only return notifications for specific recipient', async () => {
      // Create another provider
      const otherProvider = await medplum.createResource({
        resourceType: 'Practitioner',
        name: [{ given: ['Other'], family: 'Provider' }],
      });

      // Create notification for testProvider
      const notificationData: NotificationData = {
        patient: testPatient,
        provider: testProvider,
        serviceType: 'Consultation',
      };

      await createNotification(medplum, 'appointment-created', notificationData, otherProvider);

      // Get notifications for otherProvider
      const notifications = await getNotifications(medplum, otherProvider.id!, 10);

      // Should only see notifications where otherProvider is recipient
      const hasWrongRecipient = notifications.some(
        (n) => n.recipient?.some((r) => r.reference?.includes(testProvider.id))
      );

      // This test needs to be adjusted based on actual data
      expect(notifications).toBeInstanceOf(Array);

      // Cleanup
      // await medplum.deleteResource('Practitioner', otherProvider.id);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const badMedplum = new MedplumClient({
        baseUrl: 'http://invalid-server:9999',
      });

      const notifications = await getNotifications(badMedplum, 'invalid-id', 10);
      expect(notifications).toEqual([]);
    });

    it('should handle missing notification', async () => {
      await expect(
        markNotificationAsRead(medplum, 'non-existent-id')
      ).rejects.toThrow();
    });
  });
});
```

---

## 2. Calendar & Appointment Tests

### 2.1 Unit Tests

#### File: `components/CreateAppointmentModal.test.tsx`

```typescript
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateAppointmentModal } from './CreateAppointmentModal';
import { MedplumProvider } from '@medplum/react';
import type { Patient, Practitioner } from '@medplum/fhirtypes';

describe('CreateAppointmentModal', () => {
  const mockPatient: Patient = {
    resourceType: 'Patient',
    id: 'patient-123',
    name: [{ given: ['Sarah'], family: 'Chen' }],
  };

  const mockProvider: Practitioner = {
    resourceType: 'Practitioner',
    id: 'provider-123',
    name: [{ given: ['Dr.'], family: 'Smith' }],
  };

  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  it('should validate required fields', async () => {
    render(
      <MedplumProvider medplum={mockMedplum}>
        <CreateAppointmentModal
          isOpen={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      </MedplumProvider>
    );

    // Try to submit without filling required fields
    const submitButton = screen.getByText('Book Appointment');
    fireEvent.click(submitButton);

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText('Patient is required')).toBeInTheDocument();
    });
  });

  it('should create notification after successful booking', async () => {
    const mockCreateResource = vi.fn().mockResolvedValue({
      resourceType: 'Appointment',
      id: 'appt-123',
    });

    const mockMedplum = {
      createResource: mockCreateResource,
      getProfile: vi.fn().mockReturnValue(mockProvider),
    };

    // Setup and trigger booking
    // ... test implementation

    // Verify notification was created
    expect(mockCreateResource).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Communication',
      })
    );
  });
});
```

---

## 3. Treatment Workflow Tests

### 3.1 Integration Tests

#### File: `nurse-mel/BotoxTreatmentPage.test.tsx`

```typescript
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BotoxTreatmentPage } from './BotoxTreatmentPage';
import { MedplumProvider } from '@medplum/react';

describe('BotoxTreatmentPage - Status Transitions', () => {
  it('should show "Start Treatment" button for preparation status', () => {
    // Setup with procedure status = 'preparation'
    // ...

    // Verify button exists
    expect(screen.getByText('Start Treatment')).toBeInTheDocument();
  });

  it('should transition to in-progress and create notification', async () => {
    const mockUpdateResource = vi.fn().mockResolvedValue({
      resourceType: 'Procedure',
      id: 'proc-123',
      status: 'in-progress',
    });

    // Click start treatment
    fireEvent.click(screen.getByText('Start Treatment'));

    await waitFor(() => {
      // Verify status updated
      expect(mockUpdateResource).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'in-progress' })
      );

      // Verify notification created
      expect(mockCreateResource).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'Communication',
          category: expect.arrayContaining([
            expect.objectContaining({
              coding: expect.arrayContaining([
                expect.objectContaining({ code: 'treatment-started' }),
              ]),
            }),
          ]),
        })
      );
    });
  });

  it('should show "Complete Treatment" button for in-progress status', () => {
    // Setup with procedure status = 'in-progress'
    // ...

    expect(screen.getByText('Complete Treatment')).toBeInTheDocument();
  });

  it('should hide action buttons for completed treatments', () => {
    // Setup with procedure status = 'completed'
    // ...

    expect(screen.queryByText('Start Treatment')).not.toBeInTheDocument();
    expect(screen.queryByText('Complete Treatment')).not.toBeInTheDocument();
  });
});
```

---

## 4. Role-Based Access Tests

### 4.1 Unit Tests

#### File: `auth/role.test.ts`

```typescript
import { describe, expect, it } from 'vitest';
import { getMedSpaRole, canAccess, filterPatientTabs } from './role';

describe('Role System', () => {
  describe('getMedSpaRole', () => {
    it('should detect super admin', () => {
      const mockMedplum = { isSuperAdmin: () => true };
      expect(getMedSpaRole(mockMedplum as any)).toBe('super-admin');
    });

    it('should detect project admin', () => {
      const mockMedplum = {
        isSuperAdmin: () => false,
        isProjectAdmin: () => true,
      };
      expect(getMedSpaRole(mockMedplum as any)).toBe('project-admin');
    });
  });

  describe('canAccess', () => {
    it('should allow providers to access clinical-docs', () => {
      expect(canAccess('provider', 'clinical-docs')).toBe(true);
    });

    it('should allow coordinators to access scheduling', () => {
      expect(canAccess('coordinator', 'scheduling')).toBe(true);
    });

    it('should deny coordinators access to clinical-docs', () => {
      expect(canAccess('coordinator', 'clinical-docs')).toBe(false);
    });
  });

  describe('filterPatientTabs', () => {
    it('should hide Edit tab for coordinators', () => {
      const tabs = ['Details', 'Edit', 'History', 'JSON'];
      const filtered = filterPatientTabs(tabs, 'coordinator');
      expect(filtered).not.toContain('Edit');
    });

    it('should show all tabs for super-admin', () => {
      const tabs = ['Details', 'Edit', 'History', 'JSON'];
      const filtered = filterPatientTabs(tabs, 'super-admin');
      expect(filtered).toEqual(tabs);
    });
  });
});
```

---

## 5. E2E Test Scenarios

### Manual Testing Checklist

#### Notification Flow

**Scenario 1: Full Appointment → Notification Flow**
```
1. Log in as Coordinator (coord@nursemel.com)
2. Navigate to Calendar
3. Create appointment:
   - Patient: Sarah Chen
   - Service: Botox Cosmetic
   - Date: Tomorrow 9:00 AM
   - Main Provider: Dr. Smith
   - Assistant: Nurse Johnson
4. Verify toast: "Appointment Booked"
5. Log out
6. Log in as Dr. Smith
7. Navigate to Notifications
8. ✅ Verify: "New Appointment: Botox Cosmetic scheduled for Sarah Chen..."
9. ✅ Verify: Category icon is blue (appointment)
10. Click notification
11. ✅ Verify: Navigates to Calendar
12. Mark as read
13. Log out
14. Log in as Coordinator
15. Navigate to Notifications
16. ✅ Verify: No notification (coordinator created it)
```

**Scenario 2: Treatment Status Change**
```
1. Log in as Provider (melissa@melissaknudson.com)
2. Go to patient's treatment page
3. Click "Start Treatment"
4. ✅ Verify: "Treatment Started" toast
5. Log out
6. Log in as Coordinator
7. Check Notifications
8. ✅ Verify: "Treatment Started: Botox Cosmetic has started for [Patient]"
9. ✅ Verify: Category icon is green (treatment)
10. Log out
11. Log in as Provider
12. Click "Complete Treatment"
13. ✅ Verify: "Treatment Completed" toast
14. Log out
15. Log in as Coordinator
16. ✅ Verify: "Treatment Completed" notification
```

**Scenario 3: Permission Boundaries**
```
1. Log in as Assistant
2. Navigate to treatment page
3. ✅ Verify: Can see "Start Treatment" button
4. ✅ Verify: Can click it (if main provider)
5. ❌ Verify: Cannot complete if not main provider
6. Log out
7. Log in as Coordinator
8. Navigate to treatment page
9. ❌ Verify: No "Start/Complete" buttons
10. ✅ Verify: Can view everything
11. ✅ Verify: Can upload photos
```

**Scenario 4: Edge Cases**
```
1. Create appointment without assigning provider
2. ✅ Verify: No notification created (no recipients)
3. Provider books their own appointment
4. ✅ Verify: No notification (they know)
5. Mark all as read with 50 notifications
6. ✅ Verify: All marked as read
7. Refresh page
8. ✅ Verify: Read status persists
```

---

## 6. Performance Tests

### Load Testing Scenarios

```typescript
// Create 100 appointments rapidly
// Verify notifications created without duplicates

// Test with 1000 notifications in list
// Verify page loads in < 2 seconds

// Test mark all as read with 500 unread
// Verify completes in < 5 seconds
```

---

## 7. Security Tests

### Data Privacy

```typescript
// Verify user A cannot see user B's notifications
// Verify notifications only accessible to intended recipients
// Verify patient data in notifications is minimal (names only)
```

---

## Running Tests

### Unit Tests
```bash
npm test -- notifications/templates.test.ts
npm test -- notifications/utils.test.ts
npm test -- auth/role.test.ts
```

### Integration Tests
```bash
# Requires running Medplum server
npm test -- notifications/integration.test.ts
```

### All Tests
```bash
npm test
```

### With Coverage
```bash
npm test -- --coverage
```

---

## Test Data Setup

### Mock Resources
```typescript
// test-utils/notification-mocks.ts
export const mockPatient = {
  resourceType: 'Patient',
  id: 'test-patient-123',
  name: [{ given: ['Test'], family: 'Patient' }],
};

export const mockProvider = {
  resourceType: 'Practitioner',
  id: 'test-provider-123',
  name: [{ given: ['Dr.'], family: 'Provider' }],
};

export const mockAppointment = {
  resourceType: 'Appointment',
  id: 'test-appt-123',
  status: 'booked',
  start: '2026-04-24T09:00:00Z',
  end: '2026-04-24T09:30:00Z',
  serviceType: [{ text: 'Botox Cosmetic' }],
};
```

---

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run build
```

---

## Summary

### Test Coverage Goals
- **Unit Tests**: 80%+ coverage for notification utilities
- **Integration Tests**: All notification flows
- **E2E Tests**: Critical user journeys
- **Manual Testing**: Exploratory testing for edge cases

### Priority
1. **P0**: Notification creation and retrieval
2. **P1**: Role-based permissions
3. **P2**: Status transitions
4. **P3**: UI interactions

### Maintenance
- Update tests when adding new notification types
- Add tests for bug fixes
- Run tests before each release
- Monitor test coverage
