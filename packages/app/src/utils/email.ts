/**
 * Email utility functions using Resend
 * Handles sending emails for deposits, reminders, and notifications
 */

import { showNotification } from '@mantine/notifications';
import type { Appointment, Patient, ActivityDefinition, Practitioner } from '@medplum/fhirtypes';
import { formatDepositAmount, calculatePaymentLinkExpiry } from './payments';

// Environment variables
const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = import.meta.env.VITE_RESEND_FROM_EMAIL || 'noreply@studioassistant.io';

export interface EmailTemplate {
  name: string;
  subject: string;
  html: string;
  text: string;
}

// Email Templates
export const emailTemplates = {
  depositRequest: {
    name: 'Deposit Request',
    subject: 'Deposit Required for Your Appointment',
    html: `<p>Hi {patientName},</p>
<p>Your appointment for <strong>{serviceType}</strong> on {date} at {time} is confirmed.</p>
<p>Please pay your <strong>{depositAmount}</strong> deposit within {hours} hours to secure your appointment:</p>
<p><a href="{paymentLink}" style="padding: 12px 24px; background: #228be6; color: white; text-decoration: none; border-radius: 4px; display: inline-block;">Pay Deposit</a></p>
<p>Or copy this link: {paymentLink}</p>
<p>Thank you,<br>Nurse Melissa Knudson</p>`,
    text: `Hi {patientName},

Your appointment for {serviceType} on {date} at {time} is confirmed.

Please pay your {depositAmount} deposit within {hours} hours to secure your appointment:

{paymentLink}

Thank you,
Nurse Melissa Knudson`,
  },
  paymentConfirmation: {
    name: 'Payment Confirmation',
    subject: 'Deposit Received - Appointment Confirmed',
    html: `<p>Hi {patientName},</p>
<p>Thank you! Your deposit of <strong>{amount}</strong> has been received.</p>
<p>Your appointment for <strong>{serviceType}</strong> is confirmed:</p>
<ul>
<li><strong>Date:</strong> {date}</li>
<li><strong>Time:</strong> {time}</li>
</ul>
<p>See you soon!</p>
<p>Nurse Melissa Knudson</p>`,
    text: `Hi {patientName},

Thank you! Your deposit of {amount} has been received.

Your appointment for {serviceType} is confirmed:
Date: {date}
Time: {time}

See you soon!

Nurse Melissa Knudson`,
  },
  depositReminder: {
    name: 'Deposit Reminder',
    subject: 'Reminder: Deposit Due for Your Appointment',
    html: `<p>Hi {patientName},</p>
<p>This is a friendly reminder that your deposit of <strong>{depositAmount}</strong> is due for your {serviceType} appointment on {date}.</p>
<p><a href="{paymentLink}" style="padding: 12px 24px; background: #228be6; color: white; text-decoration: none; border-radius: 4px; display: inline-block;">Pay Deposit</a></p>
<p>If you have any questions, please reply to this email.</p>`,
    text: `Hi {patientName},

This is a friendly reminder that your deposit of {depositAmount} is due for your {serviceType} appointment on {date}.

Pay here: {paymentLink}

If you have any questions, please reply to this email.`,
  },
  appointmentReminder24h: {
    name: '24h Appointment Reminder',
    subject: 'Reminder: Your Appointment is Tomorrow',
    html: `<p>Hi {patientName},</p>
<p>This is a reminder that you have an appointment tomorrow:</p>
<ul>
<li><strong>Date:</strong> {date}</li>
<li><strong>Time:</strong> {time}</li>
<li><strong>Service:</strong> {serviceType}</li>
</ul>
<p>Please arrive 10 minutes early to check in.</p>
<p>See you tomorrow!</p>`,
    text: `Hi {patientName},

This is a reminder that you have an appointment tomorrow:

Date: {date}
Time: {time}
Service: {serviceType}

Please arrive 10 minutes early to check in.

See you tomorrow!`,
  },
  appointmentReminder2h: {
    name: '2h Appointment Reminder',
    subject: 'Your Appointment is in 2 Hours',
    html: `<p>Hi {patientName},</p>
<p>Your appointment is in 2 hours ({time}). See you soon!</p>`,
    text: `Hi {patientName},

Your appointment is in 2 hours ({time}). See you soon!`,
  },
  autoCancelWarning: {
    name: 'Auto-Cancel Warning',
    subject: 'Action Required: Your Appointment Will Be Cancelled',
    html: `<p>Hi {patientName},</p>
<p>Your {serviceType} appointment on {date} will be cancelled in 24 hours unless your deposit is received.</p>
<p><a href="{paymentLink}" style="padding: 12px 24px; background: #e03131; color: white; text-decoration: none; border-radius: 4px; display: inline-block;">Pay Deposit Now</a></p>
<p>Please contact us if you have any questions.</p>`,
    text: `Hi {patientName},

Your {serviceType} appointment on {date} will be cancelled in 24 hours unless your deposit is received.

Pay now: {paymentLink}

Please contact us if you have any questions.`,
  },
  appointmentCancelled: {
    name: 'Appointment Cancelled',
    subject: 'Your Appointment Has Been Cancelled',
    html: `<p>Hi {patientName},</p>
<p>Your {serviceType} appointment on {date} has been cancelled.</p>
<p>Contact us to reschedule:</p>
<p>Phone: (212) 555-0100<br>
Email: info@melissaknudson.com</p>`,
    text: `Hi {patientName},

Your {serviceType} appointment on {date} has been cancelled.

Contact us to reschedule:
Phone: (212) 555-0100
Email: info@melissaknudson.com`,
  },
  postTreatmentFollowUp: {
    name: 'Post-Treatment Follow-up',
    subject: 'How Are You Feeling After Your Treatment?',
    html: `<p>Hi {patientName},</p>
<p>We hope you're feeling well after your {serviceType} treatment.</p>
<p>If you have any questions or concerns, please don't hesitate to reach out:</p>
<p>Phone: (212) 555-0100<br>
Email: info@melissaknudson.com</p>
<p>Best regards,<br>Nurse Melissa Knudson</p>`,
    text: `Hi {patientName},

We hope you're feeling well after your {serviceType} treatment.

If you have any questions or concerns, please don't hesitate to reach out:
Phone: (212) 555-0100
Email: info@melissaknudson.com

Best regards,
Nurse Melissa Knudson`,
  },
};

/**
 * Check if email is configured
 */
export function isEmailConfigured(): boolean {
  return !!(RESEND_API_KEY && RESEND_FROM_EMAIL);
}

/**
 * Send email via Resend API
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!isEmailConfigured()) {
    console.warn('Email not configured - would have sent:', { to, subject });
    return { success: false, error: 'Email not configured' };
  }

  try {
    // In development, log the email
    if (import.meta.env.DEV) {
      console.log('%c[Email Sandbox]', 'color: #228be6; font-weight: bold;', 'To:', to);
      console.log('%c[Email Sandbox]', 'color: #228be6; font-weight: bold;', 'Subject:', subject);
      console.log('%c[Email Sandbox]', 'color: #228be6; font-weight: bold;', 'HTML:', html);
      console.log('%c[Email Sandbox]', 'color: #228be6; font-weight: bold;', 'Text:', text);
      showNotification({
        title: 'Email Sent (Sandbox)',
        message: `To: ${to}\nSubject: ${subject}`,
        color: 'blue',
      });
      return { success: true, id: 'sandbox_' + Date.now() };
    }

    // Real Resend API call
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }

    const data = await response.json();
    return { success: true, id: data.id };
  } catch (error) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get patient email
 */
function getPatientEmail(patient: Patient): string | undefined {
  return patient.telecom?.find((t) => t.system === 'email')?.value;
}

/**
 * Format date for email
 */
function formatDateForEmail(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format time for email
 */
function formatTimeForEmail(date: Date | string): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Replace template variables
 */
function replaceTemplateVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{${key}}`, 'g'), value);
  }
  return result;
}

/**
 * Send deposit request email
 */
export async function sendDepositRequestEmail(
  patient: Patient,
  appointment: Appointment,
  services: ActivityDefinition[],
  depositAmount: number,
  paymentLink: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const email = getPatientEmail(patient);
  if (!email) {
    return { success: false, error: 'Patient has no email' };
  }

  const serviceNames = services.map((s) => s.title).join(', ');
  const expiry = calculatePaymentLinkExpiry(appointment.start!);
  const hoursRemaining = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60));

  const vars = {
    patientName: patient.name?.[0]?.given?.[0] || 'there',
    serviceType: serviceNames,
    date: formatDateForEmail(appointment.start!),
    time: formatTimeForEmail(appointment.start!),
    depositAmount: formatDepositAmount(depositAmount),
    hours: hoursRemaining.toString(),
    paymentLink,
  };

  const subject = replaceTemplateVars(emailTemplates.depositRequest.subject, vars);
  const html = replaceTemplateVars(emailTemplates.depositRequest.html, vars);
  const text = replaceTemplateVars(emailTemplates.depositRequest.text, vars);

  return sendEmail(email, subject, html, text);
}

/**
 * Send payment confirmation email
 */
export async function sendPaymentConfirmationEmail(
  patient: Patient,
  appointment: Appointment,
  services: ActivityDefinition[],
  amount: number
): Promise<{ success: boolean; id?: string; error?: string }> {
  const email = getPatientEmail(patient);
  if (!email) {
    return { success: false, error: 'Patient has no email' };
  }

  const serviceNames = services.map((s) => s.title).join(', ');

  const vars = {
    patientName: patient.name?.[0]?.given?.[0] || 'there',
    amount: formatDepositAmount(amount),
    date: formatDateForEmail(appointment.start!),
    time: formatTimeForEmail(appointment.start!),
    serviceType: serviceNames,
  };

  const subject = replaceTemplateVars(emailTemplates.paymentConfirmation.subject, vars);
  const html = replaceTemplateVars(emailTemplates.paymentConfirmation.html, vars);
  const text = replaceTemplateVars(emailTemplates.paymentConfirmation.text, vars);

  return sendEmail(email, subject, html, text);
}

/**
 * Send deposit reminder email
 */
export async function sendDepositReminderEmail(
  patient: Patient,
  appointment: Appointment,
  services: ActivityDefinition[],
  depositAmount: number,
  paymentLink: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const email = getPatientEmail(patient);
  if (!email) {
    return { success: false, error: 'Patient has no email' };
  }

  const serviceNames = services.map((s) => s.title).join(', ');

  const vars = {
    patientName: patient.name?.[0]?.given?.[0] || 'there',
    depositAmount: formatDepositAmount(depositAmount),
    serviceType: serviceNames,
    date: formatDateForEmail(appointment.start!),
    paymentLink,
  };

  const subject = replaceTemplateVars(emailTemplates.depositReminder.subject, vars);
  const html = replaceTemplateVars(emailTemplates.depositReminder.html, vars);
  const text = replaceTemplateVars(emailTemplates.depositReminder.text, vars);

  return sendEmail(email, subject, html, text);
}

/**
 * Send 24-hour appointment reminder
 */
export async function sendAppointmentReminder24hEmail(
  patient: Patient,
  appointment: Appointment,
  services: ActivityDefinition[]
): Promise<{ success: boolean; id?: string; error?: string }> {
  const email = getPatientEmail(patient);
  if (!email) {
    return { success: false, error: 'Patient has no email' };
  }

  const serviceNames = services.map((s) => s.title).join(', ');

  const vars = {
    patientName: patient.name?.[0]?.given?.[0] || 'there',
    date: formatDateForEmail(appointment.start!),
    time: formatTimeForEmail(appointment.start!),
    serviceType: serviceNames,
  };

  const subject = replaceTemplateVars(emailTemplates.appointmentReminder24h.subject, vars);
  const html = replaceTemplateVars(emailTemplates.appointmentReminder24h.html, vars);
  const text = replaceTemplateVars(emailTemplates.appointmentReminder24h.text, vars);

  return sendEmail(email, subject, html, text);
}

/**
 * Send 2-hour appointment reminder
 */
export async function sendAppointmentReminder2hEmail(
  patient: Patient,
  appointment: Appointment
): Promise<{ success: boolean; id?: string; error?: string }> {
  const email = getPatientEmail(patient);
  if (!email) {
    return { success: false, error: 'Patient has no email' };
  }

  const vars = {
    patientName: patient.name?.[0]?.given?.[0] || 'there',
    time: formatTimeForEmail(appointment.start!),
  };

  const subject = replaceTemplateVars(emailTemplates.appointmentReminder2h.subject, vars);
  const html = replaceTemplateVars(emailTemplates.appointmentReminder2h.html, vars);
  const text = replaceTemplateVars(emailTemplates.appointmentReminder2h.text, vars);

  return sendEmail(email, subject, html, text);
}

/**
 * Send auto-cancel warning email
 */
export async function sendAutoCancelWarningEmail(
  patient: Patient,
  appointment: Appointment,
  services: ActivityDefinition[],
  paymentLink: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const email = getPatientEmail(patient);
  if (!email) {
    return { success: false, error: 'Patient has no email' };
  }

  const serviceNames = services.map((s) => s.title).join(', ');

  const vars = {
    patientName: patient.name?.[0]?.given?.[0] || 'there',
    serviceType: serviceNames,
    date: formatDateForEmail(appointment.start!),
    paymentLink,
  };

  const subject = replaceTemplateVars(emailTemplates.autoCancelWarning.subject, vars);
  const html = replaceTemplateVars(emailTemplates.autoCancelWarning.html, vars);
  const text = replaceTemplateVars(emailTemplates.autoCancelWarning.text, vars);

  return sendEmail(email, subject, html, text);
}

/**
 * Send appointment cancelled email
 */
export async function sendAppointmentCancelledEmail(
  patient: Patient,
  appointment: Appointment,
  services: ActivityDefinition[]
): Promise<{ success: boolean; id?: string; error?: string }> {
  const email = getPatientEmail(patient);
  if (!email) {
    return { success: false, error: 'Patient has no email' };
  }

  const serviceNames = services.map((s) => s.title).join(', ');

  const vars = {
    patientName: patient.name?.[0]?.given?.[0] || 'there',
    serviceType: serviceNames,
    date: formatDateForEmail(appointment.start!),
  };

  const subject = replaceTemplateVars(emailTemplates.appointmentCancelled.subject, vars);
  const html = replaceTemplateVars(emailTemplates.appointmentCancelled.html, vars);
  const text = replaceTemplateVars(emailTemplates.appointmentCancelled.text, vars);

  return sendEmail(email, subject, html, text);
}

/**
 * Send post-treatment follow-up email
 */
export async function sendPostTreatmentFollowUpEmail(
  patient: Patient,
  services: ActivityDefinition[]
): Promise<{ success: boolean; id?: string; error?: string }> {
  const email = getPatientEmail(patient);
  if (!email) {
    return { success: false, error: 'Patient has no email' };
  }

  const serviceNames = services.map((s) => s.title).join(', ');

  const vars = {
    patientName: patient.name?.[0]?.given?.[0] || 'there',
    serviceType: serviceNames,
  };

  const subject = replaceTemplateVars(emailTemplates.postTreatmentFollowUp.subject, vars);
  const html = replaceTemplateVars(emailTemplates.postTreatmentFollowUp.html, vars);
  const text = replaceTemplateVars(emailTemplates.postTreatmentFollowUp.text, vars);

  return sendEmail(email, subject, html, text);
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}
