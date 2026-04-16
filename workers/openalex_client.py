"""
workers/openalex_client.py
OpenAlex API client for the Python worker.
Mirrors the TypeScript service in apps/api/src/services/openalex.ts
but runs as a long-lived polling worker.

OpenAlex docs: https://docs.openalex.org
"""

import time
import httpx
from typing import Generator
from config import config
import structlog

log = structlog.get_logger()

# ─────────────────────────────────────────────────────────────────────────────
# HTTP CLIENT
# Shared client with retry logic and the "polite pool" User-Agent header.
# ─────────────────────────────────────────────────────────────────────────────

def make_client() -> httpx.Client:
    email = config.OPENALEX_EMAIL
    headers = {
        "User-Agent": f"Researchvy/1.0 (mailto:{email})" if email else "Researchvy/1.0",
    }
    return httpx.Client(
        base_url=config.OPENALEX_BASE,
        headers=headers,
        timeout=config.REQUEST_TIMEOUT,
    )


def _get_json(client: httpx.Client, path: str, params: dict) -> dict:
    """Makes a GET request with simple retry logic for transient failures."""
    if config.OPENALEX_EMAIL:
        params["mailto"] = config.OPENALEX_EMAIL

    for attempt in range(config.MAX_RETRIES):
        try:
            resp = client.get(path, params=params)

            # 429 = rate limited — back off and retry
            if resp.status_code == 429:
                wait = 2 ** attempt
                log.warning("openalex.rate_limited", wait_seconds=wait)
                time.sleep(wait)
                continue

            resp.raise_for_status()
            return resp.json()

        except httpx.RequestError as e:
            if attempt == config.MAX_RETRIES - 1:
                raise
            log.warning("openalex.request_error", error=str(e), attempt=attempt)
            time.sleep(2 ** attempt)

    return {}


# ─────────────────────────────────────────────────────────────────────────────
# AUTHOR LOOKUP
# ─────────────────────────────────────────────────────────────────────────────

def find_author_by_orcid(client: httpx.Client, orcid_id: str) -> dict | None:
    """Looks up an OpenAlex author by ORCID. Returns None if not found."""
    data = _get_json(client, "/authors", {
        "filter": f"orcid:{orcid_id}",
        "select": "id,display_name,summary_stats,last_known_institution",
    })
    results = data.get("results", [])
    if not results:
        return None
    return _parse_author(results[0])


def _parse_author(raw: dict) -> dict:
    raw_id: str = raw.get("id", "")
    return {
        "openAlexId": raw_id.replace("https://openalex.org/", ""),
        "displayName": raw.get("display_name", ""),
        "hIndex": (raw.get("summary_stats") or {}).get("h_index", 0),
        "citationsCount": (raw.get("summary_stats") or {}).get("cited_by_count", 0),
        "institution": (raw.get("last_known_institution") or {}).get("display_name"),
    }


# ─────────────────────────────────────────────────────────────────────────────
# WORKS (PUBLICATIONS)
# ─────────────────────────────────────────────────────────────────────────────

WORK_SELECT_FIELDS = ",".join([
    "id", "doi", "title", "abstract_inverted_index",
    "publication_year", "type", "cited_by_count",
    "open_access", "primary_location", "authorships",
])


def fetch_author_works(client: httpx.Client, openalex_author_id: str) -> Generator[dict, None, None]:
    """
    Generator that yields parsed work dicts for all publications by an author.
    Uses cursor-based pagination to handle authors with hundreds of papers.
    """
    cursor = "*"
    page = 0

    while True:
        data = _get_json(client, "/works", {
            "filter": f"author.id:{openalex_author_id}",
            "select": WORK_SELECT_FIELDS,
            "per_page": "100",
            "cursor": cursor,
        })

        results = data.get("results", [])
        if not results:
            break

        for raw in results:
            yield _parse_work(raw)

        next_cursor = (data.get("meta") or {}).get("next_cursor")
        if not next_cursor:
            break

        cursor = next_cursor
        page += 1

        # Be polite — small delay between pages
        if page % 5 == 0:
            time.sleep(0.5)


def _reconstruct_abstract(inverted_index: dict | None) -> str | None:
    """
    OpenAlex stores abstracts as inverted word→position maps.
    We reconstruct the sentence by sorting positions.
    """
    if not inverted_index:
        return None

    positions: list[tuple[int, str]] = []
    for word, pos_list in inverted_index.items():
        for pos in pos_list:
            positions.append((pos, word))

    positions.sort(key=lambda x: x[0])
    return " ".join(word for _, word in positions)


_WORK_TYPE_MAP = {
    "article": "JOURNAL_ARTICLE",
    "proceedings-article": "CONFERENCE_PAPER",
    "book-chapter": "BOOK_CHAPTER",
    "book": "BOOK",
    "preprint": "PREPRINT",
    "dissertation": "THESIS",
    "dataset": "DATASET",
    "report": "REPORT",
}


def _parse_work(raw: dict) -> dict:
    raw_id: str = raw.get("id", "")
    doi = raw.get("doi", "")
    if doi:
        doi = doi.replace("https://doi.org/", "").lower()

    open_access = raw.get("open_access") or {}
    primary_location = raw.get("primary_location") or {}
    source = primary_location.get("source") or {}

    co_authors = []
    for authorship in raw.get("authorships", []):
        author = authorship.get("author") or {}
        name = author.get("display_name", "")
        if name:
            orcid = author.get("orcid", "")
            if orcid:
                orcid = orcid.replace("https://orcid.org/", "")
            oalex_id = author.get("id", "").replace("https://openalex.org/", "")
            co_authors.append({
                "name": name,
                "openAlexId": oalex_id or None,
                "orcidId": orcid or None,
            })

    return {
        "openAlexId": raw_id.replace("https://openalex.org/", ""),
        "doi": doi or None,
        "title": raw.get("title") or "Untitled",
        "abstract": _reconstruct_abstract(raw.get("abstract_inverted_index")),
        "year": raw.get("publication_year"),
        "type": _WORK_TYPE_MAP.get(raw.get("type", ""), "OTHER"),
        "citationCount": raw.get("cited_by_count", 0),
        "openAccess": open_access.get("is_oa", False),
        "openAccessUrl": open_access.get("oa_url"),
        "journalName": source.get("display_name"),
        "venueName": source.get("display_name"),
        "coAuthors": co_authors,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POLICY MENTIONS
# ─────────────────────────────────────────────────────────────────────────────

def fetch_policy_mentions(client: httpx.Client, openalex_work_id: str) -> list[dict]:
    """
    Fetches policy documents that cite the given work.
    Uses OpenAlex concept filtering for policy-type sources.
    """
    data = _get_json(client, "/works", {
        "filter": ",".join([
            f"cites:{openalex_work_id}",
            "primary_location.source.type:repository",
            "concepts.id:C2779455604",  # OpenAlex "Policy" concept
        ]),
        "select": "id,title,doi,publication_year,primary_location",
        "per_page": "50",
    })

    mentions = []
    for raw in data.get("results", []):
        primary = (raw.get("primary_location") or {})
        source = (primary.get("source") or {})
        doi = raw.get("doi", "")
        url = f"https://doi.org/{doi}" if doi else primary.get("landing_page_url")

        mentions.append({
            "policyTitle": raw.get("title") or "Untitled Policy Document",
            "policyUrl": url,
            "policyType": "OTHER",
            "year": raw.get("publication_year"),
            "organization": source.get("display_name"),
            "country": None,
        })

    return mentions
