"""Unit Test Suite for LeadPulse AI V2 Phase 8 Persistence Service.

Tests:
- Research run lifecycle: creation, counter updates, completion, failure, cancellation
- Lead upsert & idempotency: deduplication by URL, phone number, and business name
- Partial research preservation: preserving successful specialist results on sibling failure
- Strict evidence classification integrity: observed, inferred, unknown never corrupted
- Outreach persistence: draft, validation status, and approval status survive
- Security: secrets and credentials never persisted in database or configuration
"""

import json
import os
import shutil
import tempfile
import unittest

from app.schemas.persistence import ResearchRunRecord, LeadPersistenceRecord
from app.services.persistence_service import PersistenceService


class TestPersistenceService(unittest.TestCase):
    """Test suite covering persistence service operations, idempotency, and integrity."""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.temp_dir, "test_persistence.db")
        # Initialize PersistenceService in isolated temp DB without remote Supabase write
        self.service = PersistenceService(db_path=self.db_path, enable_supabase=False)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    # -------------------------------------------------------------------------
    # 1. Research Run Lifecycle
    # -------------------------------------------------------------------------

    def test_01_research_run_creation_and_lifecycle(self):
        """Test research run start, running state, and counter updates."""
        run = self.service.create_research_run(
            campaign_id="camp_dental_south_delhi",
            configuration={"niche": "dental", "geo": "South Delhi", "limit": 25},
        )
        self.assertIsNotNone(run.run_id)
        self.assertEqual(run.status, "running")
        self.assertEqual(run.campaign_id, "camp_dental_south_delhi")
        self.assertEqual(run.businesses_found, 0)
        self.assertIsNotNone(run.started_at)
        self.assertIsNone(run.completed_at)

        # Update counters
        updated = self.service.update_run_counters(
            run_id=run.run_id,
            queries_generated=3,
            businesses_found=15,
            businesses_filtered=2,
            businesses_triaged=13,
            businesses_researched=5,
            qualified_leads=4,
            total_tokens=1250,
            tool_calls=8,
            apify_calls=2,
        )
        self.assertIsNotNone(updated)
        self.assertEqual(updated.queries_generated, 3)
        self.assertEqual(updated.businesses_found, 15)
        self.assertEqual(updated.businesses_filtered, 2)
        self.assertEqual(updated.businesses_triaged, 13)
        self.assertEqual(updated.businesses_researched, 5)
        self.assertEqual(updated.qualified_leads, 4)
        self.assertEqual(updated.total_tokens, 1250)
        self.assertEqual(updated.tool_calls, 8)
        self.assertEqual(updated.apify_calls, 2)

        # Complete run
        completed = self.service.complete_research_run(run_id=run.run_id, status="completed")
        self.assertIsNotNone(completed)
        self.assertEqual(completed.status, "completed")
        self.assertIsNotNone(completed.completed_at)

    def test_02_research_run_failure_and_cancellation(self):
        """Test recording failed runs with structured errors, and cancelling runs."""
        # Failed run
        run1 = self.service.create_research_run(campaign_id="camp_fail_test")
        failed = self.service.fail_research_run(
            run_id=run1.run_id,
            error_message="Apify actor run timed out after 3 retries",
        )
        self.assertEqual(failed.status, "failed")
        self.assertIsNotNone(failed.completed_at)
        self.assertEqual(len(failed.errors), 1)
        self.assertIn("timed out", failed.errors[0]["error"])

        # Cancelled run
        run2 = self.service.create_research_run(campaign_id="camp_cancel_test")
        cancelled = self.service.cancel_research_run(run_id=run2.run_id)
        self.assertEqual(cancelled.status, "cancelled")
        self.assertIsNotNone(cancelled.completed_at)

    # -------------------------------------------------------------------------
    # 2. Lead Upsert & Idempotency
    # -------------------------------------------------------------------------

    def test_03_lead_creation_and_idempotent_deduplication(self):
        """Test lead creation and verified multi-key deduplication (URL, phone, normalized name)."""
        lead_payload = {
            "source_platform": "google_maps",
            "source_url": "https://maps.google.com/?cid=1001",
            "business_name": "Apex Dental Clinic Pvt Ltd",
            "phone_number": "+91 98101 23456",
            "website_url": "https://apexdental.com",
            "rating": 4.8,
            "review_count": 85,
            "prospect_score": 8,
            "audit_friction_points": ["No online booking flow"],
        }

        # 1. Create lead
        lead1 = self.service.upsert_lead(lead_payload)
        self.assertIsNotNone(lead1.id)
        self.assertEqual(lead1.business_name, "Apex Dental Clinic Pvt Ltd")
        self.assertEqual(lead1.phone_number, "+919810123456")

        # 2. Re-upsert identical URL with updated friction points -> MUST update existing row, NOT create duplicate
        re_upsert_payload = {
            "source_url": "https://maps.google.com/?cid=1001",
            "business_name": "Apex Dental Clinic",
            "audit_friction_points": ["No online booking flow", "Missing WhatsApp chat"],
            "opportunity_score": 78.5,
        }
        lead2 = self.service.upsert_lead(re_upsert_payload)
        self.assertEqual(lead2.id, lead1.id, "Re-upsert by URL must preserve existing ID")
        self.assertEqual(lead2.opportunity_score, 78.5)
        self.assertEqual(len(lead2.audit_friction_points), 2)

        # 3. Re-upsert with same phone number but different URL -> MUST match and update existing row
        phone_match_payload = {
            "source_url": "https://facebook.com/ads/apex-variant-2",
            "phone_number": "09810123456",  # Different format, normalizes to +919810123456
            "has_active_ads": True,
        }
        lead3 = self.service.upsert_lead(phone_match_payload)
        self.assertEqual(lead3.id, lead1.id, "Match by phone number must deduplicate to existing lead")
        self.assertTrue(lead3.has_active_ads)

        # 4. Re-upsert with normalized business name variation -> MUST match existing row
        name_match_payload = {
            "business_name": "Apex Dental",  # normalizes to 'apex' matching 'Apex Dental Clinic Pvt Ltd'
            "research_status": "partial",
        }
        lead4 = self.service.upsert_lead(name_match_payload)
        self.assertEqual(lead4.id, lead1.id, "Match by normalized business name must deduplicate to existing lead")
        self.assertEqual(lead4.research_status, "partial")

        # Verify total leads in database is exactly 1
        leads, total = self.service.list_leads()
        self.assertEqual(total, 1)

    # -------------------------------------------------------------------------
    # 3. Partial Research Persistence
    # -------------------------------------------------------------------------

    def test_04_partial_research_preservation(self):
        """Verify that when one specialist agent fails, successful agent outputs are preserved with status='partial'."""
        candidate = {
            "source_platform": "meta_ads",
            "source_url": "https://meta.com/ads/lumina-skin",
            "business_name": "Lumina Skin Care Studio",
            "phone_number": "+919876543210",
            "website_url": "https://luminaskin.in",
        }

        # Simulate: Website Agent succeeded, Ads Agent failed, Maps Agent succeeded
        specialist_results = {
            "website": {
                "status": "success",
                "evidence": [
                    {
                        "finding": "Hero CTA links only to phone dialer",
                        "source": "website",
                        "evidence": "href='tel:+919876543210'",
                        "confidence": 0.95,
                        "classification": "observed",
                    }
                ],
            },
            "ads": {
                "status": "failed",
                "error": "Meta Ad Library rate limit exceeded",
            },
            "maps": {
                "status": "success",
                "evidence": [
                    {
                        "finding": "4.9 rating across 310 Google reviews",
                        "source": "maps",
                        "evidence": "Google Places rating=4.9 reviews=310",
                        "confidence": 0.98,
                        "classification": "observed",
                    }
                ],
            },
        }

        lead = self.service.persist_research_cycle(
            candidate_data=candidate,
            specialist_results=specialist_results,
            opportunity_result={
                "opportunity_score": 82.0,
                "primary_problem": "High review volume with no direct chat conversion",
                "recommended_service": "whatsapp_automation",
                "why_this_service": "Captures high-intent patient inquiries instantly",
            },
            lead_analysis={
                "qualification_status": "qualified",
                "priority": "high",
                "research_status": "partial",
                "limitations": ["Meta Ads research unavailable due to rate limit"],
            },
        )

        self.assertEqual(lead.research_status, "partial")
        self.assertIn("website", lead.specialist_results)
        self.assertEqual(lead.specialist_results["ads"]["status"], "failed")
        self.assertEqual(lead.specialist_results["maps"]["status"], "success")
        self.assertEqual(len(lead.evidence), 2)
        self.assertEqual(lead.recommended_service, "whatsapp_automation")

    # -------------------------------------------------------------------------
    # 4. Evidence Classification Integrity
    # -------------------------------------------------------------------------

    def test_05_evidence_classification_integrity(self):
        """Strict invariant: observed, inferred, and unknown classifications are NEVER corrupted."""
        raw_evidence = [
            {
                "finding": "Website has no online booking form",
                "source": "website",
                "evidence": "Inspected all landing page anchors",
                "confidence": 0.95,
                "classification": "observed",
            },
            {
                "finding": "Business likely operates multiple staff shifts",
                "source": "website",
                "evidence": "Working hours 8am to 10pm listed",
                "confidence": 0.65,
                "classification": "inferred",
            },
            {
                "finding": "Average monthly ad spend could not be determined",
                "source": "ads",
                "evidence": "Meta Ad Library does not disclose regional budget",
                "confidence": 0.3,
                "classification": "unknown",
            },
        ]

        lead = self.service.upsert_lead({
            "source_platform": "google_maps",
            "source_url": "https://maps.google.com/?cid=evidence_test",
            "business_name": "Dr. Batra Clinic",
            "evidence": raw_evidence,
        })

        retrieved = self.service.get_lead(lead.id)
        self.assertIsNotNone(retrieved)
        ev_items = retrieved.evidence
        self.assertEqual(len(ev_items), 3)

        cls_map = {item["finding"]: item["classification"] for item in ev_items}
        self.assertEqual(cls_map["Website has no online booking form"], "observed")
        self.assertEqual(cls_map["Business likely operates multiple staff shifts"], "inferred")
        self.assertEqual(cls_map["Average monthly ad spend could not be determined"], "unknown")

        # Invariant: unknown is NEVER transformed to observed!
        self.assertNotEqual(cls_map["Average monthly ad spend could not be determined"], "observed")
        # Invariant: inferred is NEVER transformed to observed!
        self.assertNotEqual(cls_map["Business likely operates multiple staff shifts"], "observed")

    # -------------------------------------------------------------------------
    # 5. Outreach Persistence
    # -------------------------------------------------------------------------

    def test_06_outreach_persistence_and_approval_boundary(self):
        """Test outreach draft, deterministic validation, and human approval persistence."""
        draft_dict = {
            "message": "I noticed your clinic on Google Maps. Adding WhatsApp booking could help capture inquiries after hours.",
            "service": "whatsapp_automation",
            "confidence": 0.85,
            "status": "draft",
        }
        validation_dict = {
            "valid": True,
            "errors": [],
            "character_count": 105,
            "sentence_count": 2,
        }

        lead = self.service.upsert_lead({
            "source_platform": "google_maps",
            "source_url": "https://maps.google.com/?cid=outreach_test",
            "business_name": "Metro Smile Dental",
            "outreach_draft": draft_dict,
            "outreach_status": "awaiting_human_approval",
        })

        self.assertEqual(lead.outreach_status, "awaiting_human_approval")
        self.assertEqual(lead.outreach_draft["message"], draft_dict["message"])

        # Update to approved
        approved_lead = self.service.upsert_lead({
            "id": lead.id,
            "outreach_status": "approved",
            "outreach_draft": {**draft_dict, "approval_status": "approved"},
        })
        self.assertEqual(approved_lead.outreach_status, "approved")

        # Verify complete report output includes outreach
        report = self.service.get_lead_report(lead.id)
        self.assertIsNotNone(report)
        self.assertEqual(report.outreach["outreach_status"], "approved")
        self.assertFalse(report.outreach["external_send_executed"])

    # -------------------------------------------------------------------------
    # 6. Security & Credential Non-Leakage
    # -------------------------------------------------------------------------

    def test_07_security_redaction_invariant(self):
        """Verify secrets are redacted and never stored in research runs or returned in reports."""
        run = self.service.create_research_run(
            campaign_id="camp_sec_test",
            configuration={
                "niche": "hair_restoration",
                "api_key": "secret-super-key-12345",
                "apify_token": "apify-secret-token",
                "safe_param": "delhi",
            },
        )
        self.assertEqual(run.configuration["api_key"], "[REDACTED]")
        self.assertEqual(run.configuration["apify_token"], "[REDACTED]")
        self.assertEqual(run.configuration["safe_param"], "delhi")

        retrieved_run = self.service.get_research_run(run.run_id)
        self.assertNotIn("secret-super-key-12345", json.dumps(retrieved_run.configuration))
        self.assertNotIn("apify-secret-token", json.dumps(retrieved_run.configuration))

    def test_08_website_url_deduplication(self):
        """Verify that matching by normalized website_url deduplicates to existing record."""
        lead1 = self.service.upsert_lead({
            "source_platform": "google_maps",
            "source_url": "https://maps.google.com/?cid=web_dedup_1",
            "business_name": "Delhi Dental Studio",
            "website_url": "https://delhidentalstudio.in",
        })

        # Same website from Meta Ads with different source URL
        lead2 = self.service.upsert_lead({
            "source_platform": "meta_ads",
            "source_url": "https://facebook.com/ads/delhi-dental-ad",
            "business_name": "Delhi Dental",
            "website_url": "https://delhidentalstudio.in",
            "has_active_ads": True,
        })
        self.assertEqual(lead2.id, lead1.id, "Website URL match must deduplicate to existing lead")
        self.assertTrue(lead2.has_active_ads)

    def test_09_non_dict_specialist_results_in_report(self):
        """Verify that string error messages or lists in specialist results do not crash get_lead_report."""
        lead = self.service.upsert_lead({
            "source_platform": "google_maps",
            "source_url": "https://maps.google.com/?cid=non_dict_specs",
            "business_name": "Metro Clinic",
            "specialist_results": {
                "website": "Service temporarily unavailable: HTTP 503",
                "ads": ["failed: rate limit exceeded"],
                "maps": {"status": "success", "rating": 4.8},
            },
        })

        report = self.service.get_lead_report(lead.id)
        self.assertIsNotNone(report)
        # website string was coerced to dict with status and details
        self.assertEqual(report.specialists.website["status"], "recorded")
        self.assertIn("503", report.specialists.website["details"])
        # ads list was coerced to dict with items
        self.assertEqual(report.specialists.ads["items"], ["failed: rate limit exceeded"])
        # maps dict remained intact
        self.assertEqual(report.specialists.maps["status"], "success")

    def test_10_falsy_zero_scores_preserved(self):
        """Verify that explicit 0.0 scores are preserved and not replaced by prior falsy checks."""
        lead = self.service.upsert_lead({
            "source_platform": "google_maps",
            "source_url": "https://maps.google.com/?cid=zero_score_test",
            "business_name": "Zero Score Dental",
            "opportunity_score": 0.0,
            "confidence_score": 0.0,
        })
        self.assertEqual(lead.opportunity_score, 0.0)
        self.assertEqual(lead.confidence_score, 0.0)

        # Update other fields, keeping 0.0
        updated = self.service.upsert_lead({
            "id": lead.id,
            "business_name": "Zero Score Dental Updated",
            "opportunity_score": 0.0,
            "confidence_score": 0.0,
        })
        self.assertEqual(updated.opportunity_score, 0.0)
        self.assertEqual(updated.confidence_score, 0.0)

    def test_11_uuid_helper_and_supabase_sync_resilience(self):
        """Verify is_valid_uuid and to_valid_uuid helper functions produce valid deterministic RFC 4122 UUIDs."""
        from app.services.persistence_service import is_valid_uuid, to_valid_uuid

        valid_uuid = "96e058e0-6bd7-4df0-a457-bf75249ba809"
        self.assertTrue(is_valid_uuid(valid_uuid))
        self.assertEqual(to_valid_uuid(valid_uuid), valid_uuid)

        custom_id = "lead_live_test_1788979962921"
        self.assertFalse(is_valid_uuid(custom_id))
        converted = to_valid_uuid(custom_id)
        self.assertTrue(is_valid_uuid(converted))
        # Idempotent: repeated conversion yields same UUID
        self.assertEqual(to_valid_uuid(custom_id), converted)


if __name__ == "__main__":
    unittest.main()
