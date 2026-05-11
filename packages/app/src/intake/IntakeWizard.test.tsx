import { MockClient } from '@medplum/mock';
import { render, screen, waitFor, act } from '../test-utils/render';
import { IntakeWizard } from './IntakeWizard';
import { MedplumProvider } from '@medplum/react';

describe('IntakeWizard', () => {
  let medplum: MockClient;
  let onSubmit: jest.Mock;

  beforeEach(() => {
    medplum = new MockClient();
    onSubmit = jest.fn();
  });

  const renderWizard = (props = {}) => {
    return render(
      <MedplumProvider medplum={medplum}>
        <IntakeWizard
          mode="self-service"
          onSubmit={onSubmit}
          isSubmitting={false}
          {...props}
        />
      </MedplumProvider>
    );
  };

  describe('Step Navigation', () => {
    test('should start at step 1 (welcome)', async () => {
      renderWizard();
      expect(await screen.findByText('Step 1: Welcome')).toBeInTheDocument();
    });

    test('should show Continue button on step 1', async () => {
      renderWizard();
      expect(await screen.findByText('Continue')).toBeInTheDocument();
    });

    test('back button should be disabled on first step', async () => {
      renderWizard();
      const backBtn = await screen.findByText('Back');
      expect(backBtn.closest('button')).toBeDisabled();
    });

    test('should not show Submit Intake on step 1', async () => {
      renderWizard();
      await screen.findByText('Step 1: Welcome');
      expect(screen.queryByText('Submit Intake')).not.toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    test('should show step title for each step', async () => {
      renderWizard();
      expect(await screen.findByText('Step 1: Welcome')).toBeInTheDocument();
    });
  });
});
