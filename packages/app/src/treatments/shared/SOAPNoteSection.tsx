import { Box, Checkbox, Collapse, Divider, Group, NumberInput, Paper, Stack, Text, Textarea, TextInput, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import type { JSX } from 'react';

export interface SOAPNoteData {
  subjective: {
    reasonForVisit: string;
    historyOfPresentIllness: string;
    painLevel: number;
    notes: string;
  };
  objective: {
    clinicalFindings: string;
    vitals: {
      bp: string;
      hr: number;
      rr: number;
      temp: number;
      spo2: number;
    };
    notes: string;
  };
  ros: {
    negatives: string[];
    noneAbove: boolean;
    positives: string;
  };
  assessment: {
    diagnosis: string;
    notes: string;
  };
  plan: {
    treatmentPlan: string;
    followUp: string;
    notes: string;
  };
}

export const DEFAULT_SOAP_NOTE: SOAPNoteData = {
  subjective: { reasonForVisit: '', historyOfPresentIllness: '', painLevel: 0, notes: '' },
  objective: { clinicalFindings: '', vitals: { bp: '', hr: 0, rr: 0, temp: 0, spo2: 0 }, notes: '' },
  ros: { negatives: [], noneAbove: false, positives: '' },
  assessment: { diagnosis: '', notes: '' },
  plan: { treatmentPlan: '', followUp: '', notes: '' },
};

const ROS_ITEMS = [
  'Rash', 'Redness', 'Warmth', 'Fever', 'Cough',
  'Shortness of breath', 'Nausea/Vomiting', 'Diarrhea',
  'Fatigue', 'Headache', 'Dizziness', 'Joint pain',
];

const VITALS_FIELDS = ['bp', 'hr', 'rr', 'temp', 'spo2'] as const;

interface SOAPNoteSectionProps {
  value: SOAPNoteData;
  onChange: (data: SOAPNoteData) => void;
  readonly?: boolean;
}

export function SOAPNoteSection({ value, onChange, readonly = false }: SOAPNoteSectionProps): JSX.Element {
  const [vitalsOpen, { toggle: toggleVitals }] = useDisclosure(false);

  const updateSubjective = (updates: Partial<SOAPNoteData['subjective']>): void => {
    onChange({ ...value, subjective: { ...value.subjective, ...updates } });
  };

  const updateObjective = (updates: Partial<SOAPNoteData['objective']>): void => {
    onChange({ ...value, objective: { ...value.objective, ...updates } });
  };

  const updateVitals = (updates: Partial<SOAPNoteData['objective']['vitals']>): void => {
    onChange({
      ...value,
      objective: {
        ...value.objective,
        vitals: { ...value.objective.vitals, ...updates },
      },
    });
  };

  const updateROS = (updates: Partial<SOAPNoteData['ros']>): void => {
    onChange({ ...value, ros: { ...value.ros, ...updates } });
  };

  const toggleROSItem = (item: string): void => {
    const current = value.ros.negatives;
    const updated = current.includes(item)
      ? current.filter((i) => i !== item)
      : [...current, item];
    onChange({
      ...value,
      ros: { ...value.ros, negatives: updated, noneAbove: false },
    });
  };

  const updateAssessment = (updates: Partial<SOAPNoteData['assessment']>): void => {
    onChange({ ...value, assessment: { ...value.assessment, ...updates } });
  };

  const updatePlan = (updates: Partial<SOAPNoteData['plan']>): void => {
    onChange({ ...value, plan: { ...value.plan, ...updates } });
  };

  return (
    <Stack gap="md">
      <Title order={5}>SOAP Note</Title>

      {/* Subjective */}
      <Paper p="sm" withBorder>
        <Text fw={500} mb="xs">Subjective</Text>
        <Stack gap="xs">
          <TextInput
            label="Reason for Visit"
            value={value.subjective.reasonForVisit}
            onChange={(e) => updateSubjective({ reasonForVisit: e.target.value })}
            disabled={readonly}
          />
          <Textarea
            label="History of Present Illness"
            value={value.subjective.historyOfPresentIllness}
            onChange={(e) => updateSubjective({ historyOfPresentIllness: e.target.value })}
            minRows={2}
            disabled={readonly}
          />
          <NumberInput
            label="Pain Level (0-10)"
            min={0}
            max={10}
            value={value.subjective.painLevel}
            onChange={(v) => updateSubjective({ painLevel: Number(v) || 0 })}
            disabled={readonly}
          />
          <Textarea
            label="Notes"
            value={value.subjective.notes}
            onChange={(e) => updateSubjective({ notes: e.target.value })}
            minRows={2}
            disabled={readonly}
          />
        </Stack>
      </Paper>

      {/* Objective */}
      <Paper p="sm" withBorder>
        <Group justify="space-between" mb="xs">
          <Text fw={500}>Objective</Text>
          <Text size="sm" c="dimmed" style={{ cursor: 'pointer' }} onClick={toggleVitals}>
            {vitalsOpen ? 'Hide vitals ▲' : 'Show vitals ▼'}
          </Text>
        </Group>
        <Stack gap="xs">
          <Textarea
            label="Clinical Findings"
            value={value.objective.clinicalFindings}
            onChange={(e) => updateObjective({ clinicalFindings: e.target.value })}
            minRows={3}
            disabled={readonly}
          />
          <Collapse in={vitalsOpen}>
            <Paper p="xs" withBorder>
              <Text size="sm" fw={500} mb="xs">Vitals</Text>
              <Group grow>
                <TextInput
                  label="BP"
                  placeholder="120/80"
                  value={value.objective.vitals.bp}
                  onChange={(e) => updateVitals({ bp: e.target.value })}
                  disabled={readonly}
                />
                <NumberInput
                  label="HR"
                  value={value.objective.vitals.hr}
                  onChange={(v) => updateVitals({ hr: Number(v) || 0 })}
                  disabled={readonly}
                />
                <NumberInput
                  label="RR"
                  value={value.objective.vitals.rr}
                  onChange={(v) => updateVitals({ rr: Number(v) || 0 })}
                  disabled={readonly}
                />
                <NumberInput
                  label="Temp"
                  value={value.objective.vitals.temp}
                  onChange={(v) => updateVitals({ temp: Number(v) || 0 })}
                  disabled={readonly}
                />
                <NumberInput
                  label="SpO2"
                  value={value.objective.vitals.spo2}
                  onChange={(v) => updateVitals({ spo2: Number(v) || 0 })}
                  disabled={readonly}
                />
              </Group>
            </Paper>
          </Collapse>
          <Textarea
            label="Notes"
            value={value.objective.notes}
            onChange={(e) => updateObjective({ notes: e.target.value })}
            minRows={2}
            disabled={readonly}
          />
        </Stack>
      </Paper>

      {/* ROS */}
      <Paper p="sm" withBorder>
        <Text fw={500} mb="xs">Review of Systems</Text>
        <Stack gap="xs">
          <Checkbox
            label="None of the above (all systems negative)"
            checked={value.ros.noneAbove}
            onChange={(e) => {
              if (e.target.checked) {
                updateROS({ noneAbove: true, negatives: [] });
              } else {
                updateROS({ noneAbove: false });
              }
            }}
            disabled={readonly}
          />
          <Group gap="xs">
            {ROS_ITEMS.map((item) => (
              <Checkbox
                key={item}
                label={item}
                size="xs"
                checked={value.ros.negatives.includes(item)}
                onChange={() => toggleROSItem(item)}
                disabled={readonly || value.ros.noneAbove}
              />
            ))}
          </Group>
          <Textarea
            label="Positive Findings"
            placeholder="Document any positive findings..."
            value={value.ros.positives}
            onChange={(e) => updateROS({ positives: e.target.value })}
            minRows={2}
            disabled={readonly}
          />
        </Stack>
      </Paper>

      {/* Assessment */}
      <Paper p="sm" withBorder>
        <Text fw={500} mb="xs">Assessment</Text>
        <Stack gap="xs">
          <TextInput
            label="Diagnosis"
            value={value.assessment.diagnosis}
            onChange={(e) => updateAssessment({ diagnosis: e.target.value })}
            disabled={readonly}
          />
          <Textarea
            label="Notes"
            value={value.assessment.notes}
            onChange={(e) => updateAssessment({ notes: e.target.value })}
            minRows={3}
            disabled={readonly}
          />
        </Stack>
      </Paper>

      {/* Plan */}
      <Paper p="sm" withBorder>
        <Text fw={500} mb="xs">Plan</Text>
        <Stack gap="xs">
          <Textarea
            label="Treatment Plan"
            value={value.plan.treatmentPlan}
            onChange={(e) => updatePlan({ treatmentPlan: e.target.value })}
            minRows={2}
            disabled={readonly}
          />
          <TextInput
            label="Follow-Up"
            placeholder="e.g., 2 weeks, PRN"
            value={value.plan.followUp}
            onChange={(e) => updatePlan({ followUp: e.target.value })}
            disabled={readonly}
          />
          <Textarea
            label="Notes"
            value={value.plan.notes}
            onChange={(e) => updatePlan({ notes: e.target.value })}
            minRows={2}
            disabled={readonly}
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
