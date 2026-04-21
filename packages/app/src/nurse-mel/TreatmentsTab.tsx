// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import {
  Table,
  Badge,
  Button,
  Group,
  Text,
  Stack,
  Paper,
  Title,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { useMedplum } from '@medplum/react';
import type { Procedure, Media } from '@medplum/fhirtypes';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { IconEye, IconPlus, IconPhoto } from '@tabler/icons-react';
import { getReferenceString } from '@medplum/core';
import type { JSX } from 'react';
import { getMedSpaRole } from '../auth/role';
import { useNavigate } from 'react-router';

interface TreatmentsTabProps {
  patientId: string;
}

interface TreatmentRow {
  procedure: Procedure;
  beforePhotoCount: number;
  afterPhotoCount: number;
}

// Status configuration for badges
const statusConfig: Record<string, { color: string; label: string }> = {
  preparation: { color: 'orange', label: 'Scheduled' },
  'in-progress': { color: 'blue', label: 'In Progress' },
  completed: { color: 'green', label: 'Completed' },
  cancelled: { color: 'red', label: 'Cancelled' },
};

export function TreatmentsTab({ patientId }: TreatmentsTabProps): JSX.Element {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const role = getMedSpaRole(medplum);
  const [treatments, setTreatments] = useState<TreatmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Load treatments for patient
  const loadTreatments = useCallback(async () => {
    try {
      setLoading(true);
      
      // Search for Botox procedures for this patient
      const proceduresBundle = await medplum.search('Procedure', {
        subject: `Patient/${patientId}`,
        code: 'http://melissaknudson.com/treatments|botox-cosmetic',
        _sort: '-date',
        _count: '50',
      });

      const procedures = (proceduresBundle.entry || []).map(e => e.resource as Procedure);
      
      // For each procedure, count before/after photos
      const treatmentRows: TreatmentRow[] = [];
      
      for (const procedure of procedures) {
        // Search for Media linked to this procedure
        const mediaBundle = await medplum.search('Media', {
          subject: `Patient/${patientId}`,
          _count: '100',
        });

        const media = (mediaBundle.entry || []).map(e => e.resource as Media);
        
        // Filter media by related procedure
        const beforePhotos = media.filter(m => 
          m.type?.coding?.[0]?.code === 'before' &&
          m.extension?.some(e => 
            e.url === 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure' &&
            e.valueReference?.reference === getReferenceString(procedure)
          )
        );
        
        const afterPhotos = media.filter(m => 
          m.type?.coding?.[0]?.code === 'after' &&
          m.extension?.some(e => 
            e.url === 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure' &&
            e.valueReference?.reference === getReferenceString(procedure)
          )
        );

        treatmentRows.push({
          procedure,
          beforePhotoCount: beforePhotos.length,
          afterPhotoCount: afterPhotos.length,
        });
      }

      // Sort by status: preparation first, then in-progress, then completed, then cancelled
      const statusOrder = { preparation: 0, 'in-progress': 1, completed: 2, cancelled: 3 };
      treatmentRows.sort((a, b) => {
        const statusDiff = (statusOrder[a.procedure.status as keyof typeof statusOrder] ?? 4) - 
                          (statusOrder[b.procedure.status as keyof typeof statusOrder] ?? 4);
        if (statusDiff !== 0) return statusDiff;
        // Within same status, sort by date descending
        const dateA = new Date(a.procedure.performedDateTime || 0).getTime();
        const dateB = new Date(b.procedure.performedDateTime || 0).getTime();
        return dateB - dateA;
      });

      setTreatments(treatmentRows);
    } catch (err) {
      console.error('Error loading treatments:', err);
    } finally {
      setLoading(false);
    }
  }, [medplum, patientId]);

  useEffect(() => {
    loadTreatments();
  }, [loadTreatments]);

  // Get treatment areas from extension
  const getTreatmentAreas = useCallback((procedure: Procedure): string => {
    const areas = procedure.extension?.find(
      (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/treatment-areas'
    )?.valueString;
    return areas || 'Not specified';
  }, []);

  // Get total units from extension
  const getTotalUnits = useCallback((procedure: Procedure): number => {
    const units = procedure.extension?.find(
      (e) => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/units-used'
    )?.valueInteger;
    return units || 0;
  }, []);

  // Handle opening a treatment
  const handleOpenTreatment = useCallback((procedureId: string) => {
    navigate(`/Patient/${patientId}/botox-treatment?procedureId=${procedureId}`);
  }, [navigate, patientId]);

  // Handle creating new treatment
  const handleNewTreatment = useCallback(() => {
    navigate(`/Patient/${patientId}/botox-treatment`);
  }, [navigate, patientId]);

  // Format date
  const formatDate = useCallback((dateString: string | undefined): string => {
    if (!dateString) return 'Not scheduled';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  if (loading) {
    return (
      <Paper p="xl">
        <Text ta="center">Loading treatments...</Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={4}>Treatments</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={handleNewTreatment}
        >
          New Treatment
        </Button>
      </Group>

      {treatments.length === 0 ? (
        <Paper p="xl" withBorder>
          <Text ta="center" c="dimmed">
            No treatments yet. Click &quot;New Treatment&quot; to create the first one.
          </Text>
        </Paper>
      ) : (
        <Paper withBorder>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Status</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Areas</Table.Th>
                <Table.Th>Units</Table.Th>
                <Table.Th>Photos</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {treatments.map(({ procedure, beforePhotoCount, afterPhotoCount }) => {
                const status = procedure.status || 'unknown';
                const statusInfo = statusConfig[status] || { color: 'gray', label: status };
                
                return (
                  <Table.Tr key={procedure.id}>
                    <Table.Td>
                      <Badge color={statusInfo.color} variant="light">
                        {statusInfo.label}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{formatDate(procedure.performedDateTime)}</Table.Td>
                    <Table.Td>{getTreatmentAreas(procedure)}</Table.Td>
                    <Table.Td>
                      {getTotalUnits(procedure) > 0 ? `${getTotalUnits(procedure)} units` : '-'}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {beforePhotoCount > 0 && (
                          <Badge size="sm" color="gray" variant="light" leftSection={<IconPhoto size={12} />}>
                            {beforePhotoCount} before
                          </Badge>
                        )}
                        {afterPhotoCount > 0 && (
                          <Badge size="sm" color="green" variant="light" leftSection={<IconPhoto size={12} />}>
                            {afterPhotoCount} after
                          </Badge>
                        )}
                        {beforePhotoCount === 0 && afterPhotoCount === 0 && (
                          <Text size="sm" c="dimmed">-</Text>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label="Open treatment">
                        <ActionIcon
                          variant="light"
                          onClick={() => handleOpenTreatment(procedure.id as string)}
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
}
