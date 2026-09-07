export type LeadIntent = 'HIRING' | 'FOR_HIRE' | 'DISCUSSION';

export type PipelineStage = 'inbox' | 'qualified' | 'outreach' | 'converted' | 'archived';

export interface Lead {
  id: string;
  subreddit: string;
  keyword_matched: string;
  title: string;
  body_text: string;
  url: string;
  score: number;
  created_date: string;
  intent: LeadIntent;
  contacts: string;
  budget_signals: string;
  stage: PipelineStage;
  notes?: string;
  updatedAt?: string;
}

export interface LeadStats {
  totalPosts: number;
  hiringCount: number;
  forHireCount: number;
  discussionCount: number;
  contactableCount: number;
  budgetCount: number;
  subredditBreakdown: Record<string, number>;
  keywordBreakdown: Record<string, number>;
  totalSpend: string;
  lastScraped: string;
}

export interface FilterState {
  search: string;
  intent: 'ALL' | LeadIntent;
  subreddits: string[];
  keywords: string[];
  onlyWithContact: boolean;
  onlyWithBudget: boolean;
  sortBy: 'newest' | 'score' | 'intent';
  stage: 'ALL' | PipelineStage;
}
