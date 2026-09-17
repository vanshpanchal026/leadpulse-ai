import { describe, it, expect } from 'vitest';
import { normalizeLead } from '../schema';
import { RawLeadRecord } from '../schema';

describe('normalizeLead Fallback Handling (Prove-It Test)', () => {
  it('should populate primaryProblem from identified_problem when primary_problem is null', () => {
    // Arrange: Dr. Batra's raw discovery record from Supabase
    const discoveryLead: RawLeadRecord = {
      id: 'ad35d788-a5b9-4463-8ea5-d7ec4fc5a07b',
      business_name: "Dr. Batra's Skin & Hair Clinic",
      business_type: 'Skin care clinic',
      source_platform: 'google_maps',
      source_url: 'https://www.google.com/maps/place/?q=Dr+Batras+GK2',
      prospect_score: 9,
      opportunity_score: 0,
      confidence_score: 9,
      research_status: 'pending',
      // V1 Discovery fields sitting in Supabase:
      identified_problem: "Dr. Batra's website lacks a direct WhatsApp booking button",
      audit_friction_points: [
        'No direct 1-click WhatsApp booking button on website',
        'High offline review volume (185 reviews) without 24/7 automated inquiry capture',
      ],
      // V2 Deep fields are empty/null before deep research:
      primary_problem: null,
      why_this_service: null,
      evidence: [],
      outreach_status: 'draft',
      status: 'new',
    };

    // Act
    const normalized = normalizeLead(discoveryLead);

    // Assert: Must NOT be null or empty
    expect(normalized.primaryProblem).toBe(
      "Dr. Batra's website lacks a direct WhatsApp booking button"
    );
    expect(normalized.whyThisService).not.toBeNull();
    expect(normalized.evidence.length).toBeGreaterThan(0);
    expect(normalized.observedCount).toBeGreaterThan(0);
  });
});
