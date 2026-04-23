// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { createReference, getReferenceString } from '@medplum/core';
import type { Communication, Practitioner, Reference } from '@medplum/fhirtypes';
import type { MedplumClient } from '@medplum/core';
import type { NotificationData, NotificationType } from './templates';
import { formatNotification } from './templates';
import { getPushSubscriptionData } from './push';

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
 * Gets all practitioners for broadcast notifications
 */
export async function getAllPractitioners(
  medplum: MedplumClient
): Promise<Reference<Practitioner>[]> {
  const recipients: Reference<Practitioner>[] = [];
  try {
    const bundle = await medplum.search('Practitioner', { _count: '100' });
    for (const entry of bundle.entry || []) {
      if (entry.resource) {
        recipients.push(createReference(entry.resource as Practitioner));
      }
    }
  } catch (err) {
    console.error('Error getting practitioners:', err);
  }
  return recipients;
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
  const recipients = getNotificationRecipients(type, data, currentUser);

  // Don't create notification if no recipients
  if (recipients.length === 0) {
    return null;
  }

  const { title, message, priority, category } = formatNotification(type, data);

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
  // NOTE: We read from localStorage since we can't search Subscription resources (403 Forbidden)
  const pushSubscriptions: Record<string, any> = {};
  const currentUserSub = getPushSubscriptionData();
  if (currentUserSub && currentUser?.id) {
    pushSubscriptions[currentUser.id] = [currentUserSub];
  }

  // Add push subscriptions as extension if any found
  if (Object.keys(pushSubscriptions).length > 0) {
    communication.extension?.push({
      url: 'http://melissaknudson.com/fhir/StructureDefinition/push-subscriptions',
      valueString: JSON.stringify(pushSubscriptions),
    });
  }

  return await medplum.createResource(communication);
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
 * Creates a broadcast notification sent to all practitioners
 * Used for testing - sends to all staff members
 */
export async function createBroadcastNotification(
  medplum: MedplumClient,
  message: string,
  currentUser: Practitioner | undefined
): Promise<Communication[]> {
  const createdCommunications: Communication[] = [];

  try {
    // Get all practitioners
    const bundle = await medplum.search('Practitioner', { _count: '100' });
    const practitioners = (bundle.entry || []).map((e) => e.resource as Practitioner).filter(Boolean);

    if (practitioners.length === 0) {
      console.log('[Broadcast] No practitioners found');
      return createdCommunications;
    }

    console.log(`[Broadcast] Sending to ${practitioners.length} practitioners`);

    // Create a notification for each practitioner directly
    for (const practitioner of practitioners) {
      const recipientRef = createReference(practitioner);

      // Create Communication resource directly
      const communication: Communication = {
        resourceType: 'Communication',
        status: 'completed',
        category: [
          {
            coding: [
              {
                system: 'http://melissaknudson.com/notification-type',
                code: 'broadcast',
                display: 'Broadcast',
              },
            ],
          },
        ],
        priority: 'urgent',
        recipient: [recipientRef],
        sender: currentUser ? createReference(currentUser) : undefined,
        sent: new Date().toISOString(),
        payload: [
          {
            contentString: message,
          },
        ],
        extension: [
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/notification-read',
            valueBoolean: false,
          },
          {
            url: 'http://melissaknudson.com/fhir/StructureDefinition/notification-category',
            valueString: 'general',
          },
        ],
      };

      const created = await medplum.createResource(communication);
      if (created) {
        createdCommunications.push(created);
      }
    }

    console.log(`[Broadcast] Successfully created ${createdCommunications.length} notifications`);
    return createdCommunications;
  } catch (err) {
    console.error('[Broadcast] Error creating broadcast notification:', err);
    return createdCommunications;
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
