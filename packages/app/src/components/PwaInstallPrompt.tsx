// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Button, Group, Paper, Stack, Text, Title, Box, rem } from '@mantine/core';
import { IconShare, IconHome, IconX, IconBell } from '@tabler/icons-react';
import type { JSX } from 'react';
import { dismissInstallPrompt, isStandalone } from '../notifications/push';

interface PwaInstallPromptProps {
  onDismiss: () => void;
  onInstall?: () => void;
}

export function PwaInstallPrompt({ onDismiss, onInstall }: PwaInstallPromptProps): JSX.Element {
  const handleDismiss = () => {
    dismissInstallPrompt();
    onDismiss();
  };

  const handleInstall = () => {
    if (onInstall) {
      onInstall();
    }
    onDismiss();
  };

  return (
    <Paper
      p="xl"
      withBorder
      shadow="lg"
      style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        right: 20,
        zIndex: 1000,
        maxWidth: 500,
        margin: '0 auto',
      }}
    >
      <Stack gap="md">
        <Group justify="space-between">
          <Group>
            <Box
              style={{
                backgroundColor: 'var(--mantine-color-blue-1)',
                borderRadius: '50%',
                padding: rem(12),
              }}
            >
              <IconBell size={24} color="var(--mantine-color-blue-6)" />
            </Box>
            <div>
              <Title order={5}>Enable Push Notifications</Title>
              <Text size="sm" c="dimmed">
                Get alerts for appointments & treatments
              </Text>
            </div>
          </Group>
          <Button variant="subtle" size="sm" onClick={handleDismiss}>
            <IconX size={16} />
          </Button>
        </Group>

        <Text size="sm">
          To receive push notifications on your iPhone, please add this app to your Home Screen first:
        </Text>

        <Stack gap="xs">
          <Group gap="sm">
            <Box
              style={{
                backgroundColor: 'var(--mantine-color-gray-1)',
                borderRadius: '50%',
                padding: rem(8),
                minWidth: rem(36),
                textAlign: 'center',
              }}
            >
              <Text fw={700} size="sm">1</Text>
            </Box>
            <Text size="sm">
              Tap the <IconShare size={16} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
              <strong>Share</strong> button in Safari
            </Text>
          </Group>

          <Group gap="sm">
            <Box
              style={{
                backgroundColor: 'var(--mantine-color-gray-1)',
                borderRadius: '50%',
                padding: rem(8),
                minWidth: rem(36),
                textAlign: 'center',
              }}
            >
              <Text fw={700} size="sm">2</Text>
            </Box>
            <Text size="sm">
              Scroll down and tap{' '}
              <strong>&quot;Add to Home Screen&quot;</strong>
            </Text>
          </Group>

          <Group gap="sm">
            <Box
              style={{
                backgroundColor: 'var(--mantine-color-gray-1)',
                borderRadius: '50%',
                padding: rem(8),
                minWidth: rem(36),
                textAlign: 'center',
              }}
            >
              <Text fw={700} size="sm">3</Text>
            </Box>
            <Text size="sm">
              Open the app from your <IconHome size={16} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
              Home Screen, then enable notifications
            </Text>
          </Group>
        </Stack>

        <Group justify="flex-end" mt="sm">
          <Button variant="light" onClick={handleDismiss}>
            Don&apos;t show again
          </Button>
          <Button onClick={handleInstall}>Got it</Button>
        </Group>
      </Stack>
    </Paper>
  );
}
