// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Group, Paper, Stack, Text, Image, Button } from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { showNotification } from '@mantine/notifications';
import type { Attachment } from '@medplum/fhirtypes';
import { AttachmentButton, useMedplum } from '@medplum/react';
import { IconUpload, IconPhoto, IconX } from '@tabler/icons-react';
import type { JSX } from 'react';

interface PhotoUploadZoneProps {
  onPhotoUpload: (attachment: Attachment) => void;
  existingPhoto?: Attachment;
}

export function PhotoUploadZone({
  onPhotoUpload,
  existingPhoto,
}: PhotoUploadZoneProps): JSX.Element {
  const medplum = useMedplum();

  const handleFileUpload = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showNotification({
        title: 'File too large',
        message: 'Maximum file size is 10MB',
        color: 'red',
      });
      return;
    }

    try {
      // Upload to Medplum as Binary
      const binary = await medplum.createBinary(file, file.name, file.type);

      const attachment: Attachment = {
        contentType: file.type,
        url: binary.url,
        title: file.name,
        size: file.size,
      };

      onPhotoUpload(attachment);

      showNotification({
        title: 'Photo uploaded',
        message: `Successfully uploaded ${file.name}`,
        color: 'green',
      });
    } catch (err) {
      showNotification({
        title: 'Upload failed',
        message: 'Failed to upload photo. Please try again.',
        color: 'red',
      });
      console.error('Upload error:', err);
    }
  };

  // Handle AttachmentButton upload (receives Attachment)
  const handleAttachmentUpload = (attachment: Attachment): void => {
    if (attachment.url) {
      onPhotoUpload(attachment);
    }
  };

  // If there's an existing photo, show it with option to replace
  if (existingPhoto?.url) {
    return (
      <Paper withBorder p="md">
        <Stack gap="md">
          <Text fw={500}>Patient Photo</Text>
          <Image
            src={existingPhoto.url}
            alt="Patient"
            fit="contain"
            mah={300}
            radius="sm"
            style={{ backgroundColor: '#f8f9fa' }}
          />
      <AttachmentButton
        onUpload={handleAttachmentUpload}
        // accept="image/*"
        // capture="environment"
      >
            {(props) => (
              <Button
                {...props}
                variant="light"
                leftSection={<IconUpload size={16} />}
                fullWidth
              >
                Replace Photo
              </Button>
            )}
          </AttachmentButton>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper withBorder p="xl">
      <Dropzone
        onDrop={(files) => handleFileUpload(files as unknown as FileList)}
        accept={IMAGE_MIME_TYPE}
        maxSize={10 * 1024 * 1024}
      >
        <Group justify="center" gap="xl" mih={220} style={{ pointerEvents: 'none' }}>
          <Dropzone.Accept>
            <IconUpload
              size={52}
              color="var(--mantine-color-blue-6)"
              stroke={1.5}
            />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX
              size={52}
              color="var(--mantine-color-red-6)"
              stroke={1.5}
            />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconPhoto
              size={52}
              color="var(--mantine-color-dimmed)"
              stroke={1.5}
            />
          </Dropzone.Idle>

          <Stack gap="xs" align="center">
            <Text size="xl" fw={500} inline>
              Upload Patient Photo
            </Text>
            <Text size="sm" c="dimmed" inline ta="center">
              Drag image here or click to select file
              <br />
              Supports: JPG, PNG, HEIC (max 10MB)
            </Text>
          </Stack>
        </Group>
      </Dropzone>

      <AttachmentButton
        onUpload={handleAttachmentUpload}
        // accept="image/*"
        // capture="environment"
        // style={{ marginTop: '1rem' }}
      >
        {(props) => (
          <Button
            {...props}
            variant="light"
            leftSection={<IconUpload size={16} />}
            fullWidth
          >
            Or Take Photo with Camera
          </Button>
        )}
      </AttachmentButton>
    </Paper>
  );
}
