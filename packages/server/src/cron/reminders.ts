import type { Appointment, Patient } from '@medplum/fhirtypes';
import { getGlobalSystemRepo } from '../fhir/repo';
import { getLogger } from '../logger';
import { sendSMS, sendEmail } from '../webhooks/notifications';

const REMINDER_24H_EXT = 'http://melissaknudson.com/fhir/StructureDefinition/reminder-24h-sent';
const REMINDER_2H_EXT = 'http://melissaknudson.com/fhir/StructureDefinition/reminder-2h-sent';
const DEPOSIT_REMINDER_COUNT_EXT = 'http://melissaknudson.com/fhir/StructureDefinition/deposit-reminder-count';
const AUTO_CANCEL_WARNING_EXT = 'http://melissaknudson.com/fhir/StructureDefinition/auto-cancel-warning-sent';
const POST_TREATMENT_FOLLOWUP_EXT = 'http://melissaknudson.com/fhir/StructureDefinition/post-treatment-followup-sent';

const MAX_DEPOSIT_REMINDERS = 4;
const AUTO_CANCEL_HOURS = 96;

export async function checkAndSendReminders(): Promise<void> {
  const logger = getLogger();
  logger.info('Checking for reminders...');
  await send24hReminders();
  await send2hReminders();
  await sendDepositReminders();
  await sendAutoCancelWarnings();
  await sendPostTreatmentFollowUps();
}

async function getPatientFromAppointment(appointment: Appointment): Promise<Patient | undefined> {
  const patientRef = appointment.participant?.find(
    (p) => p.actor?.reference?.startsWith('Patient/')
  )?.actor;
  if (!patientRef?.reference) {
    return undefined;
  }
  const repo = getGlobalSystemRepo();
  return repo.readReference<Patient>(patientRef as any);
}

function getPatientName(patient: Patient): string {
  return patient.name?.[0]?.given?.[0] || 'Patient';
}

function getPatientPhone(patient: Patient): string | undefined {
  return patient.telecom?.find((t) => t.system === 'phone')?.value;
}

function getPatientEmail(patient: Patient): string | undefined {
  return patient.telecom?.find((t) => t.system === 'email')?.value;
}

function formatAppointmentDate(start: string): string {
  return new Date(start).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatAppointmentTime(start: string): string {
  return new Date(start).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function hasExtension(appointment: Appointment, extUrl: string): boolean {
  return appointment.extension?.some((e) => e.url === extUrl) ?? false;
}

function getDepositReminderCount(appointment: Appointment): number {
  const ext = appointment.extension?.find((e) => e.url === DEPOSIT_REMINDER_COUNT_EXT);
  return ext?.valueInteger ?? 0;
}

function getDepositStatus(appointment: Appointment): string | undefined {
  const depositExt = appointment.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info'
  );
  return depositExt?.extension?.find((e) => e.url === 'status')?.valueString;
}

function getDepositAmount(appointment: Appointment): number {
  const depositExt = appointment.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info'
  );
  return depositExt?.extension?.find((e) => e.url === 'amount')?.valueInteger ?? 0;
}

function getDepositRequestedAt(appointment: Appointment): Date | undefined {
  const depositExt = appointment.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/deposit-info'
  );
  const val = depositExt?.extension?.find((e) => e.url === 'requestedAt')?.valueDateTime;
  return val ? new Date(val) : undefined;
}

async function setExtension(appointment: Appointment, extUrl: string, value?: number): Promise<void> {
  const repo = getGlobalSystemRepo();
  const existingExts = appointment.extension?.filter((e) => e.url !== extUrl) || [];

  const newExt: any = { url: extUrl };
  if (value !== undefined) {
    newExt.valueInteger = value;
  } else {
    newExt.valueBoolean = true;
  }

  appointment.extension = [...existingExts, newExt];
  await repo.updateResource(appointment);
}

async function send24hReminders(): Promise<void> {
  const logger = getLogger();
  const repo = getGlobalSystemRepo();

  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);

  const bundle = await repo.search({
    resourceType: 'Appointment',
    filters: [
      { code: 'status', operator: 'eq', value: 'booked' },
      { code: 'date', operator: 'gt', value: windowStart.toISOString() },
      { code: 'date', operator: 'lt', value: windowEnd.toISOString() },
    ],
    count: 100,
  });

  const appointments = (bundle.entry || []).map((e) => e.resource as Appointment);
  logger.info('24h reminder check', { found: appointments.length });

  for (const appt of appointments) {
    if (hasExtension(appt, REMINDER_24H_EXT)) {
      continue;
    }

    const patient = await getPatientFromAppointment(appt);
    if (!patient || !appt.start) {
      continue;
    }

    const patientName = getPatientName(patient);
    const date = formatAppointmentDate(appt.start);
    const time = formatAppointmentTime(appt.start);

    const phone = getPatientPhone(patient);
    if (phone) {
      const msg = `Hi ${patientName}, this is a reminder that you have an appointment tomorrow at ${time}. See you soon! Reply STOP to opt out.`;
      await sendSMS(phone, msg, 'reminder-24h');
    }

    const email = getPatientEmail(patient);
    if (email) {
      const subject = 'Appointment Reminder - Nurse Melissa Knudson';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a5568;">Appointment Reminder</h2>
          <p>Hi ${patientName},</p>
          <p>This is a reminder that you have an appointment <strong>tomorrow (${date}) at ${time}</strong>.</p>
          <p>Please arrive 10 minutes early for your visit.</p>
          <hr style="border: 1px solid #e2e8f0;" />
          <p style="color: #718096; font-size: 12px;">Nurse Melissa Knudson | Tribeca, NYC</p>
        </div>
      `;
      await sendEmail(email, subject, html, 'reminder-24h');
    }

    await setExtension(appt, REMINDER_24H_EXT);
    logger.info('24h reminder sent', { appointmentId: appt.id });
  }
}

async function send2hReminders(): Promise<void> {
  const logger = getLogger();
  const repo = getGlobalSystemRepo();

  const now = new Date();
  const windowStart = new Date(now.getTime() + 1 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  const bundle = await repo.search({
    resourceType: 'Appointment',
    filters: [
      { code: 'status', operator: 'eq', value: 'booked' },
      { code: 'date', operator: 'gt', value: windowStart.toISOString() },
      { code: 'date', operator: 'lt', value: windowEnd.toISOString() },
    ],
    count: 100,
  });

  const appointments = (bundle.entry || []).map((e) => e.resource as Appointment);
  logger.info('2h reminder check', { found: appointments.length });

  for (const appt of appointments) {
    if (hasExtension(appt, REMINDER_2H_EXT)) {
      continue;
    }

    const patient = await getPatientFromAppointment(appt);
    if (!patient || !appt.start) {
      continue;
    }

    const patientName = getPatientName(patient);
    const time = formatAppointmentTime(appt.start);

    const phone = getPatientPhone(patient);
    if (phone) {
      const msg = `Hi ${patientName}, your appointment is in about 2 hours (${time}). See you soon! Reply STOP to opt out.`;
      await sendSMS(phone, msg, 'reminder-2h');
    }

    const email = getPatientEmail(patient);
    if (email) {
      const subject = 'Appointment Reminder - Nurse Melissa Knudson';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a5568;">Appointment Reminder</h2>
          <p>Hi ${patientName},</p>
          <p>Your appointment is <strong>today at ${time}</strong>.</p>
          <p>We look forward to seeing you!</p>
          <hr style="border: 1px solid #e2e8f0;" />
          <p style="color: #718096; font-size: 12px;">Nurse Melissa Knudson | Tribeca, NYC</p>
        </div>
      `;
      await sendEmail(email, subject, html, 'reminder-2h');
    }

    await setExtension(appt, REMINDER_2H_EXT);
    logger.info('2h reminder sent', { appointmentId: appt.id });
  }
}

async function sendDepositReminders(): Promise<void> {
  const logger = getLogger();
  const repo = getGlobalSystemRepo();

  const bundle = await repo.search({
    resourceType: 'Appointment',
    filters: [
      { code: 'status', operator: 'eq', value: 'pending' },
      { code: 'date', operator: 'gt', value: new Date().toISOString() },
    ],
    count: 100,
  });

  const appointments = (bundle.entry || []).map((e) => e.resource as Appointment);
  logger.info('Deposit reminder check', { found: appointments.length });

  for (const appt of appointments) {
    const depositStatus = getDepositStatus(appt);
    if (depositStatus !== 'requested') {
      continue;
    }

    const count = getDepositReminderCount(appt);
    if (count >= MAX_DEPOSIT_REMINDERS) {
      continue;
    }

    const patient = await getPatientFromAppointment(appt);
    if (!patient || !appt.start) {
      continue;
    }

    const patientName = getPatientName(patient);
    const amount = getDepositAmount(appt);
    const date = formatAppointmentDate(appt.start);

    const phone = getPatientPhone(patient);
    if (phone) {
      const msg = `Hi ${patientName}, just a reminder that your deposit of $${amount} is still pending for your appointment on ${date}. Please pay to secure your booking. Reply STOP to opt out.`;
      await sendSMS(phone, msg, 'deposit-reminder');
    }

    const email = getPatientEmail(patient);
    if (email) {
      const subject = 'Deposit Reminder - Nurse Melissa Knudson';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a5568;">Deposit Reminder</h2>
          <p>Hi ${patientName},</p>
          <p>Your deposit of <strong>$${amount}</strong> is still pending for your appointment on <strong>${date}</strong>.</p>
          <p>Please pay your deposit to secure your booking.</p>
          <hr style="border: 1px solid #e2e8f0;" />
          <p style="color: #718096; font-size: 12px;">Nurse Melissa Knudson | Tribeca, NYC</p>
        </div>
      `;
      await sendEmail(email, subject, html, 'deposit-reminder');
    }

    await setExtension(appt, DEPOSIT_REMINDER_COUNT_EXT, count + 1);
    logger.info('Deposit reminder sent', { appointmentId: appt.id, count: count + 1 });
  }
}

async function sendAutoCancelWarnings(): Promise<void> {
  const logger = getLogger();
  const repo = getGlobalSystemRepo();

  const bundle = await repo.search({
    resourceType: 'Appointment',
    filters: [
      { code: 'status', operator: 'eq', value: 'pending' },
      { code: 'date', operator: 'gt', value: new Date().toISOString() },
    ],
    count: 100,
  });

  const appointments = (bundle.entry || []).map((e) => e.resource as Appointment);
  logger.info('Auto-cancel warning check', { found: appointments.length });

  for (const appt of appointments) {
    const depositStatus = getDepositStatus(appt);
    if (depositStatus !== 'requested') {
      continue;
    }

    if (hasExtension(appt, AUTO_CANCEL_WARNING_EXT)) {
      continue;
    }

    const requestedAt = getDepositRequestedAt(appt);
    if (!requestedAt) {
      continue;
    }

    const autoCancelTime = new Date(requestedAt.getTime() + AUTO_CANCEL_HOURS * 60 * 60 * 1000);
    const warningTime = new Date(autoCancelTime.getTime() - 24 * 60 * 60 * 1000);

    const now = new Date();
    if (now < warningTime || now > autoCancelTime) {
      continue;
    }

    const patient = await getPatientFromAppointment(appt);
    if (!patient || !appt.start) {
      continue;
    }

    const patientName = getPatientName(patient);
    const date = formatAppointmentDate(appt.start);

    const phone = getPatientPhone(patient);
    if (phone) {
      const msg = `Hi ${patientName}, your appointment on ${date} will be cancelled in 24 hours if the deposit is not paid. Please pay now to keep your booking. Reply STOP to opt out.`;
      await sendSMS(phone, msg, 'auto-cancel-warning');
    }

    const email = getPatientEmail(patient);
    if (email) {
      const subject = 'Booking Will Be Cancelled - Nurse Melissa Knudson';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e53e3e;">Booking Will Be Cancelled</h2>
          <p>Hi ${patientName},</p>
          <p>Your appointment on <strong>${date}</strong> will be cancelled in 24 hours if the deposit is not paid.</p>
          <p>Please pay your deposit now to keep your booking.</p>
          <hr style="border: 1px solid #e2e8f0;" />
          <p style="color: #718096; font-size: 12px;">Nurse Melissa Knudson | Tribeca, NYC</p>
        </div>
      `;
      await sendEmail(email, subject, html, 'auto-cancel-warning');
    }

    await setExtension(appt, AUTO_CANCEL_WARNING_EXT);
    logger.info('Auto-cancel warning sent', { appointmentId: appt.id });
  }
}

async function sendPostTreatmentFollowUps(): Promise<void> {
  const logger = getLogger();
  const repo = getGlobalSystemRepo();

  const now = new Date();
  const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const bundle = await repo.search({
    resourceType: 'Appointment',
    filters: [
      { code: 'status', operator: 'eq', value: 'fulfilled' },
      { code: 'date', operator: 'gt', value: windowStart.toISOString() },
      { code: 'date', operator: 'lt', value: windowEnd.toISOString() },
    ],
    count: 100,
  });

  const appointments = (bundle.entry || []).map((e) => e.resource as Appointment);
  logger.info('Post-treatment follow-up check', { found: appointments.length });

  for (const appt of appointments) {
    if (hasExtension(appt, POST_TREATMENT_FOLLOWUP_EXT)) {
      continue;
    }

    const patient = await getPatientFromAppointment(appt);
    if (!patient) {
      continue;
    }

    const patientName = getPatientName(patient);

    const phone = getPatientPhone(patient);
    if (phone) {
      const msg = `Hi ${patientName}, we hope you're feeling great after your recent visit! How are you doing? Reply with any concerns, or reply STOP to opt out.`;
      await sendSMS(phone, msg, 'post-treatment-followup');
    }

    const email = getPatientEmail(patient);
    if (email) {
      const subject = 'How Are You Feeling? - Nurse Melissa Knudson';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4a5568;">Post-Treatment Check-In</h2>
          <p>Hi ${patientName},</p>
          <p>We hope you're feeling great after your recent visit! If you have any questions or concerns, please don't hesitate to reach out.</p>
          <p>Reply to this email or call us at (212) 555-0100.</p>
          <hr style="border: 1px solid #e2e8f0;" />
          <p style="color: #718096; font-size: 12px;">Nurse Melissa Knudson | Tribeca, NYC</p>
        </div>
      `;
      await sendEmail(email, subject, html, 'post-treatment-followup');
    }

    await setExtension(appt, POST_TREATMENT_FOLLOWUP_EXT);
    logger.info('Post-treatment follow-up sent', { appointmentId: appt.id });
  }
}
