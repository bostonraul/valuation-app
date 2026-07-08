import json
import os
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
except Exception:  # pragma: no cover - optional fallback dependency
    yf = None


router = APIRouter()

FMP_BASE = "https://financialmodelingprep.com/api/v3"
MODEL_NAME = "claude-sonnet-4-6"
ROOT = Path(__file__).resolve().parents[2]
SKILL_PATH = ROOT / "agents" / "04-model-builder" / "SKILL.md"
SKILL_FALLBACK_PATH = ROOT / "skills" / "dcf-model" / "SKILL.md"
PROFILE_CACHE_TTL = timedelta(days=7)
NEWS_CACHE_TTL = timedelta(hours=6)

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


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _parse_iso(ts: str | None) -> datetime | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except ValueError:
        return None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _read_system_prompt() -> str:
    skill_text = ""
    if SKILL_PATH.exists():
        skill_text = SKILL_PATH.read_text(encoding="utf-8")
    elif SKILL_FALLBACK_PATH.exists():
        skill_text = SKILL_FALLBACK_PATH.read_text(encoding="utf-8")
    return skill_text or "You are a senior India equity research analyst."


def _init_supabase() -> Client | None:
    supabase_url = _env("SUPABASE_URL")
    supabase_anon_key = _env("SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_anon_key:
        return None
    try:
        return create_client(supabase_url, supabase_anon_key)
    except Exception:
        return None


anthropic_client = Anthropic(api_key=_env("ANTHROPIC_API_KEY")) if _env("ANTHROPIC_API_KEY") else None
supabase = _init_supabase()
FMP_API_KEY = _env("FMP_API_KEY")
SYSTEM_PROMPT_BASE = _read_system_prompt()


async def _fmp_get(path: str, params: dict[str, Any] | None = None) -> Any:
    if not FMP_API_KEY:
        raise HTTPException(status_code=500, detail="FMP_API_KEY is not configured")
    payload = dict(params or {})
    payload["apikey"] = FMP_API_KEY
    async with httpx.AsyncClient(timeout=30.0) as client:
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


def _profile_cache_get(slug: str) -> dict[str, Any] | None:
    if not supabase:
        return None
    row = (
        supabase.table("industry_profiles")
        .select("profile_data,fetched_at")
        .eq("slug", slug)
        .order("fetched_at", desc=True)
        .limit(1)
        .execute()
    )
    if not row.data:
        return None
    item = row.data[0]
    fetched_at = _parse_iso(item.get("fetched_at"))
    if fetched_at and (_utc_now() - fetched_at) <= PROFILE_CACHE_TTL:
        return item.get("profile_data")
    return None


def _profile_cache_set(slug: str, profile_data: dict[str, Any]) -> None:
    if not supabase:
        return
    supabase.table("industry_profiles").upsert(
        {"slug": slug, "profile_data": profile_data, "fetched_at": _utc_now().isoformat()},
        on_conflict="slug",
    ).execute()


def _news_cache_get(slug: str) -> list[dict[str, Any]] | None:
    if not supabase:
        return None
    row = (
        supabase.table("industry_news")
        .select("enriched_data,fetched_at")
        .eq("slug", slug)
        .order("fetched_at", desc=True)
        .limit(20)
        .execute()
    )
    if not row.data:
        return None
    freshest = _parse_iso(row.data[0].get("fetched_at"))
    if not freshest or (_utc_now() - freshest) > NEWS_CACHE_TTL:
        return None
    return [entry.get("enriched_data", {}) for entry in row.data if entry.get("enriched_data")]


def _news_cache_set(slug: str, enriched_items: list[dict[str, Any]]) -> None:
    if not supabase or not enriched_items:
        return
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


def _parse_json_text(text: str) -> dict[str, Any]:
    clean = text.strip()
    if clean.startswith("```"):
        lines = clean.splitlines()
        clean = "\n".join(lines[1:-1] if lines and lines[-1].strip() == "```" else lines[1:])
    start = clean.find("{")
    end = clean.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("Claude did not return JSON")
    return json.loads(clean[start : end + 1])


def _extract_text_blocks(response: Any) -> str:
    return "".join(block.text for block in response.content if block.type == "text")


def _repair_json_candidates(raw: str) -> list[str]:
    candidates: list[str] = []
    clean = raw.strip()
    if clean.startswith("```"):
        lines = clean.splitlines()
        clean = "\n".join(lines[1:-1] if lines and lines[-1].strip() == "```" else lines[1:])
    candidates.append(clean)
    candidates.append(clean.replace("\t", "  "))
    return [c for c in candidates if c]


def _safe_json_loads(raw: str) -> dict[str, Any]:
    last_error: Exception | None = None
    for candidate in _repair_json_candidates(raw):
        try:
            return _parse_json_text(candidate)
        except Exception as exc:  # pragma: no cover - best effort parser
            last_error = exc
    if last_error:
        raise last_error
    raise ValueError("Unable to parse JSON output")


async def _claude_json(user_prompt: str, context_suffix: str = "") -> dict[str, Any]:
    if not anthropic_client:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY is not configured")
    system_prompt = SYSTEM_PROMPT_BASE + "\n\n" + context_suffix
    response = anthropic_client.messages.create(
        model=MODEL_NAME,
        max_tokens=5000,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": user_prompt
                + "\n\nReturn JSON only. No markdown, no commentary, no trailing commas.",
            }
        ],
    )
    raw = _extract_text_blocks(response)
    try:
        return _safe_json_loads(raw)
    except Exception:
        repair_response = anthropic_client.messages.create(
            model=MODEL_NAME,
            max_tokens=5000,
            system="You convert malformed JSON-like text into strict valid JSON. Return JSON only.",
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Convert this into strict valid JSON with the same keys and values, "
                        "fixing commas/quotes/escaping only:\n\n" + raw
                    ),
                }
            ],
        )
        repaired_raw = _extract_text_blocks(repair_response)
        return _safe_json_loads(repaired_raw)


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
        result = await _claude_json(prompt)
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
        return cached

    industry_name = TAXONOMY[slug]["name"]
    tickers = _industry_tickers(slug)[:8]
    profile_snaps = []
    for ticker in tickers:
        try:
            snap = await _fmp_get(f"profile/{ticker}")
            if isinstance(snap, list) and snap:
                profile_snaps.append(snap[0])
        except Exception:
            continue

    prompt = f"""
Create a complete India industry profile for slug "{slug}" ({industry_name}) using:
- taxonomy sub-industries: {TAXONOMY[slug]["sub"]}
- sample listed players snapshots: {json.dumps(profile_snaps)[:6000]}

Return strict JSON with this exact schema and keys:
{{
  "industry": "{industry_name}",
  "slug": "{slug}",
  "geography": "India",
  "overview": {{
    "description": "2-3 paragraph overview of the industry in India",
    "market_size_usd_bn": 0,
    "market_size_year": 2024,
    "cagr_5yr_pct": 0,
    "gdp_contribution_pct": 0,
    "employment_millions": 0
  }},
  "kpis": [{{"name":"", "abbr":"", "definition":"", "why_it_matters":"", "good_range":"", "red_flag":""}}],
  "segments": [{{"name":"", "description":"", "market_share_pct":0, "key_players":[""]}}],
  "major_players": [{{"name":"", "ticker":"", "type":"", "market_position":"", "market_cap_bn_inr":0}}],
  "customers": {{"description":"", "segments":[""]}},
  "suppliers": {{"description":"", "key_inputs":[""]}},
  "value_chain": ["Step 1 description", "Step 2 description"],
  "geographies": {{
    "dominant_states":[""],
    "export_orientation":"",
    "fdi_allowed_pct":0,
    "notes":""
  }},
  "regulations": [{{"regulator":"", "key_laws":[""], "key_compliance":"", "recent_changes":""}}],
  "jargon": [{{"term":"", "full_form":"", "definition":"", "used_in":""}}],
  "investment_framework": {{
    "what_to_check_before_investing":[{{"parameter":"", "metric":"", "why":"", "good_threshold":"", "red_flag":""}}],
    "valuation_multiples_used":[""],
    "cyclicality":"",
    "key_risks":[""]
  }},
  "filings_to_track": [{{"filing":"", "where":"", "what_to_look_for":""}}]
}}

Rules:
- Use realistic India-centric figures where possible.
- Keep output purely JSON, no markdown.
"""
    result = await _claude_json(prompt, INDUSTRY_CONTEXT.get(slug, "India-specific context applies."))
    _profile_cache_set(slug, result)
    return result


async def _fetch_raw_news(slug: str) -> list[dict[str, Any]]:
    tickers = _industry_tickers(slug)[:12]
    if not tickers:
        return []
    items: list[dict[str, Any]] = []
    for ticker in tickers:
        try:
            payload = await _fmp_get("stock_news", {"tickers": ticker, "limit": 5})
            if isinstance(payload, list):
                items.extend(payload)
        except Exception:
            continue
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for item in items:
        key = item.get("url") or item.get("title")
        if not key or key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped[:20]


async def _enrich_news_item(slug: str, raw_item: dict[str, Any]) -> dict[str, Any]:
    title = raw_item.get("title", "")
    text = raw_item.get("text", "")
    source = raw_item.get("site", "")
    url = raw_item.get("url", "")
    published = raw_item.get("publishedDate", "")
    symbol = raw_item.get("symbol", "")
    prompt = f"""
You are an Indian equity research news analyst.
Industry slug: {slug}

Raw news:
- headline: {title}
- snippet: {text}
- source: {source}
- date: {published}
- url: {url}
- symbol: {symbol}

Return strict JSON with keys:
{{
  "headline":"",
  "source":"",
  "date":"YYYY-MM-DD",
  "url":"",
  "category":"M&A",
  "summary":"2-sentence plain English summary",
  "who_is_buyer": {{
    "name":"","type":"","aum_usd_bn":0,"india_presence":"","why_interested":""
  }},
  "who_is_target": {{
    "name":"","type":"","loan_book_inr_cr":0,"promoters":"","why_being_sold":""
  }},
  "deal_details": {{
    "value_usd_mn":0,"value_inr_cr":0,"structure":"","co_investors":[]
  }},
  "industry_implications":"",
  "investment_angle":"",
  "related_tickers":[""]
}}

Category must be one of: M&A | Capex | Fundraise | Regulatory | Results | Management | IPO | Sector
If fields are unknown, keep neutral text and numeric fields as 0.
"""
    try:
        return await _claude_json(prompt, INDUSTRY_CONTEXT.get(slug, "India-specific context applies."))
    except Exception:
        return {
            "headline": title,
            "source": source,
            "date": (published or "")[:10],
            "url": url,
            "category": "Sector",
            "summary": text[:220] or "Latest sector development.",
            "who_is_buyer": {
                "name": "",
                "type": "",
                "aum_usd_bn": 0,
                "india_presence": "",
                "why_interested": "",
            },
            "who_is_target": {
                "name": symbol,
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
            "industry_implications": "Monitor second-order impact on sector valuations.",
            "investment_angle": "Track whether this changes earnings or valuation multiples.",
            "related_tickers": [symbol] if symbol else [],
        }


@router.get("/{slug}/news")
async def industry_news(slug: str):
    if slug not in TAXONOMY and slug not in INDUSTRY_TICKERS:
        raise HTTPException(status_code=404, detail="Industry slug not found")

    cached = _news_cache_get(slug)
    if cached:
        return {"slug": slug, "items": cached, "source": "cache"}

    raw_news = await _fetch_raw_news(slug)
    enriched_items = [await _enrich_news_item(slug, raw_item) for raw_item in raw_news]
    _news_cache_set(slug, enriched_items)
    return {"slug": slug, "items": enriched_items, "source": "live"}


@router.get("/{slug}/ma-tracker")
async def industry_ma_tracker(slug: str):
    payload = await industry_news(slug)
    items = payload.get("items", [])
    one_year_ago = _utc_now() - timedelta(days=365)

    def _within_last_year(item: dict[str, Any]) -> bool:
        dt = _parse_iso(item.get("date"))
        return bool(dt and dt >= one_year_ago)

    filtered = [
        item
        for item in items
        if item.get("category") in {"M&A", "Capex", "Fundraise", "Regulatory", "IPO"}
        and _within_last_year(item)
    ]
    return {"slug": slug, "items": filtered}


@router.get("/{slug}/players")
async def industry_players(slug: str):
    if slug not in TAXONOMY and slug not in INDUSTRY_TICKERS:
        raise HTTPException(status_code=404, detail="Industry slug not found")
    tickers = _industry_tickers(slug)
    rows: list[dict[str, Any]] = []
    for ticker in tickers[:20]:
        try:
            profile = await _fmp_get(f"profile/{ticker}")
            quote = await _fmp_get(f"quote/{ticker}")
            key_metrics = await _fmp_get(f"key-metrics-ttm/{ticker}")
            growth = await _fmp_get(f"financial-growth/{ticker}", {"limit": 1})

            p = profile[0] if isinstance(profile, list) and profile else {}
            q = quote[0] if isinstance(quote, list) and quote else {}
            m = key_metrics[0] if isinstance(key_metrics, list) and key_metrics else {}
            g = growth[0] if isinstance(growth, list) and growth else {}
            rows.append(
                {
                    "ticker": ticker,
                    "name": p.get("companyName") or q.get("name") or ticker,
                    "market_cap_inr_cr": round(float(q.get("marketCap", 0)) / 10_000_000, 2),
                    "revenue_inr_cr": round(float(m.get("revenuePerShareTTM", 0)) * float(q.get("sharesOutstanding", 0)) / 10_000_000, 2),
                    "revenue_growth_pct": round(float(g.get("revenueGrowth", 0)) * 100, 2),
                    "ebitda_margin_pct": round(float(m.get("ebitdaMarginTTM", 0)) * 100, 2),
                    "pe_ratio": round(float(m.get("peRatioTTM", q.get("pe", 0))), 2),
                    "ev_ebitda": round(float(m.get("enterpriseValueOverEBITDATTM", 0)), 2),
                    "roic_pct": round(float(m.get("roicTTM", 0)) * 100, 2),
                    "debt_equity": round(float(m.get("debtToEquityTTM", 0)), 2),
                    "brief": p.get("description", "")[:140] or f"Key listed player in {slug}.",
                }
            )
        except Exception:
            fallback = _fallback_player_from_yf(ticker)
            if fallback:
                rows.append(
                    {
                        "ticker": ticker,
                        "name": fallback.get("name", ticker),
                        "market_cap_inr_cr": round(float(fallback.get("marketCap", 0)) / 10_000_000, 2),
                        "revenue_inr_cr": round(float(fallback.get("revenue", 0)) / 10_000_000, 2),
                        "revenue_growth_pct": 0,
                        "ebitda_margin_pct": round(float(fallback.get("ebitdaMargins", 0)) * 100, 2),
                        "pe_ratio": round(float(fallback.get("trailingPE", 0) or 0), 2),
                        "ev_ebitda": 0,
                        "roic_pct": 0,
                        "debt_equity": round(float(fallback.get("debtToEquity", 0) or 0), 2),
                        "brief": f"Fallback fundamentals from Yahoo Finance for {ticker}.",
                    }
                )

    rows.sort(key=lambda x: x.get("market_cap_inr_cr", 0), reverse=True)
    for i, row in enumerate(rows, start=1):
        row["rank_in_industry"] = i
    return {"slug": slug, "players": rows}
