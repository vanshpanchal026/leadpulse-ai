/**
 * scripts/test-scorecard.js
 * 
 * Verifies the 10-point scorecard calculation engine with 3 dummy clinic & business payloads.
 * Runs via: npx tsx scripts/test-scorecard.js (or node --experimental-strip-types scripts/test-scorecard.js)
 */

import { calculateProspectScore } from '../lib/scorecard.ts';

const testCases = [
  {
    name: 'Test Case 1: High-Ticket Dental Implant Clinic (Expected: 10/10, immediate)',
    input: {
      business_name: 'Dr. Smile Dental & Implant Centre',
      business_type: 'Dental Clinic',
      has_active_ads: true, // +3
      review_count: 145,    // +2 (>= 50)
      instagram_url: 'https://www.instagram.com/drsmiledental_delhi', // +1
      website_url: 'https://drsmileimplants.com',                     // +1
      audit_friction_points: [
        'No direct WhatsApp booking button on mobile',
        'High offline review volume without 24/7 automated inquiry capture'
      ], // +2
      address: 'Greater Kailash 1, New Delhi',
    },
    expectedScore: 10,
    expectedPriority: 'immediate',
  },
  {
    name: 'Test Case 2: Mid-tier Hair Salon with Website but No Ads (Expected: 4/10, medium)',
    input: {
      business_name: 'Luxe Hair Salon',
      business_type: 'Luxury Salon', // +1
      has_active_ads: false,         // 0
      review_count: 24,              // 0 (< 50)
      instagram_url: 'none',         // 0
      website_url: 'https://luxehairdelhi.in', // +1
      // Friction auto-detected: No WhatsApp CTA on website -> +2
      address: 'South Extension, New Delhi',
    },
    expectedScore: 4,
    expectedPriority: 'medium',
  },
  {
    name: 'Test Case 3: Local Hardware Store without Website or Ads (Expected: 2/10, skip)',
    input: {
      business_name: 'Sharma General Hardware & Paint',
      business_type: 'Hardware Store', // 0
      has_active_ads: false,           // 0
      review_count: 7,                 // 0
      instagram_url: '',               // 0
      website_url: '',                 // 0
      // Friction auto-detected: Missing website -> +2
      address: 'Lajpat Nagar, New Delhi',
    },
    expectedScore: 2,
    expectedPriority: 'skip',
  },
];

console.log('🧪 Starting Scorecard Engine Verification Tests...\n');

let passedTests = 0;

for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i];
  const result = calculateProspectScore(tc.input);

  console.log(`[${i + 1}/${testCases.length}] ${tc.name}`);
  console.log(`   - Output Score:    ${result.score}/10 (Expected: ${tc.expectedScore})`);
  console.log(`   - Output Priority: ${result.priority} (Expected: ${tc.expectedPriority})`);
  console.log(`   - Friction Points: ${JSON.stringify(result.frictionPoints)}`);

  const scoreMatches = result.score === tc.expectedScore;
  const priorityMatches = result.priority === tc.expectedPriority;

  if (scoreMatches && priorityMatches) {
    console.log('   ✅ PASSED\n');
    passedTests++;
  } else {
    console.error(`   ❌ FAILED: Score or Priority mismatch!`);
    console.error(`      Score: got ${result.score}, expected ${tc.expectedScore}`);
    console.error(`      Priority: got ${result.priority}, expected ${tc.expectedPriority}\n`);
  }
}

console.log(`Summary: ${passedTests}/${testCases.length} tests passed.`);

if (passedTests !== testCases.length) {
  process.exit(1);
} else {
  console.log('🎉 Scorecard calculation engine verified successfully!');
}
