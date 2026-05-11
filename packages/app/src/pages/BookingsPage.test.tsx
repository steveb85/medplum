import { MockClient } from '@medplum/mock';
import { render, screen, waitFor } from '../test-utils/render';
import { BookingsPage } from './BookingsPage';
import { MedplumProvider } from '@medplum/react';
import { MemoryRouter } from 'react-router-dom';

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
    test.todo('should render bookings table');
    test.todo('should show loading state initially');
    test.todo('should display bookings after loading');
    test.todo('should show patient name column');
    test.todo('should show services column');
    test.todo('should show time column');
    test.todo('should show status column');
    test.todo('should show providers column');
    test.todo('should display empty state when no bookings');
  });

  describe('Filtering', () => {
    test.todo('should filter by status');
    test.todo('should show pending status filter');
    test.todo('should show booked status filter');
    test.todo('should show arrived status filter');
    test.todo('should show fulfilled status filter');
    test.todo('should show cancelled status filter');
    test.todo('should show no-show status filter');
    test.todo('should filter by date range');
    test.todo('should filter by provider');
    test.todo('should combine multiple filters');
    test.todo('should clear all filters');
  });

  describe('Sorting', () => {
    test.todo('should sort by date ascending');
    test.todo('should sort by date descending');
    test.todo('should sort by patient name');
    test.todo('should sort by status');
  });

  describe('Pagination', () => {
    test.todo('should show pagination controls');
    test.todo('should navigate to next page');
    test.todo('should navigate to previous page');
    test.todo('should show page numbers');
    test.todo('should adjust page size');
  });

  describe('Actions', () => {
    test.todo('should have view detail button');
    test.todo('should navigate to booking detail on view');
    test.todo('should show status action menu');
    test.todo('should allow quick status change');
    test.todo('should have "New Booking" button');
    test.todo('should open booking modal on new');
  });

  describe('Multi-service Display', () => {
    test.todo('should show service count badge');
    test.todo('should list all services in tooltip');
    test.todo('should show first service time');
  });
});
