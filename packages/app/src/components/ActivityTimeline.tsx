// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * ActivityTimeline Component
 * 
 * Displays a chronological history of booking events using FHIR AuditEvent resources.
 * Shows consent signing, service status changes, deposits, and milestones.
 */

import {
  Box,
  Group,
  Paper,
  Stack,
  Text,
  Timeline,
  Badge,
  Collapse,
  Button,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconCheck,
  IconClipboardCheck,
  IconCreditCard,
  IconFlag,
  IconMessage,
  IconPhoto,
  IconSignature,
  IconStethoscope,
  IconX,
} from '@tabler/icons-react';
import type { AuditEvent, Practitioner } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import { useMemo } from 'react';

export interface TimelineEvent {
  id: string;
  type: 'booking-created' | 'booking-approved' | 'consent-signed' | 'service-started' |
    'service-completed' | 'deposit-requested' | 'deposit-paid' | 'deposit-waived' | 'status-changed' |
    'photo-uploaded' | 'note-added' | 'cancelled' | 'uncancelled' | 'rescheduled';
  timestamp: Date;
  description: string;
  actor?: {
    name: string;
    reference: string;
  };
  details?: Record<string, string | number | boolean | undefined>;
}

interface ActivityTimelineProps {
  events: TimelineEvent[];
  maxEvents?: number;
  showAllInitially?: boolean;
}

const EVENT_CONFIG: Record<TimelineEvent['type'], {
  icon: typeof IconCheck;
  color: string;
  label: string;
}> = {
  'booking-created': { icon: IconClipboardCheck, color: 'blue', label: 'Booking Created' },
  'booking-approved': { icon: IconCheck, color: 'green', label: 'Booking Approved' },
  'consent-signed': { icon: IconSignature, color: 'violet', label: 'Consent Signed' },
  'service-started': { icon: IconStethoscope, color: 'orange', label: 'Treatment Started' },
  'service-completed': { icon: IconCheck, color: 'green', label: 'Treatment Completed' },
  'deposit-requested': { icon: IconCreditCard, color: 'blue', label: 'Payment Link Sent' },
  'deposit-paid': { icon: IconCreditCard, color: 'green', label: 'Deposit Paid' },
  'deposit-waived': { icon: IconCreditCard, color: 'yellow', label: 'Deposit Waived' },
  'status-changed': { icon: IconFlag, color: 'blue', label: 'Status Changed' },
  'photo-uploaded': { icon: IconPhoto, color: 'cyan', label: 'Photo Uploaded' },
  'note-added': { icon: IconMessage, color: 'gray', label: 'Note Added' },
  'cancelled': { icon: IconX, color: 'red', label: 'Booking Cancelled' },
  'uncancelled': { icon: IconCheck, color: 'green', label: 'Booking Restored' },
  'rescheduled': { icon: IconFlag, color: 'orange', label: 'Rescheduled' },
};

function formatEventTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function ActivityTimeline({
  events,
  maxEvents = 10,
  showAllInitially = false,
}: ActivityTimelineProps): JSX.Element {
  const [showAll, { toggle: toggleShowAll }] = useDisclosure(showAllInitially);

  // Sort events by timestamp (newest first)
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [events]);

  const displayEvents = showAll ? sortedEvents : sortedEvents.slice(0, maxEvents);
  const hasMore = sortedEvents.length > maxEvents;

  if (events.length === 0) {
    return (
      <Paper withBorder p="lg" style={{ textAlign: 'center', color: '#868e96' }}>
        <Text size="sm" c="dimmed">No activity recorded yet</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      <Timeline bulletSize={28} lineWidth={2}>
        {displayEvents.map((event) => {
          const config = EVENT_CONFIG[event.type];
          const Icon = config.icon;

          return (
            <Timeline.Item
              key={event.id}
              bullet={<Icon size={14} />}
              color={config.color}
              title={
                <Group gap="xs">
                  <Text size="sm" fw={500}>
                    {config.label}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatEventTime(event.timestamp)}
                  </Text>
                </Group>
              }
            >
              <Box>
                <Text size="sm" c="dimmed">
                  {event.description}
                </Text>
                
                {event.actor && (
                  <Text size="xs" c="dimmed" mt={4}>
                    by {event.actor.name}
                  </Text>
                )}

                {event.details && Object.keys(event.details).length > 0 && (
                  <Group gap="xs" mt={8}>
                    {Object.entries(event.details).map(([key, value]) => (
                      value !== undefined && (
                        <Badge
                          key={key}
                          size="xs"
                          variant="light"
                          color="gray"
                        >
                          {key}: {String(value)}
                        </Badge>
                      )
                    ))}
                  </Group>
                )}
              </Box>
            </Timeline.Item>
          );
        })}
      </Timeline>

      {hasMore && (
        <Button
          variant="subtle"
          size="xs"
          onClick={toggleShowAll}
          fullWidth
        >
          {showAll ? 'Show Less' : `Show All ${sortedEvents.length} Events`}
        </Button>
      )}
    </Stack>
  );
}

/**
 * Convert FHIR AuditEvent to TimelineEvent
 */
export function auditEventToTimelineEvent(
  auditEvent: AuditEvent,
  practitioners: Practitioner[]
): TimelineEvent {
  // Map AuditEvent action to timeline event type
  // Also check description for more specific event types
  const description = (auditEvent.outcomeDesc || '').toLowerCase();
  const action = auditEvent.action || '';

  let type: TimelineEvent['type'] = 'note-added';

  if (action === 'C') {
    type = 'booking-created';
  } else if (action === 'D') {
    type = 'cancelled';
  } else if (action === 'R') {
    type = 'note-added';
  } else if (action === 'E') {
    // Check description for more specific types
    if (description.includes('payment link')) {
      type = 'deposit-requested';
    } else if (description.includes('consent')) {
      type = 'consent-signed';
    } else {
      type = 'service-started';
    }
  } else if (action === 'U') {
    // Check description for more specific types
    if (description.includes('waived')) {
      type = 'deposit-waived';
    } else if (description.includes('status')) {
      type = 'status-changed';
    } else if (description.includes('service')) {
      type = 'service-completed';
    } else {
      type = 'status-changed';
    }
  }
  
  // Get actor name from practitioner reference
  const actorRef = auditEvent.agent?.[0]?.who;
  const actorName = actorRef?.display || 'Unknown User';

  // Extract details from entity
  const details: Record<string, string> = auditEvent.entity?.reduce((acc, entity) => {
    if (entity.detail) {
      entity.detail.forEach(d => {
        if (d.type && d.valueString) {
          acc[d.type] = d.valueString;
        }
      });
    }
    return acc;
  }, {} as Record<string, string>) || {};

  // Build rich description with details
  let richDescription = auditEvent.outcomeDesc || 'Activity recorded';
  const detailParts: string[] = [];

  if (details.amount) {
    detailParts.push(`Amount: $${details.amount}`);
  }
  if (details.reason) {
    detailParts.push(`Reason: ${details.reason}`);
  }
  if (details.method) {
    detailParts.push(`Via: ${details.method}`);
  }
  if (details.fromStatus && details.toStatus) {
    detailParts.push(`${details.fromStatus} → ${details.toStatus}`);
  }

  if (detailParts.length > 0) {
    richDescription += ` • ${detailParts.join(' • ')}`;
  }

  return {
    id: auditEvent.id || 'unknown',
    type,
    timestamp: auditEvent.recorded ? new Date(auditEvent.recorded) : new Date(),
    description: richDescription,
    actor: {
      name: actorName,
      reference: actorRef?.reference || '',
    },
    details, // Keep for badge display if needed
  };
}

export default ActivityTimeline;
