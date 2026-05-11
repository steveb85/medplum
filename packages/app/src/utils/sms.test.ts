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
} from './sms';
import type { Patient, Appointment, ActivityDefinition } from '@medplum/fhirtypes';

describe('SMS Utilities', () => {
  describe('isSMSConfigured', () => {
    test.todo('should return true when all env vars set');
    test.todo('should return false when ACCOUNT_SID missing');
    test.todo('should return false when AUTH_TOKEN missing');
    test.todo('should return false when PHONE_NUMBER missing');
  });

  describe('sendSMS', () => {
    test.todo('should send SMS via Twilio API');
    test.todo('should return success with sid on success');
    test.todo('should return error when not configured');
    test.todo('should handle network errors gracefully');
    test.todo('should show notification in dev mode');
    test.todo('should use sandbox in dev environment');
  });

  describe('sendDepositRequestSMS', () => {
    test.todo('should generate correct message from template');
    test.todo('should replace patientName placeholder');
    test.todo('should replace serviceType placeholder');
    test.todo('should replace date placeholder');
    test.todo('should replace time placeholder');
    test.todo('should replace depositAmount placeholder');
    test.todo('should replace hours placeholder');
    test.todo('should replace paymentLink placeholder');
    test.todo('should return error when patient has no phone');
    test.todo('should calculate hours remaining correctly');
  });

  describe('sendPaymentConfirmationSMS', () => {
    test.todo('should generate confirmation message');
    test.todo('should include patient name');
    test.todo('should include amount paid');
    test.todo('should include appointment date');
    test.todo('should include appointment time');
    test.todo('should include service type');
    test.todo('should return error when no phone number');
  });

  describe('sendDepositReminderSMS', () => {
    test.todo('should generate reminder message');
    test.todo('should include deposit amount');
    test.todo('should include service type');
    test.todo('should include appointment date');
    test.todo('should include payment link');
  });

  describe('sendAppointmentReminder24h', () => {
    test.todo('should generate 24h reminder');
    test.todo('should include date');
    test.todo('should include time');
    test.todo('should include service type');
  });

  describe('sendAppointmentReminder2h', () => {
    test.todo('should generate 2h reminder');
    test.todo('should include time only');
  });

  describe('sendAutoCancelWarningSMS', () => {
    test.todo('should generate warning message');
    test.todo('should include service type');
    test.todo('should include appointment date');
    test.todo('should include payment link');
  });

  describe('sendAppointmentCancelledSMS', () => {
    test.todo('should generate cancellation message');
    test.todo('should include service type');
    test.todo('should include appointment date');
  });

  describe('sendPostTreatmentFollowUp', () => {
    test.todo('should generate follow-up message');
    test.todo('should include patient name');
    test.todo('should include service type');
  });

  describe('validatePhoneNumber', () => {
    test.todo('should validate 10-digit US numbers');
    test.todo('should validate 11-digit numbers with country code');
    test.todo('should reject numbers with letters');
    test.todo('should reject numbers with special chars');
    test.todo('should reject too short numbers');
    test.todo('should reject too long numbers');
    test.todo('should handle formatted numbers with dashes/parens');
  });

  describe('formatPhoneNumber', () => {
    test.todo('should format 10-digit as (XXX) XXX-XXXX');
    test.todo('should format 11-digit with +1 prefix');
    test.todo('should return original if invalid');
    test.todo('should strip non-numeric chars first');
  });
});
