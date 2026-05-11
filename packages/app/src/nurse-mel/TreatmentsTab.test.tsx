import { MockClient } from '@medplum/mock';
import { render, screen, waitFor } from '../test-utils/render';
import { TreatmentsTab } from './TreatmentsTab';
import { MedplumProvider } from '@medplum/react';
import { Patient } from '@medplum/fhirtypes';
import { MemoryRouter } from 'react-router';

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
      <MemoryRouter>
        <MedplumProvider medplum={medplum}>
          <TreatmentsTab patientId={mockPatient.id ?? ''} />
        </MedplumProvider>
      </MemoryRouter>
    );
  };

  describe('Display', () => {
    test('should render the component', async () => {
      renderTab();
      expect(await screen.findByText('Treatments')).toBeInTheDocument();
    });

    test('should show table headers with treatments', async () => {
      await medplum.createResource({
        resourceType: 'Appointment',
        status: 'booked',
        start: '2026-02-01T10:00:00Z',
        participant: [{ actor: { reference: `Patient/${mockPatient.id}` }, status: 'accepted' }],
      });
      renderTab();
      expect(await screen.findByText('Service')).toBeInTheDocument();
      expect(screen.getByText('Date')).toBeInTheDocument();
      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
    });

    test('should show "New Treatment" button', async () => {
      renderTab();
      expect(await screen.findByText('New Treatment')).toBeInTheDocument();
    });

    test('should show empty state when no treatments', async () => {
      renderTab();
      expect(await screen.findByText(/No treatments yet/i)).toBeInTheDocument();
    });

    test('should list patient appointments', async () => {
      await medplum.createResource({
        resourceType: 'Appointment',
        status: 'booked',
        start: '2026-02-01T10:00:00Z',
        participant: [{ actor: { reference: `Patient/${mockPatient.id}` }, status: 'accepted' }],
      });
      renderTab();
      expect(await screen.findByText('Appointment')).toBeInTheDocument();
    });

    test('should show Booking badge for appointments', async () => {
      await medplum.createResource({
        resourceType: 'Appointment',
        status: 'booked',
        start: '2026-02-01T10:00:00Z',
        participant: [{ actor: { reference: `Patient/${mockPatient.id}` }, status: 'accepted' }],
      });
      renderTab();
      expect(await screen.findByText('Booking')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    test('should distinguish appointments vs procedures', async () => {
      await medplum.createResource({
        resourceType: 'Appointment',
        status: 'booked',
        start: '2026-02-01T10:00:00Z',
        participant: [{ actor: { reference: `Patient/${mockPatient.id}` }, status: 'accepted' }],
      });
      renderTab();
      const bookingBadges = await screen.findAllByText('Booking');
      expect(bookingBadges.length).toBeGreaterThanOrEqual(1);
    });
  });
});
