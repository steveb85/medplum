import { MockClient } from '@medplum/mock';
import { render, screen, waitFor, act } from '../test-utils/render';
import { CreateAppointmentModalV3 } from './CreateAppointmentModalV3';
import { MedplumProvider } from '@medplum/react';
import type { Patient, ActivityDefinition, Practitioner } from '@medplum/fhirtypes';
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

    // Setup mock data
    mockPatient = await medplum.createResource<Patient>({
      resourceType: 'Patient',
      name: [{ given: ['Jane'], family: 'Doe' }],
      telecom: [
        { system: 'phone', value: '555-1234' },
        { system: 'email', value: 'jane@example.com' }
      ]
    });

    mockService = await medplum.createResource<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      name: 'Botox Treatment',
      status: 'active',
      code: { coding: [{ code: 'botox', display: 'Botox' }] },
      extension: [{
        url: 'http://melissaknudson.com/fhir/StructureDefinition/service-config',
        extension: [
          { url: 'defaultDuration', valueInteger: 60 },
          { url: 'defaultRoom', valueString: 'room-1' },
          { url: 'color', valueString: '#228be6' }
        ]
      }]
    });

    mockProvider = await medplum.createResource<Practitioner>({
      resourceType: 'Practitioner',
      name: [{ given: ['Nurse'], family: 'Mel' }],
      qualification: [{
        code: { coding: [{ code: 'RN' }] }
      }],
      extension: [{
        url: 'http://melissaknudson.com/fhir/StructureDefinition/medspa-role',
        valueString: 'provider'
      }]
    });
  });

  const renderModal = (props = {}) => {
    return render(
      <MedplumProvider medplum={medplum}>
        <CreateAppointmentModalV3
          isOpen={true}
          onClose={onClose}
          onSuccess={onSuccess}
          {...props}
        />
      </MedplumProvider>
    );
  };

  describe('Step 1: Patient Selection', () => {
    test.todo('should render patient selection step by default');
    test.todo('should display "Step 1 of 5" indicator');
    test.todo('should have patient search input');
    test.todo('should search for patients when typing');
    test.todo('should display patient results');
    test.todo('should select patient on click');
    test.todo('should display selected patient info');
    test.todo('should validate patient is required');
    test.todo('should disable Next until patient selected');
    test.todo('should enable Next after patient selected');
    test.todo('should proceed to step 2 on Next click');
    test.todo('should show loading state during search');
    test.todo('should handle search errors gracefully');
    test.todo('should allow creating new patient');
  });

  describe('Step 2: Service Selection', () => {
    test.todo('should render service selection step');
    test.todo('should display "Step 2 of 5" indicator');
    test.todo('should show available services list');
    test.todo('should allow selecting multiple services');
    test.todo('should display selected services');
    test.todo('should show total duration');
    test.todo('should show total price range');
    test.todo('should suggest accompanying services (numbing)');
    test.todo('should allow adding accompanying services');
    test.todo('should allow removing services');
    test.todo('should reorder services with drag-drop');
    test.todo('should validate at least one service selected');
    test.todo('should go back to step 1 on Back click');
    test.todo('should proceed to step 3 on Next click');
    test.todo('should show consultation expiry warnings');
    test.todo('should allow adding consultation service');
  });

  describe('Step 3: Configure Services', () => {
    test.todo('should render configuration step');
    test.todo('should display "Step 3 of 5" indicator');
    test.todo('should show each selected service');
    test.todo('should allow assigning provider per service');
    test.todo('should filter providers by eligibility');
    test.todo('should allow assigning assistant per service');
    test.todo('should show provider availability');
    test.todo('should assign default room from service config');
    test.todo('should allow changing room assignment');
    test.todo('should show room availability');
    test.todo('should show equipment requirements');
    test.todo('should warn if room lacks required equipment');
    test.todo('should allow selecting equipment');
    test.todo('should show equipment conflicts');
    test.todo('should allow adding per-service notes');
    test.todo('should allow overriding duration');
    test.todo('should validate all required fields');
    test.todo('should go back to step 2 on Back click');
    test.todo('should proceed to step 4 on Next click');
  });

  describe('Step 4: Schedule', () => {
    test.todo('should render scheduling step');
    test.todo('should display "Step 4 of 5" indicator');
    test.todo('should show date picker');
    test.todo('should show time picker with slots');
    test.todo('should calculate total duration');
    test.todo('should show timeline preview');
    test.todo('should show numbing timing before service');
    test.todo('should check for provider conflicts');
    test.todo('should check for assistant conflicts');
    test.todo('should check for room conflicts');
    test.todo('should display conflict warnings');
    test.todo('should show available slots');
    test.todo('should validate date/time selection');
    test.todo('should disable past dates');
    test.todo('should go back to step 3 on Back click');
    test.todo('should proceed to step 5 on Next click');
    test.todo('should accept initialSlot prop for pre-fill');
  });

  describe('Step 5: Review', () => {
    test.todo('should render review step');
    test.todo('should display "Step 5 of 5" indicator');
    test.todo('should show patient summary');
    test.todo('should show services summary');
    test.todo('should show date/time summary');
    test.todo('should show providers summary');
    test.todo('should show rooms summary');
    test.todo('should show total deposit amount');
    test.todo('should show any warnings');
    test.todo('should allow adding notes');
    test.todo('should go back to step 4 on Back click');
    test.todo('should create booking on Create click');
    test.todo('should show loading state during creation');
    test.todo('should call onSuccess after creation');
    test.todo('should call onClose after success');
    test.todo('should handle creation errors');
  });

  describe('Edit Mode', () => {
    test.todo('should accept mode=edit prop');
    test.todo('should accept appointment prop for editing');
    test.todo('should accept serviceRequests prop for editing');
    test.todo('should skip to step 2 (services) in edit mode');
    test.todo('should pre-fill patient (disabled)');
    test.todo('should pre-fill selected services');
    test.todo('should pre-fill configurations');
    test.todo('should pre-fill date/time');
    test.todo('should show "Update Booking" button');
    test.todo('should update existing resources on submit');
    test.todo('should create AuditEvent for edit');
    test.todo('should handle edit errors');
  });

  describe('Accessibility', () => {
    test.todo('should trap focus within modal');
    test.todo('should close on Escape key');
    test.todo('should have proper ARIA labels');
    test.todo('should support keyboard navigation');
  });
});
