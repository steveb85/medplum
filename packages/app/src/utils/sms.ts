/**
 * SMS utility functions using Twilio
 * Handles sending SMS messages for deposits, reminders, and notifications
 */

import { showNotification } from '@mantine/notifications';
import type { Appointment, Patient, ActivityDefinition, Practitioner } from '@medplum/fhirtypes';
import { getDefaultDepositAmount, formatDepositAmount, calculatePaymentLinkExpiry } from './payments';

// Environment variables (must be set in .env)
const TWILIO_ACCOUNT_SID = import.meta.env.VITE_TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = import.meta.env.VITE_TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = import.meta.env.VITE_TWILIO_PHONE_NUMBER || '';

export interface SMSTemplate {
  name: string;
  template: string;
}

// SMS Templates
export const smsTemplates = {
  depositRequest: {
    name: 'Deposit Request',
    template: 'Hi {patientName}, your appointment for {serviceType} on {date} at {time} is confirmed. Please pay your {depositAmount} deposit within {hours} hours: {paymentLink}',
  },
  paymentConfirmation: {
    name: 'Payment Confirmation',
    template: 'Thank you {patientName}! Your deposit of {amount} has been received. See you on {date} at {time} for your {serviceType}.',
  },
  depositReminder: {
    name: 'Deposit Reminder',
    template: 'Reminder: Your deposit of {depositAmount} is due for your {serviceType} appointment on {date}. Pay here: {paymentLink}',
  },
  appointmentReminder24h: {
    name: '24h Appointment Reminder',
    template: 'Reminder: You have an appointment tomorrow ({date}) at {time} for {serviceType}. Please arrive 10 minutes early.',
  },
  appointmentReminder2h: {
    name: '2h Appointment Reminder',
    template: 'Your appointment is in 2 hours ({time}). See you soon!',
  },
  autoCancelWarning: {
    name: 'Auto-Cancel Warning',
    template: 'Your {serviceType} appointment on {date} will be cancelled in 24 hours unless deposit is paid. Pay now: {paymentLink}',
  },
  appointmentCancelled: {
    name: 'Appointment Cancelled',
    template: 'Your {serviceType} appointment on {date} has been cancelled. Contact us to reschedule.',
  },
  postTreatmentFollowUp: {
    name: 'Post-Treatment Follow-up',
    template: 'Hi {patientName}, how are you feeling after your {serviceType} treatment? Reply if you have any questions.',
  },
};

/**
 * Check if SMS is configured
 */
export function isSMSConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
}

/**
 * Send SMS via Twilio API
 */
export async function sendSMS(to: string, message: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!isSMSConfigured()) {
    console.warn('SMS not configured - would have sent:', { to, message });
    return { success: false, error: 'SMS not configured' };
  }

  try {
    // In sandbox mode, just log the message
    if (import.meta.env.DEV) {
      console.log('[SMS Sandbox] To:', to);
      console.log('[SMS Sandbox] Message:', message);
      showNotification({
        title: 'SMS Sent (Sandbox)',
        message: `To: ${to}\n${message.substring(0, 100)}...`,
        color: 'blue',
      });
      return { success: true, sid: 'sandbox_' + Date.now() };
    }

    // Real Twilio API call
    const response = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + TWILIO_ACCOUNT_SID + '/Messages.json', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(TWILIO_ACCOUNT_SID + ':' + TWILIO_AUTH_TOKEN),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: TWILIO_PHONE_NUMBER,
        Body: message,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const data = await response.json();
    return { success: true, sid: data.sid };
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get patient phone number
 */
function getPatientPhone(patient: Patient): string | undefined {
  const phone = patient.telecom?.find((t) => t.system === 'phone' && t.use === 'mobile')?.value;
  return phone || patient.telecom?.find((t) => t.system === 'phone')?.value;
}

/**
 * Format date for SMS
 */
function formatDateForSMS(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time for SMS
 */
function formatTimeForSMS(date: Date | string): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Send deposit request SMS
 */
export async function sendDepositRequestSMS(
  patient: Patient,
  appointment: Appointment,
  services: ActivityDefinition[],
  depositAmount: number,
  paymentLink: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const phone = getPatientPhone(patient);
  if (!phone) {
    return { success: false, error: 'Patient has no phone number' };
  }

  const serviceNames = services.map((s) => s.title).join(', ');
  const expiry = calculatePaymentLinkExpiry(appointment.start!);
  const hoursRemaining = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60));

  const message = smsTemplates.depositRequest.template
    .replace('{patientName}', patient.name?.[0]?.given?.[0] || 'there')
    .replace('{serviceType}', serviceNames)
    .replace('{date}', formatDateForSMS(appointment.start!))
    .replace('{time}', formatTimeForSMS(appointment.start!))
    .replace('{depositAmount}', formatDepositAmount(depositAmount))
    .replace('{hours}', hoursRemaining.toString())
    .replace('{paymentLink}', paymentLink);

  return sendSMS(phone, message);
}

/**
 * Send payment confirmation SMS
 */
export async function sendPaymentConfirmationSMS(
  patient: Patient,
  appointment: Appointment,
  services: ActivityDefinition[],
  amount: number
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const phone = getPatientPhone(patient);
  if (!phone) {
    return { success: false, error: 'Patient has no phone number' };
  }

  const serviceNames = services.map((s) => s.title).join(', ');

  const message = smsTemplates.paymentConfirmation.template
    .replace('{patientName}', patient.name?.[0]?.given?.[0] || 'there')
    .replace('{amount}', formatDepositAmount(amount))
    .replace('{date}', formatDateForSMS(appointment.start!))
    .replace('{time}', formatTimeForSMS(appointment.start!))
    .replace('{serviceType}', serviceNames);

  return sendSMS(phone, message);
}

/**
 * Send deposit reminder SMS
 */
export async function sendDepositReminderSMS(
  patient: Patient,
  appointment: Appointment,
  services: ActivityDefinition[],
  depositAmount: number,
  paymentLink: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const phone = getPatientPhone(patient);
  if (!phone) {
    return { success: false, error: 'Patient has no phone number' };
  }

  const serviceNames = services.map((s) => s.title).join(', ');

  const message = smsTemplates.depositReminder.template
    .replace('{depositAmount}', formatDepositAmount(depositAmount))
    .replace('{serviceType}', serviceNames)
    .replace('{date}', formatDateForSMS(appointment.start!))
    .replace('{paymentLink}', paymentLink);

  return sendSMS(phone, message);
}

/**
 * Send 24-hour appointment reminder
 */
export async function sendAppointmentReminder24h(
  patient: Patient,
  appointment: Appointment,
  services: ActivityDefinition[]
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const phone = getPatientPhone(patient);
  if (!phone) {
    return { success: false, error: 'Patient has no phone number' };
  }

  const serviceNames = services.map((s) => s.title).join(', ');

  const message = smsTemplates.appointmentReminder24h.template
    .replace('{date}', formatDateForSMS(appointment.start!))
    .replace('{time}', formatTimeForSMS(appointment.start!))
    .replace('{serviceType}', serviceNames);

  return sendSMS(phone, message);
}

/**
 * Send 2-hour appointment reminder
 */
export async function sendAppointmentReminder2h(
  patient: Patient,
  appointment: Appointment
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const phone = getPatientPhone(patient);
  if (!phone) {
    return { success: false, error: 'Patient has no phone number' };
  }

  const message = smsTemplates.appointmentReminder2h.template
    .replace('{time}', formatTimeForSMS(appointment.start!));

  return sendSMS(phone, message);
}

/**
 * Send auto-cancel warning SMS
 */
export async function sendAutoCancelWarningSMS(
  patient: Patient,
  appointment: Appointment,
  services: ActivityDefinition[],
  paymentLink: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const phone = getPatientPhone(patient);
  if (!phone) {
    return { success: false, error: 'Patient has no phone number' };
  }

  const serviceNames = services.map((s) => s.title).join(', ');

  const message = smsTemplates.autoCancelWarning.template
    .replace('{serviceType}', serviceNames)
    .replace('{date}', formatDateForSMS(appointment.start!))
    .replace('{paymentLink}', paymentLink);

  return sendSMS(phone, message);
}

/**
 * Send appointment cancelled notification
 */
export async function sendAppointmentCancelledSMS(
  patient: Patient,
  appointment: Appointment,
  services: ActivityDefinition[]
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const phone = getPatientPhone(patient);
  if (!phone) {
    return { success: false, error: 'Patient has no phone number' };
  }

  const serviceNames = services.map((s) => s.title).join(', ');

  const message = smsTemplates.appointmentCancelled.template
    .replace('{serviceType}', serviceNames)
    .replace('{date}', formatDateForSMS(appointment.start!));

  return sendSMS(phone, message);
}

/**
 * Send post-treatment follow-up SMS
 */
export async function sendPostTreatmentFollowUp(
  patient: Patient,
  services: ActivityDefinition[]
): Promise<{ success: boolean; sid?: string; error?: string }> {
  const phone = getPatientPhone(patient);
  if (!phone) {
    return { success: false, error: 'Patient has no phone number' };
  }

  const serviceNames = services.map((s) => s.title).join(', ');

  const message = smsTemplates.postTreatmentFollowUp.template
    .replace('{patientName}', patient.name?.[0]?.given?.[0] || 'there')
    .replace('{serviceType}', serviceNames);

  return sendSMS(phone, message);
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phone: string): boolean {
  // Basic US phone validation
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith('1'));
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
}
