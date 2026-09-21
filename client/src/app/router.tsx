import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '@/layouts/app-shell';
import { DashboardPage } from '@/pages/dashboard/dashboard-page';
import { LeadsPage } from '@/pages/leads/leads-page';
import { LeadDetailPage } from '@/pages/leads/lead-detail-page';
import { ResearchPage } from '@/pages/research/research-page';
import { OutreachPage } from '@/pages/outreach/outreach-page';
import { SettingsPage } from '@/pages/settings/settings-page';
import { NotFoundPage } from '@/pages/not-found/not-found-page';
import { RouteErrorBoundary } from '@/components/error/error-boundary';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: 'leads',
        element: <LeadsPage />,
      },
      {
        path: 'leads/:leadId',
        element: <LeadDetailPage />,
      },
      {
        path: 'research',
        element: <ResearchPage />,
      },
      {
        path: 'outreach',
        element: <OutreachPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);
