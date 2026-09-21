import { z } from 'zod';

export const SpecialistTypeSchema = z.enum([
  'website',
  'ads',
  'maps',
  'triage',
  'opportunity',
  'analyst',
]);

export const ResearchDepthSchema = z.enum(['standard', 'deep', 'comprehensive']);

export const CampaignConfigSchema = z.object({
  campaignName: z
    .string()
    .trim()
    .min(3, 'Campaign name must be at least 3 characters')
    .max(80, 'Campaign name cannot exceed 80 characters'),
  location: z
    .string()
    .trim()
    .min(2, 'Target location is required (e.g. South Delhi, Gurgaon)'),
  vertical: z
    .string()
    .trim()
    .min(2, 'Seed vertical is required (e.g. Dermatology, Dental)'),
  leadLimit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Lead limit capped at 100 for budget control'),
  researchDepth: ResearchDepthSchema.default('deep'),
  enabledSpecialists: z
    .array(SpecialistTypeSchema)
    .min(1, 'Enable at least one specialist agent'),
});

export type CampaignConfigInput = z.infer<typeof CampaignConfigSchema>;

export const ResearchRunRecordSchema = z.object({
  run_id: z.string(),
  campaign_id: z.string().optional().nullable(),
  status: z
    .enum(['pending', 'running', 'completed', 'partial', 'failed', 'cancelled'])
    .default('pending'),
  started_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  queries_generated: z.coerce.number().default(0),
  businesses_found: z.coerce.number().default(0),
  businesses_filtered: z.coerce.number().default(0),
  businesses_triaged: z.coerce.number().default(0),
  businesses_researched: z.coerce.number().default(0),
  qualified_leads: z.coerce.number().default(0),
  total_tokens: z.coerce.number().default(0),
  tool_calls: z.coerce.number().default(0),
  apify_calls: z.coerce.number().default(0),
  errors: z.array(z.record(z.string(), z.any())).default([]),
  configuration: z.record(z.string(), z.any()).default({}),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
});

export const ResearchRunListResponseSchema = z.object({
  items: z.array(ResearchRunRecordSchema).default([]),
  total: z.coerce.number().default(0),
  limit: z.coerce.number().default(50),
  offset: z.coerce.number().default(0),
});
