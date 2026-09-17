import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { Providers } from '@/app/providers';
import { router } from '@/app/router';

/**
 * Non-negotiable LeadPulse AI V2 Operational Safety Invariant:
 * external_send_executed = false
 * All outreach generation requires explicit human approval before external dispatch.
 */

export default function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
