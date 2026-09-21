import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { LeadDossier } from '@/features/leads';

export function LeadDetailPage() {
  const { leadId = '' } = useParams<{ leadId: string }>();

  // Full Lead Intelligence Dossier View & Specialist Evidence Drawer (Phase 9.4)
  // Provides "Back to Leads" navigation, opportunity scoring, evidence drawer, and outreach boundary
  return <LeadDossier leadId={leadId} />;
}
