import { MockClient } from '@medplum/mock';
import { render, screen, waitFor, act } from '../test-utils/render';
import { BookingDetailPage } from './BookingDetailPage';
import { MedplumProvider } from '@medplum/react';
import { Patient, Appointment, ServiceRequest, Practitioner } from '@medplum/fhirtypes';
import { MemoryRouter, Route, Routes } from 'react-router';

describe('BookingDetailPage', () => {
  let medplum: MockClient;
  let mockPatient: Patient;
  let mockAppointment: Appointment;
  let mockServiceRequest: ServiceRequest;
  let mockProvider: Practitioner;

  beforeEach(async () => {
    medplum = new MockClient();

    mockPatient = await medplum.createResource<Patient>({
      resourceType: 'Patient',
      name: [{ given: ['Jane'], family: 'Doe' }],
      telecom: [
        { system: 'phone', value: '555-1234' },
        { system: 'email', value: 'jane@example.com' },
      ],
    });

    mockProvider = await medplum.createResource<Practitioner>({
      resourceType: 'Practitioner',
      name: [{ given: ['Nurse'], family: 'Mel' }],
    });

    mockAppointment = await medplum.createResource<Appointment>({
      resourceType: 'Appointment',
      status: 'pending',
      start: '2026-01-15T10:00:00Z',
      end: '2026-01-15T11:00:00Z',
      participant: [
        { actor: { reference: `Patient/${mockPatient.id}` }, status: 'accepted' },
        { actor: { reference: `Practitioner/${mockProvider.id}` }, status: 'accepted' },
      ],
    });

    mockServiceRequest = await medplum.createResource<ServiceRequest>({
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      subject: { reference: `Patient/${mockPatient.id}` },
      code: { text: 'Botox Treatment' },
      extension: [{
        url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
        valueReference: { reference: `Appointment/${mockAppointment.id}` },
      }],
    });
  });

  const renderPage = (appointmentId = mockAppointment.id) => {
    return render(
      <MedplumProvider medplum={medplum}>
        <MemoryRouter initialEntries={[`/bookings/${appointmentId}`]}>
          <Routes>
            <Route path="/bookings/:id" element={<BookingDetailPage />} />
          </Routes>
        </MemoryRouter>
      </MedplumProvider>
    );
  };

  describe('Page Display', () => {
    test('should render the page', async () => {
      renderPage();
      expect(await screen.findByText('Booking Details')).toBeInTheDocument();
    });

    test('should display patient name', async () => {
      renderPage();
      expect(await screen.findByText(/Jane Doe/i)).toBeInTheDocument();
    });

    test('should display patient phone', async () => {
      renderPage();
      expect(await screen.findByText('555-1234')).toBeInTheDocument();
    });

    test('should display patient email', async () => {
      renderPage();
      expect(await screen.findByText('jane@example.com')).toBeInTheDocument();
    });
  });
});
