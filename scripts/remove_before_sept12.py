#!/usr/bin/env python3
"""Purge all runs and leads dated before September 12, 2026.

Retains everything from September 12, 2026 onwards in both local SQLite mirror
(data/leadpulse_v2.db) and remote Supabase PostgreSQL.
"""

from datetime import datetime, timezone
import os
from pathlib import Path
import sqlite3
import sys
from dotenv import load_dotenv

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "ai-worker"))

load_dotenv(ROOT_DIR / ".env.local")
load_dotenv(ROOT_DIR / ".env")

DB_PATH = str(ROOT_DIR / "data" / "leadpulse_v2.db")
CUTOFF_DATE = "2026-09-12"


def main():
    print(f"Connecting to SQLite database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Inspect and delete research runs before September 12th
    cursor.execute("""
        SELECT run_id, status, created_at, started_at
        FROM research_runs
        WHERE (created_at < ? OR started_at < ?)
          AND created_at NOT LIKE '2026-09-12%'
          AND started_at NOT LIKE '2026-09-12%'
        ORDER BY created_at DESC
    """, (CUTOFF_DATE, CUTOFF_DATE))
    runs_to_delete = cursor.fetchall()
    run_ids = [r[0] for r in runs_to_delete]

    print(f"\n[RESEARCH RUNS] Found {len(runs_to_delete)} runs dated before {CUTOFF_DATE}:")
    for r in runs_to_delete[:10]:
        print(f"  - [{r[1].upper()}] {r[0]} | created: {r[2]}")
    if len(runs_to_delete) > 10:
        print(f"  ... and {len(runs_to_delete) - 10} more runs.")

    # 2. Inspect and delete leads before September 12th
    cursor.execute("""
        SELECT id, business_name, created_at, research_status
        FROM leads
        WHERE created_at < ?
        ORDER BY created_at DESC
    """, (CUTOFF_DATE,))
    leads_to_delete = cursor.fetchall()
    lead_ids = [l[0] for l in leads_to_delete]

    print(f"\n[LEADS] Found {len(leads_to_delete)} leads dated before {CUTOFF_DATE}:")
    for l in leads_to_delete[:10]:
        print(f"  - {l[0]} | {l[1]} | created: {l[2]}")
    if len(leads_to_delete) > 10:
        print(f"  ... and {len(leads_to_delete) - 10} more leads.")

    # 3. Perform SQLite Deletions
    if run_ids:
        placeholders_r = ",".join(["?"] * len(run_ids))
        # Unlink any leads referencing deleted runs
        cursor.execute(f"UPDATE leads SET research_run_id = NULL WHERE research_run_id IN ({placeholders_r})", run_ids)
        cursor.execute(f"DELETE FROM research_runs WHERE run_id IN ({placeholders_r})", run_ids)
        print(f"\nDeleted {cursor.rowcount} research runs from SQLite.")

    if lead_ids:
        placeholders_l = ",".join(["?"] * len(lead_ids))
        cursor.execute(f"DELETE FROM leads WHERE id IN ({placeholders_l})", lead_ids)
        print(f"Deleted {cursor.rowcount} leads from SQLite.")

    conn.commit()

    # 4. Supabase Cleanup
    try:
        from app.services.persistence_service import get_persistence_service
        service = get_persistence_service()
        if service.supabase:
            print("\n[SUPABASE] Checking and purging remote records dated before September 12th...")

            # Purge runs in Supabase before cutoff
            for rid in run_ids:
                try:
                    service.supabase.table("research_runs").delete().eq("run_id", rid).execute()
                except Exception as e:
                    pass

            # Purge leads in Supabase before cutoff
            sb_del_res = service.supabase.table("leads").delete().lt("created_at", CUTOFF_DATE).execute()
            deleted_sb_leads = len(sb_del_res.data) if sb_del_res.data else 0
            print(f"Deleted {deleted_sb_leads} leads from Supabase where created_at < {CUTOFF_DATE}.")
        else:
            print("\n[SUPABASE] Client not active.")
    except Exception as e:
        print(f"[SUPABASE] Cleanup note: {e}")

    # 5. Verification of Remaining Records
    cursor.execute("SELECT run_id, status, created_at FROM research_runs ORDER BY created_at DESC")
    remaining_runs = cursor.fetchall()
    print(f"\n=== REMAINING RESEARCH RUNS ({len(remaining_runs)} total) ===")
    for r in remaining_runs:
        print(f"  - {r[0]} ({r[1]}) at {r[2]}")

    cursor.execute("SELECT count(*), min(created_at), max(created_at) FROM leads")
    leads_count, min_l, max_l = cursor.fetchone()
    print(f"\n=== REMAINING LEADS ({leads_count} total) ===")
    print(f"  Earliest lead created_at: {min_l}")
    print(f"  Latest lead created_at:   {max_l}")

    conn.close()
    print("\nCleanup completed successfully. Only September 12th onwards data remains.")


if __name__ == "__main__":
    main()
