// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

import { Document, useMedplum } from '@medplum/react';
import type { JSX } from 'react';
import { Navigate, useLocation } from 'react-router';
import { getMedSpaRole, isRouteAccessible, type MedSpaRole } from '../auth/role';

export interface RoleGuardProps {
  /**
   * The content to render if access is granted
   */
  children: JSX.Element;

  /**
   * Optional: Require specific role(s)
   * If not provided, uses route-based access control
   */
  requiredRole?: MedSpaRole | MedSpaRole[];

  /**
   * Optional: Show fallback UI instead of redirect
   */
  fallback?: JSX.Element;
}

/**
 * RoleGuard component for protecting routes based on user role.
 *
 * This component checks if the current user has access to the current route
 * or the required role(s). If access is denied, it either shows a fallback
 * or redirects to the home page.
 *
 * Usage:
 * ```tsx
 * // In route definition:
 * <Route path="/admin/bots" element={
 *   <RoleGuard>
 *     <BotsPage />
 *   </RoleGuard>
 * } />
 *
 * // Or with specific role requirement:
 * <RouteGuard requiredRole="provider">
 *   <ProviderOnlyPage />
 * </RouteGuard>
 * ```
 */
export function RoleGuard({ children, requiredRole, fallback }: RoleGuardProps): JSX.Element {
  const medplum = useMedplum();
  const location = useLocation();
  const role = getMedSpaRole(medplum);

  // If specific role(s) required, check against those
  if (requiredRole) {
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!requiredRoles.includes(role)) {
      if (fallback) {
        return fallback;
      }
      return (
        <Document>
          <h1>Access Denied</h1>
          <p>You do not have permission to access this page.</p>
          <p>
            Required role: {requiredRoles.join(' or ')}
            <br />
            Your role: {role}
          </p>
        </Document>
      );
    }
    return children;
  }

  // Otherwise, check route-based access
  const path = location.pathname;
  if (!isRouteAccessible(path, role)) {
    if (fallback) {
      return fallback;
    }
    // Redirect to home page
    return <Navigate to="/" replace />;
  }

  return children;
}

/**
 * Higher-order component for protecting pages with role-based access
 *
 * @param Component - The component to wrap
 * @param requiredRole - Optional required role(s)
 * @returns Wrapped component with role guard
 */
export function withRoleGuard<P extends object>(
  Component: React.ComponentType<P>,
  requiredRole?: MedSpaRole | MedSpaRole[]
): React.FC<P> {
  return function WrappedComponent(props: P): JSX.Element {
    return (
      <RoleGuard requiredRole={requiredRole}>
        <Component {...props} />
      </RoleGuard>
    );
  };
}
