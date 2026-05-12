import { MockClient } from '@medplum/mock';
import { render, screen, waitFor } from '../test-utils/render';
import { CalendarPage } from './CalendarPage';
import { MedplumProvider } from '@medplum/react';
import { MemoryRouter } from 'react-router';

describe('CalendarPage', () => {
  let medplum: MockClient;

  beforeEach(() => {
    medplum = new MockClient();
  });

  const renderPage = () => {
    return render(
      <MedplumProvider medplum={medplum}>
        <MemoryRouter>
          <CalendarPage />
        </MemoryRouter>
      </MedplumProvider>
    );
  };

  describe('Calendar Display', () => {
    test('should render calendar page', async () => {
      renderPage();
      expect(await screen.findByText('Calendar')).toBeInTheDocument();
    });

    test('should show New Appointment button', async () => {
      renderPage();
      expect(await screen.findByText('New Appointment')).toBeInTheDocument();
    });

    test('should show filter button', async () => {
      renderPage();
      expect(await screen.findByText('Filters')).toBeInTheDocument();
    });
  });
});
