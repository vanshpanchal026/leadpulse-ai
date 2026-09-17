import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { OutreachRecord, OutreachActionResponse } from './types';
import {
  OutreachListResponseSchema,
  OutreachActionResponseSchema,
} from './schema';

/**
 * Fetch all outreach records awaiting review or processed from Python AI Worker (/api/v1/outreach)
 */
export async function fetchOutreachRecords(): Promise<OutreachRecord[]> {
  try {
    const response = await fetch('/api/v1/outreach', {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.warn(`Outreach records returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    const parsed = OutreachListResponseSchema.safeParse(data);
    if (!parsed.success) {
      console.warn('Outreach list schema validation mismatch:', parsed.error);
      return Array.isArray(data) ? (data as OutreachRecord[]) : [];
    }
    return parsed.data as OutreachRecord[];
  } catch (err) {
    console.warn('Could not connect to Python AI Worker for outreach records:', err);
    return [];
  }
}

/**
 * Human approval boundary: Marks draft as approved.
 * INVARIANT: external_send_executed is strictly false. No message is sent.
 */
export async function approveOutreachDraft(
  leadId: string,
  notes?: string
): Promise<OutreachActionResponse> {
  const response = await fetch(
    `/api/v1/outreach/${encodeURIComponent(leadId)}/approve`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        approved_by: 'human_operator',
        notes: notes || 'Approved via Human Review Workspace',
      }),
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to approve draft (${response.status})`);
  }

  const data = await response.json();
  const parsed = OutreachActionResponseSchema.safeParse(data);
  return (parsed.success ? parsed.data : data) as OutreachActionResponse;
}

/**
 * Human rejection boundary: Marks draft as rejected.
 */
export async function rejectOutreachDraft(
  leadId: string,
  reason?: string
): Promise<OutreachActionResponse> {
  const response = await fetch(
    `/api/v1/outreach/${encodeURIComponent(leadId)}/reject`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        reason: reason || 'Rejected by human reviewer',
      }),
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to reject draft (${response.status})`);
  }

  const data = await response.json();
  const parsed = OutreachActionResponseSchema.safeParse(data);
  return (parsed.success ? parsed.data : data) as OutreachActionResponse;
}

/**
 * Human edit: Updates message and triggers deterministic revalidation on backend.
 */
export async function editOutreachDraft(
  leadId: string,
  message: string,
  service?: string
): Promise<OutreachActionResponse> {
  const response = await fetch(
    `/api/v1/outreach/${encodeURIComponent(leadId)}/edit`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        message,
        service,
      }),
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to save edited draft (${response.status})`);
  }

  const data = await response.json();
  const parsed = OutreachActionResponseSchema.safeParse(data);
  return (parsed.success ? parsed.data : data) as OutreachActionResponse;
}

/**
 * Regenerates draft using Outreach Agent with bounded retry.
 */
export async function regenerateOutreachDraft(
  leadId: string
): Promise<OutreachActionResponse> {
  const response = await fetch(
    `/api/v1/outreach/${encodeURIComponent(leadId)}/regenerate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to regenerate draft (${response.status})`);
  }

  const data = await response.json();
  const parsed = OutreachActionResponseSchema.safeParse(data);
  return (parsed.success ? parsed.data : data) as OutreachActionResponse;
}

export function useOutreachRecordsQuery() {
  return useQuery({
    queryKey: ['outreachRecords'],
    queryFn: fetchOutreachRecords,
    staleTime: 1000 * 15,
  });
}

export function useApproveOutreachMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, notes }: { leadId: string; notes?: string }) =>
      approveOutreachDraft(leadId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreachRecords'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useRejectOutreachMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, reason }: { leadId: string; reason?: string }) =>
      rejectOutreachDraft(leadId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreachRecords'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useEditOutreachMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      leadId,
      message,
      service,
    }: {
      leadId: string;
      message: string;
      service?: string;
    }) => editOutreachDraft(leadId, message, service),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['outreachRecords'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leadReport', variables.leadId] });
    },
  });
}

export function useRegenerateOutreachMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leadId: string) => regenerateOutreachDraft(leadId),
    onSuccess: (_, leadId) => {
      queryClient.invalidateQueries({ queryKey: ['outreachRecords'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leadReport', leadId] });
    },
  });
}
