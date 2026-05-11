import { MockClient } from '@medplum/mock';
import { render, screen, waitFor } from '../test-utils/render';
import { CalendarPage } from './CalendarPage';
import { MedplumProvider } from '@medplum/react';
import { MemoryRouter } from 'react-router-dom';

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
    test.todo('should render calendar view');
    test.todo('should show current week by default');
    test.todo('should display time slots');
    test.todo('should show days of week');
    test.todo('should display events on calendar');
    test.todo('should show event with patient name');
    test.todo('should show event with service name');
    test.todo('should show room abbreviation on event');
    test.todo('should show equipment icon when required');
    test.todo('should color events by status');
    test.todo('should handle multi-service bookings');
    test.todo('should split sequential services by time');
  });

  describe('View Controls', () => {
    test.todo('should switch to day view');
    test.todo('should switch to week view');
    test.todo('should switch to month view');
    test.todo('should navigate to previous period');
    test.todo('should navigate to next period');
    test.todo('should jump to today');
    test.todo('should show current date range');
  });

  describe('Resource Filtering', () => {
    test.todo('should show filter panel');
    test.todo('should filter by room');
    test.todo('should filter by multiple rooms');
    test.todo('should filter by provider');
    test.todo('should filter by multiple providers');
    test.todo('should filter by equipment');
    test.todo('should show active filter chips');
    test.todo('should clear all filters');
    test.todo('should persist filter state');
  });

  describe('Event Interactions', () => {
    test.todo('should show event details on hover');
    test.todo('should show full tooltip with all info');
    test.todo('should navigate to booking detail on click');
    test.todo('should allow drag to create new booking');
    test.todo('should pre-fill time from drag selection');
    test.todo('should open booking modal on drag');
  });

  describe('Event Styling', () => {
    test.todo('should show pending status with yellow border');
    test.todo('should show booked status with blue border');
    test.todo('should show arrived status with teal border');
    test.todo('should show fulfilled status with green border');
    test.todo('should show cancelled status with red border');
    test.todo('should show no-show status with gray border');
  });
});
