import { MockClient } from '@medplum/mock';
import { render, screen, waitFor, act, fireEvent } from '../test-utils/render';
import { BookingsPage } from './BookingsPage';
import { MedplumProvider } from '@medplum/react';
import { MemoryRouter } from 'react-router';

describe('BookingsPage', () => {
  let medplum: MockClient;

  beforeEach(() => {
    medplum = new MockClient();
  });

  const renderPage = () => {
    return render(
      <MedplumProvider medplum={medplum}>
        <MemoryRouter>
          <BookingsPage />
        </MemoryRouter>
      </MedplumProvider>
    );
  };

  describe('Page Display', () => {
    test('should render the page', async () => {
      renderPage();
      expect(await screen.findByText('Bookings')).toBeInTheDocument();
    });

    test('should show search input', async () => {
      renderPage();
      expect(await screen.findByPlaceholderText(/Search by patient/i)).toBeInTheDocument();
    });

    test('should show tabs', async () => {
      renderPage();
      expect(await screen.findByText(/All/)).toBeInTheDocument();
      expect(screen.getByText(/Pending Approval/)).toBeInTheDocument();
      expect(screen.getByText(/Upcoming/)).toBeInTheDocument();
      expect(screen.getByText(/Past/)).toBeInTheDocument();
    });

    test('should display empty state when no bookings', async () => {
      renderPage();
      expect(await screen.findAllByText('No bookings found')).toHaveLength(4);
    });
  });
});
