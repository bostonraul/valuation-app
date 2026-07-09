"""Shared Supabase client for FastAPI (Render)."""

from __future__ import annotations

import logging
import os

from supabase import Client, create_client

logger = logging.getLogger("valuation-api")


def _env(name: str) -> str:
    return os.getenv(name, "").strip()


def _pick_supabase_key() -> tuple[str | None, str]:
    """
    Return (api_key, key_kind).

    Render backend should use SUPABASE_SERVICE_ROLE_KEY (server-only).
    Legacy anon JWT (eyJ...) also works with supabase-py.

    sb_publishable_* keys are for browser clients and are NOT accepted by
    supabase-py — using them causes 'Invalid API key' at startup.
    """
    service = _env("SUPABASE_SERVICE_ROLE_KEY")
    if service:
        return service, "service_role"

    anon = _env("SUPABASE_ANON_KEY")
    if anon.startswith("sb_publishable_"):
        logger.warning(
            "SUPABASE_ANON_KEY is a publishable key (sb_publishable_...). "
            "supabase-py on the server cannot use it. "
            "On Render set SUPABASE_SERVICE_ROLE_KEY to your sb_secret_... key "
            "(Project Settings → API → secret key), or use the legacy anon JWT (eyJ...)."
        )
        return None, "publishable_rejected"

    if anon.startswith("eyJ"):
        return anon, "legacy_anon"

    if anon:
        return anon, "anon"

    return None, "missing"


def init_supabase() -> Client | None:
    url = _env("SUPABASE_URL")
    key, kind = _pick_supabase_key()

    placeholders = {"", "your-anon-key", "your-project.supabase.co"}
    if url in placeholders or not key:
        if kind == "publishable_rejected":
            logger.warning("Supabase disabled — replace publishable key with service role or legacy anon JWT")
        return None
    if not url.startswith("https://") or "supabase.co" not in url:
        logger.warning("SUPABASE_URL looks invalid — skipping Supabase")
        return None
    if len(key) < 20:
        logger.warning("Supabase API key looks too short — skipping Supabase")
        return None

    try:
        client = create_client(url, key)
        logger.info("Supabase connected (%s)", kind)
        return client
    except Exception as exc:
        logger.warning("Supabase client failed: %s — continuing without cache", exc)
        return None
