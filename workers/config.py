"""
workers/config.py
Centralised configuration loaded from environment variables.
Workers are designed to run as separate processes (or containers)
from the API server.
"""

import os
from dotenv import load_dotenv

# Load .env from the project root (two levels up from /workers)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))


class Config:
    DATABASE_URL: str = os.environ["DATABASE_URL"]

    # OpenAlex — no key required; add email for polite pool (higher rate limits)
    OPENALEX_EMAIL: str = os.getenv("OPENALEX_EMAIL", "")
    OPENALEX_BASE: str = "https://api.openalex.org"

    # ORCID public API (no auth needed for public records)
    ORCID_API_URL: str = os.getenv("ORCID_API_URL", "https://pub.orcid.org/v3.0")

    # Semantic Scholar (optional key for higher rate limits)
    S2_API_KEY: str = os.getenv("SEMANTIC_SCHOLAR_API_KEY", "")
    S2_BASE: str = "https://api.semanticscholar.org/graph/v1"

    # Worker settings
    POLL_INTERVAL_SECONDS: int = int(os.getenv("WORKER_POLL_INTERVAL", "10"))
    MAX_RETRIES: int = 3
    REQUEST_TIMEOUT: int = 30  # seconds per HTTP request


config = Config()
