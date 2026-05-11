import { MockClient } from '@medplum/mock';
import { render, screen, waitFor } from '../test-utils/render';
import { PatientIntakePage } from '../intake/PatientIntakePage';
import { MedplumProvider } from '@medplum/react';
import { MemoryRouter } from 'react-router';

describe('PatientIntakePage', () => {
  let medplum: MockClient;

  beforeEach(() => {
    medplum = new MockClient();
  });

  const renderPage = (initialEntries = ['/intake']) => {
    return render(
      <MedplumProvider medplum={medplum}>
        <MemoryRouter initialEntries={initialEntries}>
          <PatientIntakePage />
        </MemoryRouter>
      </MedplumProvider>
    );
  };

  describe('Self-Service Mode', () => {
    test('should render intake form', async () => {
      renderPage();
      expect(await screen.findByText('Patient Intake Form')).toBeInTheDocument();
    });

    test('should show wizard with step 1', async () => {
      renderPage();
      expect(await screen.findByText('Step 1: Welcome')).toBeInTheDocument();
    });

    test('should not show coordinator alert in self-service mode', async () => {
      renderPage();
      await screen.findByText('Patient Intake Form');
      expect(screen.queryByText(/Coordinator Mode/i)).not.toBeInTheDocument();
    });
  });

  describe('Coordinator Mode', () => {
    test('should render in coordinator mode', async () => {
      renderPage(['/intake?mode=coordinator']);
      expect(await screen.findByText('Patient Intake Form')).toBeInTheDocument();
    });

    test('should show coordinator header', async () => {
      renderPage(['/intake?mode=coordinator']);
      expect(await screen.findByText(/Coordinator Mode/i)).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    test('should show step progress', async () => {
      renderPage();
      expect(await screen.findByText('Step 1 of 8')).toBeInTheDocument();
    });
  });
});
