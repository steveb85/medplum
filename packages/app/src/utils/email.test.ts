import type { Patient, Appointment, ActivityDefinition } from '@medplum/fhirtypes';
import {
  isEmailConfigured,
  sendEmail,
  sendDepositRequestEmail,
  sendPaymentConfirmationEmail,
  sendDepositReminderEmail,
  sendAppointmentReminder24hEmail,
  sendAppointmentReminder2hEmail,
  sendAutoCancelWarningEmail,
  sendAppointmentCancelledEmail,
  sendPostTreatmentFollowUpEmail,
  validateEmail,
  emailTemplates,
} from './email';

const mockPatient: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
  name: [{ given: ['Jane'], family: 'Doe' }],
  telecom: [{ system: 'email', value: 'jane@example.com' }],
};

const mockPatientNoEmail: Patient = {
  resourceType: 'Patient',
  id: 'patient-2',
  name: [{ given: ['No'], family: 'Email' }],
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

describe('Email Utilities', () => {
  describe('isEmailConfigured', () => {
    test('should return false when env vars not set (test env)', () => {
      expect(isEmailConfigured()).toBe(false);
    });
  });

  describe('sendEmail', () => {
    test('should return not configured without env vars', async () => {
      const result = await sendEmail('test@example.com', 'Subject', '<p>HTML</p>', 'Text');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email not configured');
    });
  });

  describe('Email Templates', () => {
    test('depositRequest template contains all variables', () => {
      const tmpl = emailTemplates.depositRequest.html;
      expect(tmpl).toContain('{patientName}');
      expect(tmpl).toContain('{serviceType}');
      expect(tmpl).toContain('{date}');
      expect(tmpl).toContain('{time}');
      expect(tmpl).toContain('{depositAmount}');
      expect(tmpl).toContain('{hours}');
      expect(tmpl).toContain('{paymentLink}');
    });

    test('depositRequest has correct subject line', () => {
      expect(emailTemplates.depositRequest.subject).toContain('Deposit Required');
    });

    test('paymentConfirmation template contains all variables', () => {
      const html = emailTemplates.paymentConfirmation.html;
      expect(html).toContain('{patientName}');
      expect(html).toContain('{amount}');
      expect(html).toContain('{date}');
      expect(html).toContain('{time}');
      expect(html).toContain('{serviceType}');
    });

    test('paymentConfirmation has correct subject line', () => {
      expect(emailTemplates.paymentConfirmation.subject).toContain('Deposit Received');
    });

    test('depositReminder template contains payment button', () => {
      const html = emailTemplates.depositReminder.html;
      expect(html).toContain('{depositAmount}');
      expect(html).toContain('{paymentLink}');
    });

    test('appointmentReminder24h mentions arriving 10 minutes early', () => {
      const html = emailTemplates.appointmentReminder24h.html;
      expect(html).toContain('10 minutes early');
    });
  });

  describe('sendDepositRequestEmail', () => {
    test('should return error when patient has no email', async () => {
      const result = await sendDepositRequestEmail(mockPatientNoEmail, mockAppointment, mockServices, 250, 'https://pay.example.com/123');
      expect(result.success).toBe(false);
      expect(result.error).toContain('email');
    });

    test('should return not configured when env vars missing', async () => {
      const result = await sendDepositRequestEmail(mockPatient, mockAppointment, mockServices, 250, 'https://pay.example.com/123');
      expect(result.success).toBe(false);
    });
  });

  describe('sendPaymentConfirmationEmail', () => {
    test('should return error when no email', async () => {
      const result = await sendPaymentConfirmationEmail(mockPatientNoEmail, mockAppointment, mockServices, 250);
      expect(result.success).toBe(false);
      expect(result.error).toContain('email');
    });
  });

  describe('sendDepositReminderEmail', () => {
    test('should return error when no email', async () => {
      const result = await sendDepositReminderEmail(mockPatientNoEmail, mockAppointment, mockServices, 250, 'https://pay.example.com/123');
      expect(result.success).toBe(false);
    });
  });

  describe('sendAppointmentReminder24hEmail', () => {
    test('should return error when no email', async () => {
      const result = await sendAppointmentReminder24hEmail(mockPatientNoEmail, mockAppointment, mockServices);
      expect(result.success).toBe(false);
    });
  });

  describe('sendAppointmentReminder2hEmail', () => {
    test('should return error when no email', async () => {
      const result = await sendAppointmentReminder2hEmail(mockPatientNoEmail, mockAppointment);
      expect(result.success).toBe(false);
    });
  });

  describe('sendAutoCancelWarningEmail', () => {
    test('should return error when no email', async () => {
      const result = await sendAutoCancelWarningEmail(mockPatientNoEmail, mockAppointment, mockServices, 'https://pay.example.com/123');
      expect(result.success).toBe(false);
    });
  });

  describe('sendAppointmentCancelledEmail', () => {
    test('should return error when no email', async () => {
      const result = await sendAppointmentCancelledEmail(mockPatientNoEmail, mockAppointment, mockServices);
      expect(result.success).toBe(false);
    });
  });

  describe('sendPostTreatmentFollowUpEmail', () => {
    test('should return error when no email', async () => {
      const result = await sendPostTreatmentFollowUpEmail(mockPatientNoEmail, mockServices);
      expect(result.success).toBe(false);
    });
  });

  describe('validateEmail', () => {
    test('should validate standard email format', () => {
      expect(validateEmail('user@example.com')).toBe(true);
    });

    test('should reject missing @ symbol', () => {
      expect(validateEmail('userexample.com')).toBe(false);
    });

    test('should reject missing domain', () => {
      expect(validateEmail('user@.com')).toBe(false);
    });

    test('should reject missing local part', () => {
      expect(validateEmail('@example.com')).toBe(false);
    });

    test('should handle + in local part', () => {
      expect(validateEmail('user+tag@example.com')).toBe(true);
    });

    test('should reject missing dot in domain', () => {
      expect(validateEmail('user@example')).toBe(false);
    });
  });
});
