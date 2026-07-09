export type IndustryTaxonomy = Record<
  string,
  {
    name: string;
    sub: string[];
  }
>;

export type IndustryProfile = {
  industry: string;
  slug: string;
  geography: string;
  overview: {
    description: string;
    market_size_usd_bn: number;
    market_size_year: number;
    cagr_5yr_pct: number;
    gdp_contribution_pct: number;
    employment_millions: number;
  };
  kpis: Array<{
    name: string;
    abbr: string;
    definition: string;
    why_it_matters: string;
    good_range: string;
    red_flag: string;
  }>;
  segments: Array<{
    name: string;
    description: string;
    market_share_pct: number;
    key_players: string[];
  }>;
  major_players: Array<{
    name: string;
    ticker: string;
    type: string;
    market_position: string;
    market_cap_bn_inr: number;
  }>;
  customers: { description: string; segments: string[] };
  suppliers: { description: string; key_inputs: string[] };
  value_chain: string[];
  geographies: {
    dominant_states: string[];
    export_orientation: string;
    fdi_allowed_pct: number;
    notes: string;
  };
  regulations: Array<{
    regulator: string;
    key_laws: string[];
    key_compliance: string;
    recent_changes: string;
  }>;
  jargon: Array<{
    term: string;
    full_form: string;
    definition: string;
    used_in: string;
  }>;
  investment_framework: {
    what_to_check_before_investing: Array<{
      parameter: string;
      metric: string;
      why: string;
      good_threshold: string;
      red_flag: string;
    }>;
    valuation_multiples_used: string[];
    cyclicality: string;
    key_risks: string[];
  };
  filings_to_track: Array<{
    filing: string;
    where: string;
    what_to_look_for: string;
  }>;
};

export type IndustryNewsItem = {
  headline: string;
  source: string;
  date: string;
  url: string;
  category:
    | "M&A"
    | "Capex"
    | "Fundraise"
    | "Regulatory"
    | "Results"
    | "Management"
    | "IPO"
    | "Sector";
  summary: string;
  who_is_buyer: {
    name: string;
    type: string;
    aum_usd_bn: number;
    india_presence: string;
    why_interested: string;
  };
  who_is_target: {
    name: string;
    type: string;
    loan_book_inr_cr: number;
    promoters: string;
    why_being_sold: string;
  };
  deal_details: {
    value_usd_mn: number;
    value_inr_cr: number;
    structure: string;
    co_investors: string[];
  };
  industry_implications: string;
  investment_angle: string;
  related_tickers: string[];
};

export type IndustryPlayer = {
  ticker: string;
  name: string;
  market_cap_inr_cr: number;
  revenue_inr_cr: number;
  revenue_growth_pct: number;
  ebitda_margin_pct: number;
  pe_ratio: number;
  ev_ebitda: number;
  roic_pct: number;
  debt_equity: number;
  rank_in_industry: number;
  brief: string;
};

function getIndustryApiBase() {
  if (typeof window !== "undefined") return "";
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
    /\/$/,
    ""
  );
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      if (parsed?.detail) throw new Error(String(parsed.detail));
    } catch (err) {
      if (err instanceof Error && err.message && !err.message.includes("{")) {
        throw err;
      }
    }
    if (text.trim().startsWith("<") || text.includes("Bad Gateway")) {
      throw new Error(
        "Industry backend timed out while Claude was generating. Refresh in ~30s — cache will serve next time."
      );
    }
    throw new Error(text.slice(0, 280) || `Industry API failed (${res.status})`);
  }
  return res.json();
}

export async function fetchIndustryList(): Promise<IndustryTaxonomy> {
  const res = await fetch(`${getIndustryApiBase()}/api/industry/list`, {
    cache: "no-store",
  });
  return parseOrThrow<IndustryTaxonomy>(res);
}

export async function fetchIndustryProfile(slug: string): Promise<IndustryProfile> {
  const res = await fetch(`${getIndustryApiBase()}/api/industry/${slug}/profile`, {
    cache: "no-store",
  });
  return parseOrThrow<IndustryProfile>(res);
}

export async function fetchIndustryPlayers(
  slug: string
): Promise<{ slug: string; players: IndustryPlayer[] }> {
  const res = await fetch(`${getIndustryApiBase()}/api/industry/${slug}/players`, {
    cache: "no-store",
  });
  return parseOrThrow<{ slug: string; players: IndustryPlayer[] }>(res);
}

export async function fetchIndustryNews(
  slug: string,
  refresh = false
): Promise<{ slug: string; items: IndustryNewsItem[]; source: string }> {
  const res = await fetch(
    `${getIndustryApiBase()}/api/industry/${slug}/news${refresh ? "?refresh=true" : ""}`,
    { cache: "no-store" }
  );
  return parseOrThrow<{ slug: string; items: IndustryNewsItem[]; source: string }>(res);
}

export async function fetchIndustryMaTracker(
  slug: string
): Promise<{ slug: string; items: IndustryNewsItem[] }> {
  const res = await fetch(`${getIndustryApiBase()}/api/industry/${slug}/ma-tracker`, {
    cache: "no-store",
  });
  return parseOrThrow<{ slug: string; items: IndustryNewsItem[] }>(res);
}

export async function searchIndustry(
  query: string
): Promise<{ query: string; results: Array<{ slug: string; reason: string }> }> {
  const res = await fetch(
    `${getIndustryApiBase()}/api/industry/search?q=${encodeURIComponent(query)}`,
    { cache: "no-store" }
  );
  return parseOrThrow<{ query: string; results: Array<{ slug: string; reason: string }> }>(
    res
  );
}
