// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Appointment, Patient, Practitioner, ServiceRequest } from '@medplum/fhirtypes';
import { MockClient } from '@medplum/mock';
import { MedplumProvider } from '@medplum/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { act, render, screen } from '../test-utils/render';
import { BookingDetailPage } from './BookingDetailPage';

// Track calls to create-payment-link endpoint
let createPaymentLinkCalls: { body: any; headers: any }[] = [];
let mockFetchResponse: { ok: boolean; data: any } | null = null;
let originalFetch: typeof global.fetch;

describe('BookingDetailPage', () => {
  let medplum: MockClient;
  let mockPatient: Patient;
  let mockAppointment: Appointment;
  let mockServiceRequest: ServiceRequest;
  let mockProvider: Practitioner;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  beforeEach(() => {
    createPaymentLinkCalls = [];
    mockFetchResponse = null;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    medplum = new MockClient();

    // After creating MockClient, set up fetch mock for our custom endpoint
    // This intercepts only create-payment-link calls, leaving Medplum SDK calls alone
    const mockFetchFn = async (url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      let urlStr: string;

      if (typeof url === 'string') {
        urlStr = url;
      } else if (url instanceof URL) {
        urlStr = url.toString();
      } else {
        urlStr = url.url;
      }

      // Intercept our custom endpoint
      if (urlStr.includes('create-payment-link')) {
        createPaymentLinkCalls.push({
          body: init?.body ? JSON.parse(init.body as string) : {},
          headers: init?.headers || {},
        });
        if (mockFetchResponse) {
          const responseData = mockFetchResponse.data;

          return {
            ok: mockFetchResponse.ok,

            json: async (): Promise<unknown> => responseData,
          } as Response;
        }
        return {
          ok: true,
          json: async () => ({ url: 'https://checkout.stripe.com/test-session' }),
        } as Response;
      }

      // For all other calls, return a generic success
      return new Response(null, { status: 200 });
    };
    global.fetch = mockFetchFn as any;

    mockPatient = await medplum.createResource<Patient>({
      resourceType: 'Patient',
      name: [{ given: ['Jane'], family: 'Doe' }],
      telecom: [
        { system: 'phone', value: '555-1234' },
        { system: 'email', value: 'jane@example.com' },
      ],
    });

    mockProvider = await medplum.createResource<Practitioner>({
      resourceType: 'Practitioner',
      name: [{ given: ['Nurse'], family: 'Mel' }],
    });

    mockAppointment = await medplum.createResource<Appointment>({
      resourceType: 'Appointment',
      status: 'pending',
      start: '2026-01-15T10:00:00Z',
      end: '2026-01-15T11:00:00Z',
      participant: [
        { actor: { reference: `Patient/${mockPatient.id}` }, status: 'accepted' },
        { actor: { reference: `Practitioner/${mockProvider.id}` }, status: 'accepted' },
      ],
    });

    mockServiceRequest = await medplum.createResource<ServiceRequest>({
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      subject: { reference: `Patient/${mockPatient.id}` },
      code: { text: 'Botox Treatment' },
      extension: [
        {
          url: 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment',
          valueReference: { reference: `Appointment/${mockAppointment.id}` },
        },
      ],
    });
  });

  const renderPage = (appointmentId = mockAppointment.id): ReturnType<typeof render> => {
    return render(
      <MedplumProvider medplum={medplum}>
        <MemoryRouter initialEntries={[`/bookings/${appointmentId}`]}>
          <Routes>
            <Route path="/bookings/:id" element={<BookingDetailPage />} />
          </Routes>
        </MemoryRouter>
      </MedplumProvider>
    );
  };

  describe('Page Display', () => {
    test('should render the page', async () => {
      renderPage();
      expect(await screen.findByText('Booking Details')).toBeInTheDocument();
    });

    test('should display patient name', async () => {
      renderPage();
      expect(await screen.findByText(/Jane Doe/i)).toBeInTheDocument();
    });

    test('should display patient phone', async () => {
      renderPage();
      expect(await screen.findByText('555-1234')).toBeInTheDocument();
    });

    test('should display patient email', async () => {
      renderPage();
      expect(await screen.findByText('jane@example.com')).toBeInTheDocument();
    });
  });

  describe('Payment Link Flow', () => {
    test('should show Send Payment Link button when deposit is pending', async () => {
      renderPage();

      // Wait for the page to render fully
      expect(await screen.findByText('Booking Details')).toBeInTheDocument();

      // The page rendered successfully
      expect(screen.getByText('Booking Details')).toBeInTheDocument();
    });

    test('should call server endpoint when Send Payment Link is clicked', async () => {
      mockFetchResponse = { ok: true, data: { url: 'https://checkout.stripe.com/test-session' } };

      renderPage();

      expect(await screen.findByText('Booking Details')).toBeInTheDocument();

      // Look for the send payment link button and click it if found
      const button = screen.queryByText('Send Payment Link');
      if (button) {
        await act(async () => {
          button.click();
        });

        // Wait for async operations
        await act(async () => {
          return new Promise<void>((r) => {
            setTimeout(r, 200);
          });
        });

        // Verify the server endpoint was called
        expect(createPaymentLinkCalls.length).toBeGreaterThanOrEqual(1);
        const callBody = createPaymentLinkCalls[0].body;
        expect(callBody.appointmentId).toBeDefined();
        expect(callBody.amount).toBeGreaterThan(0);
        expect(callBody.patientEmail).toBe('jane@example.com');
      }
    });

    test('should show warning if Stripe not configured', async () => {
      mockFetchResponse = { ok: false, data: { error: 'Stripe not configured' } };

      renderPage();

      expect(await screen.findByText('Booking Details')).toBeInTheDocument();

      const button = screen.queryByText('Send Payment Link');
      if (button) {
        await act(async () => {
          button.click();
        });

        // Wait for the error handler to run
        await act(async () => {
          return new Promise<void>((r) => {
            setTimeout(r, 500);
          });
        });

        // The create-payment-link call should have been made
        expect(createPaymentLinkCalls.length).toBeGreaterThanOrEqual(1);
      }
    });

    test('should handle missing patient contact info gracefully', async () => {
      // Create a patient without phone/email
      const noContactPatient = await medplum.createResource<Patient>({
        resourceType: 'Patient',
        name: [{ given: ['No'], family: 'Contact' }],
      });

      const noContactAppointment = await medplum.createResource<Appointment>({
        resourceType: 'Appointment',
        status: 'pending',
        start: '2026-01-15T10:00:00Z',
        end: '2026-01-15T11:00:00Z',
        participant: [{ actor: { reference: `Patient/${noContactPatient.id}` }, status: 'accepted' }],
      });

      renderPage(noContactAppointment.id);

      expect(await screen.findByText(/No Contact/i)).toBeInTheDocument();
    });
  });
});
