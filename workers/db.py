"""
workers/db.py
Minimal database access layer for the Python worker.
Uses psycopg2 (synchronous) — workers don't need async for their simple polling loop.
"""

import contextlib
import psycopg2
import psycopg2.extras
from config import config
import structlog

log = structlog.get_logger()


def get_connection():
    """Returns a new psycopg2 connection. Caller is responsible for closing it."""
    conn = psycopg2.connect(config.DATABASE_URL)
    conn.autocommit = False
    return conn


@contextlib.contextmanager
def cursor(conn=None):
    """Context manager that yields a DictCursor and handles commit/rollback."""
    own_conn = conn is None
    conn = conn or get_connection()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        if own_conn:
            conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# SYNC JOB QUERIES
# ─────────────────────────────────────────────────────────────────────────────

def claim_pending_job(conn, source: str) -> dict | None:
    """
    Atomically claims the next PENDING sync job for a given source.
    Uses SELECT ... FOR UPDATE SKIP LOCKED to prevent two workers
    from picking up the same job (safe for multi-process deployments).
    """
    with cursor(conn) as cur:
        cur.execute("""
            UPDATE "SyncJob"
            SET status = 'RUNNING', "startedAt" = NOW()
            WHERE id = (
                SELECT id FROM "SyncJob"
                WHERE status = 'PENDING' AND source = %s
                ORDER BY "createdAt" ASC
                LIMIT 1
                FOR UPDATE SKIP LOCKED
            )
            RETURNING *
        """, (source,))
        return cur.fetchone()


def mark_job_complete(conn, job_id: str, items_found: int, items_processed: int):
    with cursor(conn) as cur:
        cur.execute("""
            UPDATE "SyncJob"
            SET status = 'COMPLETED',
                "completedAt" = NOW(),
                "itemsFound" = %s,
                "itemsProcessed" = %s
            WHERE id = %s
        """, (items_found, items_processed, job_id))


def mark_job_failed(conn, job_id: str, error: str):
    with cursor(conn) as cur:
        cur.execute("""
            UPDATE "SyncJob"
            SET status = 'FAILED',
                "completedAt" = NOW(),
                error = %s
            WHERE id = %s
        """, (error[:1000], job_id))  # Truncate to fit DB column


# ─────────────────────────────────────────────────────────────────────────────
# RESEARCHER QUERIES
# ─────────────────────────────────────────────────────────────────────────────

def get_researcher(conn, researcher_id: str) -> dict | None:
    with cursor(conn) as cur:
        cur.execute('SELECT * FROM "Researcher" WHERE id = %s', (researcher_id,))
        return cur.fetchone()


def update_researcher_stats(conn, researcher_id: str, h_index: int, total_citations: int, pub_count: int):
    with cursor(conn) as cur:
        cur.execute("""
            UPDATE "Researcher"
            SET "hIndex" = %s,
                "totalCitations" = %s,
                "publicationCount" = %s,
                "lastSyncedAt" = NOW(),
                "updatedAt" = NOW()
            WHERE id = %s
        """, (h_index, total_citations, pub_count, researcher_id))


# ─────────────────────────────────────────────────────────────────────────────
# PUBLICATION QUERIES
# ─────────────────────────────────────────────────────────────────────────────

def upsert_publication(conn, data: dict) -> str:
    """
    Upserts a publication by openAlexId or DOI.
    Returns the publication's DB id.
    """
    import json
    with cursor(conn) as cur:
        cur.execute("""
            INSERT INTO "Publication" (
                id, "researcherId", "openAlexId", doi, title, abstract,
                year, type, "journalName", "venueName",
                "citationCount", "openAccess", "openAccessUrl",
                "coAuthors", source, "rawData", "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid()::text, %(researcherId)s, %(openAlexId)s, %(doi)s,
                %(title)s, %(abstract)s, %(year)s, %(type)s::\"PublicationType\",
                %(journalName)s, %(venueName)s, %(citationCount)s, %(openAccess)s,
                %(openAccessUrl)s, %(coAuthors)s::jsonb, %(source)s::\"DataSource\",
                %(rawData)s::jsonb, NOW(), NOW()
            )
            ON CONFLICT ("openAlexId") DO UPDATE SET
                "citationCount" = EXCLUDED."citationCount",
                "openAccess" = EXCLUDED."openAccess",
                "openAccessUrl" = EXCLUDED."openAccessUrl",
                "updatedAt" = NOW()
            RETURNING id
        """, {
            **data,
            "coAuthors": json.dumps(data.get("coAuthors", [])),
            "rawData": json.dumps(data.get("rawData", {})),
        })
        row = cur.fetchone()
        return row["id"] if row else ""


def upsert_policy_mention(conn, data: dict):
    with cursor(conn) as cur:
        cur.execute("""
            INSERT INTO "PolicyMention" (
                id, "publicationId", "policyTitle", "policyUrl",
                "policyType", country, year, organization, source, "createdAt"
            ) VALUES (
                gen_random_uuid()::text, %(publicationId)s, %(policyTitle)s, %(policyUrl)s,
                %(policyType)s::\"PolicyDocumentType\", %(country)s, %(year)s,
                %(organization)s, %(source)s, NOW()
            )
            ON CONFLICT DO NOTHING
        """, data)
