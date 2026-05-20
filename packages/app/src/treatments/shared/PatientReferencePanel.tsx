import { Badge, Box, Collapse, Divider, Group, Paper, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useMedplum } from '@medplum/react';
import type { AllergyIntolerance, Condition, MedicationStatement, Observation } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';

interface PatientSummary {
  allergies: AllergyIntolerance[];
  medications: MedicationStatement[];
  conditions: Condition[];
  aestheticHistory: Observation[];
  surgicalHistory: Observation[];
  skincareRoutine: Observation[];
}

interface PatientReferencePanelProps {
  patientId: string;
  lastReviewed?: string;
}

export function PatientReferencePanel({ patientId, lastReviewed }: PatientReferencePanelProps): JSX.Element {
  const medplum = useMedplum();
  const [opened, { toggle }] = useDisclosure(false);
  const [summary, setSummary] = useState<PatientSummary>({
    allergies: [],
    medications: [],
    conditions: [],
    aestheticHistory: [],
    surgicalHistory: [],
    skincareRoutine: [],
  });
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [allergies, medications, conditions, observations] = await Promise.all([
        medplum.search('AllergyIntolerance', { patient: `Patient/${patientId}`, _count: '50' }),
        medplum.search('MedicationStatement', { subject: `Patient/${patientId}`, _count: '50' }),
        medplum.search('Condition', { subject: `Patient/${patientId}`, _count: '50' }),
        medplum.search('Observation', { subject: `Patient/${patientId}`, _count: '100' }),
      ]);

      const aestheticHistory: Observation[] = [];
      const surgicalHistory: Observation[] = [];
      const skincareRoutine: Observation[] = [];

      for (const entry of observations.entry || []) {
        const obs = entry.resource as Observation;
        const categoryCode = obs.category?.[0]?.coding?.[0]?.code;
        if (categoryCode === 'aesthetic-treatment-history') {
          aestheticHistory.push(obs);
        } else if (categoryCode === 'surgical-history') {
          surgicalHistory.push(obs);
        } else if (categoryCode === 'skincare-routine') {
          skincareRoutine.push(obs);
        }
      }

      setSummary({
        allergies: (allergies.entry || []).map((e) => e.resource as AllergyIntolerance),
        medications: (medications.entry || []).map((e) => e.resource as MedicationStatement),
        conditions: (conditions.entry || []).map((e) => e.resource as Condition),
        aestheticHistory,
        surgicalHistory,
        skincareRoutine,
      });
    } catch (err) {
      console.error('Error loading patient reference data:', err);
    } finally {
      setLoading(false);
    }
  }, [medplum, patientId]);

  useEffect(() => {
    if (patientId) {
      loadData();
    }
  }, [patientId, loadData]);

  const totalCount =
    summary.allergies.length +
    summary.medications.length +
    summary.conditions.length +
    summary.aestheticHistory.length +
    summary.surgicalHistory.length +
    summary.skincareRoutine.length;

  return (
    <Paper p="sm" withBorder>
      <Group justify="space-between" onClick={toggle} style={{ cursor: 'pointer' }}>
        <Group gap="xs">
          <Text fw={500} size="sm">Patient Record</Text>
          {loading ? (
            <Badge size="sm" variant="light" color="gray">Loading...</Badge>
          ) : (
            <Badge size="sm" variant="light" color="blue">{totalCount} items</Badge>
          )}
        </Group>
        <Group gap="xs">
          {lastReviewed && (
            <Text size="xs" c="dimmed">Last reviewed: {lastReviewed}</Text>
          )}
          <Text size="sm" c="dimmed">{opened ? '▲' : '▼'}</Text>
        </Group>
      </Group>

      <Collapse in={opened}>
        <Divider my="sm" />

        {totalCount === 0 && !loading && (
          <Text size="sm" c="dimmed" py="xs">No patient records found</Text>
        )}

        {summary.allergies.length > 0 && (
          <Box py="xs">
            <Text fw={500} size="sm" c="red">Allergies ({summary.allergies.length})</Text>
            <Stack gap={2} mt={4}>
              {summary.allergies.map((a) => (
                <Text key={a.id} size="sm">
                  • {a.code?.text || a.code?.coding?.[0]?.display || 'Unknown'}
                  {a.clinicalStatus?.coding?.[0]?.code === 'active' && (
                    <Badge size="xs" color="red" ml={4}>Active</Badge>
                  )}
                </Text>
              ))}
            </Stack>
          </Box>
        )}

        {summary.medications.length > 0 && (
          <Box py="xs">
            <Text fw={500} size="sm" c="blue">Medications ({summary.medications.length})</Text>
            <Stack gap={2} mt={4}>
              {summary.medications.map((m) => (
                <Text key={m.id} size="sm">
                  • {m.medicationCodeableConcept?.text || m.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown'}
                </Text>
              ))}
            </Stack>
          </Box>
        )}

        {summary.conditions.length > 0 && (
          <Box py="xs">
            <Text fw={500} size="sm" c="orange">Conditions ({summary.conditions.length})</Text>
            <Stack gap={2} mt={4}>
              {summary.conditions.map((c) => (
                <Text key={c.id} size="sm">
                  • {c.code?.text || c.code?.coding?.[0]?.display || 'Unknown'}
                  {c.clinicalStatus?.coding?.[0]?.code === 'active' && (
                    <Badge size="xs" color="orange" ml={4}>Active</Badge>
                  )}
                </Text>
              ))}
            </Stack>
          </Box>
        )}

        {summary.aestheticHistory.length > 0 && (
          <Box py="xs">
            <Text fw={500} size="sm">Aesthetic History ({summary.aestheticHistory.length})</Text>
            <Stack gap={2} mt={4}>
              {summary.aestheticHistory.map((o) => (
                <Text key={o.id} size="sm">
                  • {o.valueString || o.code?.text || o.code?.coding?.[0]?.display || 'Unknown'}
                </Text>
              ))}
            </Stack>
          </Box>
        )}

        {summary.surgicalHistory.length > 0 && (
          <Box py="xs">
            <Text fw={500} size="sm">Surgical History ({summary.surgicalHistory.length})</Text>
            <Stack gap={2} mt={4}>
              {summary.surgicalHistory.map((o) => (
                <Text key={o.id} size="sm">
                  • {o.valueString || o.code?.text || o.code?.coding?.[0]?.display || 'Unknown'}
                </Text>
              ))}
            </Stack>
          </Box>
        )}

        {summary.skincareRoutine.length > 0 && (
          <Box py="xs">
            <Text fw={500} size="sm">Skincare Routine ({summary.skincareRoutine.length})</Text>
            <Stack gap={2} mt={4}>
              {summary.skincareRoutine.map((o) => (
                <Text key={o.id} size="sm">
                  • {o.valueString || o.code?.text || o.code?.coding?.[0]?.display || 'Unknown'}
                </Text>
              ))}
            </Stack>
          </Box>
        )}
      </Collapse>
    </Paper>
  );
}
