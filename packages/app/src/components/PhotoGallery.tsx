// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * PhotoGallery Component
 * 
 * Displays and manages before/after photos with body part and view tagging.
 * Used in treatment forms for visual documentation.
 */

import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Group,
  Image,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconPhoto, IconTrash, IconZoomIn } from '@tabler/icons-react';
import type { Media } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import { useCallback, useMemo, useState } from 'react';

// Body part options
export const BODY_PARTS = [
  { value: 'face', label: 'Face' },
  { value: 'forehead', label: 'Forehead' },
  { value: 'glabella', label: 'Glabella (11s)' },
  { value: 'crows-feet', label: 'Crows Feet' },
  { value: 'brows', label: 'Eyebrows' },
  { value: 'eyes', label: 'Eyes' },
  { value: 'nose', label: 'Nose' },
  { value: 'lips', label: 'Lips' },
  { value: 'cheeks', label: 'Cheeks' },
  { value: 'jawline', label: 'Jawline' },
  { value: 'chin', label: 'Chin' },
  { value: 'neck', label: 'Neck' },
  { value: 'chest', label: 'Chest/Décolletage' },
  { value: 'hands', label: 'Hands' },
  { value: 'arms', label: 'Arms' },
  { value: 'legs', label: 'Legs' },
  { value: 'abdomen', label: 'Abdomen' },
  { value: 'back', label: 'Back' },
  { value: 'full-body', label: 'Full Body' },
] as const;

// View angle options
export const VIEW_ANGLES = [
  { value: 'front', label: 'Front' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'profile-left', label: 'Profile Left' },
  { value: 'profile-right', label: 'Profile Right' },
  { value: '45-left', label: '45° Left' },
  { value: '45-right', label: '45° Right' },
  { value: 'oblique-left', label: 'Oblique Left' },
  { value: 'oblique-right', label: 'Oblique Right' },
  { value: 'close-up', label: 'Close-up' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
  { value: 'back', label: 'Back' },
] as const;

// Time phase options
export const TIME_PHASES = [
  { value: 'before', label: 'Before', color: 'gray' },
  { value: 'immediately-after', label: 'Immediately After', color: 'green' },
  { value: '1-day', label: '1 Day After', color: 'teal' },
  { value: '3-days', label: '3 Days After', color: 'cyan' },
  { value: '1-week', label: '1 Week After', color: 'blue' },
  { value: '2-weeks', label: '2 Weeks After', color: 'indigo' },
  { value: '1-month', label: '1 Month After', color: 'violet' },
  { value: '3-months', label: '3 Months After', color: 'grape' },
  { value: '6-months', label: '6 Months After', color: 'pink' },
] as const;

export interface PhotoMetadata {
  id: string;
  bodyPart: typeof BODY_PARTS[number]['value'];
  viewAngle: typeof VIEW_ANGLES[number]['value'];
  timePhase: typeof TIME_PHASES[number]['value'];
  uploadedAt: Date;
  uploadedBy: string;
  notes?: string;
}

export interface GalleryPhoto {
  id: string;
  media: Media;
  metadata: PhotoMetadata;
  url: string;
}

interface PhotoGalleryProps {
  photos: GalleryPhoto[];
  onUpload?: () => void;
  onDelete?: (photoId: string) => void;
  onUpdateMetadata?: (photoId: string, metadata: Partial<PhotoMetadata>) => void;
  readonly?: boolean;
  title?: string;
}

export function PhotoGallery({
  photos,
  onUpload,
  onDelete,
  onUpdateMetadata,
  readonly = false,
  title = 'Photos',
}: PhotoGalleryProps): JSX.Element {
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhoto | null>(null);
  const [viewModalOpen, { open: openViewModal, close: closeViewModal }] = useDisclosure(false);

  // Group photos by body part and time phase
  const groupedPhotos = useMemo(() => {
    const groups: Record<string, GalleryPhoto[]> = {};
    
    for (const photo of photos) {
      const key = `${photo.metadata.bodyPart}-${photo.metadata.timePhase}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(photo);
    }
    
    return groups;
  }, [photos]);

  const handleViewPhoto = useCallback((photo: GalleryPhoto) => {
    setSelectedPhoto(photo);
    openViewModal();
  }, [openViewModal]);

  const getBodyPartLabel = (value: string): string => {
    return BODY_PARTS.find(bp => bp.value === value)?.label || value;
  };

  const getViewAngleLabel = (value: string): string => {
    return VIEW_ANGLES.find(va => va.value === value)?.label || value;
  };

  const getTimePhaseLabel = (value: string): { label: string; color: string } => {
    const phase = TIME_PHASES.find(tp => tp.value === value);
    return { 
      label: phase?.label || value, 
      color: phase?.color || 'gray' 
    };
  };

  return (
    <Box>
      <Group justify="space-between" mb="md">
        <Title order={5}>{title}</Title>
        {!readonly && onUpload && (
          <Button
            variant="light"
            size="xs"
            leftSection={<IconPhoto size={16} />}
            onClick={onUpload}
          >
            Add Photos
          </Button>
        )}
      </Group>

      {photos.length === 0 ? (
        <Card withBorder p="xl" style={{ textAlign: 'center', color: '#868e96' }}>
          <IconPhoto size={48} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <Text size="sm" c="dimmed">No photos uploaded</Text>
          {!readonly && onUpload && (
            <Button
              variant="light"
              size="sm"
              mt="md"
              onClick={onUpload}
            >
              Upload Photos
            </Button>
          )}
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
          {photos.map((photo) => {
            const timePhase = getTimePhaseLabel(photo.metadata.timePhase);
            
            return (
              <Card key={photo.id} withBorder p="xs">
                <Box
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    overflow: 'hidden',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleViewPhoto(photo)}
                >
                  <Image
                    src={photo.url}
                    alt={`${getBodyPartLabel(photo.metadata.bodyPart)} - ${getViewAngleLabel(photo.metadata.viewAngle)}`}
                    fit="cover"
                    style={{ width: '100%', height: '100%' }}
                  />
                  <Box
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                    }}
                  >
                    <Badge size="sm" color={timePhase.color} variant="filled">
                      {timePhase.label}
                    </Badge>
                  </Box>
                  <Box
                    style={{
                      position: 'absolute',
                      bottom: '4px',
                      left: '4px',
                      right: '4px',
                      background: 'rgba(0,0,0,0.6)',
                      borderRadius: '4px',
                      padding: '4px 8px',
                    }}
                  >
                    <Text size="xs" c="white" truncate>
                      {getBodyPartLabel(photo.metadata.bodyPart)}
                    </Text>
                    <Text size="xs" c="gray.3" truncate>
                      {getViewAngleLabel(photo.metadata.viewAngle)}
                    </Text>
                  </Box>
                </Box>

                {!readonly && (
                  <Group justify="flex-end" mt="xs" gap="xs">
                    <ActionIcon
                      variant="light"
                      size="sm"
                      onClick={() => handleViewPhoto(photo)}
                    >
                      <IconZoomIn size={14} />
                    </ActionIcon>
                    {onDelete && (
                      <ActionIcon
                        variant="light"
                        color="red"
                        size="sm"
                        onClick={() => onDelete(photo.id)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    )}
                  </Group>
                )}
              </Card>
            );
          })}
        </SimpleGrid>
      )}

      {/* Photo View/Edit Modal */}
      <Modal
        opened={viewModalOpen}
        onClose={closeViewModal}
        title="Photo Details"
        size="lg"
      >
        {selectedPhoto && (
          <Stack>
            <Image
              src={selectedPhoto.url}
              alt="Treatment photo"
              fit="contain"
              style={{ maxHeight: '400px' }}
            />
            
            <Group>
              <Badge color={getTimePhaseLabel(selectedPhoto.metadata.timePhase).color}>
                {getTimePhaseLabel(selectedPhoto.metadata.timePhase).label}
              </Badge>
              <Badge variant="light">
                {getBodyPartLabel(selectedPhoto.metadata.bodyPart)}
              </Badge>
              <Badge variant="light">
                {getViewAngleLabel(selectedPhoto.metadata.viewAngle)}
              </Badge>
            </Group>

            {!readonly && onUpdateMetadata && (
              <>
                <Select
                  label="Body Part"
                  data={BODY_PARTS.map(bp => ({ value: bp.value, label: bp.label }))}
                  value={selectedPhoto.metadata.bodyPart}
                  onChange={(value) => 
                    value && onUpdateMetadata(selectedPhoto.id, { bodyPart: value as PhotoMetadata['bodyPart'] })
                  }
                />
                <Select
                  label="View Angle"
                  data={VIEW_ANGLES.map(va => ({ value: va.value, label: va.label }))}
                  value={selectedPhoto.metadata.viewAngle}
                  onChange={(value) => 
                    value && onUpdateMetadata(selectedPhoto.id, { viewAngle: value as PhotoMetadata['viewAngle'] })
                  }
                />
                <Select
                  label="Time Phase"
                  data={TIME_PHASES.map(tp => ({ value: tp.value, label: tp.label }))}
                  value={selectedPhoto.metadata.timePhase}
                  onChange={(value) => 
                    value && onUpdateMetadata(selectedPhoto.id, { timePhase: value as PhotoMetadata['timePhase'] })
                  }
                />
              </>
            )}

            <Text size="sm" c="dimmed">
              Uploaded: {selectedPhoto.metadata.uploadedAt.toLocaleString()} by {selectedPhoto.metadata.uploadedBy}
            </Text>
          </Stack>
        )}
      </Modal>
    </Box>
  );
}

export default PhotoGallery;
