import 'dotenv/config';
import { POST } from '../app/api/scraper/meta-ads/route';
import { NextRequest } from 'next/server';

async function runTest() {
  console.log('Testing /api/scraper/meta-ads with a batch of 3 Meta ads...');

  const mockAds = [
    {
      adArchiveID: 'ad_1010101',
      pageName: 'DermaElite Skin Clinic Delhi',
      categories: ['Skin Care Clinic', 'Dermatologist'],
      snapshot: {
        title: 'Special HydraFacial & Laser Offer - 40% OFF',
        body: {
          text: 'Get 40% OFF on HydraFacial & Laser Hair Reduction this week in South Delhi! WhatsApp our clinic at +91 98112 34567 or visit our site to claim.',
        },
        linkUrl: 'https://dermaeliteclinic.in/delhi-acne-treatment',
        pageProfileUri: 'https://instagram.com/dermaelite_delhi',
      },
    },
    {
      adArchiveID: 'ad_1010102',
      pageName: 'Apex Dental Implant Center South Delhi',
      categories: ['Dental Clinic', 'Dentist'],
      snapshot: {
        title: 'Permanent Dental Implants Offer - ₹19,999',
        body: {
          text: 'Permanent dental implants starting at ₹19,999 with 0% EMI options. Experienced implantologist in South Delhi. Contact: 98188 76543.',
        },
        linkUrl: 'https://apexdentaldelhi.com/implants',
        pageProfileUri: 'https://instagram.com/apexdental_delhi',
      },
    },
    {
      adArchiveID: 'ad_1010103',
      pageName: 'Luxe Hair Transplant & Restoration Delhi',
      categories: ['Hair Transplant Clinic'],
      snapshot: {
        title: 'Natural Hairline Restoration Consult Offer',
        body: {
          text: 'Natural hairline restoration with direct follicular implantation. High graft survival rate. Reach us directly: +91-98711-22334.',
        },
        linkUrl: 'https://luxehairdelhi.com/consultation',
        pageProfileUri: 'https://instagram.com/luxehairdelhi',
      },
    },
  ];

  const req = new NextRequest('http://localhost:3000/api/scraper/meta-ads', {
    method: 'POST',
    body: JSON.stringify({
      searchQuery: 'Skin & Dental Clinic Delhi',
      items: mockAds,
    }),
  });

  const response = await POST(req);
  const data = await response.json();

  console.log('\n--- Pipeline Result ---');
  console.log('Success:', data.success);
  console.log('Total ingested:', data.total_ingested);
  console.log('Qualified count:', data.qualified_leads_count);

  if (data.leads && data.leads.length > 0) {
    console.log('\n--- Qualified Lead Details ---');
    data.leads.forEach((lead: any, idx: number) => {
      console.log(`\nLead #${idx + 1}:`);
      console.log(`- Business Name: ${lead.business_name}`);
      console.log(`- Platform: ${lead.source_platform}`);
      console.log(`- Phone: ${lead.phone_number}`);
      console.log(`- Active Ads: ${lead.has_active_ads}`);
      console.log(`- Prospect Score: ${lead.prospect_score}/10`);
      console.log(`- Friction Points: ${JSON.stringify(lead.audit_friction_points)}`);
      console.log(`- Pitch: "${lead.draft_pitch}"`);
    });
  }

  // Quality checks
  if (!data.success) {
    throw new Error('Pipeline failed');
  }
  if (data.qualified_leads_count < 3) {
    throw new Error(`Expected at least 3 qualified leads, got ${data.qualified_leads_count}`);
  }

  const allScoresValid = data.leads.every((l: any) => l.prospect_score >= 8 && l.prospect_score <= 10);
  if (!allScoresValid) {
    throw new Error('Not all leads scored between 8 and 10');
  }

  const allAdsActive = data.leads.every((l: any) => l.has_active_ads === true);
  if (!allAdsActive) {
    throw new Error('has_active_ads is not true for all leads');
  }

  const allHavePhones = data.leads.every((l: any) => l.phone_number && l.phone_number.startsWith('+91'));
  if (!allHavePhones) {
    throw new Error('Not all leads have normalized E.164 +91 phone numbers');
  }

  console.log('\n✅ ALL VERIFICATION GATES PASSED CLEANLY!');
}

runTest().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
