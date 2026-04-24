// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Button, Group, Paper, Stack, Text, Title, Box } from '@mantine/core';
import { IconBell, IconX, IconCheck } from '@tabler/icons-react';
import type { JSX } from 'react';
import type { MedplumClient } from '@medplum/core';
import type { Practitioner } from '@medplum/fhirtypes';
import { useMedplum } from '@medplum/react';
import { useState } from 'react';
import { subscribeToPush, dismissPushPrompt, isStandalone, getVapidPublicKey } from '../notifications/push';

interface PushNotificationPromptProps {
  onDismiss: () => void;
  onSuccess?: () => void;
}

export function PushNotificationPrompt({ onDismiss, onSuccess }: PushNotificationPromptProps): JSX.Element {
  const medplum = useMedplum();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDismiss = () => {
    dismissPushPrompt();
    onDismiss();
  };

  const handleEnable = async () => {
    setLoading(true);
    setError(null);

    try {
      // Get VAPID public key from server config
      const vapidKey = await getVapidPublicKey(medplum);
      if (!vapidKey) {
        setError('Push notifications are not configured. Please contact support.');
        setLoading(false);
        return;
      }

      // Get current user profile for sender attribution
      const profile = medplum.getProfile() as Practitioner | undefined;

      const success = await subscribeToPush(medplum, vapidKey, profile);
      if (success) {
        if (onSuccess) {
          onSuccess();
        }
        onDismiss();
      } else {
        setError('Permission denied or subscription failed');
      }
    } catch (err) {
      setError('An error occurred while enabling notifications');
    } finally {
      setLoading(false);
    }
  };

  // Show different message for iOS Home Screen vs Desktop
  const isIOSSafariHomeScreen = typeof window !== 'undefined' && 
    /iPad|iPhone|iPod/.test(navigator.userAgent) && 
    isStandalone();

  return (
    <Paper
      p="xl"
      withBorder
      shadow="lg"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1000,
        maxWidth: 450,
        width: '90%',
      }}
    >
      <Stack gap="md">
        <Group justify="space-between">
          <Group>
            <Box
              style={{
                backgroundColor: 'var(--mantine-color-green-1)',
                borderRadius: '50%',
                padding: 12,
              }}
            >
              <IconBell size={28} color="var(--mantine-color-green-6)" />
            </Box>
            <div>
              <Title order={5}>Enable Push Notifications</Title>
              <Text size="sm" c="dimmed">
                Stay updated with appointments & treatments
              </Text>
            </div>
          </Group>
          <Button variant="subtle" size="sm" onClick={handleDismiss}>
            <IconX size={16} />
          </Button>
        </Group>

        <Text size="sm">
          {isIOSSafariHomeScreen 
            ? "Get notified when appointments are booked, treatments start, or when photos are uploaded - even when the app is closed."
            : "Get notified when appointments are booked, treatments start, or when photos are uploaded - even when your browser is closed."
          }
        </Text>

        <Stack gap="xs" pl="sm">
          <Group gap="sm">
            <IconCheck size={16} color="var(--mantine-color-green-6)" />
            <Text size="sm">New appointment alerts</Text>
          </Group>
          <Group gap="sm">
            <IconCheck size={16} color="var(--mantine-color-green-6)" />
            <Text size="sm">Treatment status updates</Text>
          </Group>
          <Group gap="sm">
            <IconCheck size={16} color="var(--mantine-color-green-6)" />
            <Text size="sm">Photo upload notifications</Text>
          </Group>
        </Stack>

        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}

        <Group justify="flex-end" mt="sm">
          <Button variant="light" onClick={handleDismiss}>
            Not now
          </Button>
          <Button onClick={handleEnable} loading={loading}>
            Enable Notifications
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

// Hook to manage push prompt visibility
export function usePushPrompt(): {
  showPushPrompt: boolean;
  setShowPushPrompt: (show: boolean) => void;
} {
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  return { showPushPrompt, setShowPushPrompt };
}
