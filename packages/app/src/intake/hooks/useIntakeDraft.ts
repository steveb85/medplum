// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0

/**
 * useIntakeDraft Hook
 * Manages auto-save and loading of intake form drafts to localStorage
 */

import { useCallback, useEffect, useState } from 'react';
import type { IntakeDraft, IntakeFormData, IntakeMode, IntakeStep } from '../types/intake';
import { STEPS, getDefaultFormData } from '../utils/validation';

const DRAFT_KEY_PREFIX = 'intake-draft';
const DRAFT_EXPIRY_DAYS = 7;
const AUTO_SAVE_INTERVAL_MS = 30000; // 30 seconds

interface UseIntakeDraftOptions {
  mode: IntakeMode;
  userId?: string;
}

interface UseIntakeDraftReturn {
  draft: Partial<IntakeFormData>;
  currentStep: IntakeStep;
  draftId: string;
  hasDraft: boolean;
  isLoading: boolean;
  saveDraft: (data: Partial<IntakeFormData>, step: IntakeStep) => void;
  clearDraft: () => void;
  lastSaved: Date | null;
}

function getDraftKey(mode: IntakeMode, userId?: string): string {
  return `${DRAFT_KEY_PREFIX}-${mode}-${userId || 'anonymous'}`;
}

function generateDraftId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useIntakeDraft(options: UseIntakeDraftOptions): UseIntakeDraftReturn {
  const { mode, userId } = options;
  const [draftId, setDraftId] = useState<string>('');
  const [draft, setDraft] = useState<Partial<IntakeFormData>>({});
  const [currentStep, setCurrentStep] = useState<IntakeStep>(STEPS[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load draft from localStorage on mount
  useEffect(() => {
    const key = getDraftKey(mode, userId);
    const saved = localStorage.getItem(key);

    if (saved) {
      try {
        const parsed: IntakeDraft = JSON.parse(saved);
        const expiryDate = new Date(parsed.timestamp);
        expiryDate.setDate(expiryDate.getDate() + DRAFT_EXPIRY_DAYS);

        if (new Date() < expiryDate) {
          setDraftId(parsed.id);
          setDraft(parsed.data);
          setCurrentStep(parsed.currentStep);
        } else {
          // Draft expired, clear it
          localStorage.removeItem(key);
        }
      } catch {
        // Invalid draft data, ignore
      }
    }

    // Generate new draft ID if none exists
    if (!draftId) {
      setDraftId(generateDraftId());
    }

    setIsLoading(false);
  }, [mode, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft
  const saveDraft = useCallback(
    (data: Partial<IntakeFormData>, step: IntakeStep) => {
      const key = getDraftKey(mode, userId);
      const draftToSave: IntakeDraft = {
        id: draftId || generateDraftId(),
        data,
        currentStep: step,
        timestamp: Date.now(),
        mode,
        userId,
      };

      try {
        localStorage.setItem(key, JSON.stringify(draftToSave));
        setLastSaved(new Date());
        if (!draftId) {
          setDraftId(draftToSave.id);
        }
      } catch (err) {
        console.error('Failed to save draft:', err);
      }
    },
    [mode, userId, draftId]
  );

  // Clear draft
  const clearDraft = useCallback(() => {
    const key = getDraftKey(mode, userId);
    localStorage.removeItem(key);
    setDraft({});
    setCurrentStep(STEPS[0]);
    setDraftId(generateDraftId());
    setLastSaved(null);
  }, [mode, userId]);

  // Set up auto-save interval
  useEffect(() => {
    const interval = setInterval(() => {
      if (Object.keys(draft).length > 0) {
        saveDraft(draft, currentStep);
      }
    }, AUTO_SAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [draft, currentStep, saveDraft]);

  return {
    draft,
    currentStep,
    draftId,
    hasDraft: Object.keys(draft).length > 0,
    isLoading,
    saveDraft,
    clearDraft,
    lastSaved,
  };
}

/**
 * Clear all intake drafts (for logout/reset)
 */
export function clearAllIntakeDrafts(): void {
  Object.keys(localStorage)
    .filter((key) => key.startsWith(DRAFT_KEY_PREFIX))
    .forEach((key) => localStorage.removeItem(key));
}

/**
 * Get draft resume URL
 */
export function getDraftResumeUrl(draftId: string): string {
  return `/intake?draft=${draftId}`;
}
