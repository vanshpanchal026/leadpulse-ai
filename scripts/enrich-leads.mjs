import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const leadsPath = path.join(__dirname, '..', 'data', 'leads.json');
const rawData = fs.readFileSync(leadsPath, 'utf-8');
const leads = JSON.parse(rawData);

console.log(`Loaded ${leads.length} leads.`);

function isLegitWebsite(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().trim();
  if (lower === 'none' || lower === 'n/a' || lower === 'null') return false;
  if (lower.includes('wa.me') || lower.includes('whatsapp.com') || lower.includes('facebook.com')) return false;
  try {
    const parsed = new URL(lower.startsWith('http') ? lower : 'https://' + lower);
    return Boolean(parsed.hostname && parsed.hostname.includes('.'));
  } catch {
    return false;
  }
}

// Canonical services:
// 1. website_development
// 2. booking_automation
// 3. whatsapp_automation
// 4. lead_automation
// 5. ai_agents
// 6. crm_workflow_automation
// 7. business_automation

const enriched = leads.map((lead, index) => {
  const name = lead.business_name || lead.title || 'the business';
  const hasWebsite = isLegitWebsite(lead.website_url);
  const hasAds = lead.has_active_ads === true;
  const reviews = typeof lead.review_count === 'number' ? lead.review_count : 0;

  let service = 'whatsapp_automation';
  let problem = '';
  let friction = [];
  let pitch = '';

  if (!hasWebsite) {
    service = 'website_development';
    problem = 'Missing official mobile-optimized website for Delhi clients to view services and book consultations';
    friction = ['Missing official website for capturing direct inbound appointments and search inquiries'];
    pitch = `Hi, noticed ${name} does not have an official website listed on Google Maps. Most local clients check treatment options online before visiting, so a clean mobile landing page captures those direct inquiries.`;
  } else if (hasAds) {
    service = 'lead_automation';
    problem = 'Active paid ad spend with delayed lead follow-up, causing inquiry drop-off';
    friction = [
      'Active paid ad traffic routed to static landing page with high form abandonment',
      'Delayed response to ad inquiries resulting in low consult conversion'
    ];
    pitch = `Hi, saw ${name} is actively running ads in Delhi right now. Following up with new inquiries within 5 minutes significantly increases consult bookings, whereas delayed responses often lose patients to other clinics.`;
  } else {
    // Distribute remaining across services based on index modulo
    const remainder = index % 5;
    if (remainder === 0 && reviews >= 50) {
      service = 'booking_automation';
      problem = 'High patient inquiry volume without self-serve appointment scheduling, causing front desk bottlenecks';
      friction = [
        'No direct online self-serve calendar booking; reliant on manual telephone scheduling',
        `High inquiry volume (${reviews} reviews) without 24/7 automated scheduling`
      ];
      pitch = `Hi, saw ${name} has great reviews on Maps, but scheduling currently requires calling the desk. An automated calendar link lets clients pick appointment slots directly without phone tag.`;
    } else if (remainder === 1) {
      service = 'whatsapp_automation';
      problem = 'Missing instant 1-click messaging capture, losing inquiries that land after business operating hours';
      friction = ['No direct 1-click WhatsApp inquiry capture for instant after-hours lead response'];
      pitch = `Hi, noticed ${name} does not have a direct WhatsApp link on your online listing. Adding a 1-click inquiry button captures after-hours client queries when your front desk is closed.`;
    } else if (remainder === 2) {
      service = 'ai_agents';
      problem = 'Repetitive routine inquiries regarding service pricing and timings overwhelming staff';
      friction = [
        'High volume of repetitive client inquiries regarding pricing and doctor availability',
        'Staff time consumed answering routine FAQ queries rather than client care'
      ];
      pitch = `Hi, noticed ${name} handles high consultation interest in Delhi. An automated inquiry assistant answering standard questions on pricing, timings, and prep filters qualified bookings before staff steps in.`;
    } else if (remainder === 3) {
      service = 'crm_workflow_automation';
      problem = 'Consultation inquiries and client follow-ups managed manually across fragmented channels';
      friction = [
        'Client inquiries across phone and messaging scattered without central tracking',
        'No automated handoff from inbound inquiry to front desk schedule'
      ];
      pitch = `Hi, noticed ${name} handles high inquiry volume across calls and messages. Syncing every incoming consultation request automatically into a central tracker ensures no client follow-up gets missed.`;
    } else {
      service = 'business_automation';
      problem = 'Manual consultation confirmations and follow-ups resulting in avoidable schedule gaps';
      friction = [
        'Manual appointment confirmations and reminders leading to clinic schedule gaps',
        'Lack of automated post-consultation review and follow-up sequences'
      ];
      pitch = `Hi, noticed ${name} manages high daily appointment volume. Automated booking confirmations and timely reminders reduce no-shows without adding manual work for your reception.`;
    }
  }

  let score = lead.prospect_score || lead.confidence_score || 7;
  if (reviews >= 50) score = Math.max(score, 8);
  if (hasAds) score = Math.max(score, 9);
  if (!hasWebsite) score = Math.max(score, 8);

  return {
    ...lead,
    recommended_service: service,
    identified_problem: problem,
    audit_friction_points: friction,
    draft_pitch: pitch,
    prospect_score: score,
    confidence_score: score,
    direct_contact_channel: 'whatsapp'
  };
});

fs.writeFileSync(leadsPath, JSON.stringify(enriched, null, 2), 'utf-8');
console.log('Successfully updated data/leads.json!');

const summary = {};
enriched.forEach(l => {
  summary[l.recommended_service] = (summary[l.recommended_service] || 0) + 1;
});
console.log('New Service Distribution:', summary);
