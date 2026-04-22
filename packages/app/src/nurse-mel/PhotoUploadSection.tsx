// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { ActionIcon, Group, Paper, Stack, Text, Image, SimpleGrid, rem, Loader } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import type { Attachment } from '@medplum/fhirtypes';
import { AttachmentButton } from '@medplum/react';
import { IconTrash, IconUpload, IconCamera, IconCameraCheck } from '@tabler/icons-react';
import type { JSX } from 'react';

interface PhotoUploadSectionProps {
  /** Photos taken before treatment */
  beforePhotos?: Attachment[];
  /** Photos taken after treatment */
  afterPhotos?: Attachment[];
  /** Callback when a before photo is uploaded */
  onBeforePhotoUpload?: (attachment: Attachment) => Promise<void>;
  /** Callback when an after photo is uploaded */
  onAfterPhotoUpload?: (attachment: Attachment) => Promise<void>;
  /** Callback when a before photo is removed */
  onBeforePhotoRemove?: (index: number) => Promise<void>;
  /** Callback when an after photo is removed */
  onAfterPhotoRemove?: (index: number) => Promise<void>;
  /** Whether the section is read-only */
  readOnly?: boolean;
  /** Whether a save operation is in progress */
  isSaving?: boolean;
}

export function PhotoUploadSection({
  beforePhotos = [],
  afterPhotos = [],
  onBeforePhotoUpload,
  onAfterPhotoUpload,
  onBeforePhotoRemove,
  onAfterPhotoRemove,
  readOnly = false,
  isSaving = false,
}: PhotoUploadSectionProps): JSX.Element {
  const handleBeforeUpload = async (attachment: Attachment): Promise<void> => {
    try {
      await onBeforePhotoUpload?.(attachment);
      showNotification({
        title: 'Photo uploaded',
        message: 'Before photo uploaded successfully',
        color: 'green',
      });
    } catch (err) {
      showNotification({
        title: 'Upload failed',
        message: err instanceof Error ? err.message : 'Failed to upload photo',
        color: 'red',
      });
    }
  };

  const handleAfterUpload = async (attachment: Attachment): Promise<void> => {
    try {
      await onAfterPhotoUpload?.(attachment);
      showNotification({
        title: 'Photo uploaded',
        message: 'After photo uploaded successfully',
        color: 'green',
      });
    } catch (err) {
      showNotification({
        title: 'Upload failed',
        message: err instanceof Error ? err.message : 'Failed to upload photo',
        color: 'red',
      });
    }
  };

  const handleBeforeRemove = async (index: number): Promise<void> => {
    try {
      await onBeforePhotoRemove?.(index);
      showNotification({
        title: 'Photo removed',
        message: 'Before photo removed successfully',
        color: 'green',
      });
    } catch (err) {
      showNotification({
        title: 'Remove failed',
        message: err instanceof Error ? err.message : 'Failed to remove photo',
        color: 'red',
      });
    }
  };

  const handleAfterRemove = async (index: number): Promise<void> => {
    try {
      await onAfterPhotoRemove?.(index);
      showNotification({
        title: 'Photo removed',
        message: 'After photo removed successfully',
        color: 'green',
      });
    } catch (err) {
      showNotification({
        title: 'Remove failed',
        message: err instanceof Error ? err.message : 'Failed to remove photo',
        color: 'red',
      });
    }
  };

  return (
    <Stack gap="md">
      {/* Before Photos */}
      <Paper p="md" radius="sm" withBorder>
        <Group justify="space-between" align="center" mb="md">
          <Group gap="xs">
            <IconCamera size={20} />
            <Text fw={500}>Before Photos</Text>
          </Group>
          <Group gap="xs">
            {isSaving && <Loader size="xs" />}
            <Text size="sm" c="dimmed">
              {beforePhotos.length} photo{beforePhotos.length !== 1 ? 's' : ''}
            </Text>
          </Group>
        </Group>

        {beforePhotos.length > 0 && (
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} mb="md">
            {beforePhotos.map((photo, index) => (
              <Paper
                key={`before-${index}`}
                shadow="xs"
                radius="sm"
                p="xs"
                style={{ position: 'relative' }}
              >
                <Image
                  src={photo.url}
                  alt={photo.title || 'Before photo'}
                  height={rem(120)}
                  fit="cover"
                  radius="xs"
                  fallbackSrc="https://placehold.co/200x120?text=No+Preview"
                />
                {!readOnly && (
                  <ActionIcon
                    color="red"
                    variant="light"
                    size="sm"
                    style={{
                      position: 'absolute',
                      top: rem(8),
                      right: rem(8),
                    }}
                    onClick={() => handleBeforeRemove(index)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Paper>
            ))}
          </SimpleGrid>
        )}

        {!readOnly && (
          <AttachmentButton
            onUpload={(attachment) => void handleBeforeUpload(attachment)}
          >
            {(props) => (
              <Paper
                component="button"
                {...props}
                withBorder
                p="md"
                radius="sm"
                style={{
                  borderStyle: 'dashed',
                  cursor: 'pointer',
                  width: '100%',
                  background: 'transparent',
                }}
              >
                <Stack align="center" gap="xs">
                  <IconUpload size={24} color="gray" />
                  <Text size="sm" c="dimmed">
                    Upload before photos
                  </Text>
                </Stack>
              </Paper>
            )}
          </AttachmentButton>
        )}
      </Paper>

      {/* After Photos */}
      <Paper p="md" radius="sm" withBorder>
        <Group justify="space-between" align="center" mb="md">
          <Group gap="xs">
            <IconCameraCheck size={20} />
            <Text fw={500}>After Photos</Text>
          </Group>
          <Group gap="xs">
            {isSaving && <Loader size="xs" />}
            <Text size="sm" c="dimmed">
              {afterPhotos.length} photo{afterPhotos.length !== 1 ? 's' : ''}
            </Text>
          </Group>
        </Group>

        {afterPhotos.length > 0 && (
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} mb="md">
            {afterPhotos.map((photo, index) => (
              <Paper
                key={`after-${index}`}
                shadow="xs"
                radius="sm"
                p="xs"
                style={{ position: 'relative' }}
              >
                <Image
                  src={photo.url}
                  alt={photo.title || 'After photo'}
                  height={rem(120)}
                  fit="cover"
                  radius="xs"
                  fallbackSrc="https://placehold.co/200x120?text=No+Preview"
                />
                {!readOnly && (
                  <ActionIcon
                    color="red"
                    variant="light"
                    size="sm"
                    style={{
                      position: 'absolute',
                      top: rem(8),
                      right: rem(8),
                    }}
                    onClick={() => handleAfterRemove(index)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                )}
              </Paper>
            ))}
          </SimpleGrid>
        )}

        {!readOnly && (
          <AttachmentButton
            onUpload={(attachment) => void handleAfterUpload(attachment)}
          >
            {(props) => (
              <Paper
                component="button"
                {...props}
                withBorder
                p="md"
                radius="sm"
                style={{
                  borderStyle: 'dashed',
                  cursor: 'pointer',
                  width: '100%',
                  background: 'transparent',
                }}
              >
                <Stack align="center" gap="xs">
                  <IconUpload size={24} color="gray" />
                  <Text size="sm" c="dimmed">
                    Upload after photos
                  </Text>
                </Stack>
              </Paper>
            )}
          </AttachmentButton>
        )}
      </Paper>
    </Stack>
  );
}
