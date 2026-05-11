import { MockClient } from '@medplum/mock';
import { render, screen, waitFor, act } from '../test-utils/render';
import { BookingDetailPage } from './BookingDetailPage';
import { MedplumProvider } from '@medplum/react';
import type { Patient, Appointment, ServiceRequest, Practitioner, Communication } from '@medplum/fhirtypes';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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
        { system: 'email', value: 'jane@example.com' }
      ]
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
        { actor: { reference: `Practitioner/${mockProvider.id}` }, status: 'accepted' }
      ],
      extension: [{
        url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
        extension: [
          { url: 'status', valueString: 'pending' },
          { url: 'amount', valueInteger: 200 }
        ]
      }]
    });

    mockServiceRequest = await medplum.createResource<ServiceRequest>({
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      subject: { reference: `Patient/${mockPatient.id}` },
      code: { text: 'Botox Treatment' },
      extension: [{
        url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
        valueReference: { reference: `Appointment/${mockAppointment.id}` }
      }]
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
    test.todo('should load appointment data');
    test.todo('should display patient name');
    test.todo('should display patient phone');
    test.todo('should display patient email');
    test.todo('should display appointment date');
    test.todo('should display appointment time');
    test.todo('should display duration');
    test.todo('should display service type');
    test.todo('should display assigned provider');
    test.todo('should display assigned assistant if any');
    test.todo('should display assigned room');
    test.todo('should display required equipment');
    test.todo('should show loading state initially');
    test.todo('should handle loading errors');
    test.todo('should show 404 for invalid appointment ID');
  });

  describe('Deposit Management', () => {
    test.todo('should display deposit status');
    test.todo('should display deposit amount');
    test.todo('should show "Send Payment Link" button when pending');
    test.todo('should show "Send Payment Link" button when requested');
    test.todo('should hide "Send Payment Link" when paid');
    test.todo('should hide "Send Payment Link" when waived');
    test.todo('should send SMS when clicking "Send Payment Link"');
    test.todo('should send Email when clicking "Send Payment Link"');
    test.todo('should show confirmation after sending link');
    test.todo('should show "Mark as Paid" button');
    test.todo('should show modal for entering payment details');
    test.todo('should update status to paid after marking');
    test.todo('should show "Waive Deposit" button');
    test.todo('should show modal for waiver reason');
    test.todo('should update status to waived after waiving');
    test.todo('should show "Undo Payment" button for manual payments');
    test.todo('should revert status when undoing payment');
    test.todo('should show "Refund" button for paid deposits');
    test.todo('should process refund correctly');
    test.todo('should create AuditEvents for all deposit actions');
    test.todo('should allow custom deposit amount override');
    test.todo('should validate deposit amount');
  });

  describe('Status Management', () => {
    test.todo('should display current status');
    test.todo('should show "Approve" action when pending');
    test.todo('should change status to booked when approved');
    test.todo('should show "Mark Arrived" action when booked');
    test.todo('should change status to arrived when marked');
    test.todo('should show "Mark No-Show" action when booked');
    test.todo('should change status to noshow when marked');
    test.todo('should show "Cancel" action');
    test.todo('should require cancellation reason');
    test.todo('should change status to cancelled');
    test.todo('should show "Uncancel" action when cancelled');
    test.todo('should revert to previous status when uncancelled');
    test.todo('should create AuditEvents for status changes');
  });

  describe('Activity Timeline', () => {
    test.todo('should display activity history');
    test.todo('should show booking creation event');
    test.todo('should show deposit status changes');
    test.todo('should show payment events');
    test.todo('should show status changes');
    test.todo('should show edit history');
    test.todo('should show WHO for each action');
    test.todo('should show WHEN for each action');
    test.todo('should show WHAT for each action');
    test.todo('should sort by timestamp descending');
    test.todo('should load more on scroll');
  });

  describe('Edit Booking', () => {
    test.todo('should show "Edit Booking" button');
    test.todo('should open CreateAppointmentModalV3 in edit mode');
    test.todo('should pre-fill current data');
    test.todo('should update booking on save');
    test.todo('should refresh page after edit');
    test.todo('should create AuditEvent for edit');
    test.todo('should hide edit button for non-editable statuses');
  });

  describe('Real-time Updates', () => {
    test.todo('should poll for updates');
    test.todo('should refresh when payment received');
    test.todo('should show notification on status change');
    test.todo('should update deposit status in real-time');
  });

  describe('Role-Based Access', () => {
    test.todo('should allow coordinators to view');
    test.todo('should allow coordinators to manage deposits');
    test.todo('should allow coordinators to change status');
    test.todo('should allow providers to view');
    test.todo('should allow providers to manage deposits');
    test.todo('should allow providers to change status');
    test.todo('should restrict based on assignment');
  });
});
