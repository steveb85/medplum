import { Group, Paper, Select, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import type { JSX } from 'react';

export interface ProcedureNoteData {
  preOpDiagnosis: string;
  postOpDiagnosis: string;
  procedurePerformed: string;
  findings: string;
  indications: string;
  complications: string;
  estimatedBloodLoss: string;
  levelOfMonitoring: string;
  specimens: string;
  drains: string;
  tourniquet: string;
  counts: string;
  signedBy: string;
  supervisingProvider: string;
}

const DEFAULT_PROCEDURE_NOTE: ProcedureNoteData = {
  preOpDiagnosis: '',
  postOpDiagnosis: '',
  procedurePerformed: '',
  findings: '',
  indications: '',
  complications: 'None',
  estimatedBloodLoss: 'None',
  levelOfMonitoring: 'local',
  specimens: 'None',
  drains: 'None',
  tourniquet: 'None',
  counts: 'N/A',
  signedBy: '',
  supervisingProvider: '',
};

const MONITORING_OPTIONS = [
  { value: 'local', label: 'Local' },
  { value: 'moderate-sedation', label: 'Moderate Sedation' },
  { value: 'general', label: 'General' },
];

const COUNTS_OPTIONS = [
  { value: 'correct', label: 'Correct' },
  { value: 'incorrect', label: 'Incorrect' },
  { value: 'N/A', label: 'N/A' },
];

interface ProcedureNoteSectionProps {
  value: ProcedureNoteData;
  onChange: (data: ProcedureNoteData) => void;
  readonly?: boolean;
  supervisingProviderOptions?: { value: string; label: string }[];
}

export function ProcedureNoteSection({
  value,
  onChange,
  readonly = false,
  supervisingProviderOptions = [],
}: ProcedureNoteSectionProps): JSX.Element {
  const update = (updates: Partial<ProcedureNoteData>): void => {
    onChange({ ...value, ...updates });
  };

  return (
    <Stack gap="md">
      <Title order={5}>Procedure Note</Title>

      <Paper p="sm" withBorder>
        <Stack gap="xs">
          <TextInput
            label="Pre-Op Diagnosis"
            value={value.preOpDiagnosis}
            onChange={(e) => update({ preOpDiagnosis: e.target.value })}
            disabled={readonly}
          />
          <TextInput
            label="Post-Op Diagnosis"
            value={value.postOpDiagnosis}
            onChange={(e) => update({ postOpDiagnosis: e.target.value })}
            disabled={readonly}
          />
          <TextInput
            label="Procedure Performed"
            value={value.procedurePerformed}
            onChange={(e) => update({ procedurePerformed: e.target.value })}
            disabled={readonly}
          />
          <Textarea
            label="Findings"
            value={value.findings}
            onChange={(e) => update({ findings: e.target.value })}
            minRows={2}
            disabled={readonly}
          />
          <Textarea
            label="Indications"
            value={value.indications}
            onChange={(e) => update({ indications: e.target.value })}
            minRows={2}
            disabled={readonly}
          />
          <Textarea
            label="Complications"
            value={value.complications}
            onChange={(e) => update({ complications: e.target.value })}
            minRows={2}
            disabled={readonly}
          />

          <Group grow>
            <TextInput
              label="Estimated Blood Loss"
              value={value.estimatedBloodLoss}
              onChange={(e) => update({ estimatedBloodLoss: e.target.value })}
              disabled={readonly}
            />
            <Select
              label="Level of Monitoring"
              data={MONITORING_OPTIONS}
              value={value.levelOfMonitoring}
              onChange={(v) => update({ levelOfMonitoring: v || 'local' })}
              disabled={readonly}
            />
          </Group>

          <Group grow>
            <TextInput
              label="Specimens"
              value={value.specimens}
              onChange={(e) => update({ specimens: e.target.value })}
              disabled={readonly}
            />
            <TextInput
              label="Drains"
              value={value.drains}
              onChange={(e) => update({ drains: e.target.value })}
              disabled={readonly}
            />
          </Group>

          <Group grow>
            <TextInput
              label="Tourniquet"
              value={value.tourniquet}
              onChange={(e) => update({ tourniquet: e.target.value })}
              disabled={readonly}
            />
            <Select
              label="Counts"
              data={COUNTS_OPTIONS}
              value={value.counts}
              onChange={(v) => update({ counts: v || 'N/A' })}
              disabled={readonly}
            />
          </Group>

          <TextInput
            label="Signed By"
            value={value.signedBy}
            onChange={(e) => update({ signedBy: e.target.value })}
            disabled={readonly}
            placeholder="Auto-filled from logged-in user"
          />

          <Select
            label="Supervising Provider"
            data={supervisingProviderOptions}
            value={value.supervisingProvider || undefined}
            onChange={(v) => update({ supervisingProvider: v || '' })}
            disabled={readonly}
            clearable
            placeholder="Select supervising provider"
          />

          <Text size="xs" c="dimmed">
            CMS 11-line-item surgical note standard
          </Text>
        </Stack>
      </Paper>
    </Stack>
  );
}

export { DEFAULT_PROCEDURE_NOTE };
