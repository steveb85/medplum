import { MockClient } from '@medplum/mock';
import { render, screen, waitFor } from '../test-utils/render';
import { PatientIntakePage } from '../intake/PatientIntakePage';
import { MedplumProvider } from '@medplum/react';
import { MemoryRouter } from 'react-router-dom';

describe('PatientIntakePage', () => {
  let medplum: MockClient;

  beforeEach(() => {
    medplum = new MockClient();
  });

  const renderPage = (mode = 'self-service') => {
    return render(
      <MedplumProvider medplum={medplum}>
        <MemoryRouter initialEntries={[`/intake?mode=${mode}`]}>
          <PatientIntakePage />
        </MemoryRouter>
      </MedplumProvider>
    );
  };

  describe('Self-Service Mode', () => {
    test.todo('should render intake form in self-service mode');
    test.todo('should show welcome message');
    test.todo('should display all 8 steps');
    test.todo('should allow completing intake');
    test.todo('should show success screen after submission');
    test.todo('should create Patient resource');
  });

  describe('Coordinator Mode', () => {
    test.todo('should render in coordinator mode');
    test.todo('should show coordinator header');
    test.todo('should allow coordinator-assisted completion');
  });

  describe('Navigation', () => {
    test.todo('should navigate between steps');
    test.todo('should validate before proceeding');
    test.todo('should show step progress');
  });
});
