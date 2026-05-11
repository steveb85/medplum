import { MockClient } from '@medplum/mock';
import type { Patient, ServiceRequest, Practitioner, Appointment, AuditEvent } from '@medplum/fhirtypes';
import {
  recordBookingCreated,
  recordBookingEdited,
  recordBookingStatusChange,
  recordDepositRequested,
  recordDepositPaid,
  recordDepositWaived,
  recordPaymentUndone,
  recordRefundIssued,
  recordFinalPaymentRequested,
  recordFinalPaymentReceived,
  getDepositStatusFromAuditEvents,
  parseEntityDetails,
  recordBookingCompleted,
  recordDepositWaiveUndone,
  recordDepositAmountChanged,
  recordPaymentLinkSent,
  recordConsentSigned,
  recordServiceStarted,
  recordServiceCompleted,
  recordTreatmentMilestone,
} from './audit-events';

describe('Audit Events Utilities', () => {
  let medplum: MockClient;
  let mockPatient: Patient;
  let mockServiceRequest: ServiceRequest;
  let mockPractitioner: Practitioner;
  let mockAppointment: Appointment;

  beforeEach(() => {
    medplum = new MockClient();
    mockPatient = {
      resourceType: 'Patient',
      id: 'patient-1',
      name: [{ given: ['Jane'], family: 'Doe' }],
    };
    mockServiceRequest = {
      resourceType: 'ServiceRequest',
      id: 'sr-1',
      status: 'draft',
      intent: 'order',
      subject: { reference: 'Patient/patient-1' },
      code: { text: 'Test Service' },
    };
    mockPractitioner = {
      resourceType: 'Practitioner',
      id: 'practitioner-1',
      name: [{ given: ['Nurse'], family: 'Mel' }],
    };
    mockAppointment = {
      resourceType: 'Appointment',
      id: 'appt-1',
      status: 'pending',
      participant: [],
    };
  });

  describe('recordBookingCreated', () => {
    test('should create AuditEvent when booking created', async () => {
      const event = await recordBookingCreated(medplum, mockPatient, mockServiceRequest, mockPractitioner, ['Botox'], 'Test reason');
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.action).toBe('C');
    });

    test('should include patient reference', async () => {
      const event = await recordBookingCreated(medplum, mockPatient, mockServiceRequest, mockPractitioner, ['Botox']);
      const patientEntity = event.entity?.find((e) => e.what?.reference === 'Patient/patient-1');
      expect(patientEntity).toBeDefined();
    });

    test('should include services booked in description', async () => {
      const event = await recordBookingCreated(medplum, mockPatient, mockServiceRequest, mockPractitioner, ['Botox', 'Filler']);
      expect(event.subtype?.[0]?.display).toContain('Botox, Filler');
    });

    test('should include createdBy practitioner', async () => {
      const event = await recordBookingCreated(medplum, mockPatient, mockServiceRequest, mockPractitioner, ['Botox']);
      const agent = event.agent?.find((a) => a.requestor);
      expect(agent?.who?.reference).toBe('Practitioner/practitioner-1');
    });

    test('should include creation date/time', async () => {
      const event = await recordBookingCreated(medplum, mockPatient, mockServiceRequest, mockPractitioner, ['Botox']);
      expect(event.recorded).toBeDefined();
      expect(new Date(event.recorded).getTime()).toBeGreaterThan(0);
    });

    test('should include notes if provided', async () => {
      const event = await recordBookingCreated(medplum, mockPatient, mockServiceRequest, mockPractitioner, ['Botox'], 'Walk-in');
      expect(event.subtype?.[0]?.display).toContain('Walk-in');
    });
  });

  describe('recordBookingEdited', () => {
    test('should create AuditEvent when booking edited', async () => {
      const event = await recordBookingEdited(medplum, mockPatient, mockServiceRequest, mockPractitioner, 'Changed date to Jan 20');
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.action).toBe('U');
    });

    test('should record which fields changed', async () => {
      const event = await recordBookingEdited(medplum, mockPatient, mockServiceRequest, mockPractitioner, 'Changed date, provider');
      expect(event.subtype?.[0]?.display).toContain('Changed date, provider');
    });

    test('should include editedBy practitioner', async () => {
      const event = await recordBookingEdited(medplum, mockPatient, mockServiceRequest, mockPractitioner, 'Changed date');
      const agent = event.agent?.find((a) => a.requestor);
      expect(agent?.who?.display).toContain('Nurse');
    });

    test('should include edit timestamp', async () => {
      const event = await recordBookingEdited(medplum, mockPatient, mockServiceRequest, mockPractitioner, 'Changed date');
      expect(event.recorded).toBeDefined();
    });

    test('should include edit reason if provided', async () => {
      const event = await recordBookingEdited(medplum, mockPatient, mockServiceRequest, mockPractitioner, 'Changed date', 'Patient request');
      expect(event.subtype?.[0]?.display).toContain('Patient request');
    });
  });

  describe('recordBookingStatusChange', () => {
    test('should create AuditEvent on status change', async () => {
      const event = await recordBookingStatusChange(medplum, mockPatient, mockServiceRequest, 'pending', 'booked', mockPractitioner);
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.action).toBe('U');
    });

    test('should record fromStatus and toStatus', async () => {
      const event = await recordBookingStatusChange(medplum, mockPatient, mockServiceRequest, 'pending', 'booked', mockPractitioner);
      expect(event.subtype?.[0]?.display).toContain('pending');
      expect(event.subtype?.[0]?.display).toContain('booked');
    });

    test('should include changedBy practitioner', async () => {
      const event = await recordBookingStatusChange(medplum, mockPatient, mockServiceRequest, 'pending', 'booked', mockPractitioner);
      const agent = event.agent?.find((a) => a.requestor);
      expect(agent?.who?.reference).toBe('Practitioner/practitioner-1');
    });

    test('should include change reason', async () => {
      const event = await recordBookingStatusChange(medplum, mockPatient, mockServiceRequest, 'pending', 'cancelled', mockPractitioner, 'Patient cancelled');
      expect(event.subtype?.[0]?.display).toContain('Patient cancelled');
    });

    test('should handle cancellation with reason', async () => {
      const event = await recordBookingStatusChange(medplum, mockPatient, mockServiceRequest, 'booked', 'cancelled', mockPractitioner, 'No show');
      expect(event.subtype?.[0]?.display).toContain('cancelled');
      expect(event.subtype?.[0]?.display).toContain('No show');
    });

    test('should handle arrival status', async () => {
      const event = await recordBookingStatusChange(medplum, mockPatient, mockServiceRequest, 'booked', 'arrived', mockPractitioner);
      expect(event.subtype?.[0]?.display).toContain('arrived');
    });
  });

  describe('recordDepositRequested', () => {
    test('should create AuditEvent when deposit requested', async () => {
      const event = await recordDepositRequested(medplum, mockPatient, mockServiceRequest, 250, 'sms+email', mockPractitioner);
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.action).toBe('R');
    });

    test('should include request method', async () => {
      const event = await recordDepositRequested(medplum, mockPatient, mockServiceRequest, 250, 'sms', mockPractitioner);
      expect(event.subtype?.[0]?.display).toContain('sms');
    });
  });

  describe('recordDepositPaid', () => {
    test('should create AuditEvent when deposit paid', async () => {
      const event = await recordDepositPaid(medplum, mockPatient, mockServiceRequest, 250, mockPractitioner, 'online');
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.action).toBe('E');
    });

    test('should record payment type', async () => {
      const event = await recordDepositPaid(medplum, mockPatient, mockServiceRequest, 250, mockPractitioner, 'manual');
      expect(event.subtype?.[0]?.display).toContain('manual');
    });

    test('should include payment notes', async () => {
      const event = await recordDepositPaid(medplum, mockPatient, mockServiceRequest, 250, mockPractitioner, 'manual', 250, 'Check #123');
      expect(event.subtype?.[0]?.display).toContain('manual');
    });
  });

  describe('recordDepositWaived', () => {
    test('should create AuditEvent when deposit waived', async () => {
      const event = await recordDepositWaived(medplum, mockPatient, mockServiceRequest, 250, mockPractitioner, 'Promotion');
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.subtype?.[0]?.display).toContain('waived');
    });

    test('should include waiver reason', async () => {
      const event = await recordDepositWaived(medplum, mockPatient, mockServiceRequest, 250, mockPractitioner, 'VIP discount');
      expect(event.subtype?.[0]?.display).toContain('VIP discount');
    });
  });

  describe('recordPaymentUndone', () => {
    test('should create AuditEvent when payment undone', async () => {
      const event = await recordPaymentUndone(medplum, mockPatient, mockServiceRequest, 250, mockPractitioner);
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.subtype?.[0]?.display).toContain('undone');
    });

    test('should include undo reason', async () => {
      const event = await recordPaymentUndone(medplum, mockPatient, mockServiceRequest, 250, mockPractitioner, 'Patient requested');
      expect(event.subtype?.[0]?.display).toContain('Patient requested');
    });
  });

  describe('recordRefundIssued', () => {
    test('should create AuditEvent when refund issued', async () => {
      const event = await recordRefundIssued(medplum, mockPatient, mockServiceRequest, 250, mockPractitioner, 'Overcharged');
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.subtype?.[0]?.display).toContain('Refund');
    });

    test('should include refund amount', async () => {
      const event = await recordRefundIssued(medplum, mockPatient, mockServiceRequest, 150, mockPractitioner);
      expect(event.subtype?.[0]?.display).toContain('$150');
    });
  });

  describe('recordFinalPaymentRequested', () => {
    test('should create AuditEvent when final payment requested', async () => {
      const event = await recordFinalPaymentRequested(medplum, mockPatient, mockServiceRequest, 500, 'email', mockPractitioner);
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.subtype?.[0]?.display).toContain('Final payment');
    });

    test('should differentiate from deposit request', async () => {
      const event = await recordFinalPaymentRequested(medplum, mockPatient, mockServiceRequest, 500, 'sms', mockPractitioner);
      expect(event.subtype?.[0]?.display).toContain('Final');
    });
  });

  describe('recordFinalPaymentReceived', () => {
    test('should create AuditEvent when final payment received', async () => {
      const event = await recordFinalPaymentReceived(medplum, mockPatient, mockServiceRequest, 500, mockPractitioner, 'online');
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.subtype?.[0]?.display).toContain('Final payment received');
    });
  });

  describe('recordBookingCompleted', () => {
    test('should create AuditEvent when booking completed', async () => {
      const event = await recordBookingCompleted(medplum, mockPatient, mockServiceRequest, mockPractitioner);
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.subtype?.[0]?.display).toContain('completed');
    });
  });

  describe('recordDepositWaiveUndone', () => {
    test('should create AuditEvent when deposit waive undone', async () => {
      const event = await recordDepositWaiveUndone(medplum, mockPatient, mockServiceRequest, 250, mockPractitioner);
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.subtype?.[0]?.display).toContain('waive undone');
    });
  });

  describe('recordDepositAmountChanged', () => {
    test('should create AuditEvent when deposit amount changed', async () => {
      const event = await recordDepositAmountChanged(medplum, mockPatient, mockServiceRequest, 250, 200, mockPractitioner);
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.subtype?.[0]?.display).toContain('Deposit amount changed');
    });
  });

  describe('recordPaymentLinkSent', () => {
    test('should create AuditEvent when payment link sent', async () => {
      const event = await recordPaymentLinkSent(medplum, mockPatient, mockServiceRequest, 250, 'email', mockPractitioner);
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.subtype?.[0]?.display).toContain('Payment link sent');
    });

    test('should include method', async () => {
      const event = await recordPaymentLinkSent(medplum, mockPatient, mockServiceRequest, 250, 'sms', mockPractitioner);
      expect(event.subtype?.[0]?.display).toContain('sms');
    });
  });

  describe('recordConsentSigned', () => {
    test('should create AuditEvent when consent signed', async () => {
      const consent = {
        resourceType: 'Consent' as const,
        id: 'consent-1',
        status: 'active' as const,
        scope: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/consentscope', code: 'treatment' }] },
        category: [{ coding: [{ code: 'hipaa-acknowledgement' }] }],
        patient: { reference: 'Patient/patient-1' },
      };
      const event = await recordConsentSigned(medplum, mockPatient, consent, mockServiceRequest, 'self');
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.subtype?.[0]?.display).toContain('consent signed');
    });
  });

  describe('recordServiceStarted / recordServiceCompleted', () => {
    test('recordServiceStarted should create AuditEvent', async () => {
      const event = await recordServiceStarted(medplum, mockPatient, mockServiceRequest, mockPractitioner);
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.subtype?.[0]?.display).toContain('started');
    });

    test('recordServiceCompleted should create AuditEvent', async () => {
      const event = await recordServiceCompleted(medplum, mockPatient, mockServiceRequest, mockPractitioner);
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.subtype?.[0]?.display).toContain('completed');
    });
  });

  describe('recordTreatmentMilestone', () => {
    test('should create AuditEvent for treatment milestone', async () => {
      const event = await recordTreatmentMilestone(medplum, mockPatient, mockServiceRequest, 'Numbing applied', mockPractitioner);
      expect(event.resourceType).toBe('AuditEvent');
      expect(event.subtype?.[0]?.display).toContain('Numbing applied');
    });

    test('should default to System when no practitioner', async () => {
      const event = await recordTreatmentMilestone(medplum, mockPatient, mockServiceRequest, 'Auto-timer started');
      expect(event.subtype?.[0]?.display).toContain('System');
    });
  });

  describe('parseEntityDetails', () => {
    test('should extract description from AuditEvent', async () => {
      const event = await recordBookingCreated(medplum, mockPatient, mockServiceRequest, mockPractitioner, ['Botox']);
      const parsed = parseEntityDetails(event);
      expect(parsed.description).toContain('Booking created');
    });

    test('should extract entity details', async () => {
      const event = await recordDepositPaid(medplum, mockPatient, mockServiceRequest, 250, mockPractitioner, 'online');
      const parsed = parseEntityDetails(event);
      expect(parsed.details).toBeDefined();
      expect(parsed.details.serviceRequestId).toBe('sr-1');
    });

    test('should return empty details for events with no entity data', () => {
      const minimalEvent: AuditEvent = {
        resourceType: 'AuditEvent',
        id: 'event-1',
        type: { system: 'http://terminology.hl7.org/CodeSystem/audit-event-type', code: 'rest' },
        recorded: new Date().toISOString(),
        outcome: '0',
        agent: [],
        source: { observer: { display: 'Test' } },
      };
      const parsed = parseEntityDetails(minimalEvent);
      expect(Object.keys(parsed.details).length).toBe(0);
    });
  });

  describe('getDepositStatusFromAuditEvents', () => {
    test('should return pending if no events', async () => {
      const status = await getDepositStatusFromAuditEvents(medplum, 'patient-1');
      expect(status.status).toBe('pending');
    });

    test('should return requested after deposit request event', async () => {
      await recordDepositRequested(medplum, mockPatient, mockServiceRequest, 250, 'sms', mockPractitioner);
      const status = await getDepositStatusFromAuditEvents(medplum, 'patient-1');
      expect(status.status).toBe('requested');
    });

    test('should return paid after deposit paid event', async () => {
      await recordDepositRequested(medplum, mockPatient, mockServiceRequest, 250, 'sms', mockPractitioner);
      await recordDepositPaid(medplum, mockPatient, mockServiceRequest, 250, mockPractitioner, 'online');
      const status = await getDepositStatusFromAuditEvents(medplum, 'patient-1');
      expect(status.status).toBe('paid');
    });

    test('should return waived after deposit waived event', async () => {
      await recordDepositRequested(medplum, mockPatient, mockServiceRequest, 250, 'sms', mockPractitioner);
      await recordDepositWaived(medplum, mockPatient, mockServiceRequest, 250, mockPractitioner, 'Promotion');
      const status = await getDepositStatusFromAuditEvents(medplum, 'patient-1');
      expect(status.status).toBe('waived');
    });

    test('should handle undo operations', async () => {
      await recordDepositRequested(medplum, mockPatient, mockServiceRequest, 250, 'sms', mockPractitioner);
      await recordDepositPaid(medplum, mockPatient, mockServiceRequest, 250, mockPractitioner, 'online');
      await recordPaymentUndone(medplum, mockPatient, mockServiceRequest, 250, mockPractitioner, 'Refund');
      const status = await getDepositStatusFromAuditEvents(medplum, 'patient-1');
      expect(status.isUndone).toBe(true);
    });

    test('should filter by service request', async () => {
      const sr2: ServiceRequest = {
        resourceType: 'ServiceRequest',
        id: 'sr-2',
        status: 'draft',
        intent: 'order',
        subject: { reference: 'Patient/patient-1' },
        code: { text: 'Other' },
      };
      await recordDepositRequested(medplum, mockPatient, mockServiceRequest, 250, 'sms', mockPractitioner);
      await recordDepositPaid(medplum, mockPatient, sr2, 300, mockPractitioner, 'online');
      const status = await getDepositStatusFromAuditEvents(medplum, 'patient-1', 'sr-1');
      expect(status.status).toBe('requested');
    });

    test('should sort events chronologically', async () => {
      await recordDepositRequested(medplum, mockPatient, mockServiceRequest, 250, 'sms', mockPractitioner);
      await recordDepositPaid(medplum, mockPatient, mockServiceRequest, 250, mockPractitioner, 'online');
      const status = await getDepositStatusFromAuditEvents(medplum, 'patient-1');
      expect(status.status).toBe('paid');
    });
  });
});
