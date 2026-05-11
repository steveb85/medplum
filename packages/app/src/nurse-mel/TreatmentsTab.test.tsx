import { MockClient } from '@medplum/mock';
import { render, screen, waitFor } from '../test-utils/render';
import { TreatmentsTab } from './TreatmentsTab';
import { MedplumProvider } from '@medplum/react';
import type { Patient } from '@medplum/fhirtypes';

describe('TreatmentsTab', () => {
  let medplum: MockClient;
  let mockPatient: Patient;

  beforeEach(async () => {
    medplum = new MockClient();
    mockPatient = await medplum.createResource<Patient>({
      resourceType: 'Patient',
      name: [{ given: ['Jane'], family: 'Doe' }],
    });
  });

  const renderTab = () => {
    return render(
      <MedplumProvider medplum={medplum}>
        <TreatmentsTab patient={mockPatient} />
      </MedplumProvider>
    );
  };

  describe('Display', () => {
    test.todo('should show appointments section');
    test.todo('should show procedures section');
    test.todo('should list patient appointments');
    test.todo('should list patient procedures');
    test.todo('should show status badges');
    test.todo('should show empty state when no treatments');
  });

  describe('Navigation', () => {
    test.todo('should navigate to appointment detail');
    test.todo('should navigate to procedure detail');
    test.todo('should distinguish appointments vs procedures');
    test.todo('should show booking badges for appointments');
  });

  describe('Filtering', () => {
    test.todo('should filter by status');
    test.todo('should filter by date range');
    test.todo('should show upcoming treatments');
    test.todo('should show past treatments');
  });
});
