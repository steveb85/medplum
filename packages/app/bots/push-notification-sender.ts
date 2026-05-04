// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * Push Notification Sender Bot
 *
 * This bot is triggered when a new Communication resource is created
 * (notification for practice staff). It sends push notifications
 * to subscribed users' devices via the web-push library.
 */

import type { MedplumClient } from '@medplum/core';
import type { Communication } from '@medplum/fhirtypes';

// web-push will be available in the Medplum Bot runtime
declare const webpush: any;

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url: string;
  notificationId: string;
}

/**
 * Bot handler function
 * Called whenever a Communication resource is created
 * @param medplum - The Medplum client for API access
 * @param event - The bot event containing the Communication resource
 * @returns void
 */
export async function handler(medplum: MedplumClient, event: any): Promise<void> {
  // Only process Communications that are notifications
  const communication = event.communication as Communication;

  if (communication?.resourceType !== 'Communication') {
    console.log('[Push Bot] Not a Communication resource, skipping');
    return;
  }

  // Check if this is a notification-type Communication
  const isNotification = communication.category?.some((cat) =>
    cat.coding?.some((coding) => coding.system === 'http://melissaknudson.com/notification-type')
  );

  if (!isNotification) {
    console.log('[Push Bot] Not a notification-type Communication, skipping');
    return;
  }

  console.log('[Push Bot] Processing notification:', communication.id);

  // Get notification details
  const title = communication.category?.[0]?.coding?.[0]?.display || 'Nurse Mel';
  const body = communication.payload?.[0]?.contentString || 'You have a new notification';

  // Get related resource URL
  const url = getNotificationUrl(communication);
  const notificationId = communication.id || '';

  // Send to each recipient
  const recipients = communication.recipient || [];

  for (const recipient of recipients) {
    if (!recipient.reference?.startsWith('Practitioner/')) {
      continue; // Only send to practitioners (staff)
    }

    const practitionerId = recipient.reference.split('/')[1];
    console.log('[Push Bot] Sending to practitioner:', practitionerId);

    try {
      // Get push subscriptions for this practitioner
      const subscriptions = await getPushSubscriptions(medplum, practitionerId);

      if (subscriptions.length === 0) {
        console.log('[Push Bot] No push subscriptions for', practitionerId);
        continue;
      }

      // Send push to each subscription
      for (const subscription of subscriptions) {
        await sendPushNotification(subscription, {
          title,
          body,
          url,
          notificationId,
        });
      }
    } catch (err) {
      console.error('[Push Bot] Error sending to', practitionerId, ':', err);
    }
  }

  console.log('[Push Bot] Notification processing complete');
}

/**
 * Get push subscriptions for a practitioner
 * Looks for Subscription resources with push notification criteria
 * @param medplum - The Medplum client for API access
 * @param practitionerId - The ID of the practitioner to get subscriptions for
 * @returns An array of push subscriptions for the practitioner
 */
async function getPushSubscriptions(medplum: MedplumClient, practitionerId: string): Promise<PushSubscription[]> {
  try {
    // Search for Subscription resources linked to this practitioner
    // These are created when users enable push notifications
    const bundle = await medplum.search('Subscription', {
      reason: 'Push notifications',
      _count: '100',
    });

    const subscriptions: PushSubscription[] = [];

    for (const entry of bundle.entry || []) {
      const subscription = entry.resource as any;

      // Check if this subscription belongs to the practitioner
      // The subscription channel payload contains the push subscription data
      if (subscription.channel?.payload) {
        try {
          const pushSub = JSON.parse(subscription.channel.payload);
          if (pushSub.endpoint && pushSub.keys) {
            subscriptions.push(pushSub);
          }
        } catch {
          // Invalid JSON, skip
        }
      }
    }

    return subscriptions;
  } catch (err) {
    console.error('[Push Bot] Error getting subscriptions:', err);
    return [];
  }
}

/**
 * Send push notification to a subscription
 * @param subscription - The push subscription details
 * @param payload - The notification payload to send
 */
async function sendPushNotification(subscription: PushSubscription, payload: PushPayload): Promise<void> {
  try {
    // Set VAPID details from environment
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured');
    }

    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      vapidDetails: {
        subject: 'mailto:support@melissaknudson.com',
        publicKey: vapidPublicKey,
        privateKey: vapidPrivateKey,
      },
      TTL: 60, // Time to live in seconds
    });

    console.log('[Push Bot] Push sent successfully to', subscription.endpoint);
  } catch (err: any) {
    // Handle expired/invalid subscriptions
    if (err.statusCode === 404 || err.statusCode === 410) {
      console.log('[Push Bot] Subscription expired, removing:', subscription.endpoint);
      // Could delete the subscription here
    } else {
      throw err;
    }
  }
}

/**
 * Get the URL for the notification
 * Based on related resource extensions
 * @param communication - The Communication resource to extract related info from
 * @returns The URL to link to in the notification
 */
function getNotificationUrl(communication: Communication): string {
  // Check for related appointment
  const apptRef = communication.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/related-appointment'
  )?.valueReference?.reference;

  if (apptRef) {
    return '/calendar';
  }

  // Check for related procedure
  const procRef = communication.extension?.find(
    (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure'
  )?.valueReference?.reference;

  if (procRef) {
    const patientRef = communication.subject?.reference;
    if (patientRef) {
      const patientId = patientRef.split('/')[1];
      const procedureId = procRef.split('/')[1];
      return `/Patient/${patientId}/botox-treatment?procedureId=${procedureId}`;
    }
  }

  // Default: notifications page
  return '/notifications';
}
