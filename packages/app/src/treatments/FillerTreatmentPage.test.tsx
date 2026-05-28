import { MockClient } from '@medplum/mock';
import { render, screen, waitFor } from '../test-utils/render';
import { FillerTreatmentPage } from './FillerTreatmentPage';
import { MedplumProvider } from '@medplum/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Patient, Procedure, Appointment, Practitioner } from '@medplum/fhirtypes';

// Mock getMedSpaRole to return 'provider' so save button is visible
jest.mock('../auth/role', () => ({
  ...jest.requireActual('../auth/role'),
  getMedSpaRole: () => 'provider',
}));

describe('FillerTreatmentPage', () => {
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
      code: { text: 'Filler Treatment' },
      extension: [{
        url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
        valueReference: { reference: `Appointment/${mockAppointment.id}` },
      }],
    });
  });

  const renderPage = (procedureId = mockProcedure.id, patientId = mockPatient.id) => {
    return render(
      <MedplumProvider medplum={medplum}>
        <MemoryRouter initialEntries={[`/Patient/${patientId}/filler-treatment?procedureId=${procedureId}`]}>
          <Routes>
            <Route path="/Patient/:id/filler-treatment" element={<FillerTreatmentPage />} />
          </Routes>
        </MemoryRouter>
      </MedplumProvider>
    );
  };

  describe('Page Display', () => {
    test('should load and render treatment data', async () => {
      renderPage();
      const titles = await screen.findAllByText('Filler Treatment');
      expect(titles.length).toBeGreaterThanOrEqual(1);
    });

    test('should display patient name', async () => {
      renderPage();
      expect(await screen.findByText(/Jane Doe/i)).toBeInTheDocument();
    });
  });

  describe('Save Flow', () => {
    test('should persist filler data on save', async () => {
      const updateSpy = jest.spyOn(medplum, 'updateResource');

      renderPage();

      // Wait for page to load and save button to appear
      await screen.findAllByText('Filler Treatment');
      const saveButton = await screen.findByText('Save All Changes');

      // Click save
      saveButton.click();

      // Wait for save to complete
      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalled();
      });

      // Verify the updated procedure has expected structure
      const updatedProcedure = updateSpy.mock.calls[0][0] as Procedure;
      expect(updatedProcedure.resourceType).toBe('Procedure');
      expect(updatedProcedure.extension).toBeDefined();
    });

    test('should render SOAP note section', async () => {
      renderPage();
      expect(await screen.findByText('SOAP Note')).toBeInTheDocument();
    });

    test('should render procedure note section', async () => {
      renderPage();
      expect(await screen.findByText('Procedure Note')).toBeInTheDocument();
    });
  });
});
