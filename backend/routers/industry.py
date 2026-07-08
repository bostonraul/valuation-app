import asyncio
import json
import logging
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import httpx
from anthropic import Anthropic
from fastapi import APIRouter, HTTPException, Query
from supabase import Client, create_client

from data.industry_taxonomy import TAXONOMY
from data.industry_tickers import INDUSTRY_TICKERS

try:
    import yfinance as yf
except Exception:  # pragma: no cover
    yf = None


logger = logging.getLogger("industry-api")
router = APIRouter()

FMP_BASE = "https://financialmodelingprep.com/api/v3"
# Match valuation agent model (stable). Override with CLAUDE_MODEL if needed.
MODEL_NAME = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-20250514").strip() or "claude-sonnet-4-20250514"
ROOT = Path(__file__).resolve().parents[2]
SKILL_PATH = ROOT / "agents" / "04-model-builder" / "SKILL.md"
SKILL_FALLBACK_PATH = ROOT / "skills" / "dcf-model" / "SKILL.md"
PROFILE_CACHE_TTL = timedelta(days=7)
NEWS_CACHE_TTL = timedelta(hours=6)
MAX_NEWS_ENRICH = 8
MAX_PLAYERS = 8
FMP_CONCURRENCY = 4

INDUSTRY_CONTEXT = {
    "banking": """
India-specific banking context:
- Regulated by RBI. Key ratios: NIM, GNPA, NNPA, PCR, CRAR, CASA ratio
- Priority sector lending (PSL) mandates apply to all banks
- RBI's PCA framework triggers action on weak banks
- SARFAESI Act governs bad loan recovery
- Current NIM range for good private banks: 3.5-5%
- GNPA < 2% is excellent; > 5% is a red flag
- CASA ratio > 40% indicates low-cost funding advantage
""",
    "pharma": """
India-specific pharma context:
- India is the world's largest generic drug exporter (pharmacy of the world)
- USFDA approval is critical for US export revenues
- Import alerts and warning letters from USFDA = major risk event
- NPPA controls drug pricing in India
- Key metric: API vs formulation revenue mix, US/EU revenue as % of total
- R&D spend as % of revenue: 8-12% is healthy for innovators
- Domestic formulations = stable; US generics = volatile due to price erosion
""",
    "technology": """
India-specific technology context:
- IT services are export-oriented with major exposure to US and Europe.
- Key metrics: dollar revenue growth, EBIT margin, attrition, deal TCV.
- Rupee depreciation can boost margins; wage inflation hurts profitability.
- AI-led productivity and cloud migration are major structural tailwinds.
""",
    "consumer": """
India-specific consumer context:
- Growth driven by urban premiumization and rural demand cycles.
- Key metrics: volume growth, gross margin, ad-spend ratio, channel mix.
- GST, commodity inflation, and monsoon quality influence demand elasticity.
""",
    "real-estate": """
India-specific real estate context:
- RERA Act 2016 regulates developers — project registration mandatory
- Key metrics: pre-sales bookings, collections, unsold inventory, debt/equity
- Residential cycle = interest rate sensitive (home loan EMIs)
- NCLT/IBC process for stressed developers (key for distressed asset plays)
- Affordable housing gets government subsidies (PMAY scheme)
- REITs in India: Embassy, Mindspace, Brookfield — track DPU
""",
    "manufacturing": """
India-specific manufacturing context:
- Make in India and PLI schemes support capex-heavy sectors.
- Key metrics: capacity utilization, order backlog, EBITDA margin, ROCE.
- Export competitiveness is impacted by logistics costs and rupee movement.
""",
    "automobiles": """
India-specific automobile context:
- EV penetration is rising in 2W/3W; policy incentives drive adoption.
- Key metrics: dispatch growth, market share, realization per vehicle, dealer inventory.
- Commodity prices and financing rates significantly impact demand.
""",
    "energy": """
India-specific energy context:
- Mix of fossil fuels and accelerating renewable transition.
- Key metrics: plant load factor, refining GRM, transmission losses, regulated ROE.
- Regulatory framework includes PNGRB, CERC, and state discom policies.
""",
    "infrastructure": """
India-specific infrastructure context:
- Sector is policy-driven with long project cycles and execution risk.
- Key metrics: order book-to-sales, working capital days, BOT/HAM exposure.
- Public capex and state budget allocations are key demand drivers.
""",
    "metals-mining": """
India-specific metals and mining context:
- Highly cyclical and sensitive to global commodity prices.
- Key metrics: realization, cost per tonne, utilization, export share.
- Coal/iron ore linkages and environmental approvals affect supply.
""",
    "agri-plantations": """
India-specific agriculture and plantation context:
- Monsoon quality and MSP policy are central macro variables.
- Key metrics: acreage, yield, realization, inventory cycle.
- Input costs (fertilizer, fuel) and export restrictions influence margins.
""",
    "media-gaming": """
India-specific media/gaming context:
- Real Money Gaming (RMG) is heavily regulated — state-level bans matter
- Supreme Court judgements on games of skill vs chance are key
- 28% GST on online gaming deposits is a major cost headwind
- OTT metrics: MAU, paid subscribers, ARPU, content cost as % of revenue
- TV: TRAI regulations on channel pricing, must-carry rules
- Fantasy sports is legal; casino-style games are state-regulated
- Key risk: regulatory ban in large states
""",
    "telecom": """
India-specific telecom context:
- Market structure is concentrated; ARPU and subscriber quality are core.
- 5G rollout capex and spectrum liabilities shape free cash flow.
- Key metrics: ARPU, churn, data usage per subscriber, EBITDA margin.
""",
    "logistics": """
India-specific logistics context:
- E-commerce and formalization trends support organized logistics players.
- Key metrics: tonnage growth, yields, network utilization, fuel cost ratio.
- GST-driven hub consolidation remains a structural margin tailwind.
""",
    "consumer-durables": """
India-specific consumer durables context:
- Demand linked to income growth, replacement cycles, and festive seasonality.
- Key metrics: same-store growth, premium mix, warranty costs, channel inventory.
- Import dependence and currency movement affect gross margins.
""",
}

INDUSTRY_ANALYST_PROMPT = """
You are a senior India equity research analyst building industry intelligence packs.
Always respond with one valid JSON object only.
No markdown fences. No commentary. No trailing commas.
Use India-centric figures, regulators, tickers (.NS where relevant), and realistic ranges.
Prefer concise analyst language.
""".strip()


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _parse_iso(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
    except ValueError:
        return None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _read_system_prompt() -> str:
    skill_text = ""
    if SKILL_PATH.exists():
        skill_text = SKILL_PATH.read_text(encoding="utf-8")
    elif SKILL_FALLBACK_PATH.exists():
        # Don't dump the whole DCF skill — keep industry-focused base prompt short.
        skill_text = ""
    return "\n\n".join(filter(None, [INDUSTRY_ANALYST_PROMPT, skill_text]))


def _init_supabase() -> Client | None:
    supabase_url = _env("SUPABASE_URL")
    supabase_anon_key = _env("SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_anon_key:
        return None
    try:
        return create_client(supabase_url, supabase_anon_key)
    except Exception as exc:
        logger.warning("Supabase init failed for industry module: %s", exc)
        return None


anthropic_client = Anthropic(api_key=_env("ANTHROPIC_API_KEY")) if _env("ANTHROPIC_API_KEY") else None
supabase = _init_supabase()
FMP_API_KEY = _env("FMP_API_KEY")
SYSTEM_PROMPT_BASE = _read_system_prompt()
_fmp_sem = asyncio.Semaphore(FMP_CONCURRENCY)


async def _fmp_get(path: str, params: dict[str, Any] | None = None) -> Any:
    if not FMP_API_KEY:
        raise HTTPException(status_code=500, detail="FMP_API_KEY is not configured")
    payload = dict(params or {})
    payload["apikey"] = FMP_API_KEY
    async with _fmp_sem:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(f"{FMP_BASE}/{path.lstrip('/')}", params=payload)
            response.raise_for_status()
            return response.json()


def _industry_tickers(slug: str) -> list[str]:
    if slug in INDUSTRY_TICKERS:
        return INDUSTRY_TICKERS[slug]
    sub_tickers: list[str] = []
    for sub_slug in TAXONOMY.get(slug, {}).get("sub", []):
        sub_tickers.extend(INDUSTRY_TICKERS.get(sub_slug, []))
    deduped: list[str] = []
    seen: set[str] = set()
    for ticker in sub_tickers:
        if ticker not in seen:
            seen.add(ticker)
            deduped.append(ticker)
    return deduped[:20]


def _profile_cache_get(slug: str, *, allow_stale: bool = False) -> dict[str, Any] | None:
    if not supabase:
        return None
    try:
        row = (
            supabase.table("industry_profiles")
            .select("profile_data,fetched_at")
            .eq("slug", slug)
            .order("fetched_at", desc=True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.warning("profile cache get failed: %s", exc)
        return None
    if not row.data:
        return None
    item = row.data[0]
    data = item.get("profile_data")
    if not isinstance(data, dict):
        return None
    fetched_at = _parse_iso(item.get("fetched_at"))
    if allow_stale:
        return data
    if fetched_at and (_utc_now() - fetched_at) <= PROFILE_CACHE_TTL:
        return data
    return None


def _profile_cache_set(slug: str, profile_data: dict[str, Any]) -> None:
    if not supabase:
        return
    try:
        supabase.table("industry_profiles").upsert(
            {
                "slug": slug,
                "profile_data": profile_data,
                "fetched_at": _utc_now().isoformat(),
            },
            on_conflict="slug",
        ).execute()
    except Exception as exc:
        logger.warning("profile cache set failed: %s", exc)


def _news_cache_get(slug: str, *, allow_stale: bool = False) -> list[dict[str, Any]] | None:
    if not supabase:
        return None
    try:
        row = (
            supabase.table("industry_news")
            .select("enriched_data,fetched_at")
            .eq("slug", slug)
            .order("fetched_at", desc=True)
            .limit(MAX_NEWS_ENRICH)
            .execute()
        )
    except Exception as exc:
        logger.warning("news cache get failed: %s", exc)
        return None
    if not row.data:
        return None
    freshest = _parse_iso(row.data[0].get("fetched_at"))
    if not allow_stale:
        if not freshest or (_utc_now() - freshest) > NEWS_CACHE_TTL:
            return None
    return [entry.get("enriched_data", {}) for entry in row.data if entry.get("enriched_data")]


def _news_cache_set(slug: str, enriched_items: list[dict[str, Any]]) -> None:
    if not supabase or not enriched_items:
        return
    try:
        # Replace prior cache rows for this slug to avoid unbounded growth.
        supabase.table("industry_news").delete().eq("slug", slug).execute()
        rows = [
            {
                "slug": slug,
                "headline": item.get("headline"),
                "category": item.get("category"),
                "enriched_data": item,
                "published_at": item.get("date"),
                "fetched_at": _utc_now().isoformat(),
            }
            for item in enriched_items
        ]
        supabase.table("industry_news").insert(rows).execute()
    except Exception as exc:
        logger.warning("news cache set failed: %s", exc)


def _strip_fences(text: str) -> str:
    clean = text.strip()
    if clean.startswith("```"):
        lines = clean.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        clean = "\n".join(lines)
    return clean.strip()


def _fix_common_json_issues(text: str) -> str:
    # Remove trailing commas before } or ]
    text = re.sub(r",\s*([}\]])", r"\1", text)
    # Normalize smart quotes
    text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    return text


def _parse_json_text(text: str) -> dict[str, Any]:
    clean = _fix_common_json_issues(_strip_fences(text))
    start = clean.find("{")
    end = clean.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("Claude did not return a JSON object")
    return json.loads(clean[start : end + 1])


def _extract_text_blocks(response: Any) -> str:
    return "".join(block.text for block in response.content if getattr(block, "type", "") == "text")


def _run_claude_sync(system_prompt: str, user_prompt: str, max_tokens: int = 4500) -> str:
    if not anthropic_client:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    response = anthropic_client.messages.create(
        model=MODEL_NAME,
        max_tokens=max_tokens,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return _extract_text_blocks(response)


async def _claude_json(
    user_prompt: str,
    context_suffix: str = "",
    *,
    max_tokens: int = 4500,
) -> dict[str, Any]:
    system_prompt = SYSTEM_PROMPT_BASE + "\n\n" + context_suffix
    full_prompt = (
        user_prompt
        + "\n\nCRITICAL: Return ONE valid JSON object only. "
        "No markdown. No trailing commas. Double-quote all keys/strings."
    )

    def _call_and_parse() -> dict[str, Any]:
        raw = _run_claude_sync(system_prompt, full_prompt, max_tokens=max_tokens)
        try:
            return _parse_json_text(raw)
        except Exception as first_exc:
            logger.warning("Industry Claude JSON parse failed once: %s", first_exc)
            repair_raw = _run_claude_sync(
                "You repair invalid JSON. Output a single valid JSON object only.",
                "Fix commas/quotes/escaping and return valid JSON with the same keys:\n\n" + raw[:120000],
                max_tokens=max_tokens,
            )
            return _parse_json_text(repair_raw)

    return await asyncio.to_thread(_call_and_parse)


def _num(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _fallback_player_from_yf(ticker: str) -> dict[str, Any]:
    if yf is None:
        return {}
    try:
        info = yf.Ticker(ticker).info
    except Exception:
        return {}
    return {
        "name": info.get("longName") or ticker,
        "marketCap": info.get("marketCap"),
        "revenue": info.get("totalRevenue"),
        "ebitdaMargins": info.get("ebitdaMargins"),
        "trailingPE": info.get("trailingPE"),
        "debtToEquity": info.get("debtToEquity"),
    }


def _minimal_news_item(raw_item: dict[str, Any]) -> dict[str, Any]:
    title = raw_item.get("title", "")
    text = raw_item.get("text", "")
    source = raw_item.get("site", "")
    url = raw_item.get("url", "")
    published = raw_item.get("publishedDate", "")
    symbol = raw_item.get("symbol", "")
    return {
        "headline": title,
        "source": source,
        "date": (published or "")[:10],
        "url": url,
        "category": "Sector",
        "summary": (text or title)[:220],
        "who_is_buyer": {
            "name": "",
            "type": "",
            "aum_usd_bn": 0,
            "india_presence": "",
            "why_interested": "",
        },
        "who_is_target": {
            "name": symbol or "",
            "type": "Listed company",
            "loan_book_inr_cr": 0,
            "promoters": "",
            "why_being_sold": "",
        },
        "deal_details": {
            "value_usd_mn": 0,
            "value_inr_cr": 0,
            "structure": "",
            "co_investors": [],
        },
        "industry_implications": "Monitor sector impact.",
        "investment_angle": "Track earnings and multiple implications.",
        "related_tickers": [symbol] if symbol else [],
    }


@router.get("/list")
async def industry_list():
    return TAXONOMY


@router.get("/search")
async def industry_search(q: str = Query(..., min_length=3)):
    prompt = f"""
You are an India industry strategist.
Query: "{q}"

Return strict JSON:
{{
  "results": [
    {{"slug":"banking","reason":"One-line reason"}}
  ]
}}

Only include slugs from this taxonomy: {list(TAXONOMY.keys())}
Return max 6 results.
"""
    try:
        result = await _claude_json(prompt, max_tokens=800)
        rows = result.get("results", [])
        return {"query": q, "results": [r for r in rows if r.get("slug") in TAXONOMY][:6]}
    except Exception:
        ql = q.lower()
        fallback = []
        for slug, meta in TAXONOMY.items():
            haystack = " ".join([slug, meta["name"], *meta["sub"]]).lower()
            if any(word in haystack for word in ql.split()):
                fallback.append({"slug": slug, "reason": "Keyword overlap with your query."})
        return {"query": q, "results": fallback[:6]}


@router.get("/{slug}/profile")
async def industry_profile(slug: str):
    if slug not in TAXONOMY:
        raise HTTPException(status_code=404, detail="Industry slug not found")

    cached = _profile_cache_get(slug)
    if cached:
        return {**cached, "source": "cache"}

    industry_name = TAXONOMY[slug]["name"]
    tickers = _industry_tickers(slug)[:5]

    async def _snap(ticker: str) -> dict[str, Any] | None:
        try:
            snap = await _fmp_get(f"profile/{ticker}")
            if isinstance(snap, list) and snap:
                row = snap[0]
                return {
                    "ticker": ticker,
                    "name": row.get("companyName"),
                    "mktCap": row.get("mktCap"),
                    "sector": row.get("sector"),
                    "industry": row.get("industry"),
                    "description": (row.get("description") or "")[:180],
                }
        except Exception:
            return None
        return None

    snaps = [s for s in await asyncio.gather(*[_snap(t) for t in tickers]) if s]

    prompt = f"""
Build a complete India industry research pack for "{industry_name}" (slug: {slug}).

Sub-industries: {TAXONOMY[slug]["sub"]}
Listed player snapshots (use for major_players where useful): {json.dumps(snaps)[:3500]}

Return ONE JSON object with EXACTLY these top-level keys:
industry, slug, geography, overview, kpis, segments, major_players, customers, suppliers,
value_chain, geographies, regulations, jargon, investment_framework, filings_to_track.

Constraints for length/reliability:
- overview.description: 2 short paragraphs
- kpis: 6-8 items
- segments: cover taxonomy subs (merge if needed, max 8)
- major_players: 5-8
- jargon: 8-12 terms
- regulations: 1-3 regulators
- investment_framework.what_to_check_before_investing: 5-7
- filings_to_track: 3-5
- Use numbers as numbers, not strings
- slug must be "{slug}", geography must be "India", industry must be "{industry_name}"
"""

    try:
        result = await _claude_json(
            prompt,
            INDUSTRY_CONTEXT.get(slug, "India-specific context applies."),
            max_tokens=5000,
        )
        result["slug"] = slug
        result["industry"] = industry_name
        result["geography"] = "India"
        _profile_cache_set(slug, result)
        return {**result, "source": "live"}
    except Exception as exc:
        logger.exception("industry profile generation failed for %s", slug)
        stale = _profile_cache_get(slug, allow_stale=True)
        if stale:
            return {**stale, "source": "stale_cache", "warning": str(exc)}
        raise HTTPException(
            status_code=502,
            detail=f"Industry profile generation failed: {exc}",
        ) from exc


async def _fetch_raw_news(slug: str) -> list[dict[str, Any]]:
    tickers = _industry_tickers(slug)[:6]
    if not tickers:
        return []

    async def _one(ticker: str) -> list[dict[str, Any]]:
        try:
            payload = await _fmp_get("stock_news", {"tickers": ticker, "limit": 4})
            return payload if isinstance(payload, list) else []
        except Exception:
            return []

    batches = await asyncio.gather(*[_one(t) for t in tickers])
    items: list[dict[str, Any]] = [item for batch in batches for item in batch]
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for item in items:
        key = item.get("url") or item.get("title")
        if not key or key in seen:
            continue
        seen.add(str(key))
        deduped.append(item)
    return deduped[:MAX_NEWS_ENRICH]


async def _enrich_news_batch(slug: str, raw_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not raw_items:
        return []
    compact = [
        {
            "headline": r.get("title", ""),
            "snippet": (r.get("text") or "")[:280],
            "source": r.get("site", ""),
            "date": (r.get("publishedDate") or "")[:10],
            "url": r.get("url", ""),
            "symbol": r.get("symbol", ""),
        }
        for r in raw_items
    ]
    prompt = f"""
You are an Indian equity research news analyst for industry slug "{slug}".
Enrich EACH item in this list and return JSON:
{{
  "items": [ ... same length as input ... ]
}}

Each item must have:
headline, source, date (YYYY-MM-DD), url, category,
summary (2 sentences),
who_is_buyer {{name,type,aum_usd_bn,india_presence,why_interested}},
who_is_target {{name,type,loan_book_inr_cr,promoters,why_being_sold}},
deal_details {{value_usd_mn,value_inr_cr,structure,co_investors}},
industry_implications, investment_angle, related_tickers.

category one of: M&A | Capex | Fundraise | Regulatory | Results | Management | IPO | Sector
Unknown fields: empty string or 0.

INPUT:
{json.dumps(compact)}
"""
    try:
        result = await _claude_json(
            prompt,
            INDUSTRY_CONTEXT.get(slug, "India-specific context applies."),
            max_tokens=4500,
        )
        items = result.get("items")
        if isinstance(items, list) and items:
            return items[:MAX_NEWS_ENRICH]
    except Exception as exc:
        logger.warning("batch news enrich failed: %s", exc)
    return [_minimal_news_item(r) for r in raw_items]


@router.get("/{slug}/news")
async def industry_news(slug: str):
    if slug not in TAXONOMY and slug not in INDUSTRY_TICKERS:
        raise HTTPException(status_code=404, detail="Industry slug not found")

    cached = _news_cache_get(slug)
    if cached:
        return {"slug": slug, "items": cached, "source": "cache"}

    try:
        raw_news = await _fetch_raw_news(slug)
        enriched_items = await _enrich_news_batch(slug, raw_news)
        _news_cache_set(slug, enriched_items)
        return {"slug": slug, "items": enriched_items, "source": "live"}
    except Exception as exc:
        logger.exception("industry news failed for %s", slug)
        stale = _news_cache_get(slug, allow_stale=True)
        if stale:
            return {"slug": slug, "items": stale, "source": "stale_cache", "warning": str(exc)}
        raise HTTPException(status_code=502, detail=f"Industry news failed: {exc}") from exc


@router.get("/{slug}/ma-tracker")
async def industry_ma_tracker(slug: str):
    payload = await industry_news(slug)
    items = payload.get("items", [])
    one_year_ago = _utc_now() - timedelta(days=365)

    def _within_last_year(item: dict[str, Any]) -> bool:
        raw = item.get("date")
        if not raw:
            return True
        dt = _parse_iso(raw if "T" in str(raw) else f"{raw}T00:00:00+00:00")
        return bool(dt and dt >= one_year_ago)

    filtered = [
        item
        for item in items
        if item.get("category") in {"M&A", "Capex", "Fundraise", "Regulatory", "IPO"}
        and _within_last_year(item)
    ]
    return {"slug": slug, "items": filtered, "source": payload.get("source")}


async def _player_row(slug: str, ticker: str) -> dict[str, Any] | None:
    try:
        profile, quote, key_metrics, growth = await asyncio.gather(
            _fmp_get(f"profile/{ticker}"),
            _fmp_get(f"quote/{ticker}"),
            _fmp_get(f"key-metrics-ttm/{ticker}"),
            _fmp_get(f"financial-growth/{ticker}", {"limit": 1}),
        )
        p = profile[0] if isinstance(profile, list) and profile else {}
        q = quote[0] if isinstance(quote, list) and quote else {}
        m = key_metrics[0] if isinstance(key_metrics, list) and key_metrics else {}
        g = growth[0] if isinstance(growth, list) and growth else {}
        shares = _num(q.get("sharesOutstanding"))
        rev_per_share = _num(m.get("revenuePerShareTTM"))
        return {
            "ticker": ticker,
            "name": p.get("companyName") or q.get("name") or ticker,
            "market_cap_inr_cr": round(_num(q.get("marketCap")) / 10_000_000, 2),
            "revenue_inr_cr": round(rev_per_share * shares / 10_000_000, 2) if shares else 0,
            "revenue_growth_pct": round(_num(g.get("revenueGrowth")) * 100, 2),
            "ebitda_margin_pct": round(_num(m.get("ebitdaMarginTTM")) * 100, 2),
            "pe_ratio": round(_num(m.get("peRatioTTM"), _num(q.get("pe"))), 2),
            "ev_ebitda": round(_num(m.get("enterpriseValueOverEBITDATTM")), 2),
            "roic_pct": round(_num(m.get("roicTTM")) * 100, 2),
            "debt_equity": round(_num(m.get("debtToEquityTTM")), 2),
            "brief": (p.get("description") or "")[:140] or f"Key listed player in {slug}.",
        }
    except Exception:
        fallback = await asyncio.to_thread(_fallback_player_from_yf, ticker)
        if not fallback:
            return None
        return {
            "ticker": ticker,
            "name": fallback.get("name", ticker),
            "market_cap_inr_cr": round(_num(fallback.get("marketCap")) / 10_000_000, 2),
            "revenue_inr_cr": round(_num(fallback.get("revenue")) / 10_000_000, 2),
            "revenue_growth_pct": 0,
            "ebitda_margin_pct": round(_num(fallback.get("ebitdaMargins")) * 100, 2),
            "pe_ratio": round(_num(fallback.get("trailingPE")), 2),
            "ev_ebitda": 0,
            "roic_pct": 0,
            "debt_equity": round(_num(fallback.get("debtToEquity")), 2),
            "brief": f"Fallback fundamentals for {ticker}.",
        }


@router.get("/{slug}/players")
async def industry_players(slug: str):
    if slug not in TAXONOMY and slug not in INDUSTRY_TICKERS:
        raise HTTPException(status_code=404, detail="Industry slug not found")

    tickers = _industry_tickers(slug)[:MAX_PLAYERS]
    results = await asyncio.gather(*[_player_row(slug, t) for t in tickers])
    rows = [r for r in results if r]
    rows.sort(key=lambda x: x.get("market_cap_inr_cr", 0), reverse=True)
    for i, row in enumerate(rows, start=1):
        row["rank_in_industry"] = i
    return {"slug": slug, "players": rows}
