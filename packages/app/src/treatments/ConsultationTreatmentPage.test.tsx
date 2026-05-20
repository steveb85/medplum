import { MockClient } from '@medplum/mock';
import { render, screen, waitFor } from '../test-utils/render';
import { ConsultationTreatmentPage } from './ConsultationTreatmentPage';
import { MedplumProvider } from '@medplum/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Patient, Procedure, Appointment } from '@medplum/fhirtypes';

describe('ConsultationTreatmentPage', () => {
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
      code: { text: 'Consultation' },
      extension: [{
        url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
        valueReference: { reference: `Appointment/${mockAppointment.id}` },
      }],
    });
  });

  const renderPage = (procedureId = mockProcedure.id, patientId = mockPatient.id) => {
    return render(
      <MedplumProvider medplum={medplum}>
        <MemoryRouter initialEntries={[`/Patient/${patientId}/consultation?procedureId=${procedureId}`]}>
          <Routes>
            <Route path="/Patient/:id/consultation" element={<ConsultationTreatmentPage />} />
          </Routes>
        </MemoryRouter>
      </MedplumProvider>
    );
  };

  describe('Page Display', () => {
    test('should load and render treatment data', async () => {
      renderPage();
      const titles = await screen.findAllByText('Consultation');
      expect(titles.length).toBeGreaterThanOrEqual(1);
    });

    test('should display patient name', async () => {
      renderPage();
      expect(await screen.findByText(/Jane Doe/i)).toBeInTheDocument();
    });
  });
});
