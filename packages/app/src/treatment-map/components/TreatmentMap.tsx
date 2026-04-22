// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Badge, Box, Button, Divider, Grid, Group, Paper, Select, Stack, Text, Title } from '@mantine/core';
import { IconDeviceFloppy, IconMap, IconX } from '@tabler/icons-react';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useInjectionMap } from '../hooks/useInjectionMap';
import { usePatientAssets } from '../hooks/usePatientAssets';
import type { InjectionMarker, TreatmentMapProps } from '../types/injection';
import { PRODUCT_NAMES } from '../types/injection';
import { BackgroundSelector, type BackgroundConfig } from './BackgroundSelector';
import { ImageCanvas } from './ImageCanvas';
import { ZoneEntryPopup } from './ZoneEntryPopup';
import { ZoneList } from './ZoneList';

// Body region options
const BODY_REGION_OPTIONS = [{ value: 'face', label: 'Face' }];

export function TreatmentMap({
  patientId,
  mode = 'create',
  existingProcedure,
  initialMap,
  onSave,
  onCancel,
  readOnly = false,
  isSaving: externalIsSaving,
}: TreatmentMapProps): JSX.Element {
  // Use initialMap if provided, otherwise fall back to existingProcedure
  const mapToUse = initialMap || existingProcedure?.injectionMap;

  // Fetch patient assets (gender and photos)
  const { gender, photos, loading: assetsLoading } = usePatientAssets(patientId, existingProcedure?.id);

  // Background state
  const [background, setBackground] = useState<BackgroundConfig>(() => {
    // Try to restore from existing map
    if (mapToUse) {
      if (mapToUse.backgroundType === 'photo' && mapToUse.photoMediaId) {
        return {
          type: 'photo',
          templateView: mapToUse.templateView || 'front',
          photoId: mapToUse.photoMediaId,
        };
      }
      return {
        type: 'template',
        templateGender: mapToUse.templateGender || gender || 'unknown',
        templateView: mapToUse.templateView || 'front',
      };
    }
    // Default: use patient's gender if available
    return {
      type: 'template',
      templateGender: gender || 'unknown',
      templateView: 'front',
    };
  });

  // Update background when patient gender loads
  useEffect(() => {
    if (gender && background.type === 'template' && !background.templateGender) {
      setBackground((prev) => ({
        ...prev,
        templateGender: gender,
      }));
    }
  }, [gender, background.type, background.templateGender]);

  // Get selected photo URL
  const selectedPhotoUrl =
    background.type === 'photo' && background.photoId
      ? photos.find((p) => p.id === background.photoId)?.url
      : undefined;

  const {
    // State
    markers,
    selectedMarker,
    isSaving: internalIsSaving,
    zones,
    unitsByProduct,
    totalUnits,
    totalMarkers,
    canSave,
    addMarker,
    updateMarker,
    deleteMarker,
    selectMarker,
    saveTreatment,
  } = useInjectionMap(patientId, mode, mapToUse);

  // Use external isSaving if provided, otherwise use internal
  const isSaving = externalIsSaving ?? internalIsSaving;

  // Handle background change
  const handleBackgroundChange = useCallback((newBackground: BackgroundConfig) => {
    setBackground(newBackground);
  }, []);

  // Handle save marker and immediately persist to parent
  const handleSaveMarker = useCallback(
    async (updatedMarker: InjectionMarker): Promise<void> => {
      // First update local state
      updateMarker(updatedMarker);

      // Build complete injection map and save immediately
      const injectionMap = await saveTreatment(background);
      if (injectionMap && onSave) {
        await onSave(injectionMap);
      }
    },
    [updateMarker, saveTreatment, background, onSave]
  );

  // Legacy handleSave (for any direct save buttons, though we removed them)
  const handleSave = useCallback(async () => {
    const injectionMap = await saveTreatment(background);
    if (injectionMap && onSave) {
      await onSave(injectionMap);
    }
  }, [saveTreatment, background, onSave]);

  return (
    <Stack gap="md">
      {/* Header with controls */}
      <Paper withBorder p="md">
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={4}>
                <IconMap size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                Treatment Mapping
              </Title>
              <Text size="sm" c="dimmed">
                Click on the image to mark injection points
              </Text>
            </div>

            {/* Summary stats */}
            {totalMarkers > 0 && (
              <Group gap="xs">
                <Badge size="lg" color="blue">
                  {totalMarkers} markers
                </Badge>
                <Badge size="lg" color="green">
                  {totalUnits} units
                </Badge>
              </Group>
            )}
          </Group>

          <Divider />

          {/* Controls */}
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Select
                label="Body Region"
                data={BODY_REGION_OPTIONS}
                value="face"
                disabled={true}
                description="Face treatments only"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <BackgroundSelector
                config={background}
                onChange={handleBackgroundChange}
                patientGender={gender}
                photos={photos}
                disabled={readOnly || assetsLoading}
              />
            </Grid.Col>
          </Grid>
        </Stack>
      </Paper>

      {/* Main content: Image Canvas + Zone List */}
      <Grid gutter="md">
        {/* Canvas - Takes up most space */}
        <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
          <Stack gap="xs">
            {/* Canvas title with product legend */}
            <Group justify="space-between">
              <Text size="sm" fw={500}>
                <IconMap size={16} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                Injection Map
              </Text>

              {/* Product color legend */}
              <Group gap="xs">
                {Object.entries(unitsByProduct).map(([product, units]) => (
                  <Badge
                    key={product}
                    size="sm"
                    variant="dot"
                    styles={{
                      root: {
                        borderLeft: `3px solid var(--mantine-color-${getProductColor(product)}-6)`,
                      },
                    }}
                  >
                    {PRODUCT_NAMES[product as keyof typeof PRODUCT_NAMES]}: {units}u
                  </Badge>
                ))}
              </Group>
            </Group>

            {/* Image Canvas with markers */}
            <ImageCanvas
              background={background}
              photoUrl={selectedPhotoUrl}
              markers={markers}
              selectedMarker={selectedMarker}
              onCanvasClick={readOnly ? () => {} : addMarker}
              onMarkerClick={selectMarker}
              readOnly={readOnly}
              markerColorMode="product"
            />

            {/* Instructions */}
            {!readOnly && (
              <Text size="xs" c="dimmed">
                {markers.length === 0
                  ? 'Click anywhere on the image to add your first injection point'
                  : 'Click on the image to add more injection points, or click an existing marker to edit'}
              </Text>
            )}
          </Stack>
        </Grid.Col>

        {/* Zone List - Sidebar */}
        <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
          <Box h="100%">
            <ZoneList
              markers={markers}
              selectedMarker={selectedMarker}
              onMarkerSelect={selectMarker}
              onMarkerDelete={deleteMarker}
              readOnly={readOnly}
            />
          </Box>
        </Grid.Col>
      </Grid>

      {/* Zone Entry Popup (for editing markers) */}
      <ZoneEntryPopup
        isOpen={!!selectedMarker && !readOnly}
        marker={selectedMarker}
        onSave={handleSaveMarker}
        onDelete={deleteMarker}
        onClose={() => {
          // Delete unsaved markers (new markers with no units)
          if (selectedMarker && selectedMarker.units === 0) {
            deleteMarker(selectedMarker.id);
          } else {
            selectMarker(null);
          }
        }}
      />

      {/* Read-only notice for coordinators */}
      {readOnly && (
        <Paper withBorder p="md" bg="gray.0">
          <Text size="sm" c="dimmed" ta="center">
            Read-only view. Contact a provider to modify treatment records.
          </Text>
        </Paper>
      )}
    </Stack>
  );
}

// Helper to get product color for badge
function getProductColor(product: string): string {
  const colorMap: Record<string, string> = {
    botox_cosmetic: 'blue',
    dysport: 'green',
    xeomin: 'violet',
    jeuveau: 'orange',
    custom: 'gray',
  };
  return colorMap[product] || 'gray';
}
