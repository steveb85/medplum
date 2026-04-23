// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import type { MedplumClient } from '@medplum/core';
import { createReference } from '@medplum/core';
import type { Communication, Practitioner, Reference } from '@medplum/fhirtypes';
import { getPushSubscriptionData } from './push';
import type { NotificationData, NotificationType } from './templates';
import { formatNotification } from './templates';

/**
 * Determines who should receive a notification based on event type and data
 * @param type - The type of notification (e.g. appointment-created, treatment-updated)
 * @param data - The data related to the event (e.g. appointment, procedure, patient)
 * @param currentUser - The current user (to avoid sending notifications to self)
 * @returns Array of Practitioner references to receive the notification
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
 * @param medplum - Medplum client instance
 * @returns Array of Practitioner references for all practitioners in the system
 */
export async function getAllPractitioners(medplum: MedplumClient): Promise<Reference<Practitioner>[]> {
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
 * @param medplum - medplum client instance
 * @param type - The type of notification (e.g. appointment-created, treatment-updated)
 * @param data - The data related to the event (e.g. appointment, procedure, patient)
 * @param currentUser - The current user (to set as sender and avoid sending to self)
 * @returns The created Communication resource or null if no recipients
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

  return medplum.createResource(communication);
}

/**
 * Marks a notification as read
 * @param medplum - Medplum client instance
 * @param communicationId - The ID of the Communication resource to mark as read
 * @returns void
 */
export async function markNotificationAsRead(medplum: MedplumClient, communicationId: string): Promise<void> {
  const communication = await medplum.readResource('Communication', communicationId);

  const updatedExtension =
    communication.extension?.map((ext) =>
      ext.url === 'http://melissaknudson.com/fhir/StructureDefinition/notification-read'
        ? { ...ext, valueBoolean: true }
        : ext
    ) || [];

  // Add read extension if not present
  if (
    !updatedExtension.some((ext) => ext.url === 'http://melissaknudson.com/fhir/StructureDefinition/notification-read')
  ) {
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
 * @param medplum - Medplum client instance
 * @param userId - The ID of the user (Practitioner) to get notifications for
 * @returns number of unread notifications for the user
 */
export async function getUnreadNotificationCount(medplum: MedplumClient, userId: string): Promise<number> {
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
 * Creates ONE Communication with all practitioners as recipients
 * The Bot will query for push subscriptions and send to all
 * @param medplum - Medplum client instance
 * @param message  - The message to include in the notification
 * @param currentUser - The current user (to set as sender and avoid sending to self)
 * @returns Array of created Communication resources (should be 1) or empty array if no practitioners
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

    console.log(`[Broadcast] Creating broadcast for ${practitioners.length} practitioners`);

    // Create ONE Communication with ALL practitioners as recipients
    // The Bot will handle querying and sending to each
    const recipients: Reference<Practitioner>[] = practitioners.map((p) => createReference(p));

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
      recipient: recipients,
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
      console.log(`[Broadcast] Successfully created broadcast notification: ${created.id}`);
    }

    return createdCommunications;
  } catch (err) {
    console.error('[Broadcast] Error creating broadcast notification:', err);
    return createdCommunications;
  }
}

/**
 * Gets notifications for a user
 * @param medplum - Medplum client instance
 * @param userId - The ID of the user (Practitioner) to get notifications for
 * @param limit - The maximum number of notifications to retrieve (default 20)
 * @returns Array of Communication resources representing the notifications for the user
 */
export async function getNotifications(medplum: MedplumClient, userId: string, limit = 20): Promise<Communication[]> {
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
 * @param communication -  The Communication resource representing the notification
 * @returns Reference to the related resource (e.g. Appointment, Procedure) or null if not found
 */
export function getRelatedResource(communication: Communication): { type: string; id: string } | null {
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
 * @param communication - The Communication resource representing the notification
 * @returns true if the notification is marked as read, false otherwise
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
 * @param communication - The Communication resource representing the notification
 * @returns The category of the notification (e.g. appointment, treatment, general)
 */
export function getNotificationCategory(communication: Communication): string {
  return (
    communication.extension?.find(
      (ext) => ext.url === 'http://melissaknudson.com/fhir/StructureDefinition/notification-category'
    )?.valueString || 'general'
  );
}
