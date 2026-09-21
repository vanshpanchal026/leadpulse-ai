#!/usr/bin/env python3
"""Sync All SQLite Research Runs & Leads to Supabase PostgreSQL.

Bridges the local development database (data/leadpulse_v2.db) with the remote
Supabase database so that all local leads and research runs appear live on Vercel.
"""

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sqlite3
import sys
import uuid
from dotenv import load_dotenv
from supabase import create_client

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

ROOT_DIR = Path(__file__).resolve().parent.parent

# Load environment variables
load_dotenv(ROOT_DIR / ".env.local")
load_dotenv(ROOT_DIR / ".env")

DB_PATH = str(ROOT_DIR / "data" / "leadpulse_v2.db")

supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL") or os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not supabase_url or not supabase_key:
    print("ERROR: Supabase URL or Service Role Key missing.")
    sys.exit(1)

sb = create_client(supabase_url, supabase_key)

def is_valid_uuid(val: str) -> bool:
    if not val:
        return False
    try:
        u = uuid.UUID(str(val).strip())
        return str(u).lower() == str(val).strip().lower()
    except (ValueError, TypeError, AttributeError):
        return False

def to_valid_uuid(val: str) -> str:
    if is_valid_uuid(val):
        return str(val).strip().lower()
    if val:
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, str(val).strip()))
    return str(uuid.uuid4())

def main():
    print("=" * 60)
    print("Syncing all SQLite Data -> Supabase PostgreSQL")
    print("=" * 60)

    if not os.path.exists(DB_PATH):
        print(f"ERROR: DB not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # 1. Sync Research Runs
    cursor.execute("SELECT * FROM research_runs")
    runs = cursor.fetchall()
    print(f"\n1. Found {len(runs)} research runs in SQLite.")

    for r in runs:
        run_dict = dict(r)
        # Parse JSON fields if necessary
        for json_field in ["errors", "configuration"]:
            val = run_dict.get(json_field)
            if isinstance(val, str) and val.strip():
                try:
                    run_dict[json_field] = json.loads(val)
                except Exception:
                    run_dict[json_field] = {}

        try:
            sb.table("research_runs").upsert(run_dict, on_conflict="run_id").execute()
            print(f"  ✓ Upserted run: {run_dict['run_id']} ({run_dict.get('status')})")
        except Exception as e:
            print(f"  ❌ Failed to upsert run {run_dict.get('run_id')}: {e}")

    # 2. Sync Leads
    cursor.execute("SELECT * FROM leads")
    leads = cursor.fetchall()
    print(f"\n2. Found {len(leads)} leads in SQLite.")

    jsonb_cols = [
        "audit_friction_points",
        "evidence",
        "research_sources",
        "specialist_results",
        "lead_analysis",
        "outreach_draft",
        "token_usage",
    ]

    records_to_upsert = []
    for r in leads:
        lead_dict = dict(r)
        lead_dict["id"] = to_valid_uuid(lead_dict["id"])

        for col in jsonb_cols:
            val = lead_dict.get(col)
            if isinstance(val, str) and val.strip():
                try:
                    lead_dict[col] = json.loads(val)
                except Exception:
                    lead_dict[col] = None
            elif val is None or val == "":
                lead_dict[col] = None

        # Clean numeric fields
        if lead_dict.get("rating") is not None:
            try:
                lead_dict["rating"] = float(lead_dict["rating"])
            except Exception:
                lead_dict["rating"] = None

        if lead_dict.get("opportunity_score") is not None:
            try:
                lead_dict["opportunity_score"] = float(lead_dict["opportunity_score"])
            except Exception:
                lead_dict["opportunity_score"] = None

        records_to_upsert.append(lead_dict)

    # Upsert in chunks of 25
    chunk_size = 25
    success_count = 0
    for i in range(0, len(records_to_upsert), chunk_size):
        chunk = records_to_upsert[i : i + chunk_size]
        try:
            sb.table("leads").upsert(chunk, on_conflict="id").execute()
            success_count += len(chunk)
            print(f"  ✓ Upserted batch {i + 1} to {min(i + chunk_size, len(records_to_upsert))} leads.")
        except Exception as e:
            print(f"  ❌ Batch {i} error: {e}")
            # Try single lead insert to isolate failure
            for item in chunk:
                try:
                    sb.table("leads").upsert(item, on_conflict="id").execute()
                    success_count += 1
                except Exception as single_err:
                    print(f"    Failed single lead {item.get('business_name')}: {single_err}")

    print(f"\n✅ Total leads successfully synced to Supabase: {success_count} / {len(leads)}")

    # Verification
    res = sb.table("leads").select("id", count="exact").execute()
    supabase_count = res.count if hasattr(res, 'count') else len(res.data)
    print(f"📊 Final Supabase Lead Count: {supabase_count}")

if __name__ == "__main__":
    main()
