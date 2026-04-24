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
  Box,
} from '@mantine/core';
import { useMedplum } from '@medplum/react';
import type { Procedure, Media, Appointment, ServiceRequest } from '@medplum/fhirtypes';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { IconEye, IconPlus, IconPhoto } from '@tabler/icons-react';
import { getReferenceString } from '@medplum/core';
import type { JSX } from 'react';
import { getMedSpaRole } from '../auth/role';
import { useNavigate } from 'react-router';
import dayjs from 'dayjs';
import { getTreatmentPageRoute } from '../treatments/shared/getTreatmentType';

interface TreatmentsTabProps {
  patientId: string;
}

interface TreatmentRow {
  id: string;
  type: 'procedure' | 'appointment';
  resource: Procedure | Appointment;
  serviceName: string;
  date: string;
  status: string;
  beforePhotoCount: number;
  afterPhotoCount: number;
}

// Status configuration for badges
const procedureStatusConfig: Record<string, { color: string; label: string }> = {
  preparation: { color: 'orange', label: 'Scheduled' },
  'in-progress': { color: 'blue', label: 'In Progress' },
  completed: { color: 'green', label: 'Completed' },
  cancelled: { color: 'red', label: 'Cancelled' },
};

const appointmentStatusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: 'yellow', label: 'Pending' },
  booked: { color: 'blue', label: 'Booked' },
  arrived: { color: 'green', label: 'Arrived' },
  fulfilled: { color: 'green', label: 'Completed' },
  cancelled: { color: 'red', label: 'Cancelled' },
  noshow: { color: 'gray', label: 'No Show' },
};

// Service type display names
const getServiceDisplayName = (procedure: Procedure): string => {
  // First try to get from code.text
  if (procedure.code?.text) {
    return procedure.code.text;
  }
  // Then try coding display
  const coding = procedure.code?.coding?.[0];
  if (coding?.display) {
    return coding.display;
  }
  // Fall back to code value
  if (coding?.code) {
    return coding.code
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  return 'Unknown Service';
};

export function TreatmentsTab({ patientId }: TreatmentsTabProps): JSX.Element {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const role = getMedSpaRole(medplum);
  const [treatments, setTreatments] = useState<TreatmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Load treatments for patient - now includes appointments
  const loadTreatments = useCallback(async () => {
    try {
      setLoading(true);

      // Load both appointments AND procedures for this patient
      const [appointmentsBundle, proceduresBundle] = await Promise.all([
        medplum.search('Appointment', {
          patient: `Patient/${patientId}`,
          _sort: '-date',
          _count: '50',
        }),
        medplum.search('Procedure', {
          subject: `Patient/${patientId}`,
          'code:has': 'http://melissaknudson.com/treatments|',
          _sort: '-date',
          _count: '50',
        }),
      ]);

      const appointments = (appointmentsBundle.entry || []).map(e => e.resource as Appointment);
      const procedures = (proceduresBundle.entry || []).map(e => e.resource as Procedure);

      // Create a map of linked appointments to procedures
      const linkedAppointments = new Map<string, Procedure>();
      for (const procedure of procedures) {
        const linkedApptExt = procedure.extension?.find(
          e => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment'
        );
        if (linkedApptExt?.valueReference?.reference?.startsWith('Appointment/')) {
          const apptId = linkedApptExt.valueReference.reference.split('/')[1];
          linkedAppointments.set(apptId, procedure);
        }
      }

      // Load all media once
      const mediaBundle = await medplum.search('Media', {
        subject: `Patient/${patientId}`,
        _count: '100',
      });
      const media = (mediaBundle.entry || []).map(e => e.resource as Media);

      const treatmentRows: TreatmentRow[] = [];

      // Add appointments (bookings) first
      for (const appointment of appointments) {
        // Get service names
        const services = appointment.serviceType?.map(st => st.text || 'Unknown Service') || ['Appointment'];
        const serviceName = services.join(', ');

        // Check if there's a linked procedure
        const linkedProcedure = linkedAppointments.get(appointment.id || '');

        // Count photos from linked procedure
        let beforePhotoCount = 0;
        let afterPhotoCount = 0;

        if (linkedProcedure) {
          beforePhotoCount = media.filter(m =>
            m.type?.coding?.[0]?.code === 'before' &&
            m.extension?.some(e =>
              e.url === 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure' &&
              e.valueReference?.reference === getReferenceString(linkedProcedure)
            )
          ).length;

          afterPhotoCount = media.filter(m =>
            m.type?.coding?.[0]?.code === 'after' &&
            m.extension?.some(e =>
              e.url === 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure' &&
              e.valueReference?.reference === getReferenceString(linkedProcedure)
            )
          ).length;
        }

        treatmentRows.push({
          id: appointment.id || '',
          type: 'appointment',
          resource: appointment,
          serviceName,
          date: appointment.start || '',
          status: appointment.status || 'unknown',
          beforePhotoCount,
          afterPhotoCount,
        });
      }

      // Add procedures that don't have linked appointments
      for (const procedure of procedures) {
        const hasLinkedAppt = procedure.extension?.some(
          e => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/linked-appointment' &&
               e.valueReference?.reference?.startsWith('Appointment/')
        );

        if (!hasLinkedAppt) {
          const beforePhotos = media.filter(m =>
            m.type?.coding?.[0]?.code === 'before' &&
            m.extension?.some(e =>
              e.url === 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure' &&
              e.valueReference?.reference === getReferenceString(procedure)
            )
          ).length;

          const afterPhotos = media.filter(m =>
            m.type?.coding?.[0]?.code === 'after' &&
            m.extension?.some(e =>
              e.url === 'http://melissaknudson.com/fhir/StructureDefinition/related-procedure' &&
              e.valueReference?.reference === getReferenceString(procedure)
            )
          ).length;

          const scheduledDate = procedure.extension?.find(
            e => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/scheduled-datetime'
          )?.valueDateTime;

          const serviceName = procedure.code?.text ||
            procedure.code?.coding?.[0]?.display ||
            'Unknown Service';

          treatmentRows.push({
            id: procedure.id || '',
            type: 'procedure',
            resource: procedure,
            serviceName,
            date: scheduledDate || procedure.performedDateTime || '',
            status: procedure.status || 'unknown',
            beforePhotoCount: beforePhotos,
            afterPhotoCount: afterPhotos,
          });
        }
      }

      // Sort by date (newest first)
      treatmentRows.sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
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

  // Get treatment areas from injection map extension (for procedures)
  const getTreatmentAreas = useCallback((resource: Procedure | Appointment): string => {
    if (resource.resourceType === 'Appointment') {
      return '-';
    }
    const injectionMapExt = resource.extension?.find(
      e => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/injection-map'
    );
    if (injectionMapExt?.extension) {
      const markers = injectionMapExt.extension.filter(e => e.url === 'marker');
      if (markers.length > 0) {
        const zoneNames = markers.map(m => {
          const zoneName = m.extension?.find(e => e.url === 'zoneName')?.valueString;
          return zoneName;
        }).filter(Boolean);
        const uniqueZones = [...new Set(zoneNames)];
        return uniqueZones.join(', ') || 'Not specified';
      }
    }
    const areas = resource.extension?.find(
      e => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/treatment-areas'
    )?.valueString;
    return areas || '-';
  }, []);

  // Get total units from extension (for procedures)
  const getTotalUnits = useCallback((resource: Procedure | Appointment): number => {
    if (resource.resourceType === 'Appointment') {
      return 0;
    }
    const units = resource.extension?.find(
      e => e.url === 'http://melissaknudson.com/fhir/StructureDefinition/units-used'
    )?.valueInteger;
    return units || 0;
  }, []);

  // Handle opening a treatment
  const handleOpenTreatment = useCallback((treatment: TreatmentRow) => {
    if (treatment.type === 'procedure' && treatment.resource.resourceType === 'Procedure') {
      const procedure = treatment.resource as Procedure;
      if (!procedure.id) return;
      const route = getTreatmentPageRoute(patientId, procedure.id, procedure);
      navigate(route);
} else if (treatment.type === 'appointment' && treatment.resource.resourceType === 'Appointment') {
    // For appointments, navigate to booking detail page
    navigate(`/bookings/${treatment.id}`);
  }
  }, [navigate, patientId]);

  // Handle creating new treatment - opens calendar for booking
  const handleNewTreatment = useCallback(() => {
    navigate('/calendar');
  }, [navigate]);

  // Format date
  const formatDate = useCallback((dateStr: string): string => {
    if (!dateStr) return 'Not scheduled';
    return dayjs(dateStr).format('MMM D, YYYY');
  }, []);

  // Format time
  const formatTime = useCallback((dateStr: string): string => {
    if (!dateStr) return '';
    return dayjs(dateStr).format('h:mm A');
  }, []);

  if (loading) {
    return (
      <Box p="md">
        <Paper p="xl">
          <Text ta="center">Loading treatments...</Text>
        </Paper>
      </Box>
    );
  }

  return (
    <Box p="md">
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
              No treatments yet. Click &quot;New Treatment&quot; to schedule the first one.
            </Text>
          </Paper>
        ) : (
          <Paper withBorder>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Service</Table.Th>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Time</Table.Th>
                  <Table.Th>Areas</Table.Th>
                  <Table.Th>Units</Table.Th>
                  <Table.Th>Photos</Table.Th>
                  <Table.Th>Actions</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
          {treatments.map((treatment) => {
                const status = treatment.status;
                const statusInfo = treatment.type === 'procedure'
                  ? procedureStatusConfig[status] || { color: 'gray', label: status }
                  : appointmentStatusConfig[status] || { color: 'gray', label: status };

                return (
                  <Table.Tr key={treatment.id}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {treatment.serviceName}
                      </Text>
                      {treatment.type === 'appointment' && (
                        <Badge size="xs" variant="light" color="blue" mt={4}>
                          Booking
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>{formatDate(treatment.date)}</Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {formatTime(treatment.date)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" lineClamp={2} style={{ maxWidth: 150 }}>
                        {treatment.type === 'procedure'
                          ? getTreatmentAreas(treatment.resource)
                          : '-'
                        }
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {treatment.type === 'procedure' && getTotalUnits(treatment.resource) > 0 ? (
                        <Text size="sm" fw={500}>{getTotalUnits(treatment.resource)} units</Text>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {treatment.beforePhotoCount > 0 && (
                          <Badge size="sm" color="gray" variant="light" leftSection={<IconPhoto size={12} />}>
                            {treatment.beforePhotoCount}
                          </Badge>
                        )}
                        {treatment.afterPhotoCount > 0 && (
                          <Badge size="sm" color="green" variant="light" leftSection={<IconPhoto size={12} />}>
                            {treatment.afterPhotoCount}
                          </Badge>
                        )}
                        {treatment.beforePhotoCount === 0 && treatment.afterPhotoCount === 0 && (
                          <Text size="sm" c="dimmed">-</Text>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip label="Open treatment">
                        <ActionIcon
                          variant="light"
                          onClick={() => handleOpenTreatment(treatment)}
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={statusInfo.color} variant="light">
                        {statusInfo.label}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              </Table.Tbody>
            </Table>
          </Paper>
        )}
      </Stack>
    </Box>
  );
}
