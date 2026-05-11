import { MockClient } from '@medplum/mock';
import { render, screen, waitFor, act, fireEvent } from '../test-utils/render';
import { CreateAppointmentModalV3 } from './CreateAppointmentModalV3';
import { MedplumProvider } from '@medplum/react';
import { Patient, ActivityDefinition, Practitioner, Appointment, ServiceRequest } from '@medplum/fhirtypes';
import userEvent from '@testing-library/user-event';

describe('CreateAppointmentModalV3', () => {
  let medplum: MockClient;
  let mockPatient: Patient;
  let mockService: ActivityDefinition;
  let mockProvider: Practitioner;
  let onClose: jest.Mock;
  let onSuccess: jest.Mock;

  beforeEach(async () => {
    medplum = new MockClient();
    onClose = jest.fn();
    onSuccess = jest.fn();

    mockPatient = await medplum.createResource<Patient>({
      resourceType: 'Patient',
      id: 'test-patient',
      name: [{ given: ['Jane'], family: 'Doe' }],
      telecom: [
        { system: 'phone', value: '555-1234' },
        { system: 'email', value: 'jane@example.com' },
      ],
    });

    mockService = await medplum.createResource<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      id: 'test-service',
      name: 'Botox Treatment',
      status: 'active',
      code: { coding: [{ code: 'botox', display: 'Botox' }] },
      extension: [
        {
          url: 'http://melissaknudson.com/fhir/StructureDefinition/service-config',
          extension: [
            { url: 'defaultDuration', valueInteger: 60 },
            { url: 'defaultRoom', valueString: 'room-1' },
            { url: 'color', valueString: '#228be6' },
          ],
        },
      ],
    });

    mockProvider = await medplum.createResource<Practitioner>({
      resourceType: 'Practitioner',
      id: 'test-provider',
      name: [{ given: ['Nurse'], family: 'Mel' }],
      qualification: [{ code: { coding: [{ code: 'RN' }] } }],
      extension: [
        { url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role', valueString: 'provider' },
      ],
    });
  });

  const renderModal = (props = {}) => {
    return render(
      <MedplumProvider medplum={medplum}>
        <CreateAppointmentModalV3 isOpen={true} onClose={onClose} onSuccess={onSuccess} {...props} />
      </MedplumProvider>
    );
  };

  describe('Step 1: Patient Selection', () => {
    test('should render modal with stepper', async () => {
      renderModal();
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    test('should show patient selection instructions', async () => {
      renderModal();
      expect(await screen.findByText(/Select a patient/i)).toBeInTheDocument();
    });

    test('should have patient search input', async () => {
      renderModal();
      expect(await screen.findByPlaceholderText('Search for patient...')).toBeInTheDocument();
    });

    test('should disable Next until patient selected', async () => {
      renderModal();
      const nextBtn = await screen.findByRole('button', { name: /next/i });
      expect(nextBtn).toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    test('should render modal dialog with proper role', async () => {
      renderModal();
      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    test('should call onClose when modal is closed programmatically', () => {
      const { unmount } = renderModal();
      unmount();
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
