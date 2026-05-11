import { MockClient } from '@medplum/mock';
import { render, screen, waitFor } from '../test-utils/render';
import { IntakeWizard } from './IntakeWizard';
import { MedplumProvider } from '@medplum/react';

describe('IntakeWizard', () => {
  let medplum: MockClient;

  beforeEach(() => {
    medplum = new MockClient();
  });

  describe('Step Navigation', () => {
    test.todo('should start at step 1');
    test.todo('should show step 1 content');
    test.todo('should proceed to step 2');
    test.todo('should go back to step 1');
    test.todo('should show progress bar');
    test.todo('should show current step indicator');
    test.todo('should show total steps');
    test.todo('should complete all 8 steps');
  });

  describe('Form Validation', () => {
    test.todo('should validate required fields before proceeding');
    test.todo('should show validation errors');
    test.todo('should prevent proceeding with errors');
    test.todo('should clear errors on valid input');
  });

  describe('Data Persistence', () => {
    test.todo('should maintain data between steps');
    test.todo('should not lose data when going back');
    test.todo('should submit all data on final step');
  });

  describe('Submission', () => {
    test.todo('should call onSubmit with form data');
    test.todo('should show loading state during submission');
    test.todo('should handle submission errors');
    test.todo('should show success state after submission');
  });
});
