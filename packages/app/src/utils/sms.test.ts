import type { Patient, Appointment, ActivityDefinition } from '@medplum/fhirtypes';
import {
  isSMSConfigured,
  sendSMS,
  sendDepositRequestSMS,
  sendPaymentConfirmationSMS,
  sendDepositReminderSMS,
  sendAppointmentReminder24h,
  sendAppointmentReminder2h,
  sendAutoCancelWarningSMS,
  sendAppointmentCancelledSMS,
  sendPostTreatmentFollowUp,
  validatePhoneNumber,
  formatPhoneNumber,
  smsTemplates,
} from './sms';

const mockPatient: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
  name: [{ given: ['Jane'], family: 'Doe' }],
  telecom: [{ system: 'phone', use: 'mobile', value: '+12125551234' }],
};

const mockPatientNoPhone: Patient = {
  resourceType: 'Patient',
  id: 'patient-2',
  name: [{ given: ['No'], family: 'Phone' }],
};

const mockAppointment: Appointment = {
  resourceType: 'Appointment',
  id: 'appt-1',
  status: 'booked',
  start: '2026-01-20T14:30:00Z',
  participant: [],
};

const mockServices: ActivityDefinition[] = [
  { resourceType: 'ActivityDefinition', id: 'ad-1', status: 'active', title: 'Botox' },
];

describe('SMS Utilities', () => {
  describe('isSMSConfigured', () => {
    test('should return false when env vars not set (test env)', () => {
      expect(isSMSConfigured()).toBe(false);
    });
  });

  describe('sendSMS', () => {
    test('should return not configured without env vars', async () => {
      const result = await sendSMS('+12125551234', 'Test message');
      expect(result.success).toBe(false);
      expect(result.error).toBe('SMS not configured');
    });
  });

  describe('SMS Templates', () => {
    test('depositRequest template contains all placeholders', () => {
      const tmpl = smsTemplates.depositRequest.template;
      expect(tmpl).toContain('{patientName}');
      expect(tmpl).toContain('{serviceType}');
      expect(tmpl).toContain('{date}');
      expect(tmpl).toContain('{time}');
      expect(tmpl).toContain('{depositAmount}');
      expect(tmpl).toContain('{hours}');
      expect(tmpl).toContain('{paymentLink}');
    });

    test('paymentConfirmation template contains all placeholders', () => {
      const tmpl = smsTemplates.paymentConfirmation.template;
      expect(tmpl).toContain('{patientName}');
      expect(tmpl).toContain('{amount}');
      expect(tmpl).toContain('{date}');
      expect(tmpl).toContain('{time}');
      expect(tmpl).toContain('{serviceType}');
    });

    test('depositReminder template contains all placeholders', () => {
      const tmpl = smsTemplates.depositReminder.template;
      expect(tmpl).toContain('{depositAmount}');
      expect(tmpl).toContain('{serviceType}');
      expect(tmpl).toContain('{date}');
      expect(tmpl).toContain('{paymentLink}');
    });

    test('appointmentReminder24h template contains all placeholders', () => {
      const tmpl = smsTemplates.appointmentReminder24h.template;
      expect(tmpl).toContain('{date}');
      expect(tmpl).toContain('{time}');
      expect(tmpl).toContain('{serviceType}');
    });

    test('appointmentReminder2h template contains time placeholder', () => {
      const tmpl = smsTemplates.appointmentReminder2h.template;
      expect(tmpl).toContain('{time}');
    });

    test('autoCancelWarning template contains all placeholders', () => {
      const tmpl = smsTemplates.autoCancelWarning.template;
      expect(tmpl).toContain('{serviceType}');
      expect(tmpl).toContain('{date}');
      expect(tmpl).toContain('{paymentLink}');
    });

    test('appointmentCancelled template contains all placeholders', () => {
      const tmpl = smsTemplates.appointmentCancelled.template;
      expect(tmpl).toContain('{serviceType}');
      expect(tmpl).toContain('{date}');
    });

    test('postTreatmentFollowUp template contains all placeholders', () => {
      const tmpl = smsTemplates.postTreatmentFollowUp.template;
      expect(tmpl).toContain('{patientName}');
      expect(tmpl).toContain('{serviceType}');
    });
  });

  describe('sendDepositRequestSMS', () => {
    test('should return error when patient has no phone', async () => {
      const result = await sendDepositRequestSMS(mockPatientNoPhone, mockAppointment, mockServices, 250, 'https://pay.example.com/123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('phone');
    });

    test('should return not configured when env vars missing (but phone exists)', async () => {
      const result = await sendDepositRequestSMS(mockPatient, mockAppointment, mockServices, 250, 'https://pay.example.com/123');
      expect(result.success).toBe(false);
    });
  });

  describe('sendPaymentConfirmationSMS', () => {
    test('should return error when no phone number', async () => {
      const result = await sendPaymentConfirmationSMS(mockPatientNoPhone, mockAppointment, mockServices, 250);
      expect(result.success).toBe(false);
      expect(result.error).toContain('phone');
    });
  });

  describe('sendDepositReminderSMS', () => {
    test('should return error when no phone', async () => {
      const result = await sendDepositReminderSMS(mockPatientNoPhone, mockAppointment, mockServices, 250, 'https://pay.example.com/link');
      expect(result.success).toBe(false);
    });
  });

  describe('sendAppointmentReminder24h', () => {
    test('should return error when no phone', async () => {
      const result = await sendAppointmentReminder24h(mockPatientNoPhone, mockAppointment, mockServices);
      expect(result.success).toBe(false);
    });
  });

  describe('sendAppointmentReminder2h', () => {
    test('should return error when no phone', async () => {
      const result = await sendAppointmentReminder2h(mockPatientNoPhone, mockAppointment);
      expect(result.success).toBe(false);
    });
  });

  describe('sendAutoCancelWarningSMS', () => {
    test('should return error when no phone', async () => {
      const result = await sendAutoCancelWarningSMS(mockPatientNoPhone, mockAppointment, mockServices, 'https://pay.example.com/123');
      expect(result.success).toBe(false);
    });
  });

  describe('sendAppointmentCancelledSMS', () => {
    test('should return error when no phone', async () => {
      const result = await sendAppointmentCancelledSMS(mockPatientNoPhone, mockAppointment, mockServices);
      expect(result.success).toBe(false);
    });
  });

  describe('sendPostTreatmentFollowUp', () => {
    test('should return error when no phone', async () => {
      const result = await sendPostTreatmentFollowUp(mockPatientNoPhone, mockServices);
      expect(result.success).toBe(false);
    });
  });

  describe('validatePhoneNumber', () => {
    test('should validate 10-digit US numbers', () => {
      expect(validatePhoneNumber('2125551234')).toBe(true);
    });

    test('should validate 11-digit numbers with country code', () => {
      expect(validatePhoneNumber('12125551234')).toBe(true);
    });

    test('should reject numbers with letters', () => {
      expect(validatePhoneNumber('212555ABCD')).toBe(false);
    });

    test('should reject too short numbers', () => {
      expect(validatePhoneNumber('12345')).toBe(false);
    });

    test('should reject too long numbers', () => {
      expect(validatePhoneNumber('123456789012')).toBe(false);
    });

    test('should handle formatted numbers with dashes and parens', () => {
      expect(validatePhoneNumber('(212) 555-1234')).toBe(true);
    });
  });

  describe('formatPhoneNumber', () => {
    test('should format 10-digit as (XXX) XXX-XXXX', () => {
      expect(formatPhoneNumber('2125551234')).toBe('(212) 555-1234');
    });

    test('should format 11-digit with +1 prefix', () => {
      expect(formatPhoneNumber('12125551234')).toBe('+1 (212) 555-1234');
    });

    test('should return original if invalid', () => {
      expect(formatPhoneNumber('short')).toBe('short');
    });

    test('should strip non-numeric chars first', () => {
      expect(formatPhoneNumber('(212) 555-1234')).toBe('(212) 555-1234');
    });
  });
});
