// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import {
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Text,
  Title,
  ActionIcon,
  Tooltip,
  Box,
  Divider,
  Loader,
  Center,
  ScrollArea,
  Switch,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { useMedplum } from '@medplum/react';
import type { Communication, Practitioner } from '@medplum/fhirtypes';
import { useState, useEffect, useCallback } from 'react';
import type { JSX } from 'react';
import {
  IconEye,
  IconCheck,
  IconCalendar,
  IconUser,
  IconPhoto,
  IconNotes,
  IconBell,
  IconX,
  IconList,
  IconSend,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import {
  getNotifications,
  markNotificationAsRead,
  isNotificationRead,
  getRelatedResource,
  getNotificationCategory,
  createNotification,
  createBroadcastNotification,
} from './utils';

// Category icons
const CATEGORY_ICONS: Record<string, JSX.Element> = {
  appointment: <IconCalendar size={20} />,
  treatment: <IconUser size={20} />,
  photos: <IconPhoto size={20} />,
  notes: <IconNotes size={20} />,
  general: <IconBell size={20} />,
};

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  appointment: 'blue',
  treatment: 'green',
  photos: 'purple',
  notes: 'orange',
  general: 'gray',
};

export function NotificationsPage(): JSX.Element {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const user = medplum.getProfile() as Practitioner | undefined;
  const [notifications, setNotifications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAll, setShowAll] = useState(false);

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const comms = await getNotifications(medplum, user.id, 20);
      setNotifications(comms);

      // Count unread
      const unread = comms.filter((comm) => !isNotificationRead(comm)).length;
      setUnreadCount(unread);
    } catch (err) {
      console.error('Error loading notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [medplum, user?.id]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Mark notification as read
  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    try {
      await markNotificationAsRead(medplum, notificationId);
      // Update local state
      setNotifications((prev) =>
        prev.map((comm) =>
          comm.id === notificationId
            ? {
                ...comm,
                extension: comm.extension?.map((ext) =>
                  ext.url === 'http://melissaknudson.com/fhir/StructureDefinition/notification-read'
                    ? { ...ext, valueBoolean: true }
                    : ext
                ),
              }
            : comm
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, [medplum]);

  // Mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    try {
      const unreadNotifications = notifications.filter((comm) => !isNotificationRead(comm));
      await Promise.all(unreadNotifications.map((comm) => markNotificationAsRead(medplum, comm.id as string)));
      await loadNotifications();
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }, [medplum, notifications, loadNotifications]);

  // Navigate to related resource
  const handleNavigate = useCallback((notification: Communication) => {
    const related = getRelatedResource(notification);
    if (related) {
      if (related.type === 'Appointment') {
        navigate('/calendar');
      } else if (related.type === 'Procedure') {
        const patientRef = notification.subject?.reference;
        if (patientRef) {
          const patientId = patientRef.split('/')[1];
          navigate(`/Patient/${patientId}/botox-treatment?procedureId=${related.id}`);
        }
      } else if (related.type === 'Patient') {
        navigate(`/Patient/${related.id}`);
      }
    }

    // Mark as read when clicked
    if (notification.id && !isNotificationRead(notification)) {
      handleMarkAsRead(notification.id);
    }
  }, [navigate, handleMarkAsRead]);

  // Filter notifications based on showAll toggle
  const displayedNotifications = showAll
    ? notifications
    : notifications.filter((comm) => !isNotificationRead(comm));

  const readCount = notifications.length - unreadCount;

  // Send test notification
  const handleSendTestNotification = useCallback(async () => {
    try {
      await createNotification(medplum, 'general', {
        message: 'This is a test notification to verify push notifications are working!',
      }, user);
      showNotification({
        title: 'Test Notification Sent',
        message: 'Check your browser notifications and refresh the page to see it',
        color: 'green',
      });
      // Reload notifications after a brief delay
      setTimeout(loadNotifications, 1000);
    } catch (err) {
      console.error('Error sending test notification:', err);
      showNotification({
        title: 'Error',
        message: 'Failed to send test notification',
        color: 'red',
      });
    }
  }, [medplum, user, loadNotifications]);

  // Send broadcast notification to all practitioners
  const handleSendBroadcastNotification = useCallback(async () => {
    try {
      showNotification({
        title: 'Sending Broadcast',
        message: 'Sending notifications to all practitioners...',
        color: 'blue',
      });

      const result = await createBroadcastNotification(
        medplum,
        'This is a broadcast notification to all staff!',
        user
      );

      showNotification({
        title: 'Broadcast Sent',
        message: `Sent ${result.length} notifications to all practitioners`,
        color: 'green',
      });
      // Reload notifications after a brief delay
      setTimeout(loadNotifications, 1000);
    } catch (err) {
      console.error('Error sending broadcast notification:', err);
      showNotification({
        title: 'Error',
        message: 'Failed to send broadcast notification',
        color: 'red',
      });
    }
  }, [medplum, user, loadNotifications]);

  // Format date
  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <Box p="md">
        <Center h={400}>
          <Loader />
        </Center>
      </Box>
    );
  }

  return (
    <Box p="md">
      <Stack gap="md">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group>
            <IconBell size={24} />
            <Title order={4}>Notifications</Title>
            {unreadCount > 0 && (
              <Badge color="red" variant="filled" size="lg">
                {unreadCount} unread
              </Badge>
            )}
          </Group>
        <Group>
        <Button
          variant="light"
          size="sm"
          leftSection={<IconSend size={16} />}
          onClick={handleSendTestNotification}
        >
          Send Test Push
        </Button>
        <Button
          variant="filled"
          color="orange"
          size="sm"
          leftSection={<IconSend size={16} />}
          onClick={handleSendBroadcastNotification}
        >
          Broadcast to All
        </Button>
        {readCount > 0 && (
            <Switch
              label={showAll ? 'Showing all' : `Hide ${readCount} read`}
              checked={showAll}
              onChange={(e) => setShowAll(e.currentTarget.checked)}
            />
          )}
          {unreadCount > 0 && (
            <Button variant="light" size="sm" onClick={handleMarkAllAsRead}>
              Mark all as read
            </Button>
          )}
        </Group>
      </Group>

        <Divider />

        {/* Notification List */}
        {displayedNotifications.length === 0 ? (
          <Paper p="xl" withBorder>
            <Center>
              <Stack align="center" gap="md">
                <IconBell size={48} style={{ color: 'var(--mantine-color-gray-6)' }} />
                <Text size="lg" c="dimmed">
                  {showAll ? 'No notifications yet' : 'No unread notifications'}
                </Text>
                <Text size="sm" c="dimmed" ta="center">
                  {showAll
                    ? 'Notifications will appear here when appointments are booked, treatments are updated, or photos are uploaded.'
                    : `You have ${readCount} read notification${readCount === 1 ? '' : 's'}. Toggle "Show all" to view them.`}
                </Text>
                {!showAll && readCount > 0 && (
                  <Button variant="light" onClick={() => setShowAll(true)}>
                    Show all notifications
                  </Button>
                )}
              </Stack>
            </Center>
          </Paper>
        ) : (
          <ScrollArea h="calc(100vh - 200px)">
            <Stack gap="xs">
              {displayedNotifications.map((notification) => {
                const isRead = isNotificationRead(notification);
                const category = getNotificationCategory(notification);
                const icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.general;
                const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.general;

                return (
                  <Paper
                    key={notification.id}
                    p="md"
                    withBorder
                    bg={isRead ? 'var(--mantine-color-gray-3)' : 'var(--mantine-color-body)'}
                    style={{
                      borderLeft: `4px solid var(--mantine-color-${color}-6)`,
                      cursor: 'pointer',
                      opacity: isRead ? 0.8 : 1,
                    }}
                    onClick={() => handleNavigate(notification)}
                  >
                    <Group justify="space-between" align="flex-start">
                      <Group gap="sm" align="flex-start">
                        {/* Category Icon */}
                        <Box
                          style={{
                            backgroundColor: `var(--mantine-color-${color}-1)`,
                            borderRadius: '50%',
                            padding: 8,
                          }}
                        >
                          {icon}
                        </Box>

                        {/* Content */}
                        <Stack gap={4} style={{ flex: 1 }}>
                          <Group gap="xs">
                            <Text size="sm" fw={500}>
                              {notification.category?.[0]?.coding?.[0]?.display || 'Notification'}
                            </Text>
                            {!isRead && (
                              <Badge size="xs" color="red" variant="filled">
                                New
                              </Badge>
                            )}
                          </Group>
                          <Text size="sm">{notification.payload?.[0]?.contentString}</Text>
                          <Text size="xs" c="dimmed">
                            {formatDate(notification.sent)}
                          </Text>
                        </Stack>
                      </Group>

                      {/* Actions */}
                      <Group gap="xs">
                        {!isRead && (
                          <Tooltip label="Mark as read">
                            <ActionIcon
                              variant="light"
                              color="green"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (notification.id) {
                                  handleMarkAsRead(notification.id);
                                }
                              }}
                            >
                              <IconCheck size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Tooltip label="View">
                          <ActionIcon variant="light" onClick={() => handleNavigate(notification)}>
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          </ScrollArea>
        )}
      </Stack>
    </Box>
  );
}
