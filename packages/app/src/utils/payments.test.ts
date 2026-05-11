import type { Appointment, ActivityDefinition } from '@medplum/fhirtypes';
import {
  getDefaultDepositAmount,
  calculatePaymentLinkExpiry,
  calculateTotalDeposit,
  shouldAutoCancel,
  formatDepositAmount,
  getDepositStatusColor,
  canRequestDeposit,
  canMarkPaid,
  canWaiveDeposit,
  getDepositStatus,
  buildDepositInfoExtensions,
} from './payments';

describe('Payment Utilities', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-15T10:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getDefaultDepositAmount', () => {
    test('should return configured amount from ActivityDefinition extension', () => {
      const service: ActivityDefinition = {
        resourceType: 'ActivityDefinition',
        id: 'ad-1',
        status: 'active',
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/service-config',
            extension: [{ url: 'depositAmount', valueInteger: 200 }],
          },
        ],
      };
      expect(getDefaultDepositAmount(service)).toBe(200);
    });

    test('should return 250 as default for unknown services', () => {
      const service: ActivityDefinition = {
        resourceType: 'ActivityDefinition',
        id: 'ad-1',
        status: 'active',
      };
      expect(getDefaultDepositAmount(service)).toBe(250);
    });

    test('should return 250 if service config extension has no depositAmount', () => {
      const service: ActivityDefinition = {
        resourceType: 'ActivityDefinition',
        id: 'ad-1',
        status: 'active',
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/service-config',
            extension: [{ url: 'otherField', valueString: 'test' }],
          },
        ],
      };
      expect(getDefaultDepositAmount(service)).toBe(250);
    });
  });

  describe('calculatePaymentLinkExpiry', () => {
    test('should return 96 hours for appointments > 96h away', () => {
      const future = new Date('2026-01-19T12:00:00Z'); // ~98h from now
      const result = calculatePaymentLinkExpiry(future);
      const expected = new Date('2026-01-19T10:00:00Z'); // now + 96h
      expect(result.getTime()).toBeCloseTo(expected.getTime(), -4);
    });

    test('should return 24 hours when appointment is 72h away', () => {
      const future = new Date('2026-01-18T10:00:00Z'); // 72h from now
      const result = calculatePaymentLinkExpiry(future);
      const expected = new Date('2026-01-16T10:00:00Z'); // now + 24h (72-48=24)
      expect(result.getTime()).toBeCloseTo(expected.getTime(), -4);
    });

    test('should return 12 hours when appointment is 48h away', () => {
      const future = new Date('2026-01-17T10:00:00Z'); // 48h from now
      const result = calculatePaymentLinkExpiry(future);
      const expected = new Date('2026-01-15T22:00:00Z'); // now + 12h (max(48-48,12)=12)
      expect(result.getTime()).toBeCloseTo(expected.getTime(), -4);
    });

    test('should return 24 hours when appointment is 25h away', () => {
      const future = new Date('2026-01-16T11:00:00Z'); // 25h from now
      const result = calculatePaymentLinkExpiry(future);
      const expected = new Date('2026-01-16T10:00:00Z'); // now + 24h (<48h rule)
      expect(result.getTime()).toBeCloseTo(expected.getTime(), -4);
    });

    test('should never return negative time', () => {
      const past = new Date('2026-01-14T10:00:00Z'); // in the past
      const result = calculatePaymentLinkExpiry(past);
      expect(result.getTime()).toBeGreaterThan(0);
    });

    test('should handle Date object input', () => {
      const result = calculatePaymentLinkExpiry(new Date('2026-01-17T10:00:00Z'));
      expect(result).toBeInstanceOf(Date);
    });

    test('should handle ISO string input', () => {
      const result = calculatePaymentLinkExpiry('2026-01-17T10:00:00.000Z');
      expect(result).toBeInstanceOf(Date);
    });
  });

  describe('calculateTotalDeposit', () => {
    test('should return 0 for empty services array', () => {
      expect(calculateTotalDeposit([])).toBe(0);
    });

    test('should return single service deposit', () => {
      const services: ActivityDefinition[] = [
        {
          resourceType: 'ActivityDefinition',
          id: 'ad-1',
          status: 'active',
          extension: [
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/service-config',
              extension: [{ url: 'depositAmount', valueInteger: 200 }],
            },
          ],
        },
      ];
      expect(calculateTotalDeposit(services)).toBe(200);
    });

    test('should return highest deposit for multiple services', () => {
      const services: ActivityDefinition[] = [
        {
          resourceType: 'ActivityDefinition',
          id: 'ad-1',
          status: 'active',
          extension: [
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/service-config',
              extension: [{ url: 'depositAmount', valueInteger: 200 }],
            },
          ],
        },
        {
          resourceType: 'ActivityDefinition',
          id: 'ad-2',
          status: 'active',
          extension: [
            {
              url: 'http://melissaknudson.com/fhir/StructureDefinition/service-config',
              extension: [{ url: 'depositAmount', valueInteger: 300 }],
            },
          ],
        },
      ];
      expect(calculateTotalDeposit(services)).toBe(300);
    });
  });

  describe('shouldAutoCancel', () => {
    test('should return false for paid bookings', () => {
      const appt: Appointment = {
        resourceType: 'Appointment',
        id: 'appt-1',
        status: 'booked',
        start: '2026-01-16T10:00:00Z',
        participant: [],
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
            extension: [
              { url: 'status', valueString: 'paid' },
              { url: 'amount', valueInteger: 250 },
            ],
          },
        ],
      };
      expect(shouldAutoCancel(appt)).toBe(false);
    });

    test('should return false for waived bookings', () => {
      const appt: Appointment = {
        resourceType: 'Appointment',
        id: 'appt-1',
        status: 'booked',
        start: '2026-01-16T10:00:00Z',
        participant: [],
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
            extension: [
              { url: 'status', valueString: 'waived' },
              { url: 'amount', valueInteger: 250 },
            ],
          },
        ],
      };
      expect(shouldAutoCancel(appt)).toBe(false);
    });

    test('should return false for pending status', () => {
      const appt: Appointment = {
        resourceType: 'Appointment',
        id: 'appt-1',
        status: 'booked',
        start: '2026-01-16T10:00:00Z',
        participant: [],
      };
      expect(shouldAutoCancel(appt)).toBe(false);
    });

    test('should return true when 96 hours passed since request', () => {
      const fiveDaysAgo = new Date('2026-01-10T09:00:00Z');
      const appt: Appointment = {
        resourceType: 'Appointment',
        id: 'appt-1',
        status: 'booked',
        start: '2026-01-20T10:00:00Z',
        participant: [],
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
            extension: [
              { url: 'status', valueString: 'requested' },
              { url: 'amount', valueInteger: 250 },
              { url: 'requestedAt', valueDateTime: fiveDaysAgo.toISOString() },
            ],
          },
        ],
      };
      expect(shouldAutoCancel(appt)).toBe(true);
    });

    test('should return true when within 48 hours of appointment', () => {
      const appt: Appointment = {
        resourceType: 'Appointment',
        id: 'appt-1',
        status: 'booked',
        start: '2026-01-16T08:00:00Z', // 22h from now
        participant: [],
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
            extension: [
              { url: 'status', valueString: 'requested' },
              { url: 'amount', valueInteger: 250 },
              { url: 'requestedAt', valueDateTime: '2026-01-14T10:00:00Z' },
            ],
          },
        ],
      };
      expect(shouldAutoCancel(appt)).toBe(true);
    });

    test('should return false when > 48 hours away and < 96h since request', () => {
      const appt: Appointment = {
        resourceType: 'Appointment',
        id: 'appt-1',
        status: 'booked',
        start: '2026-01-18T10:00:00Z', // 72h from now
        participant: [],
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
            extension: [
              { url: 'status', valueString: 'requested' },
              { url: 'amount', valueInteger: 250 },
              { url: 'requestedAt', valueDateTime: '2026-01-14T10:00:00Z' }, // 48h ago
            ],
          },
        ],
      };
      expect(shouldAutoCancel(appt)).toBe(false);
    });
  });

  describe('formatDepositAmount', () => {
    test('should format whole dollars correctly', () => {
      expect(formatDepositAmount(250)).toBe('$250.00');
    });

    test('should format cents correctly', () => {
      expect(formatDepositAmount(250.5)).toBe('$250.50');
    });

    test('should include dollar sign', () => {
      expect(formatDepositAmount(100)).toContain('$');
    });

    test('should format zero correctly', () => {
      expect(formatDepositAmount(0)).toBe('$0.00');
    });

    test('should format large amounts correctly', () => {
      expect(formatDepositAmount(10000)).toBe('$10,000.00');
    });
  });

  describe('getDepositStatusColor', () => {
    test('should return gray for pending', () => {
      expect(getDepositStatusColor('pending')).toBe('gray');
    });

    test('should return yellow for requested', () => {
      expect(getDepositStatusColor('requested')).toBe('yellow');
    });

    test('should return green for paid', () => {
      expect(getDepositStatusColor('paid')).toBe('green');
    });

    test('should return blue for waived', () => {
      expect(getDepositStatusColor('waived')).toBe('blue');
    });
  });

  describe('canRequestDeposit', () => {
    test('should return true for pending status', () => {
      expect(canRequestDeposit('pending')).toBe(true);
    });

    test('should return false for requested status', () => {
      expect(canRequestDeposit('requested')).toBe(false);
    });

    test('should return false for paid status', () => {
      expect(canRequestDeposit('paid')).toBe(false);
    });

    test('should return false for waived status', () => {
      expect(canRequestDeposit('waived')).toBe(false);
    });
  });

  describe('canMarkPaid', () => {
    test('should return true for pending status', () => {
      expect(canMarkPaid('pending')).toBe(true);
    });

    test('should return true for requested status', () => {
      expect(canMarkPaid('requested')).toBe(true);
    });

    test('should return false for paid status', () => {
      expect(canMarkPaid('paid')).toBe(false);
    });

    test('should return false for waived status', () => {
      expect(canMarkPaid('waived')).toBe(false);
    });
  });

  describe('canWaiveDeposit', () => {
    test('should return true for pending status', () => {
      expect(canWaiveDeposit('pending')).toBe(true);
    });

    test('should return true for requested status', () => {
      expect(canWaiveDeposit('requested')).toBe(true);
    });

    test('should return false for paid status', () => {
      expect(canWaiveDeposit('paid')).toBe(false);
    });

    test('should return false for waived status', () => {
      expect(canWaiveDeposit('waived')).toBe(false);
    });
  });

  describe('getDepositStatus (deprecated)', () => {
    test('should extract status from appointment extension', () => {
      const appt: Appointment = {
        resourceType: 'Appointment',
        id: 'appt-1',
        status: 'booked',
        participant: [],
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
            extension: [
              { url: 'status', valueString: 'paid' },
              { url: 'amount', valueInteger: 250 },
            ],
          },
        ],
      };
      const result = getDepositStatus(appt);
      expect(result.status).toBe('paid');
      expect(result.amount).toBe(250);
    });

    test('should extract amount from extension', () => {
      const appt: Appointment = {
        resourceType: 'Appointment',
        id: 'appt-1',
        status: 'booked',
        participant: [],
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
            extension: [
              { url: 'status', valueString: 'requested' },
              { url: 'amount', valueInteger: 300 },
            ],
          },
        ],
      };
      const result = getDepositStatus(appt);
      expect(result.amount).toBe(300);
    });

    test('should extract requestedAt date', () => {
      const appt: Appointment = {
        resourceType: 'Appointment',
        id: 'appt-1',
        status: 'booked',
        participant: [],
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
            extension: [
              { url: 'status', valueString: 'requested' },
              { url: 'amount', valueInteger: 250 },
              { url: 'requestedAt', valueDateTime: '2026-01-14T10:00:00Z' },
            ],
          },
        ],
      };
      const result = getDepositStatus(appt);
      expect(result.requestedAt?.toISOString()).toBe('2026-01-14T10:00:00.000Z');
    });

    test('should extract paidAt date', () => {
      const appt: Appointment = {
        resourceType: 'Appointment',
        id: 'appt-1',
        status: 'booked',
        participant: [],
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
            extension: [
              { url: 'status', valueString: 'paid' },
              { url: 'amount', valueInteger: 250 },
              { url: 'paidAt', valueDateTime: '2026-01-15T12:00:00Z' },
            ],
          },
        ],
      };
      const result = getDepositStatus(appt);
      expect(result.paidAt?.toISOString()).toBe('2026-01-15T12:00:00.000Z');
    });

    test('should extract paymentType', () => {
      const appt: Appointment = {
        resourceType: 'Appointment',
        id: 'appt-1',
        status: 'booked',
        participant: [],
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
            extension: [
              { url: 'status', valueString: 'paid' },
              { url: 'amount', valueInteger: 250 },
              { url: 'paymentType', valueString: 'online' },
            ],
          },
        ],
      };
      const result = getDepositStatus(appt);
      expect(result.paymentType).toBe('online');
    });

    test('should extract paymentNotes', () => {
      const appt: Appointment = {
        resourceType: 'Appointment',
        id: 'appt-1',
        status: 'booked',
        participant: [],
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
            extension: [
              { url: 'status', valueString: 'paid' },
              { url: 'amount', valueInteger: 250 },
              { url: 'paymentNotes', valueString: 'Check #1234' },
            ],
          },
        ],
      };
      const result = getDepositStatus(appt);
      expect(result.paymentNotes).toBe('Check #1234');
    });

    test('should return default values when extension missing', () => {
      const appt: Appointment = {
        resourceType: 'Appointment',
        id: 'appt-1',
        status: 'booked',
        participant: [],
      };
      const result = getDepositStatus(appt);
      expect(result.status).toBe('pending');
      expect(result.amount).toBe(0);
    });

    test('should handle waived status', () => {
      const appt: Appointment = {
        resourceType: 'Appointment',
        id: 'appt-1',
        status: 'booked',
        participant: [],
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
            extension: [
              { url: 'status', valueString: 'waived' },
              { url: 'amount', valueInteger: 250 },
              { url: 'waivedAt', valueDateTime: '2026-01-15T10:00:00Z' },
              { url: 'waivedReason', valueString: 'Promotion' },
            ],
          },
        ],
      };
      const result = getDepositStatus(appt);
      expect(result.status).toBe('waived');
      expect(result.waivedAt).toBeDefined();
      expect(result.waivedReason).toBe('Promotion');
    });

    test('should handle isUndone flag', () => {
      const appt: Appointment = {
        resourceType: 'Appointment',
        id: 'appt-1',
        status: 'booked',
        participant: [],
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
            extension: [
              { url: 'status', valueString: 'paid' },
              { url: 'amount', valueInteger: 250 },
              { url: 'isUndone', valueBoolean: true },
              { url: 'undoneReason', valueString: 'Patient requested refund' },
            ],
          },
        ],
      };
      const result = getDepositStatus(appt);
      expect(result.isUndone).toBe(true);
      expect(result.undoneReason).toBe('Patient requested refund');
    });
  });

  describe('buildDepositInfoExtensions (deprecated)', () => {
    test('should build extension with status and amount', () => {
      const result = buildDepositInfoExtensions({ status: 'pending', amount: 250 });
      expect(result.url).toContain('deposit-info');
      expect(result.extension).toEqual(
        expect.arrayContaining([
          { url: 'status', valueString: 'pending' },
          { url: 'amount', valueInteger: 250 },
        ])
      );
    });

    test('should include requestedAt when provided', () => {
      const date = new Date('2026-01-14T10:00:00Z');
      const result = buildDepositInfoExtensions({ status: 'requested', amount: 200, requestedAt: date });
      expect(result.extension).toContainEqual({ url: 'requestedAt', valueDateTime: date.toISOString() });
    });

    test('should include paidAt when provided', () => {
      const date = new Date('2026-01-15T12:00:00Z');
      const result = buildDepositInfoExtensions({ status: 'paid', amount: 250, paidAt: date });
      expect(result.extension).toContainEqual({ url: 'paidAt', valueDateTime: date.toISOString() });
    });

    test('should include paidBy reference', () => {
      const paidBy = { reference: 'Practitioner/123', display: 'Dr. Smith' };
      const result = buildDepositInfoExtensions({ status: 'paid', amount: 250, paidBy });
      expect(result.extension).toContainEqual({ url: 'paidBy', valueReference: paidBy });
    });

    test('should include paymentType', () => {
      const result = buildDepositInfoExtensions({ status: 'paid', amount: 250, paymentType: 'manual' });
      expect(result.extension).toContainEqual({ url: 'paymentType', valueString: 'manual' });
    });

    test('should include paymentNotes', () => {
      const result = buildDepositInfoExtensions({ status: 'paid', amount: 250, paymentNotes: 'Cash payment' });
      expect(result.extension).toContainEqual({ url: 'paymentNotes', valueString: 'Cash payment' });
    });

    test('should include waived info when applicable', () => {
      const date = new Date('2026-01-15T10:00:00Z');
      const result = buildDepositInfoExtensions({
        status: 'waived',
        amount: 250,
        waivedAt: date,
        waivedReason: 'Promotion',
      });
      expect(result.extension).toContainEqual({ url: 'waivedAt', valueDateTime: date.toISOString() });
      expect(result.extension).toContainEqual({ url: 'waivedReason', valueString: 'Promotion' });
    });

    test('should include undo tracking when applicable', () => {
      const date = new Date('2026-01-16T10:00:00Z');
      const result = buildDepositInfoExtensions({
        status: 'paid',
        amount: 250,
        isUndone: true,
        undoneAt: date,
        undoneReason: 'Refund issued',
      });
      expect(result.extension).toContainEqual({ url: 'isUndone', valueBoolean: true });
      expect(result.extension).toContainEqual({ url: 'undoneReason', valueString: 'Refund issued' });
    });
  });
});
