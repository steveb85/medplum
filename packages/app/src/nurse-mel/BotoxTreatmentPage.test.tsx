import { MockClient } from '@medplum/mock';
import { render, screen, waitFor } from '../test-utils/render';
import { BotoxTreatmentPage } from '../nurse-mel/BotoxTreatmentPage';
import { MedplumProvider } from '@medplum/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Patient, Procedure, Appointment } from '@medplum/fhirtypes';

describe('BotoxTreatmentPage', () => {
  let medplum: MockClient;
  let mockPatient: Patient;
  let mockProcedure: Procedure;
  let mockAppointment: Appointment;

  beforeEach(async () => {
    medplum = new MockClient();

    mockPatient = await medplum.createResource<Patient>({
      resourceType: 'Patient',
      name: [{ given: ['Jane'], family: 'Doe' }],
    });

    mockAppointment = await medplum.createResource<Appointment>({
      resourceType: 'Appointment',
      status: 'booked',
      start: '2026-01-15T10:00:00Z',
      end: '2026-01-15T11:00:00Z',
      participant: [{ actor: { reference: `Patient/${mockPatient.id}` }, status: 'accepted' }],
    });

    mockProcedure = await medplum.createResource<Procedure>({
      resourceType: 'Procedure',
      status: 'preparation',
      subject: { reference: `Patient/${mockPatient.id}` },
      code: { text: 'Botox Treatment' },
      extension: [{
        url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
        valueReference: { reference: `Appointment/${mockAppointment.id}` },
      }],
    });
  });

  const renderPage = (procedureId = mockProcedure.id, patientId = mockPatient.id) => {
    return render(
      <MedplumProvider medplum={medplum}>
        <MemoryRouter initialEntries={[`/Patient/${patientId}/botox-treatment?procedureId=${procedureId}`]}>
          <Routes>
            <Route path="/Patient/:id/botox-treatment" element={<BotoxTreatmentPage />} />
          </Routes>
        </MemoryRouter>
      </MedplumProvider>
    );
  };

  describe('Page Display', () => {
    test('should load procedure data', async () => {
      renderPage();
      expect(await screen.findByText('Treatment Details')).toBeInTheDocument();
    });

    test('should display patient name', async () => {
      renderPage();
      expect(await screen.findByText(/Jane Doe/i)).toBeInTheDocument();
    });

    test('should show status badge', async () => {
      renderPage();
      const scheduled = await screen.findAllByText('Scheduled');
      expect(scheduled.length).toBeGreaterThanOrEqual(1);
    });
  });
});
