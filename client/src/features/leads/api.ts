import { useQuery } from '@tanstack/react-query';
import { LeadsApiResponseSchema, normalizeLead } from './schema';
import { NormalizedLead, LeadReportResponse } from './types';

export interface FetchLeadsParams {
  research_run_id?: string;
  status?: string;
  research_status?: string;
  limit?: number;
  offset?: number;
}

export async function fetchLeads(params?: FetchLeadsParams): Promise<NormalizedLead[]> {
  const queryParams = new URLSearchParams();
  if (params?.research_run_id && params.research_run_id !== 'all') {
    queryParams.set('research_run_id', params.research_run_id);
  }
  if (params?.status && params.status !== 'all') {
    queryParams.set('status', params.status);
  }
  if (params?.research_status && params.research_status !== 'all') {
    queryParams.set('research_status', params.research_status);
  }
  if (params?.limit) {
    queryParams.set('limit', String(params.limit));
  }
  if (params?.offset) {
    queryParams.set('offset', String(params.offset));
  }
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';

  // Direct fetch from Python AI Worker with fallback to Next.js BFF
  let response = await fetch(`/api/v1/leads${queryString}`, {
    headers: { Accept: 'application/json' },
  }).catch(() => null);

  if (!response || !response.ok) {
    response = await fetch(`/api/leads${queryString}`, {
      headers: { Accept: 'application/json' },
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch leads: ${response.status} ${errorText}`
    );
  }

  const json = await response.json();
  const parsedResult = LeadsApiResponseSchema.safeParse(json);

  let rawList: any[] = [];
  if (parsedResult.success) {
    const parsed = parsedResult.data;
    if (Array.isArray(parsed)) {
      rawList = parsed;
    } else if ('leads' in parsed && Array.isArray(parsed.leads)) {
      rawList = parsed.leads;
    } else if ('items' in parsed && Array.isArray(parsed.items)) {
      rawList = parsed.items;
    }
  } else {
    console.warn('LeadsApiResponseSchema parsing issue, falling back to raw payload extraction:', parsedResult.error);
    if (Array.isArray(json)) {
      rawList = json;
    } else if (json && typeof json === 'object') {
      if (Array.isArray(json.leads)) rawList = json.leads;
      else if (Array.isArray(json.items)) rawList = json.items;
      else if (Array.isArray(json.data)) rawList = json.data;
    }
  }

  return rawList
    .map(normalizeLead)
    .filter((lead) => {
      const name = lead.name || '';
      const id = lead.id || '';
      if (id.startsWith('lead_live_test_') || id.startsWith('test_')) return false;
      if (name.startsWith('Test Clinic')) return false;
      if (['Metro Aesthetics & Smile Studio', 'Apex Dental Spa', 'Aura Dental Lounge'].includes(name)) return false;
      return true;
    });
}

export function useLeadsQuery(params?: FetchLeadsParams) {
  return useQuery({
    queryKey: ['leads', params],
    queryFn: () => fetchLeads(params),
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetches canonical business intelligence report from Python AI worker (/api/v1/leads/:id/report)
 */
export async function fetchLeadReport(leadId: string): Promise<LeadReportResponse | null> {
  if (!leadId) return null;
  try {
    const response = await fetch(`/api/v1/leads/${encodeURIComponent(leadId)}/report`, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      console.warn(`Lead report returned status ${response.status} for ${leadId}`);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.warn(`Could not reach AI worker for lead report (${leadId}):`, err);
    return null;
  }
}

/**
 * Hook to fetch lead deep research report with non-blocking graceful fallback
 */
export function useLeadReportQuery(leadId?: string) {
  return useQuery({
    queryKey: ['leadReport', leadId],
    queryFn: () => (leadId ? fetchLeadReport(leadId) : Promise.resolve(null)),
    enabled: Boolean(leadId),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Composite hook to get normalized lead and previous/next navigation from leads cache
 */
export function useLeadDetail(leadId?: string) {
  const leadsQuery = useLeadsQuery();
  const allLeads = leadsQuery.data || [];

  const currentIndex = leadId ? allLeads.findIndex((l) => l.id === leadId) : -1;
  const lead = currentIndex >= 0 ? allLeads[currentIndex] : null;

  const prevLeadId = currentIndex > 0 ? allLeads[currentIndex - 1].id : null;
  const nextLeadId =
    currentIndex >= 0 && currentIndex < allLeads.length - 1
      ? allLeads[currentIndex + 1].id
      : null;

  return {
    lead,
    allLeads,
    currentIndex,
    totalLeads: allLeads.length,
    prevLeadId,
    nextLeadId,
    isLoading: leadsQuery.isLoading,
    isError: leadsQuery.isError,
    error: leadsQuery.error,
    refetch: leadsQuery.refetch,
  };
}

