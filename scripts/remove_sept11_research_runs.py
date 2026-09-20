#!/usr/bin/env python3
"""Delete all Research Runs for September 11, 2026.

This script deletes all research run records created or started on September 11, 2026
from both the local SQLite mirror (data/leadpulse_v2.db) and Supabase (if present).
"""

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


def main():
    print(f"Connecting to SQLite database: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Find runs created or started on 2026-09-11
    cursor.execute("""
        SELECT run_id, campaign_id, status, started_at, created_at
        FROM research_runs
        WHERE started_at LIKE '2026-09-11%' OR created_at LIKE '2026-09-11%'
        ORDER BY created_at DESC
    """)
    runs_to_delete = cursor.fetchall()

    print(f"Found {len(runs_to_delete)} research runs recorded for September 11, 2026:")
    run_ids = []
    for r in runs_to_delete:
        run_id, camp_id, status, started_at, created_at = r
        run_ids.append(run_id)
        print(f"  - [{status.upper()}] {run_id} | started: {started_at} | created: {created_at}")

    if not run_ids:
        print("No research runs found for September 11, 2026. Nothing to delete.")
        return

    # Check if any leads point to these runs
    placeholders = ",".join(["?"] * len(run_ids))
    cursor.execute(f"SELECT COUNT(*) FROM leads WHERE research_run_id IN ({placeholders})", run_ids)
    linked_leads = cursor.fetchone()[0]
    print(f"Linked leads in leads table: {linked_leads}")

    if linked_leads > 0:
        cursor.execute(f"UPDATE leads SET research_run_id = NULL WHERE research_run_id IN ({placeholders})", run_ids)
        print(f"Unlinked {linked_leads} leads from deleted research runs.")

    # Delete from SQLite
    cursor.execute(f"DELETE FROM research_runs WHERE run_id IN ({placeholders})", run_ids)
    conn.commit()
    print(f"Successfully deleted {cursor.rowcount} research runs from SQLite database.")

    # Also clean up from Supabase if present
    try:
        from app.services.persistence_service import get_persistence_service
        service = get_persistence_service()
        if service.supabase:
            print("Checking Supabase for corresponding research runs...")
            for rid in run_ids:
                try:
                    res = service.supabase.table("research_runs").delete().eq("run_id", rid).execute()
                    if res.data:
                        print(f"  - Deleted {rid} from Supabase")
                except Exception as sub_err:
                    print(f"  - Supabase notice for {rid}: {sub_err}")
            print("Supabase check completed.")
        else:
            print("Supabase client not active or not configured.")
    except Exception as e:
        print(f"Note on Supabase sync: {e}")

    # Verify remaining runs in SQLite
    cursor.execute("SELECT run_id, status, started_at FROM research_runs ORDER BY created_at DESC")
    remaining = cursor.fetchall()
    print(f"\nRemaining research runs in SQLite ({len(remaining)} total):")
    for rem in remaining[:15]:
        print(f"  - {rem[0]} ({rem[1]}) at {rem[2]}")

    conn.close()
    print("\nDeletion complete.")


if __name__ == "__main__":
    main()
