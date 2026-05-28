import { Button, Divider, Group, Modal, Stack, Tabs, Text, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { normalizeErrorString } from '@medplum/core';
import { useMedplum } from '@medplum/react';
import type { Patient, ServiceRequest } from '@medplum/fhirtypes';
import type { JSX } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BotoxTreatmentForm, type BotoxTreatmentData, FillerTreatmentForm, type FillerTreatmentData, GenericTreatmentForm, type GenericTreatmentData, LaserTreatmentForm, type LaserTreatmentData } from './treatment-forms';
import { PhotoUploadSection } from '../nurse-mel/PhotoUploadSection';
import { PatientReferencePanel } from '../treatments/shared/PatientReferencePanel';
import { DEFAULT_SOAP_NOTE, SOAPNoteSection, type SOAPNoteData } from '../treatments/shared/SOAPNoteSection';
import { DEFAULT_PROCEDURE_NOTE, ProcedureNoteSection, type ProcedureNoteData } from '../treatments/shared/ProcedureNoteSection';
import { loadProviderOptions, type ProviderOption } from '../treatments/shared/loadProviders';
import { EXTENSION_URLS } from '../utils/fhir-extensions';
import { getPracticeConfig } from '../utils/practice-config';

interface TreatmentModalProps {
  opened: boolean;
  onClose: () => void;
  serviceRequest: ServiceRequest;
  patient: Patient;
  onSaved: (updated: ServiceRequest) => void;
}

const FILLER_CODES = ['filler', 'sculptra', 'skinvive', 'prp-face', 'prp-hair', 'aquagold'];
const LASER_CODES = ['laser', 'lumecca', 'clear-brilliant', 'fraxel', 'thermage', 'ulthera', 'skin-pen'];
const BOTOX_CODES = ['botox-cosmetic'];

function getServiceCode(sr: ServiceRequest): string {
  return sr.code?.coding?.[0]?.code || '';
}

function parseExtension<T>(sr: ServiceRequest, url: string, fallback: T): T {
  const ext = sr.extension?.find((e) => e.url === url);
  if (ext?.valueString) {
    try { return JSON.parse(ext.valueString) as T; } catch { /* fall through */ }
  }
  return fallback;
}

export function TreatmentModal({ opened, onClose, serviceRequest, patient, onSaved }: TreatmentModalProps): JSX.Element {
  const medplum = useMedplum();
  const code = getServiceCode(serviceRequest);
  const initialized = useRef(false);

  // Track the latest saved version to prevent overwrites
  const [latestSr, setLatestSr] = useState<ServiceRequest>(serviceRequest);

  const [treatmentData, setTreatmentData] = useState<Record<string, unknown>>(
    parseExtension(serviceRequest, EXTENSION_URLS.serviceRequest.serviceNotes, {})
  );
  const [soapNote, setSoapNote] = useState<SOAPNoteData>(
    parseExtension(serviceRequest, EXTENSION_URLS.procedure.soapNote, DEFAULT_SOAP_NOTE)
  );
  const [procedureNote, setProcedureNote] = useState<ProcedureNoteData>(
    parseExtension(serviceRequest, EXTENSION_URLS.procedure.procedureNote, DEFAULT_PROCEDURE_NOTE)
  );
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
  const [saving, setSaving] = useState(false);

  // Re-initialize when modal opens or serviceRequest changes
  useEffect(() => {
    if (opened) {
      setLatestSr(serviceRequest);
      setTreatmentData(parseExtension(serviceRequest, EXTENSION_URLS.serviceRequest.serviceNotes, {}));

      // Load SOAP note (or defaults)
      setSoapNote(parseExtension(serviceRequest, EXTENSION_URLS.procedure.soapNote, DEFAULT_SOAP_NOTE));

      // Load procedure note, auto-fill signedBy and supervising provider if empty
      const savedProcNote = parseExtension(serviceRequest, EXTENSION_URLS.procedure.procedureNote, null);
      if (savedProcNote) {
        setProcedureNote(savedProcNote);
      } else {
        const defaultProcNote = { ...DEFAULT_PROCEDURE_NOTE };
        // Auto-fill signedBy from logged-in user
        const profile = medplum.getProfile();
        if (profile?.name?.[0]) {
          const n = profile.name[0];
          defaultProcNote.signedBy = `${n.given?.[0] || ''} ${n.family || ''}`.trim();
        }
        // Auto-fill supervising provider from practice config
        getPracticeConfig(medplum).then((config) => {
          if (config.supervisingProvider?.display) {
            defaultProcNote.supervisingProvider = config.supervisingProvider.display;
          }
          setProcedureNote(defaultProcNote);
        }).catch(() => setProcedureNote(defaultProcNote));
      }

      loadProviderOptions(medplum).then(setProviderOptions).catch(console.error);
      initialized.current = true;
    }
  }, [opened, serviceRequest, medplum]);

  const saveData = useCallback(async (extensions: { url: string; valueString: string }[]): Promise<void> => {
    setSaving(true);
    try {
      const updated: ServiceRequest = {
        ...latestSr,
        extension: [
          ...(latestSr.extension || []).filter(
            (e) => !extensions.some((ex) => ex.url === e.url)
          ),
          ...extensions,
        ],
      };
      const saved = await medplum.updateResource(updated);
      setLatestSr(saved);
      onSaved(saved);
    } catch (err) {
      showNotification({ title: 'Error saving', message: normalizeErrorString(err), color: 'red' });
    } finally {
      setSaving(false);
    }
  }, [latestSr, medplum, onSaved]);

  const handleSaveTreatment = useCallback(async (): Promise<void> => {
    await saveData([{ url: EXTENSION_URLS.serviceRequest.serviceNotes, valueString: JSON.stringify(treatmentData) }]);
    showNotification({ title: 'Saved', message: 'Treatment data saved', color: 'green' });
  }, [saveData, treatmentData]);

  const handleSaveSoapNote = useCallback(async (): Promise<void> => {
    await saveData([{ url: EXTENSION_URLS.procedure.soapNote, valueString: JSON.stringify(soapNote) }]);
    showNotification({ title: 'Saved', message: 'SOAP note saved', color: 'green' });
  }, [saveData, soapNote]);

  const handleSaveProcedureNote = useCallback(async (): Promise<void> => {
    await saveData([{ url: EXTENSION_URLS.procedure.procedureNote, valueString: JSON.stringify(procedureNote) }]);
    showNotification({ title: 'Saved', message: 'Procedure note saved', color: 'green' });
  }, [saveData, procedureNote]);

  const serviceStatusExt = latestSr.extension?.find(
    (e) => e.url === EXTENSION_URLS.serviceRequest.serviceStatus
  )?.valueString;
  const isReadonly = serviceStatusExt === 'completed' || serviceStatusExt === 'cancelled';

  const renderTreatmentForm = (): JSX.Element => {
    if (BOTOX_CODES.includes(code)) {
      return <BotoxTreatmentForm value={treatmentData as unknown as BotoxTreatmentData} onChange={(d) => setTreatmentData(d as unknown as Record<string, unknown>)} readonly={isReadonly} />;
    }
    if (FILLER_CODES.includes(code)) {
      return <FillerTreatmentForm value={treatmentData as unknown as FillerTreatmentData} onChange={(d) => setTreatmentData(d as unknown as Record<string, unknown>)} readonly={isReadonly} />;
    }
    if (LASER_CODES.includes(code)) {
      return <LaserTreatmentForm value={treatmentData as unknown as LaserTreatmentData} onChange={(d) => setTreatmentData(d as unknown as Record<string, unknown>)} readonly={isReadonly} />;
    }
    return <GenericTreatmentForm value={treatmentData as unknown as GenericTreatmentData} onChange={(d) => setTreatmentData(d as unknown as Record<string, unknown>)} readonly={isReadonly} />;
  };

  const title = serviceRequest.code?.text || 'Treatment';

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text size="lg" fw={600}>{title}</Text>}
      size="xl"
      fullScreen
    >
      <Tabs defaultValue="treatment">
        <Tabs.List>
          <Tabs.Tab value="treatment">Treatment Data</Tabs.Tab>
          <Tabs.Tab value="soap">SOAP Note</Tabs.Tab>
          <Tabs.Tab value="procedure">Procedure Note</Tabs.Tab>
          <Tabs.Tab value="photos">Photos</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="treatment" pt="md">
          <Stack gap="md">
            {renderTreatmentForm()}
            {!isReadonly && (
              <Group justify="flex-end">
                <Button onClick={handleSaveTreatment} loading={saving}>Save Treatment Data</Button>
              </Group>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="soap" pt="md">
          <Stack gap="md">
            <PatientReferencePanel patientId={patient.id || ''} />
            <SOAPNoteSection value={soapNote} onChange={setSoapNote} readonly={isReadonly} />
            {!isReadonly && (
              <Group justify="flex-end">
                <Button onClick={handleSaveSoapNote} loading={saving}>Save SOAP Note</Button>
              </Group>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="procedure" pt="md">
          <Stack gap="md">
            <ProcedureNoteSection value={procedureNote} onChange={setProcedureNote} readonly={isReadonly} supervisingProviderOptions={providerOptions} />
            {!isReadonly && (
              <Group justify="flex-end">
                <Button onClick={handleSaveProcedureNote} loading={saving}>Save Procedure Note</Button>
              </Group>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="photos" pt="md">
          <Stack gap="md">
            <PhotoUploadSection
              beforePhotos={[]}
              afterPhotos={[]}
              readOnly={isReadonly}
              isSaving={saving}
            />
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Modal>
  );
}
