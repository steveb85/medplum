/**
 * Payment utility functions for deposit management
 * Handles deposit status, payment link expiry calculation, and amount calculations
 */

import type { Appointment, ActivityDefinition } from '@medplum/fhirtypes';
import dayjs from 'dayjs';

export type DepositStatus = 'pending' | 'requested' | 'paid' | 'waived';

export interface DepositInfo {
  status: DepositStatus;
  amount: number;
  requestedAt?: Date;
  // Payment tracking
  paidAt?: Date;
  paidBy?: { reference: string; display?: string };
  paymentType?: 'online' | 'manual'; // online = Stripe, manual = cash/check/etc
  paymentNotes?: string; // For manual payments: check number, cash, etc.
  // Undo tracking (only for manual payments)
  isUndone?: boolean;
  undoneAt?: Date;
  undoneBy?: { reference: string; display?: string };
  undoneReason?: string;
  // Waiver tracking
  waivedAt?: Date;
  waivedBy?: { reference: string; display?: string };
  waivedReason?: string;
}

/**
 * Get deposit status from appointment extensions
 */
export function getDepositStatus(appointment: Appointment): DepositInfo {
  const ext = appointment.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info'
  );

  if (!ext?.extension) {
    return { status: 'pending', amount: 0 };
  }

  const status = ext.extension.find((e) => e.url === 'status')?.valueString as DepositStatus | undefined;
  const amount = ext.extension.find((e) => e.url === 'amount')?.valueInteger ?? 0;
  const requestedAtRaw = ext.extension.find((e) => e.url === 'requestedAt')?.valueDateTime;
  const paidAtRaw = ext.extension.find((e) => e.url === 'paidAt')?.valueDateTime;
  const paidBy = ext.extension.find((e) => e.url === 'paidBy')?.valueReference;
  const paymentType = ext.extension.find((e) => e.url === 'paymentType')?.valueString as 'online' | 'manual' | undefined;
  const paymentNotes = ext.extension.find((e) => e.url === 'paymentNotes')?.valueString;
  const isUndone = ext.extension.find((e) => e.url === 'isUndone')?.valueBoolean;
  const undoneAtRaw = ext.extension.find((e) => e.url === 'undoneAt')?.valueDateTime;
  const undoneBy = ext.extension.find((e) => e.url === 'undoneBy')?.valueReference;
  const undoneReason = ext.extension.find((e) => e.url === 'undoneReason')?.valueString;
  const waivedAtRaw = ext.extension.find((e) => e.url === 'waivedAt')?.valueDateTime;
  const waivedBy = ext.extension.find((e) => e.url === 'waivedBy')?.valueReference;
  const waivedReason = ext.extension.find((e) => e.url === 'waivedReason')?.valueString;

  return {
    status: status ?? 'pending',
    amount,
    requestedAt: requestedAtRaw ? new Date(requestedAtRaw) : undefined,
    paidAt: paidAtRaw ? new Date(paidAtRaw) : undefined,
    paidBy,
    paymentType,
    paymentNotes,
    isUndone,
    undoneAt: undoneAtRaw ? new Date(undoneAtRaw) : undefined,
    undoneBy,
    undoneReason,
    waivedAt: waivedAtRaw ? new Date(waivedAtRaw) : undefined,
    waivedBy,
    waivedReason,
  };
}

/**
 * Build deposit info extensions for saving to appointment
 */
export function buildDepositInfoExtensions(depositInfo: DepositInfo): { url: string; extension: Array<{ url: string; [key: string]: unknown }> } {
  const extensions: Array<{ url: string; [key: string]: unknown }> = [
    { url: 'status', valueString: depositInfo.status },
    { url: 'amount', valueInteger: depositInfo.amount },
  ];

  if (depositInfo.requestedAt) {
    extensions.push({ url: 'requestedAt', valueDateTime: depositInfo.requestedAt.toISOString() });
  }
  if (depositInfo.paidAt) {
    extensions.push({ url: 'paidAt', valueDateTime: depositInfo.paidAt.toISOString() });
  }
  if (depositInfo.paidBy) {
    extensions.push({ url: 'paidBy', valueReference: depositInfo.paidBy });
  }
  if (depositInfo.paymentType) {
    extensions.push({ url: 'paymentType', valueString: depositInfo.paymentType });
  }
  if (depositInfo.paymentNotes) {
    extensions.push({ url: 'paymentNotes', valueString: depositInfo.paymentNotes });
  }
  // Undo tracking
  if (depositInfo.isUndone) {
    extensions.push({ url: 'isUndone', valueBoolean: depositInfo.isUndone });
  }
  if (depositInfo.undoneAt) {
    extensions.push({ url: 'undoneAt', valueDateTime: depositInfo.undoneAt.toISOString() });
  }
  if (depositInfo.undoneBy) {
    extensions.push({ url: 'undoneBy', valueReference: depositInfo.undoneBy });
  }
  if (depositInfo.undoneReason) {
    extensions.push({ url: 'undoneReason', valueString: depositInfo.undoneReason });
  }
  if (depositInfo.waivedAt) {
    extensions.push({ url: 'waivedAt', valueDateTime: depositInfo.waivedAt.toISOString() });
  }
  if (depositInfo.waivedBy) {
    extensions.push({ url: 'waivedBy', valueReference: depositInfo.waivedBy });
  }
  if (depositInfo.waivedReason) {
    extensions.push({ url: 'waivedReason', valueString: depositInfo.waivedReason });
  }

  return {
    url: 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info',
    extension: extensions,
  };
}

/**
 * Calculate payment link expiry based on appointment time
 * Rules:
 * - Default: 96 hours
 * - If appointment < 96h away: Use (appointment_time - 48h)
 * - If appointment < 48h away: Use 24 hours
 * - If appointment < 24h away: Use 12 hours
 */
export function calculatePaymentLinkExpiry(appointmentStart: Date | string): Date {
  const now = dayjs();
  const appointment = dayjs(appointmentStart);
  const hoursUntilAppointment = appointment.diff(now, 'hours');

  let expiryHours = 96; // Default

  if (hoursUntilAppointment < 96) {
    expiryHours = Math.max(hoursUntilAppointment - 48, 12);
  }
  if (hoursUntilAppointment < 48) {
    expiryHours = 24;
  }
  if (hoursUntilAppointment < 24) {
    expiryHours = 12;
  }

  return now.add(expiryHours, 'hours').toDate();
}

/**
 * Get default deposit amount for a service
 */
export function getDefaultDepositAmount(service: ActivityDefinition): number {
  const ext = service.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/service-config'
  );

  return ext?.extension?.find((e) => e.url === 'depositAmount')?.valueInteger ?? 250;
}

/**
 * Calculate total deposit for multiple services
 * Uses highest deposit amount if services have different defaults
 */
export function calculateTotalDeposit(services: ActivityDefinition[]): number {
  if (services.length === 0) return 0;

  const amounts = services.map(getDefaultDepositAmount);
  return Math.max(...amounts);
}

/**
 * Check if booking should be auto-cancelled
 * Auto-cancel if:
 * 1. 96 hours have passed since deposit request
 * OR
 * 2. Within 48 hours of appointment and deposit not paid/waived
 */
export function shouldAutoCancel(appointment: Appointment): boolean {
  const depositInfo = getDepositStatus(appointment);

  // Already paid or waived - don't cancel
  if (depositInfo.status === 'paid' || depositInfo.status === 'waived') {
    return false;
  }

  // Not yet requested - don't cancel
  if (depositInfo.status === 'pending') {
    return false;
  }

  const now = dayjs();
  const appointmentTime = dayjs(appointment.start);
  const hoursUntilAppointment = appointmentTime.diff(now, 'hours');

  // Get deposit requested timestamp
  const hoursSinceRequest = depositInfo.requestedAt
    ? now.diff(depositInfo.requestedAt, 'hours')
    : 0;

  // Auto-cancel if 96 hours passed since request
  if (hoursSinceRequest >= 96) {
    return true;
  }

  // Auto-cancel if within 48 hours of appointment
  if (hoursUntilAppointment <= 48) {
    return true;
  }

  return false;
}

/**
 * Format deposit amount for display
 */
export function formatDepositAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Get deposit status display color
 */
export function getDepositStatusColor(status: DepositStatus): string {
  switch (status) {
    case 'paid':
      return 'green';
    case 'waived':
      return 'blue';
    case 'requested':
      return 'yellow';
    case 'pending':
    default:
      return 'gray';
  }
}

/**
 * Check if deposit can be requested
 */
export function canRequestDeposit(status: DepositStatus): boolean {
  return status === 'pending';
}

/**
 * Check if deposit can be marked as paid
 */
export function canMarkPaid(status: DepositStatus): boolean {
  return status === 'pending' || status === 'requested';
}

/**
 * Check if deposit can be waived
 */
export function canWaiveDeposit(status: DepositStatus): boolean {
  return status === 'pending' || status === 'requested';
}
