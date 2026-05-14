import { getLogger } from '../logger';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@studioassistant.io';

function isSMSConfigured(): boolean {
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
}

function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}

export async function sendSMS(phone: string, message: string, logLabel?: string): Promise<void> {
  if (!isSMSConfigured()) {
    getLogger().warn('SMS not configured - skipping SMS');
    return;
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(TWILIO_ACCOUNT_SID + ':' + TWILIO_AUTH_TOKEN).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phone,
          From: TWILIO_PHONE_NUMBER,
          Body: message,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      getLogger().error('Failed to send SMS', { error, label: logLabel });
    } else {
      getLogger().info('SMS sent', { to: phone, label: logLabel });
    }
  } catch (err) {
    getLogger().error('Error sending SMS', { error: err, label: logLabel });
  }
}

export async function sendPaymentConfirmationSMS(
  phone: string,
  patientName: string,
  appointmentDate: string
): Promise<void> {
  const message = `Hi ${patientName}, your deposit payment has been received successfully! Your appointment is confirmed for ${appointmentDate}. Reply STOP to opt out.`;
  await sendSMS(phone, message, 'payment-confirmation');
}

export async function sendEmail(
  email: string,
  subject: string,
  html: string,
  logLabel?: string
): Promise<void> {
  if (!isEmailConfigured()) {
    getLogger().warn('Resend not configured - skipping email');
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: email,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      getLogger().error('Failed to send email', { error, label: logLabel });
    } else {
      getLogger().info('Email sent', { to: email, label: logLabel });
    }
  } catch (err) {
    getLogger().error('Error sending email', { error: err, label: logLabel });
  }
}

export async function sendPaymentConfirmationEmail(
  email: string,
  patientName: string,
  appointmentDate: string,
  paymentAmount: number
): Promise<void> {
  const subject = 'Payment Confirmed - Nurse Melissa Knudson';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4a5568;">Payment Confirmed</h2>
      <p>Hi ${patientName},</p>
      <p>Your deposit payment of <strong>$${paymentAmount.toFixed(2)}</strong> has been received successfully!</p>
      <p>Your appointment is confirmed for <strong>${appointmentDate}</strong>.</p>
      <p>If you have any questions, please contact the office.</p>
      <hr style="border: 1px solid #e2e8f0;" />
      <p style="color: #718096; font-size: 12px;">Nurse Melissa Knudson | Tribeca, NYC</p>
    </div>
  `;
  await sendEmail(email, subject, html, 'payment-confirmation');
}
