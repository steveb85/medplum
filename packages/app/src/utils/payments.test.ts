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
import type { Appointment, ActivityDefinition } from '@medplum/fhirtypes';

describe('Payment Utilities', () => {
  describe('getDefaultDepositAmount', () => {
    test.todo('should return 200 for Botox services');
    test.todo('should return 300 for Filler services');
    test.todo('should return 100 for Consultation services');
    test.todo('should return configured amount from ActivityDefinition extension');
    test.todo('should return 250 as default for unknown services');
  });

  describe('calculatePaymentLinkExpiry', () => {
    test.todo('should return 96 hours for appointments > 96h away');
    test.todo('should return 48 hours when appointment is 72h away');
    test.todo('should return 24 hours when appointment is 48h away');
    test.todo('should return 12 hours when appointment is 24h away');
    test.todo('should never return negative time');
    test.todo('should handle Date object input');
    test.todo('should handle ISO string input');
    test.todo('should cap at appointment time minus 48 hours');
  });

  describe('calculateTotalDeposit', () => {
    test.todo('should return 0 for empty services array');
    test.todo('should return single service deposit');
    test.todo('should return highest deposit for multiple services');
    test.todo('should sum deposits correctly for different service types');
  });

  describe('shouldAutoCancel', () => {
    test.todo('should return false for paid bookings');
    test.todo('should return false for waived bookings');
    test.todo('should return false for pending status (not requested)');
    test.todo('should return true when 96 hours passed since request');
    test.todo('should return true when within 48 hours of appointment');
    test.todo('should return false when > 48 hours away and < 96h since request');
  });

  describe('formatDepositAmount', () => {
    test.todo('should format whole dollars correctly');
    test.todo('should format cents correctly');
    test.todo('should include dollar sign');
    test.todo('should format zero correctly');
    test.todo('should format large amounts correctly');
  });

  describe('getDepositStatusColor', () => {
    test.todo('should return gray for pending');
    test.todo('should return yellow for requested');
    test.todo('should return green for paid');
    test.todo('should return blue for waived');
  });

  describe('canRequestDeposit', () => {
    test.todo('should return true for pending status');
    test.todo('should return false for requested status');
    test.todo('should return false for paid status');
    test.todo('should return false for waived status');
  });

  describe('canMarkPaid', () => {
    test.todo('should return true for pending status');
    test.todo('should return true for requested status');
    test.todo('should return false for paid status');
    test.todo('should return false for waived status');
  });

  describe('canWaiveDeposit', () => {
    test.todo('should return true for pending status');
    test.todo('should return true for requested status');
    test.todo('should return false for paid status');
    test.todo('should return false for waived status');
  });

  describe('getDepositStatus (deprecated)', () => {
    test.todo('should extract status from appointment extension');
    test.todo('should extract amount from extension');
    test.todo('should extract requestedAt date');
    test.todo('should extract paidAt date');
    test.todo('should extract paymentType');
    test.todo('should extract paymentNotes');
    test.todo('should return default values when extension missing');
    test.todo('should handle waived status');
    test.todo('should handle isUndone flag');
  });

  describe('buildDepositInfoExtensions (deprecated)', () => {
    test.todo('should build extension with status and amount');
    test.todo('should include requestedAt when provided');
    test.todo('should include paidAt when provided');
    test.todo('should include paidBy reference');
    test.todo('should include paymentType');
    test.todo('should include paymentNotes');
    test.todo('should include waived info when applicable');
    test.todo('should include undo tracking when applicable');
  });
});
