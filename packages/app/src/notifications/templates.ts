// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import type { Appointment, Patient, Practitioner, Procedure, Reference } from '@medplum/fhirtypes';
import dayjs from 'dayjs';

/**
 * Notification Types
 * These are the events that trigger notifications
 */
export type NotificationType =
  | 'appointment-created'
  | 'appointment-cancelled'
  | 'appointment-rescheduled'
  | 'treatment-started'
  | 'treatment-completed'
  | 'photos-uploaded'
  | 'notes-added';

/**
 * Notification Priority
 */
export type NotificationPriority = 'routine' | 'urgent' | 'asap' | 'stat';

/**
 * Notification Template
 * Defines how a notification should be formatted
 */
export interface NotificationTemplate {
  type: NotificationType;
  title: string;
  getMessage: (data: NotificationData) => string;
  priority: NotificationPriority;
  category: string;
}

/**
 * Data passed to notification templates
 */
export interface NotificationData {
  patient?: Patient;
  appointment?: Appointment;
  procedure?: Procedure;
  provider?: Practitioner;
  assistant?: Practitioner;
  date?: string;
  time?: string;
  notes?: string;
  serviceType?: string;
}

/**
 * Notification Templates
 * Each event type has its own template
 */
export const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  'appointment-created': {
    type: 'appointment-created',
    title: 'New Appointment',
    getMessage: (data) => {
      const patientName = getPatientName(data.patient);
      const date = data.date ? dayjs(data.date).format('MMM D, YYYY') : 'Unknown date';
      const time = data.time || 'Unknown time';
      const service = data.serviceType || 'Appointment';
      return `${service} scheduled for ${patientName} on ${date} at ${time}`;
    },
    priority: 'routine',
    category: 'appointment',
  },

  'appointment-cancelled': {
    type: 'appointment-cancelled',
    title: 'Appointment Cancelled',
    getMessage: (data) => {
      const patientName = getPatientName(data.patient);
      const date = data.date ? dayjs(data.date).format('MMM D, YYYY') : 'Unknown date';
      return `Appointment for ${patientName} on ${date} has been cancelled`;
    },
    priority: 'urgent',
    category: 'appointment',
  },

  'appointment-rescheduled': {
    type: 'appointment-rescheduled',
    title: 'Appointment Rescheduled',
    getMessage: (data) => {
      const patientName = getPatientName(data.patient);
      const date = data.date ? dayjs(data.date).format('MMM D, YYYY') : 'Unknown date';
      const time = data.time || 'Unknown time';
      return `Appointment for ${patientName} moved to ${date} at ${time}`;
    },
    priority: 'routine',
    category: 'appointment',
  },

  'treatment-started': {
    type: 'treatment-started',
    title: 'Treatment Started',
    getMessage: (data) => {
      const patientName = getPatientName(data.patient);
      const service = data.serviceType || 'Treatment';
      return `${service} has started for ${patientName}`;
    },
    priority: 'routine',
    category: 'treatment',
  },

  'treatment-completed': {
    type: 'treatment-completed',
    title: 'Treatment Completed',
    getMessage: (data) => {
      const patientName = getPatientName(data.patient);
      const service = data.serviceType || 'Treatment';
      return `${service} has been completed for ${patientName}`;
    },
    priority: 'routine',
    category: 'treatment',
  },

  'photos-uploaded': {
    type: 'photos-uploaded',
    title: 'Photos Uploaded',
    getMessage: (data) => {
      const patientName = getPatientName(data.patient);
      return `New photos uploaded for ${patientName}`;
    },
    priority: 'routine',
    category: 'photos',
  },

  'notes-added': {
    type: 'notes-added',
    title: 'Notes Added',
    getMessage: (data) => {
      const patientName = getPatientName(data.patient);
      return `New notes added for ${patientName}`;
    },
    priority: 'routine',
    category: 'notes',
  },
};

/**
 * Helper to get patient name
 */
function getPatientName(patient: Patient | undefined): string {
  if (!patient?.name?.[0]) return 'Unknown Patient';
  const name = patient.name[0];
  const given = name.given?.[0] || '';
  const family = name.family || '';
  return `${given} ${family}`.trim();
}

/**
 * Get notification template by type
 */
export function getNotificationTemplate(type: NotificationType): NotificationTemplate {
  return NOTIFICATION_TEMPLATES[type];
}

/**
 * Format notification message using template
 */
export function formatNotification(
  type: NotificationType,
  data: NotificationData
): { title: string; message: string; priority: NotificationPriority; category: string } {
  const template = NOTIFICATION_TEMPLATES[type];
  return {
    title: template.title,
    message: template.getMessage(data),
    priority: template.priority,
    category: template.category,
  };
}
