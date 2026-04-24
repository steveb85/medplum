/**
 * Automated reminders scheduler
 * Handles deposit reminders, appointment reminders, and post-treatment follow-ups
 */

import type { Appointment, Patient, ActivityDefinition, Practitioner, ServiceRequest } from '@medplum/fhirtypes';
import dayjs from 'dayjs';
import { getDepositStatus, shouldAutoCancel, DepositStatus } from './payments';
import { sendDepositReminderSMS, sendAppointmentReminder24h, sendAppointmentReminder2h, sendAutoCancelWarningSMS, sendPostTreatmentFollowUp, sendAppointmentCancelledSMS } from './sms';
import { sendDepositReminderEmail, sendAppointmentReminder24hEmail, sendAppointmentReminder2hEmail, sendAppointmentCancelledEmail } from './email';

export interface ReminderSchedule {
  depositReminders: number;      // Max reminders (default: 4)
  depositReminderInterval: number; // Hours between reminders (default: 24)
  appointmentReminder24h: boolean; // 24h before appointment
  appointmentReminder2h: boolean; // 2h before appointment
  followUpEnabled: boolean;    // Post-treatment follow-ups
}

export interface ReminderJob {
  id: string;
  type: 'deposit_reminder' | 'appointment_reminder_24h' | 'appointment_reminder_2h' | 'auto_cancel' | 'post_treatment';
  appointmentId: string;
  patientId: string;
  scheduledAt: Date;
  attempts: number;
  maxAttempts: number;
}

// Default reminder configuration
export const defaultReminderSchedule: ReminderSchedule = {
  depositReminders: 4,
  depositReminderInterval: 24,
  appointmentReminder24h: true,
  appointmentReminder2h: true,
  followUpEnabled: true,
};

/**
 * Get reminder configuration from service
 */
export function getReminderConfig(service: ActivityDefinition): ReminderSchedule {
  const ext = service.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/service-config'
  );

  return {
    depositReminders: ext?.extension?.find((e) => e.url === 'depositReminders')?.valueInteger ?? 4,
    depositReminderInterval: ext?.extension?.find((e) => e.url === 'depositReminderInterval')?.valueInteger ?? 24,
    appointmentReminder24h: true,
    appointmentReminder2h: true,
    followUpEnabled: true,
  };
}

/**
 * Check if deposit reminder should be sent
 * Returns the reminder number (1-4) or null if no reminder needed
 */
export function shouldSendDepositReminder(
  appointment: Appointment,
  config: ReminderSchedule
): number | null {
  const depositInfo = getDepositStatus(appointment);

  // Don't send if already paid or waived
  if (depositInfo.status === 'paid' || depositInfo.status === 'waived') {
    return null;
  }

  // Don't send if not yet requested
  if (depositInfo.status === 'pending') {
    return null;
  }

  // Don't send if auto-cancel conditions met
  if (shouldAutoCancel(appointment)) {
    return null;
  }

  if (!depositInfo.requestedAt) {
    return null;
  }

  const now = dayjs();
  const hoursSinceRequest = now.diff(depositInfo.requestedAt, 'hours');
  const reminderInterval = config.depositReminderInterval;

  // Calculate which reminder this should be
  const reminderNumber = Math.floor(hoursSinceRequest / reminderInterval);

  // Check if within valid reminder count
  if (reminderNumber >= 1 && reminderNumber <= config.depositReminders) {
    // Check if we haven't already sent this reminder (would need to track in extensions)
    const lastReminderExt = appointment.extension?.find(
      (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/last-deposit-reminder'
    );
    const lastReminderNumber = lastReminderExt?.extension?.find((e) => e.url === 'reminderNumber')?.valueInteger ?? 0;

    if (reminderNumber > lastReminderNumber) {
      return reminderNumber;
    }
  }

  return null;
}

/**
 * Calculate next reminder time
 */
export function getNextReminderTime(
  appointment: Appointment,
  config: ReminderSchedule
): Date | null {
  const depositInfo = getDepositStatus(appointment);

  if (!depositInfo.requestedAt || depositInfo.status === 'paid' || depositInfo.status === 'waived') {
    return null;
  }

  const now = dayjs();
  const hoursSinceRequest = now.diff(depositInfo.requestedAt, 'hours');
  const reminderInterval = config.depositReminderInterval;

  // Find next reminder slot
  for (let i = 1; i <= config.depositReminders; i++) {
    const reminderTime = dayjs(depositInfo.requestedAt).add(i * reminderInterval, 'hours');
    if (reminderTime.isAfter(now)) {
      return reminderTime.toDate();
    }
  }

  return null;
}

/**
 * Check if auto-cancel warning should be sent
 * Send warning 24 hours before auto-cancel
 */
export function shouldSendAutoCancelWarning(appointment: Appointment): boolean {
  const depositInfo = getDepositStatus(appointment);

  if (depositInfo.status === 'paid' || depositInfo.status === 'waived') {
    return false;
  }

  if (!depositInfo.requestedAt) {
    return false;
  }

  const now = dayjs();
  const appointmentTime = dayjs(appointment.start);
  const hoursSinceRequest = now.diff(depositInfo.requestedAt, 'hours');
  const hoursUntilAppointment = appointmentTime.diff(now, 'hours');

  // Auto-cancel conditions:
  // 1. 96 hours passed since request
  // 2. Within 48 hours of appointment
  const willAutoCancelAt96h = hoursSinceRequest >= 72 && hoursSinceRequest < 96;
  const willAutoCancelAt48h = hoursUntilAppointment <= 72 && hoursUntilAppointment > 48;

  // Check if warning already sent
  const warningSent = appointment.extension?.some(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/auto-cancel-warning-sent'
  );

  return (willAutoCancelAt96h || willAutoCancelAt48h) && !warningSent;
}

/**
 * Check if appointment reminder should be sent (24h)
 */
export function shouldSendAppointmentReminder24h(appointment: Appointment): boolean {
  if (!appointment.start) return false;
  if (appointment.status !== 'booked') return false;

  const now = dayjs();
  const appointmentTime = dayjs(appointment.start);
  const hoursUntilAppointment = appointmentTime.diff(now, 'hours');

  // Send between 23-25 hours before
  const shouldSend = hoursUntilAppointment <= 25 && hoursUntilAppointment >= 23;

  // Check if already sent
  const alreadySent = appointment.extension?.some(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/appointment-reminder-24h-sent'
  );

  return shouldSend && !alreadySent;
}

/**
 * Check if appointment reminder should be sent (2h)
 */
export function shouldSendAppointmentReminder2h(appointment: Appointment): boolean {
  if (!appointment.start) return false;
  if (appointment.status !== 'booked' && appointment.status !== 'arrived') return false;

  const now = dayjs();
  const appointmentTime = dayjs(appointment.start);
  const hoursUntilAppointment = appointmentTime.diff(now, 'hours');

  // Send between 1.5-2.5 hours before
  const shouldSend = hoursUntilAppointment <= 2.5 && hoursUntilAppointment >= 1.5;

  // Check if already sent
  const alreadySent = appointment.extension?.some(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/appointment-reminder-2h-sent'
  );

  return shouldSend && !alreadySent;
}

/**
 * Check if post-treatment follow-up should be sent
 */
export function shouldSendPostTreatmentFollowUp(
  appointment: Appointment,
  services: ActivityDefinition[]
): { shouldSend: boolean; hours?: number } {
  if (appointment.status !== 'fulfilled') {
    return { shouldSend: false };
  }

  const now = dayjs();
  const endTime = dayjs(appointment.end || appointment.start);

  // Get follow-up schedule from first service
  const service = services[0];
  if (!service) return { shouldSend: false };

  const ext = service.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/service-config'
  );
  const followUpScheduleRaw = ext?.extension?.find((e) => e.url === 'followUpSchedule')?.valueString;

  if (!followUpScheduleRaw) return { shouldSend: false };

  try {
    const followUpSchedule = JSON.parse(followUpScheduleRaw) as Array<{ hours: number; message: string }>;

    // Check each follow-up time
    for (const followUp of followUpSchedule) {
      const hoursSinceEnd = now.diff(endTime, 'hours');
      const shouldSend = hoursSinceEnd >= followUp.hours && hoursSinceEnd < followUp.hours + 1;

      // Check if already sent for this time
      const alreadySent = appointment.extension?.some(
        (e) =>
          e.url === 'http://melissaknudson.com/fhir/StructureDefinition/post-treatment-followup-sent' &&
          e.extension?.some((ext) => ext.url === 'hours' && ext.valueInteger === followUp.hours)
      );

      if (shouldSend && !alreadySent) {
        return { shouldSend: true, hours: followUp.hours };
      }
    }
  } catch {
    // Invalid JSON, skip
  }

  return { shouldSend: false };
}

/**
 * Mark reminder as sent
 */
export function markReminderSent(
  appointment: Appointment,
  reminderType: string,
  extraData?: Record<string, unknown>
): Appointment {
  const extension = {
    url: reminderType,
    extension: [
      { url: 'sentAt', valueDateTime: new Date().toISOString() },
      ...(extraData
        ? Object.entries(extraData).map(([key, value]) => ({
            url: key,
            ...(typeof value === 'number'
              ? { valueInteger: value }
              : typeof value === 'boolean'
                ? { valueBoolean: value }
                : { valueString: String(value) }),
          }))
        : []),
    ],
  };

  return {
    ...appointment,
    extension: [...(appointment.extension || []), extension],
  };
}

/**
 * Process all reminders for an appointment
 * This would be called by a background job or cron
 */
export async function processReminders(
  medplum: {
    readResource: (type: string, id: string) => Promise<unknown>;
    updateResource: (resource: unknown) => Promise<unknown>;
    search: (type: string, params: Record<string, string>) => Promise<{ entry?: Array<{ resource?: unknown }> }>;
  },
  appointment: Appointment
): Promise<void> {
  const depositInfo = getDepositStatus(appointment);
  const patientRef = appointment.participant?.find((p) => p.actor?.reference?.startsWith('Patient/'))?.actor?.reference;

  if (!patientRef) return;

  const patientId = patientRef.split('/')[1];
  let patient: Patient | undefined;
  try {
    patient = (await medplum.readResource('Patient', patientId)) as Patient;
  } catch {
    return;
  }

  // Load services
  const srBundle = await medplum.search('ServiceRequest', {
    'appointment-reference': `Appointment/${appointment.id}`,
  });
  const serviceRequests = (srBundle.entry || []).map((e) => e.resource as ServiceRequest);

  const services: ActivityDefinition[] = [];
  for (const sr of serviceRequests) {
    const code = sr.code?.coding?.[0]?.code;
    if (code) {
      try {
        const adBundle = await medplum.search('ActivityDefinition', {
          'code:exact': code,
          status: 'active',
        });
        const ad = adBundle.entry?.[0]?.resource as ActivityDefinition;
        if (ad) services.push(ad);
      } catch {
        // Skip
      }
    }
  }

  const config = services[0] ? getReminderConfig(services[0]) : defaultReminderSchedule;

  // Check auto-cancel first (highest priority)
  if (shouldAutoCancel(appointment)) {
    // Cancel the appointment
    const updatedAppointment: Appointment = {
      ...appointment,
      status: 'cancelled',
    };
    await medplum.updateResource(updatedAppointment);

    // Send cancellation notification
    if (patient) {
      await sendAppointmentCancelledSMS(patient, appointment, services);
      await sendAppointmentCancelledEmail(patient, appointment, services);
    }
    return;
  }

  // Check auto-cancel warning
  if (shouldSendAutoCancelWarning(appointment)) {
    // Generate payment link
    const paymentLink = `https://pay.studioassistant.io/d/${appointment.id}`;

    if (patient) {
      await sendAutoCancelWarningSMS(patient, appointment, services, paymentLink);
    }

    // Mark as sent
    const markedAppointment = markReminderSent(
      appointment,
      'http://melissaknudson.com/fhir/StructureDefinition/auto-cancel-warning-sent'
    );
    await medplum.updateResource(markedAppointment);
    return;
  }

  // Check deposit reminders
  const reminderNumber = shouldSendDepositReminder(appointment, config);
  if (reminderNumber && patient) {
    const paymentLink = `https://pay.studioassistant.io/d/${appointment.id}`;

    await sendDepositReminderSMS(patient, appointment, services, depositInfo.amount, paymentLink);
    await sendDepositReminderEmail(patient, appointment, services, depositInfo.amount, paymentLink);

    // Mark as sent
    const markedAppointment = markReminderSent(
      appointment,
      'http://melissaknudson.com/fhir/StructureDefinition/last-deposit-reminder',
      { reminderNumber }
    );
    await medplum.updateResource(markedAppointment);
    return;
  }

  // Check appointment reminders (24h)
  if (shouldSendAppointmentReminder24h(appointment) && patient) {
    await sendAppointmentReminder24h(patient, appointment, services);
    await sendAppointmentReminder24hEmail(patient, appointment, services);

    const markedAppointment = markReminderSent(
      appointment,
      'http://melissaknudson.com/fhir/StructureDefinition/appointment-reminder-24h-sent'
    );
    await medplum.updateResource(markedAppointment);
    return;
  }

  // Check appointment reminders (2h)
  if (shouldSendAppointmentReminder2h(appointment) && patient) {
    await sendAppointmentReminder2h(patient, appointment);
    await sendAppointmentReminder2hEmail(patient, appointment);

    const markedAppointment = markReminderSent(
      appointment,
      'http://melissaknudson.com/fhir/StructureDefinition/appointment-reminder-2h-sent'
    );
    await medplum.updateResource(markedAppointment);
    return;
  }

  // Check post-treatment follow-up
  const followUpCheck = shouldSendPostTreatmentFollowUp(appointment, services);
  if (followUpCheck.shouldSend && followUpCheck.hours && patient) {
    await sendPostTreatmentFollowUp(patient, services);

    const markedAppointment = markReminderSent(
      appointment,
      'http://melissaknudson.com/fhir/StructureDefinition/post-treatment-followup-sent',
      { hours: followUpCheck.hours }
    );
    await medplum.updateResource(markedAppointment);
  }
}

/**
 * Get upcoming reminders for display
 */
export function getUpcomingReminders(
  appointment: Appointment,
  config: ReminderSchedule
): Array<{ type: string; scheduledAt: Date; description: string }> {
  const reminders: Array<{ type: string; scheduledAt: Date; description: string }> = [];

  if (!appointment.start) return reminders;

  const depositInfo = getDepositStatus(appointment);

  // Deposit reminders
  if (depositInfo.status === 'requested' && depositInfo.requestedAt) {
    for (let i = 1; i <= config.depositReminders; i++) {
      const reminderTime = dayjs(depositInfo.requestedAt).add(i * config.depositReminderInterval, 'hours');
      if (reminderTime.isAfter(dayjs())) {
        reminders.push({
          type: 'deposit_reminder',
          scheduledAt: reminderTime.toDate(),
          description: `Deposit reminder #${i}`,
        });
      }
    }

    // Auto-cancel warning (24h before auto-cancel)
    const autoCancelAt96h = dayjs(depositInfo.requestedAt).add(72, 'hours'); // 24h before 96h
    const appointmentTime = dayjs(appointment.start);
    const autoCancelAt48h = appointmentTime.subtract(72, 'hours'); // 24h before 48h window

    if (autoCancelAt96h.isAfter(dayjs())) {
      reminders.push({
        type: 'auto_cancel_warning',
        scheduledAt: autoCancelAt96h.toDate(),
        description: 'Auto-cancel warning (96h rule)',
      });
    }

    if (autoCancelAt48h.isAfter(dayjs())) {
      reminders.push({
        type: 'auto_cancel_warning',
        scheduledAt: autoCancelAt48h.toDate(),
        description: 'Auto-cancel warning (48h before appointment)',
      });
    }
  }

  // Appointment reminders
  if (appointment.status === 'booked') {
    const appointmentTime = dayjs(appointment.start);

    const reminder24h = appointmentTime.subtract(24, 'hours');
    if (reminder24h.isAfter(dayjs())) {
      reminders.push({
        type: 'appointment_reminder_24h',
        scheduledAt: reminder24h.toDate(),
        description: '24-hour appointment reminder',
      });
    }

    const reminder2h = appointmentTime.subtract(2, 'hours');
    if (reminder2h.isAfter(dayjs())) {
      reminders.push({
        type: 'appointment_reminder_2h',
        scheduledAt: reminder2h.toDate(),
        description: '2-hour appointment reminder',
      });
    }
  }

  // Sort by scheduled time
  reminders.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

  return reminders;
}

/**
 * Format reminder for display
 */
export function formatReminderTime(date: Date): string {
  const now = dayjs();
  const reminderTime = dayjs(date);

  const days = reminderTime.diff(now, 'days');
  const hours = reminderTime.diff(now, 'hours') % 24;

  if (days > 0) {
    return `in ${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `in ${hours}h`;
  }
  return 'soon';
}
