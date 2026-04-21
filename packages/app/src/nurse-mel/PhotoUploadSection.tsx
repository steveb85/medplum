// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { ActionIcon, Group, Paper, Stack, Text, Image, SimpleGrid, rem } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import type { Attachment } from '@medplum/fhirtypes';
import { AttachmentButton } from '@medplum/react';
import { IconTrash, IconUpload } from '@tabler/icons-react';
import type { JSX, ReactNode } from 'react';

interface PhotoUploadSectionProps {
  title: string;
  photos: Attachment[];
  onPhotosChange: (photos: Attachment[]) => void;
  icon?: ReactNode;
}

export function PhotoUploadSection({
  title,
  photos,
  onPhotosChange,
  icon,
}: PhotoUploadSectionProps): JSX.Element {
  const handleUpload = (attachment: Attachment): void => {
    const newPhotos = [...photos, attachment];
    onPhotosChange(newPhotos);

    showNotification({
      title: 'Photo uploaded',
      message: `Successfully uploaded ${attachment.title || 'photo'}`,
      color: 'green',
    });
  };

  const handleRemove = (index: number): void => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    onPhotosChange(newPhotos);
  };

  return (
    <Paper p="md" radius="sm" withBorder>
      <Group justify="space-between" align="center" mb="md">
        <Group gap="xs">
          {icon}
          <Text fw={500}>{title}</Text>
        </Group>
        <Text size="sm" color="dimmed">
          {photos.length} photo{photos.length !== 1 ? 's' : ''}
        </Text>
      </Group>

      {photos.length > 0 && (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} mb="md">
          {photos.map((photo, _index) => (
            <Paper
              key={_index}
              shadow="xs"
              radius="sm"
              p="xs"
              style={{ position: 'relative' }}
            >
              <Image
                src={photo.url}
                alt={photo.title || 'Treatment photo'}
                height={rem(120)}
                fit="cover"
                radius="xs"
                fallbackSrc="https://placehold.co/200x120?text=No+Preview"
              />
              <ActionIcon
                color="red"
                variant="light"
                size="sm"
                style={{
                  position: 'absolute',
                  top: rem(8),
                  right: rem(8),
                }}
                onClick={() => handleRemove(_index)}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Paper>
          ))}
        </SimpleGrid>
      )}

      <AttachmentButton
        onUpload={handleUpload}
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
              <Text size="sm" color="dimmed">
                Click to upload photos
              </Text>
              <Text size="xs" color="dimmed">
                Supports: JPG, PNG, HEIC
              </Text>
            </Stack>
          </Paper>
        )}
      </AttachmentButton>
    </Paper>
  );
}
