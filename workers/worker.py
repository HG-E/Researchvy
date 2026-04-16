"""
workers/worker.py
Main worker entrypoint — polls the database for PENDING sync jobs and processes them.

Architecture:
  - This is a simple polling worker, not a message queue consumer.
  - Simple is better for MVP: no Redis, no Bull, no infrastructure overhead.
  - When the queue grows, swap this for a Redis-backed Bull worker in Node.js.

Run with:
  python worker.py
  python worker.py --source ORCID       (process only ORCID jobs)
  python worker.py --source OPEN_ALEX   (process only OpenAlex jobs)
"""

import sys
import time
import signal
import argparse
import structlog
from config import config
from db import (
    get_connection,
    claim_pending_job,
    mark_job_complete,
    mark_job_failed,
    get_researcher,
    update_researcher_stats,
    upsert_publication,
    upsert_policy_mention,
)
from openalex_client import (
    make_client,
    find_author_by_orcid,
    fetch_author_works,
    fetch_policy_mentions,
)

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ]
)
log = structlog.get_logger()

# Global flag for graceful shutdown
_running = True


def handle_signal(signum, frame):
    global _running
    log.info("worker.shutdown_requested", signal=signum)
    _running = False


signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)


# ─────────────────────────────────────────────────────────────────────────────
# MAIN PROCESSING LOOP
# ─────────────────────────────────────────────────────────────────────────────

def process_openalex_job(job: dict, conn):
    """
    Fetches all publications for a researcher from OpenAlex,
    upserts them into the database, and triggers a score recompute.
    """
    researcher_id = job["researcherId"]
    job_id = job["id"]

    log.info("openalex_job.start", researcher_id=researcher_id, job_id=job_id)

    researcher = get_researcher(conn, researcher_id)
    if not researcher:
        raise ValueError(f"Researcher {researcher_id} not found")

    client = make_client()
    openalex_id = researcher.get("openAlexId")

    # If researcher doesn't have an OpenAlex ID yet, try to find it via ORCID
    if not openalex_id and researcher.get("orcidId"):
        log.info("openalex_job.finding_author", orcid=researcher["orcidId"])
        author = find_author_by_orcid(client, researcher["orcidId"])
        if author:
            openalex_id = author["openAlexId"]
            # Persist the resolved ID back to the researcher
            from db import cursor
            with cursor(conn) as cur:
                cur.execute(
                    'UPDATE "Researcher" SET "openAlexId" = %s WHERE id = %s',
                    (openalex_id, researcher_id)
                )
            log.info("openalex_job.author_found", openalex_id=openalex_id)

    if not openalex_id:
        raise ValueError(
            f"Could not resolve OpenAlex ID for researcher {researcher_id}. "
            "Ensure they have an ORCID connected."
        )

    # ── Fetch and upsert all works ─────────────────────────────────────────

    items_found = 0
    items_processed = 0
    all_citation_counts: list[int] = []
    publication_ids: dict[str, str] = {}  # openAlexId → DB id

    for work in fetch_author_works(client, openalex_id):
        items_found += 1

        try:
            pub_id = upsert_publication(conn, {
                "researcherId": researcher_id,
                "openAlexId": work["openAlexId"],
                "doi": work.get("doi"),
                "title": work["title"],
                "abstract": work.get("abstract"),
                "year": work.get("year"),
                "type": work["type"],
                "journalName": work.get("journalName"),
                "venueName": work.get("venueName"),
                "citationCount": work["citationCount"],
                "openAccess": work["openAccess"],
                "openAccessUrl": work.get("openAccessUrl"),
                "coAuthors": work.get("coAuthors", []),
                "source": "OPEN_ALEX",
                "rawData": work,
            })

            publication_ids[work["openAlexId"]] = pub_id
            all_citation_counts.append(work["citationCount"])
            items_processed += 1

        except Exception as e:
            log.warning("openalex_job.upsert_failed",
                        openalex_id=work.get("openAlexId"),
                        error=str(e))

        # Log progress every 50 papers
        if items_found % 50 == 0:
            log.info("openalex_job.progress",
                     found=items_found, processed=items_processed)

    # ── Fetch policy mentions for high-citation papers ─────────────────────
    # Only check papers with >5 citations to avoid too many API calls

    policy_count = 0
    for oalex_id, pub_db_id in publication_ids.items():
        citation_idx = list(publication_ids.keys()).index(oalex_id)
        if citation_idx < len(all_citation_counts) and all_citation_counts[citation_idx] > 5:
            try:
                mentions = fetch_policy_mentions(client, oalex_id)
                for mention in mentions:
                    upsert_policy_mention(conn, {
                        "publicationId": pub_db_id,
                        **mention,
                        "source": "open_alex",
                    })
                    policy_count += 1
            except Exception as e:
                log.warning("openalex_job.policy_fetch_failed",
                            openalex_id=oalex_id, error=str(e))

    log.info("openalex_job.policy_done", policy_mentions=policy_count)

    # ── Update researcher stats ────────────────────────────────────────────

    total_citations = sum(all_citation_counts)
    h_index = _compute_h_index(sorted(all_citation_counts, reverse=True))

    update_researcher_stats(
        conn,
        researcher_id=researcher_id,
        h_index=h_index,
        total_citations=total_citations,
        pub_count=items_processed,
    )

    mark_job_complete(conn, job_id, items_found, items_processed)

    log.info("openalex_job.complete",
             researcher_id=researcher_id,
             publications=items_processed,
             h_index=h_index,
             total_citations=total_citations)


def _compute_h_index(sorted_citations: list[int]) -> int:
    """Computes h-index from a descending-sorted list of citation counts."""
    h = 0
    for i, citations in enumerate(sorted_citations):
        if citations >= i + 1:
            h = i + 1
        else:
            break
    return h


# ─────────────────────────────────────────────────────────────────────────────
# WORKER LOOP
# ─────────────────────────────────────────────────────────────────────────────

HANDLERS = {
    "OPEN_ALEX": process_openalex_job,
    # ORCID sync is done inline in the API (simpler for MVP)
    # Add handlers here when you need dedicated workers for other sources
}


def run_worker(source_filter: str | None = None):
    sources = [source_filter] if source_filter else list(HANDLERS.keys())
    log.info("worker.started", sources=sources, poll_interval=config.POLL_INTERVAL_SECONDS)

    while _running:
        did_work = False

        for source in sources:
            if source not in HANDLERS:
                continue

            conn = get_connection()
            try:
                job = claim_pending_job(conn, source)
                if not job:
                    continue

                did_work = True
                log.info("worker.job_claimed", job_id=job["id"], source=source)

                try:
                    HANDLERS[source](job, conn)
                except Exception as e:
                    log.error("worker.job_failed", job_id=job["id"], error=str(e))
                    mark_job_failed(conn, job["id"], str(e))

            finally:
                conn.close()

        # Only sleep if no work was found — prevents idle waiting when queue is full
        if not did_work:
            time.sleep(config.POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Researchvy data sync worker")
    parser.add_argument(
        "--source",
        choices=list(HANDLERS.keys()),
        default=None,
        help="Process only jobs for this source (default: all)",
    )
    args = parser.parse_args()

    run_worker(source_filter=args.source)
