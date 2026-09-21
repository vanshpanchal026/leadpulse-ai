import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ResearchRunRecord,
  ResearchRunListResponse,
  CampaignFormData,
} from './types';
import {
  ResearchRunRecordSchema,
  ResearchRunListResponseSchema,
} from './schema';

/**
 * Fetches recent research runs from Python AI Worker (/api/v1/research-runs)
 */
export async function fetchResearchRuns(
  limit = 20,
  offset = 0
): Promise<ResearchRunListResponse> {
  const response = await fetch(
    `/api/v1/research-runs?limit=${limit}&offset=${offset}`,
    {
      headers: { Accept: 'application/json' },
    }
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(
      `Failed to fetch research runs (${response.status}): ${errText || response.statusText}`
    );
  }

  const json = await response.json();
  const parsed = ResearchRunListResponseSchema.safeParse(json);
  if (parsed.success) {
    return parsed.data;
  }
  console.warn('ResearchRunListResponseSchema parsing issue, returning normalized fallback:', parsed.error);
  if (Array.isArray(json)) {
    return { items: json, total: json.length, limit, offset };
  }
  if (json && typeof json === 'object') {
    const rawItems = Array.isArray(json.items) ? json.items : (Array.isArray((json as any).runs) ? (json as any).runs : []);
    return {
      items: rawItems,
      total: typeof json.total === 'number' ? json.total : rawItems.length,
      limit: typeof json.limit === 'number' ? json.limit : limit,
      offset: typeof json.offset === 'number' ? json.offset : offset,
    };
  }
  return { items: [], total: 0, limit, offset };
}

/**
 * Fetches single research run status and live telemetry from Python AI Worker
 */
export async function fetchResearchRunById(
  runId: string
): Promise<ResearchRunRecord> {
  const response = await fetch(
    `/api/v1/research-runs/${encodeURIComponent(runId)}`,
    {
      headers: { Accept: 'application/json' },
    }
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(
      `Failed to fetch run '${runId}' (${response.status}): ${errText || response.statusText}`
    );
  }

  const json = await response.json();
  const parsed = ResearchRunRecordSchema.safeParse(json);
  if (parsed.success) {
    return parsed.data;
  }
  console.warn(`ResearchRunRecordSchema parsing issue for run '${runId}':`, parsed.error);
  return json as ResearchRunRecord;
}

/**
 * Initializes and starts a campaign research run via Python AI Worker
 */
export async function createResearchRun(
  formData: CampaignFormData
): Promise<ResearchRunRecord> {
  const campaignSlug = `camp_${formData.vertical.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20)}_${Date.now().toString(36)}`;

  const payload = {
    campaign_id: campaignSlug,
    configuration: {
      campaign_name: formData.campaignName,
      location: formData.location,
      vertical: formData.vertical,
      lead_limit: formData.leadLimit,
      research_depth: formData.researchDepth,
      specialists: formData.enabledSpecialists,
      execute: true,
      auto_execute: true,
    },
  };

  const response = await fetch('/api/v1/research-runs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(
      `Failed to initiate research run (${response.status}): ${errText || response.statusText}`
    );
  }

  const json = await response.json();
  return ResearchRunRecordSchema.parse(json);
}

/**
 * Hook to retrieve list of recent research runs
 */
export function useResearchRunsQuery(limit = 15) {
  return useQuery({
    queryKey: ['researchRuns', limit],
    queryFn: () => fetchResearchRuns(limit, 0),
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 15,
  });
}

/**
 * Hook to retrieve single run telemetry with smart polling that terminates upon completion
 */
export function useResearchRunQuery(runId?: string | null) {
  return useQuery({
    queryKey: ['researchRun', runId],
    queryFn: () => (runId ? fetchResearchRunById(runId) : Promise.resolve(null)),
    enabled: Boolean(runId),
    staleTime: 1000 * 2,
    // Poll every 2.5s ONLY while run is running or pending; stop immediately when terminal
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 2500;
      const isTerminal = ['completed', 'partial', 'failed', 'cancelled'].includes(data.status);
      return isTerminal ? false : 2500;
    },
  });
}

/**
 * Mutation hook to start research run and refresh runs cache
 */
export function useCreateResearchRunMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createResearchRun,
    onSuccess: (newRun) => {
      queryClient.invalidateQueries({ queryKey: ['researchRuns'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['outreachRecords'] });
      queryClient.setQueryData(['researchRun', newRun.run_id], newRun);
    },
  });
}
