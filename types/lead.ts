export type LeadStatus = 'new' | 'pitch_sent' | 'replied' | 'meeting_booked' | 'archived';
export type Platform = 'reddit' | 'x' | 'google_maps' | 'instagram' | 'meta_ads';

export interface Lead {
  id: string;
  source_platform: Platform;
  source_url: string;
  author: string;
  subreddit_or_handle: string;
  title: string;
  body_text: string;
  identified_problem: string;
  business_type: string;
  confidence_score: number; // 1-10
  draft_pitch: string;
  status: LeadStatus;
  created_at: string;

  // Local prospecting & multi-channel outreach properties
  business_name?: string;
  phone_number?: string;
  website_url?: string;
  instagram_url?: string;
  google_maps_url?: string;
  address?: string;
  rating?: number;
  review_count?: number;
  has_active_ads?: boolean;
  prospect_score?: number; // 1 - 10
  audit_friction_points?: string[];
  direct_contact_channel?: 'whatsapp' | 'instagram_dm' | 'phone' | 'email';
  recommended_service?: string;

  // Persistence metadata
  updated_at?: string;
  notes?: string | null;
}
