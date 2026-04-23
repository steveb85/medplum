// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { createReference, getReferenceString } from '@medplum/core';
import type { Communication, Practitioner, Reference } from '@medplum/fhirtypes';
import type { MedplumClient } from '@medplum/core';
import type { NotificationData, NotificationType } from './templates';
import { formatNotification } from './templates';
import { getPushSubscriptionData, type PushSubscriptionData } from './push';

/**
 * Gets push subscription data for the current user from localStorage
 * Since we can't search Subscription resources (403 Forbidden), we store locally
 */
function getCurrentUserPushSubscription(): Array<{ endpoint: string; keys: any }> | null {
  const data = getPushSubscriptionData();
  if (!data) return null;
  return [data];
}

/**
 * Determines who should receive a notification based on event type and data
 */
export function getNotificationRecipients(
  type: NotificationType,
  data: NotificationData,
  currentUser: Practitioner | undefined
): Reference<Practitioner>[] {
  const recipients: Reference<Practitioner>[] = [];

  switch (type) {
    case 'appointment-created':
      // Notify main provider and assistant (not the creator)
      if (data.provider && data.provider.id !== currentUser?.id) {
        recipients.push(createReference(data.provider));
      }
      if (data.assistant && data.assistant.id !== currentUser?.id) {
        recipients.push(createReference(data.assistant));
      }
      break;

    case 'appointment-cancelled':
      // Notify all assigned providers
      if (data.provider) {
        recipients.push(createReference(data.provider));
      }
      if (data.assistant) {
        recipients.push(createReference(data.assistant));
      }
      break;

    case 'appointment-rescheduled':
      // Notify all assigned providers
      if (data.provider) {
        recipients.push(createReference(data.provider));
      }
      if (data.assistant) {
        recipients.push(createReference(data.assistant));
      }
      break;

    case 'treatment-started':
    case 'treatment-completed':
      // Notify coordinator and assistant about treatment updates
      // Main provider made the change, so notify others
      if (data.assistant) {
        recipients.push(createReference(data.assistant));
      }
      break;

    case 'photos-uploaded':
    case 'notes-added':
      // Notify main provider about updates
      if (data.provider && data.provider.id !== currentUser?.id) {
        recipients.push(createReference(data.provider));
      }
      break;

    case 'general':
      // For general/test notifications, notify the current user if no specific recipients
      if (currentUser) {
        recipients.push(createReference(currentUser));
      }
      break;
  }

  return recipients;
}

/**
 * Gets push subscriptions for a practitioner
 * Searches for FHIR Subscriptions with push notification data
 */
async function getPushSubscriptionsForPractitioner(
  medplum: MedplumClient,
  practitionerId: string
): Promise<Array<{ endpoint: string; keys: any }> | null> {
  console.log('[NotificationUtils] Getting push subscriptions for practitioner:', practitionerId);
  try {
    // Search for subscriptions with push notification data for this practitioner
    const bundle = await medplum.search('Subscription', {
      reason: 'Push notifications',
      status: 'active',
      _count: '100',
    });

    console.log('[NotificationUtils] Found', bundle.entry?.length || 0, 'total push subscriptions');

    const pushSubs: Array<{ endpoint: string; keys: any }> = [];

    for (const entry of bundle.entry || []) {
      const sub = entry.resource as any;
      console.log('[NotificationUtils] Checking subscription:', sub.id);
      console.log('[NotificationUtils] Subscription meta:', JSON.stringify(sub.meta, null, 2));
      console.log('[NotificationUtils] Subscription channel:', JSON.stringify(sub.channel, null, 2));

      // Check if this subscription belongs to the practitioner
      const authorRef = sub.meta?.author?.reference || '';
      console.log('[NotificationUtils] Author ref:', authorRef, 'Looking for:', practitionerId);
      if (authorRef.includes(practitionerId) && sub.channel?.payload) {
        console.log('[NotificationUtils] Found subscription belonging to practitioner');
        try {
          const pushData = JSON.parse(sub.channel.payload);
          console.log('[NotificationUtils] Parsed push data:', JSON.stringify(pushData, null, 2));
          if (pushData.endpoint && pushData.keys) {
            pushSubs.push(pushData);
            console.log('[NotificationUtils] Added push subscription');
          } else {
            console.log('[NotificationUtils] Push data missing endpoint or keys');
          }
        } catch (err) {
          console.log('[NotificationUtils] Failed to parse payload:', err);
        }
      } else {
        console.log('[NotificationUtils] Subscription does not match practitioner');
      }
    }

    console.log('[NotificationUtils] Total push subscriptions found:', pushSubs.length);
    return pushSubs.length > 0 ? pushSubs : null;
  } catch (err) {
    console.error('[NotificationUtils] Error getting push subscriptions:', err);
    return null;
  }
}

/**
 * Creates a Communication resource for a notification
 */
export async function createNotification(
  medplum: MedplumClient,
  type: NotificationType,
  data: NotificationData,
  currentUser: Practitioner | undefined
): Promise<Communication | null> {
  console.log('[createNotification] Starting notification creation for type:', type);
  console.log('[createNotification] Current user:', currentUser?.id);

  const recipients = getNotificationRecipients(type, data, currentUser);
  console.log('[createNotification] Recipients:', JSON.stringify(recipients, null, 2));

  // Don't create notification if no recipients
  if (recipients.length === 0) {
    console.log('[createNotification] No recipients, returning null');
    return null;
  }

  const { title, message, priority, category } = formatNotification(type, data);
  console.log('[createNotification] Formatted notification:', { title, message, priority, category });

  const communication: Communication = {
    resourceType: 'Communication',
    status: 'completed',
    category: [
      {
        coding: [
          {
            system: 'http://melissaknudson.com/notification-type',
            code: type,
            display: title,
          },
        ],
      },
    ],
    priority,
    subject: data.patient ? createReference(data.patient) : undefined,
    recipient: recipients,
    sender: currentUser ? createReference(currentUser) : undefined,
    sent: new Date().toISOString(),
    payload: [
      {
        contentString: message,
      },
    ],
    extension: [],
  };

  // Add related resource references as extensions
  if (data.appointment) {
    communication.extension?.push({
      url: 'http://melissaknudson.com/fhir/StructureDefinition/related-appointment',
      valueReference: createReference(data.appointment),
    });
  }

  if (data.procedure) {
    communication.extension?.push({
      url: 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure',
      valueReference: createReference(data.procedure),
    });
  }

  // Add read status extension
  communication.extension?.push({
    url: 'http://melissaknudson.com/fhir/StructureDefinition/notification-read',
    valueBoolean: false,
  });

  // Add category extension
  communication.extension?.push({
    url: 'http://melissaknudson.com/fhir/StructureDefinition/notification-category',
    valueString: category,
  });

  // Fetch push subscriptions for each recipient and add to Communication
  // This allows the Bot to send push notifications without searching
  const pushSubscriptions: Record<string, any> = {};
  console.log('[createNotification] Fetching push subscriptions for recipients...');
  for (const recipient of recipients) {
    const practitionerRef = recipient.reference;
    console.log('[createNotification] Checking recipient:', practitionerRef);
    if (practitionerRef?.startsWith('Practitioner/')) {
      const practitionerId = practitionerRef.split('/')[1];
      console.log('[createNotification] Fetching subscriptions for practitioner:', practitionerId);
      const subs = await getPushSubscriptionsForPractitioner(medplum, practitionerId);
      console.log('[createNotification] Found subscriptions:', subs);
      if (subs) {
        pushSubscriptions[practitionerId] = subs;
      }
    }
  }

  console.log('[createNotification] All push subscriptions:', JSON.stringify(pushSubscriptions, null, 2));

  // Add push subscriptions as extension if any found
  if (Object.keys(pushSubscriptions).length > 0) {
    communication.extension?.push({
      url: 'http://melissaknudson.com/fhir/StructureDefinition/push-subscriptions',
      valueString: JSON.stringify(pushSubscriptions),
    });
    console.log('[createNotification] Added push subscriptions extension for', Object.keys(pushSubscriptions).length, 'recipients');
  } else {
    console.log('[createNotification] No push subscriptions found, no extension added');
  }

  console.log('[createNotification] Final Communication resource:', JSON.stringify(communication, null, 2));

  const created = await medplum.createResource(communication);
  console.log('[createNotification] Created Communication:', created.id);
  return created;
}

/**
 * Marks a notification as read
 */
export async function markNotificationAsRead(
  medplum: MedplumClient,
  communicationId: string
): Promise<void> {
  const communication = await medplum.readResource('Communication', communicationId);

  const updatedExtension = communication.extension?.map((ext) =>
    ext.url === 'http://melissaknudson.com/fhir/StructureDefinition/notification-read'
      ? { ...ext, valueBoolean: true }
      : ext
  ) || [];

  // Add read extension if not present
  if (!updatedExtension.some((ext) => ext.url === 'http://melissaknudson.com/fhir/StructureDefinition/notification-read')) {
    updatedExtension.push({
      url: 'http://melissaknudson.com/fhir/StructureDefinition/notification-read',
      valueBoolean: true,
    });
  }

  await medplum.updateResource({
    ...communication,
    extension: updatedExtension,
  });
}

/**
 * Gets unread notification count for a user
 */
export async function getUnreadNotificationCount(
  medplum: MedplumClient,
  userId: string
): Promise<number> {
  try {
    const bundle = await medplum.search('Communication', {
      recipient: `Practitioner/${userId}`,
      _count: '100',
    });

    const communications = (bundle.entry || []).map((e) => e.resource as Communication);

    // Filter for unread notifications
    const unreadCount = communications.filter((comm) => {
      const isRead = comm.extension?.find(
        (ext) => ext.url === 'http://melissaknudson.com/fhir/StructureDefinition/notification-read'
      )?.valueBoolean;
      return !isRead;
    }).length;

    return unreadCount;
  } catch (err) {
    console.error('Error getting notification count:', err);
    return 0;
  }
}

/**
 * Gets notifications for a user
 */
export async function getNotifications(
  medplum: MedplumClient,
  userId: string,
  limit = 20
): Promise<Communication[]> {
  try {
    const bundle = await medplum.search('Communication', {
      recipient: `Practitioner/${userId}`,
      _sort: '-sent',
      _count: String(limit),
    });

    return (bundle.entry || []).map((e) => e.resource as Communication);
  } catch (err) {
    console.error('Error getting notifications:', err);
    return [];
  }
}

/**
 * Gets the related resource reference from a notification
 */
export function getRelatedResource(
  communication: Communication
): { type: string; id: string } | null {
  // Check for appointment
  const appointmentRef = communication.extension?.find(
    (ext) => ext.url === 'http://melissaknudson.com/fhir/StructureDefinition/related-appointment'
  )?.valueReference?.reference;

  if (appointmentRef) {
    const [type, id] = appointmentRef.split('/');
    return { type, id };
  }

  // Check for procedure
  const procedureRef = communication.extension?.find(
    (ext) => ext.url === 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure'
  )?.valueReference?.reference;

  if (procedureRef) {
    const [type, id] = procedureRef.split('/');
    return { type, id };
  }

  // Check for patient
  if (communication.subject?.reference) {
    const [type, id] = communication.subject.reference.split('/');
    return { type, id };
  }

  return null;
}

/**
 * Checks if a notification is read
 */
export function isNotificationRead(communication: Communication): boolean {
  return (
    communication.extension?.find(
      (ext) => ext.url === 'http://melissaknudson.com/fhir/StructureDefinition/notification-read'
    )?.valueBoolean ?? false
  );
}

/**
 * Gets notification category
 */
export function getNotificationCategory(communication: Communication): string {
  return (
    communication.extension?.find(
      (ext) => ext.url === 'http://melissaknudson.com/fhir/StructureDefinition/notification-category'
    )?.valueString || 'general'
  );
}
