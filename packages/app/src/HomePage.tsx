// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { Paper } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import type { SearchRequest } from '@medplum/core';
import { formatSearchQuery, normalizeErrorString, parseSearchRequest } from '@medplum/core';
import { exportJsonFile, Loading, SearchControl, useMedplum } from '@medplum/react';
import type { JSX } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import classes from './HomePage.module.css';
import { addSearchValues, getTransactionBundle, RESOURCE_TYPE_CREATION_PATHS, saveLastSearch } from './HomePage.utils';
import { getMedSpaRole } from './auth/role';
import { canCreate, canDelete, canExport, canBulk } from './config/tablePermissions';

export function HomePage(): JSX.Element {
  const medplum = useMedplum();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState<SearchRequest>();

  // Get user role for permission checking
  const role = getMedSpaRole(medplum);

  // Define all callbacks BEFORE any early returns
  const handleNew = useCallback(
    (resourceType: string) => () => {
      navigate(RESOURCE_TYPE_CREATION_PATHS[resourceType] ?? `/${resourceType}/new`)?.catch(console.error);
    },
    [navigate]
  );

  const handleDelete = useCallback(
    (resourceType: string, currentSearch: SearchRequest) => (ids: string[]) => {
      if (window.confirm('Are you sure you want to delete these resources?')) {
        medplum.invalidateSearches(resourceType);
        medplum
          .executeBatch({
            resourceType: 'Bundle',
            type: 'batch',
            entry: ids.map((id) => ({
              request: {
                method: 'DELETE',
                url: `${resourceType}/${id}`,
              },
            })),
          })
          .then(() => setSearch({ ...currentSearch }))
          .catch((err) => showNotification({ color: 'red', message: normalizeErrorString(err), autoClose: false }));
      }
    },
    [medplum]
  );

  const handleExportCsv = useCallback(
    (resourceType: string, currentSearch: SearchRequest) => () => {
      const url = medplum.fhirUrl(resourceType, '$csv') + formatSearchQuery(currentSearch);
      medplum
        .download(url)
        .then((blob: Blob) => {
          window.open(window.URL.createObjectURL(blob), '_blank');
        })
        .catch((err) => showNotification({ color: 'red', message: normalizeErrorString(err), autoClose: false }));
    },
    [medplum]
  );

  const handleExportTransactionBundle = useCallback(
    (currentSearch: SearchRequest) => async () => {
      getTransactionBundle(currentSearch, medplum)
        .then((bundle) => exportJsonFile(JSON.stringify(bundle, undefined, 2)))
        .catch((err) => showNotification({ color: 'red', message: normalizeErrorString(err), autoClose: false }));
    },
    [medplum]
  );

  const handleBulk = useCallback(
    (resourceType: string) => (ids: string[]) => {
      navigate(`/bulk/${resourceType}?ids=${ids.join(',')}`)?.catch(console.error);
    },
    [navigate]
  );

  useEffect(() => {
    // Parse the search from the URL
    const parsedSearch = parseSearchRequest(location.pathname + location.search);

    // Fill in the search with default values
    const populatedSearch = addSearchValues(parsedSearch, medplum.getUserConfiguration());

    if (
      location.pathname === `/${populatedSearch.resourceType}` &&
      location.search === formatSearchQuery(populatedSearch)
    ) {
      // If the URL matches the parsed search, then save it and execute it
      saveLastSearch(populatedSearch);
      setSearch(populatedSearch);
    } else {
      // Otherwise, navigate to the desired URL
      navigate(`/${populatedSearch.resourceType}${formatSearchQuery(populatedSearch)}`)?.catch(console.error);
    }
  }, [medplum, navigate, location]);

  // Early return AFTER all hooks are defined
  if (!search?.resourceType || !search.fields || search.fields.length === 0) {
    return <Loading />;
  }

  const resourceType = search.resourceType;

  // Build action callbacks object based on permissions
  // Only include callbacks for permitted actions - this controls button visibility
  const actionCallbacks: {
    onNew?: () => void;
    onDelete?: (ids: string[]) => void;
    onExportCsv?: () => void;
    onExportTransactionBundle?: () => Promise<void>;
    onBulk?: (ids: string[]) => void;
  } = {};

  if (canCreate(resourceType, role)) {
    actionCallbacks.onNew = handleNew(resourceType);
  }

  if (canDelete(resourceType, role)) {
    actionCallbacks.onDelete = handleDelete(resourceType, search);
  }

  if (canExport(resourceType, role)) {
    actionCallbacks.onExportCsv = handleExportCsv(resourceType, search);
    actionCallbacks.onExportTransactionBundle = handleExportTransactionBundle(search);
  }

  if (canBulk(resourceType, role)) {
    actionCallbacks.onBulk = handleBulk(resourceType);
  }

  return (
    <Paper shadow="xs" m="md" p="xs" className={classes.paper}>
      <SearchControl
        checkboxesEnabled={true}
        search={search}
        onClick={(e) => navigate(`/${e.resource.resourceType}/${e.resource.id}`)?.catch(console.error)}
        onAuxClick={(e) => window.open(`/${e.resource.resourceType}/${e.resource.id}`, '_blank')}
        onChange={(e) => {
          navigate(`/${resourceType}${formatSearchQuery(e.definition)}`)?.catch(console.error);
        }}
        {...actionCallbacks}
      />
    </Paper>
  );
}
