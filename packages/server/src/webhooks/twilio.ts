// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { createReference, Operator } from '@medplum/core';
import type { Communication, CommunicationPayload, Patient } from '@medplum/fhirtypes';
import type { Request, Response } from 'express';
import { getGlobalSystemRepo } from '../fhir/repo';
import { getLogger } from '../logger';

interface TwilioWebhookBody {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  NumMedia: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
}

/**
 * Find patient by phone number
 * @param phone - The phone number to search for
 * @returns Patient or undefined if no  t found
 */
async function findPatientByPhone(phone: string): Promise<Patient | undefined> {
  const repo = getGlobalSystemRepo();

  // Normalize phone number
  const normalizedPhone = phone.replace(/\D/g, '');

  try {
    // Search for patient with this phone number
    const bundle = await repo.search({
      resourceType: 'Patient',
      filters: [
        {
          code: 'phone',
          operator: Operator.EQUALS,
          value: normalizedPhone,
        },
      ],
    });

    const patient = bundle.entry?.[0]?.resource as Patient;
    return patient;
  } catch {
    return undefined;
  }
}

/**
 * Create a Communication resource for the incoming message
 * @param patient - The patient associated with the message
 * @param from - The phone number the message was sent from
 * @param body - The content of the message
 * @param messageSid - The Twilio message SID for reference
 */
async function createCommunication(patient: Patient, from: string, body: string, messageSid: string): Promise<void> {
  const repo = getGlobalSystemRepo();

  const communication: Communication = {
    resourceType: 'Communication',
    status: 'completed',
    subject: createReference(patient),
    sent: new Date().toISOString(),
    received: new Date().toISOString(),
    payload: [
      {
        contentString: body,
      } as CommunicationPayload,
    ],
    sender: {
      display: from,
    },
    medium: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode',
            code: 'SMSWRIT',
            display: 'SMS text',
          },
        ],
        text: 'SMS',
      },
    ],
    extension: [
      {
        url: 'http://melissaknudson.com/fhir/StructureDefinition/sms-metadata',
        extension: [
          { url: 'messageSid', valueString: messageSid },
          { url: 'fromNumber', valueString: from },
        ],
      },
    ],
  };

  await repo.createResource(communication);
}

/**
 * Handle incoming SMS webhook
 * @param req - The Express request object containing the Twilio webhook data
 * @param res - The Express response object to send the TwiML response
 */
export async function twilioWebhookHandler(req: Request, res: Response): Promise<void> {
  const logger = getLogger();

  try {
    const body = req.body as TwilioWebhookBody;
    const { MessageSid, From, To, Body } = body;

    logger.info('Twilio SMS received', { messageSid: MessageSid });

    // Verify this is from Twilio (check signature)
    // TODO: Implement Twilio signature verification
    // const signature = req.headers['x-twilio-signature'] as string;
    // const url = req.protocol + '://' + req.get('host') + req.originalUrl;
    // const isValid = twilio.validateRequest(authToken, signature, url, body);

    // Find patient by phone number
    const patient = await findPatientByPhone(From);

    if (!patient) {
      logger.warn('SMS from unknown number', { messageSid: MessageSid });
      // Still respond with TwiML to acknowledge receipt
      res.set('Content-Type', 'text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thank you for your message. We could not identify your account. Please call us at (212) 555-0100.</Message>
</Response>`);
      return;
    }

    // Create Communication resource
    await createCommunication(patient, From, Body, MessageSid);
    logger.info('SMS Communication created', { patientId: patient.id, messageSid: MessageSid });

    // Auto-response logic
    let autoResponse = '';

    // Check for common keywords
    const lowerBody = Body.toLowerCase().trim();

    // Urgent keywords take priority
    const urgentKeywords = ['pain', 'problem', 'hurts', 'hurting', 'bleeding', 'swelling', 'infection', 'emergency', 'urgent'];
    const hasUrgentKeyword = urgentKeywords.some((kw) => lowerBody.includes(kw));

    if (hasUrgentKeyword) {
      autoResponse =
        'We received your message and have flagged it for urgent review. A team member will contact you shortly. If this is a medical emergency, please call 911.';
      logger.warn('Urgent patient SMS detected', {
        patientId: patient.id,
        messageSid: MessageSid,
        matchedKeyword: urgentKeywords.find((kw) => lowerBody.includes(kw)),
      });
    } else if (lowerBody.includes('cancel')) {
      autoResponse =
        'We received your cancellation request. A coordinator will contact you shortly to confirm. Reply STOP to opt out of SMS notifications.';
    } else if (lowerBody.includes('reschedule')) {
      autoResponse =
        'We received your reschedule request. A coordinator will contact you shortly. Reply STOP to opt out of SMS notifications.';
    } else if (lowerBody.includes('confirm') || lowerBody.includes('yes')) {
      autoResponse =
        'Thank you for confirming! We look forward to seeing you. Reply STOP to opt out of SMS notifications.';
    } else if (lowerBody.includes('stop')) {
      autoResponse =
        'You have been opted out of SMS notifications. To opt back in, reply START or call us at (212) 555-0100.';
      // TODO: Update patient preferences
    } else if (lowerBody.includes('question') || lowerBody.includes('?')) {
      autoResponse =
        'Thank you for your question. A coordinator will respond shortly. For urgent matters, please call us at (212) 555-0100.';
    } else {
      // Generic response
      autoResponse =
        'Thank you for your message. Our team will review and respond during business hours. Reply STOP to opt out of SMS notifications.';
    }

    // Send TwiML response
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${autoResponse}</Message>
</Response>`);

    // Broadcast notification to staff about patient message
    // This would use the existing notification system
    try {
      const repo = getGlobalSystemRepo();
      // Find the notification bot
      const bots = await repo.search({
        resourceType: 'Bot',
        filters: [
          {
            code: 'name',
            operator: Operator.EQUALS,
            value: 'notification-bot',
          },
        ],
      });
      if (bots.entry?.[0]) {
        // Trigger notification
        await repo.createResource({
          resourceType: 'Communication',
          status: 'in-progress',
          category: [
            {
              coding: [
                {
                  system: 'http://melissaknudson.com/fhir/notification-category',
                  code: 'patient-message',
                  display: 'Patient Message',
                },
              ],
            },
          ],
          subject: createReference(patient),
          payload: [
            {
              contentString: `SMS from ${patient.name?.[0]?.given?.[0]}: "${Body.substring(0, 100)}${Body.length > 100 ? '...' : ''}"`,
            },
          ],
        });
      }
    } catch (notifyErr) {
      logger.error('Failed to broadcast patient message notification', { error: notifyErr });
    }
  } catch (err) {
    logger.error('Twilio webhook error', { error: err });
    // Still return 200 to Twilio to prevent retries
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thank you for your message. We will respond shortly.</Message>
</Response>`);
  }
}

/**
 * Handle Twilio status callback webhook
 * Tracks message delivery status
 * @param req - The Express request object containing the Twilio status callback data
 * @param res - The Express response object to send the status update
 */
export async function twilioStatusCallbackHandler(req: Request, res: Response): Promise<void> {
  const logger = getLogger();

  try {
    const { MessageSid, MessageStatus, ErrorCode } = req.body as {
      MessageSid: string;
      MessageStatus: string;
      ErrorCode?: string;
    };

    logger.info('Twilio status callback', {
      messageSid: MessageSid,
      status: MessageStatus,
      errorCode: ErrorCode,
    });

    // Update message status in database if needed
    // This could track delivery failures

    res.sendStatus(200);
  } catch (err) {
    logger.error('Twilio status callback error', { error: err });
    res.sendStatus(200); // Still return 200 to prevent retries
  }
}
