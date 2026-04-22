// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Button, Paper, ScrollArea, Title } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { getReferenceString, isGone, normalizeErrorString } from '@medplum/core';
import type { OperationOutcome, Resource, ResourceType, ServiceRequest } from '@medplum/fhirtypes';
import { Document, LinkTabs, OperationOutcomeAlert, PatientHeader, useMedplum, useResource } from '@medplum/react';
import type { JSX } from 'react';
import { useState } from 'react';
import { Outlet, useParams } from 'react-router';
import { filterPatientTabs, getMedSpaRole } from '../auth/role';
import  type { MedSpaRole } from '../auth/role';
import { QuickServiceRequests } from '../components/QuickServiceRequests';
import { QuickStatus } from '../components/QuickStatus';
import { ResourceHeader } from '../components/ResourceHeader';
import { SpecimenHeader } from '../components/SpecimenHeader';
import { getPatient, getSpecimen } from '../utils';
import { cleanResource } from './utils';

/**
 * Get tabs for a resource type, filtered by user role
 *
 * @param resourceType - The FHIR resource type
 * @param role - The user's MedSpa role
 * @returns Array of tab names to display
 */
function getTabs(resourceType: string, role: MedSpaRole): string[] {
  const result = ['Timeline'];

  // Bot-specific tabs (admin only)
  if (resourceType === 'Bot') {
    if (role === 'super-admin' || role === 'project-admin') {
      result.push('Editor', 'Subscriptions');
    }
  }

  // PlanDefinition tabs (admin only)
  if (resourceType === 'PlanDefinition') {
    if (role === 'super-admin' || role === 'project-admin') {
      result.push('Apply', 'Builder');
    }
  }

  // Questionnaire tabs (admin only for Builder/Bots, all for Preview/Responses)
  if (resourceType === 'Questionnaire') {
    result.push('Preview', 'Responses');
    if (role === 'super-admin' || role === 'project-admin') {
      result.push('Builder', 'Bots');
    }
  }

  // ValueSet tabs (admin only)
  if (resourceType === 'ValueSet') {
    if (role === 'super-admin' || role === 'project-admin') {
      result.push('Preview');
    }
  }

  // Lab-related tabs (admin only)
  if (resourceType === 'DiagnosticReport' || resourceType === 'MeasureReport') {
    if (role === 'super-admin' || role === 'project-admin') {
      result.push('Report');
    }
  }

  // RequestGroup (admin only)
  if (resourceType === 'RequestGroup') {
    if (role === 'super-admin' || role === 'project-admin') {
      result.push('Checklist');
    }
  }

  // ObservationDefinition (admin/lab only)
  if (resourceType === 'ObservationDefinition') {
    if (role === 'super-admin' || role === 'project-admin') {
      result.push('Ranges');
    }
  }

  // Agent tools (admin only)
  if (resourceType === 'Agent') {
    if (role === 'super-admin' || role === 'project-admin') {
      result.push('Tools');
    }
  }

  // Communication payload (admin only)
  if (resourceType === 'Communication') {
    if (role === 'super-admin' || role === 'project-admin') {
      result.push('Payload');
    }
  }

  // Base tabs - filtered by role
  const baseTabs = ['Details', 'Edit', 'Event', 'History', 'Blame', 'Accounts','JSON', 'Apps', 'Profiles'];
  const filteredBaseTabs = filterPatientTabs(baseTabs, role);
  result.push(...filteredBaseTabs);

  // Patient-specific tabs
  if (resourceType === 'Patient') {
    // Treatments tab - list of all aesthetic procedures
    result.push('Treatments');

    // Note: Treatment detail pages (botox-treatment, filler-treatment, etc.)
    // are accessed via the Treatments list, not as tabs

    // Export - admin only
    if (role === 'super-admin' || role === 'project-admin') {
      result.push('Export');
    }
  }

  return result;
}

export function ResourcePage(): JSX.Element | null {
  const medplum = useMedplum();
  const { resourceType, id } = useParams() as { resourceType: ResourceType; id: string };
  const reference = { reference: resourceType + '/' + id };
  const [outcome, setOutcome] = useState<OperationOutcome | undefined>();
  const value = useResource(reference, setOutcome);
  const role = getMedSpaRole(medplum);
  const tabs = getTabs(resourceType, role);

  async function restoreResource(): Promise<void> {
    const historyBundle = await medplum.readHistory(resourceType, id);
    const restoredResource = historyBundle.entry?.find((e) => !!e.resource)?.resource;
    if (restoredResource) {
      onSubmit(restoredResource);
    } else {
      showNotification({ color: 'red', message: 'No history to restore', autoClose: false });
    }
  }

  function onSubmit(newResource: Resource): void {
    medplum
      .updateResource(cleanResource(newResource))
      .then(() => {
        setOutcome(undefined);
        showNotification({ color: 'green', message: 'Success' });
      })
      .catch((err) => {
        showNotification({ color: 'red', message: normalizeErrorString(err), autoClose: false });
      });
  }

  if (outcome) {
    if (isGone(outcome)) {
      return (
        <Document>
          <Title>Deleted</Title>
          <p>The resource was deleted.</p>
          <Button color="red" onClick={restoreResource}>
            Restore
          </Button>
        </Document>
      );
    }
    return <OperationOutcomeAlert outcome={outcome} />;
  }

  function onStatusChange(status: string): void {
    const serviceRequest = value as ServiceRequest;
    const orderDetail = serviceRequest.orderDetail || [];
    if (orderDetail.length === 0) {
      orderDetail.push({});
    }
    if (orderDetail[0].text !== status) {
      orderDetail[0].text = status;
      onSubmit({ ...serviceRequest, orderDetail });
    }
  }

  const patient = value && getPatient(value);
  const specimen = value && getSpecimen(value);
  const statusValueSet = medplum.getUserConfiguration()?.option?.find((o) => o.id === 'statusValueSet')?.valueString;

  return (
    <>
      {value?.resourceType === 'ServiceRequest' && statusValueSet && (
        <QuickStatus
          key={getReferenceString(value) + '-' + value.orderDetail?.[0]?.text}
          valueSet={{ reference: statusValueSet }}
          defaultValue={value.orderDetail?.[0]?.text}
          onChange={onStatusChange}
        />
      )}
      {value && <QuickServiceRequests value={value} />}
      {value && (
        <Paper>
          {patient && <PatientHeader patient={patient} />}
          {specimen && <SpecimenHeader specimen={specimen} />}
          {resourceType !== 'Patient' && <ResourceHeader resource={reference} />}
          <ScrollArea>
            <LinkTabs baseUrl={`/${resourceType}/${id}`} tabs={tabs} />
          </ScrollArea>
        </Paper>
      )}
      <Outlet />
    </>
  );
}
