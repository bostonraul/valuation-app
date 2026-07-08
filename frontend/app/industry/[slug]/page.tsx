"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  fetchIndustryNews,
  fetchIndustryPlayers,
  fetchIndustryProfile,
  type IndustryNewsItem,
  type IndustryPlayer,
  type IndustryProfile,
} from "@/lib/industry";
import { useEffect } from "react";

type TabKey =
  | "overview"
  | "kpis"
  | "players"
  | "investment"
  | "news"
  | "regulations"
  | "jargon"
  | "segments";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "kpis", label: "KPIs" },
  { key: "players", label: "Players" },
  { key: "investment", label: "Investment Guide" },
  { key: "news", label: "M&A & News" },
  { key: "regulations", label: "Regulations" },
  { key: "jargon", label: "Jargon Glossary" },
  { key: "segments", label: "Segments" },
];

const NEWS_FILTERS = ["All", "M&A", "Capex", "Fundraise", "Regulatory", "Results"] as const;
type NewsFilter = (typeof NEWS_FILTERS)[number];

const CATEGORY_COLORS: Record<string, string> = {
  "M&A": "bg-blue-500/15 text-blue-300 border-blue-500/35",
  Capex: "bg-amber-500/15 text-amber-300 border-amber-500/35",
  Fundraise: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35",
  Regulatory: "bg-red-500/15 text-red-300 border-red-500/35",
  Results: "bg-violet-500/15 text-violet-300 border-violet-500/35",
  Management: "bg-cyan-500/15 text-cyan-300 border-cyan-500/35",
  IPO: "bg-indigo-500/15 text-indigo-300 border-indigo-500/35",
  Sector: "bg-zinc-500/15 text-zinc-300 border-zinc-500/35",
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function fmtCr(v: number | undefined) {
  if (!v) return "NA";
  return `₹${Math.round(v).toLocaleString("en-IN")} Cr`;
}

function fmtPct(v: number | undefined) {
  if (v === undefined || Number.isNaN(v)) return "NA";
  return `${v.toFixed(1)}%`;
}

function useIndustryData(slug: string) {
  const [profile, setProfile] = useState<IndustryProfile | null>(null);
  const [players, setPlayers] = useState<IndustryPlayer[]>([]);
  const [news, setNews] = useState<IndustryNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([fetchIndustryProfile(slug), fetchIndustryPlayers(slug), fetchIndustryNews(slug)])
      .then(([profileData, playerData, newsData]) => {
        if (!mounted) return;
        setProfile(profileData);
        setPlayers(playerData.players ?? []);
        setNews(newsData.items ?? []);
      })
      .catch((e) => {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : "Failed to load industry data");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [slug]);

  return { profile, players, news, loading, error };
}

export default function IndustrySlugPage() {
  const params = useParams();
  const slug = String(params.slug ?? "");
  const [tab, setTab] = useState<TabKey>("overview");
  const [newsFilter, setNewsFilter] = useState<NewsFilter>("All");
  const [expandedNews, setExpandedNews] = useState<string | null>(null);
  const [jargonQuery, setJargonQuery] = useState("");
  const [sortBy, setSortBy] = useState<keyof IndustryPlayer>("market_cap_inr_cr");
  const [sortAsc, setSortAsc] = useState(false);
  const [activeSub, setActiveSub] = useState<string | null>(null);
  const { profile, players, news, loading, error } = useIndustryData(slug);

  const sortedPlayers = useMemo(() => {
    const copy = [...players];
    copy.sort((a, b) => {
      const av = a[sortBy] as number | string;
      const bv = b[sortBy] as number | string;
      if (typeof av === "number" && typeof bv === "number") {
        return sortAsc ? av - bv : bv - av;
      }
      return sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [players, sortBy, sortAsc]);

  const filteredNews = useMemo(
    () => news.filter((n) => newsFilter === "All" || n.category === newsFilter),
    [news, newsFilter]
  );

  const filteredJargon = useMemo(() => {
    if (!profile?.jargon) return [];
    const q = jargonQuery.trim().toLowerCase();
    return profile.jargon.filter((item) => {
      if (!q) return true;
      return `${item.term} ${item.definition} ${item.full_form} ${item.used_in}`
        .toLowerCase()
        .includes(q);
    });
  }, [profile?.jargon, jargonQuery]);

  if (loading) {
    return <main className="min-h-screen bg-[#18192a] p-8 text-[#8a8ca0]">Loading industry...</main>;
  }
  if (error || !profile) {
    return <main className="min-h-screen bg-[#18192a] p-8 text-red-300">{error ?? "No data"}</main>;
  }

  return (
    <main className="min-h-screen bg-[#18192a] px-4 py-6 text-[#e0dedd] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-2xl border border-[#2a2c48] bg-[#1e2038] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[#8a8ca0]">India · Industry</p>
              <h1 className="mt-1 text-2xl font-semibold text-[#e07d2a] sm:text-[28px]">
                {profile.industry}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.segments.map((segment) => (
                  <button
                    key={segment.name}
                    type="button"
                    onClick={() =>
                      setActiveSub(
                        activeSub === segment.name.toLowerCase() ? null : segment.name.toLowerCase()
                      )
                    }
                    className="rounded-full border border-[#e07d2a] px-3 py-1 text-xs text-[#e0dedd] hover:bg-[#e07d2a]/15"
                  >
                    {segment.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[#2a2c48] bg-[#18192a] px-4 py-3 text-right">
              <p className="text-xs uppercase text-[#8a8ca0]">Market Snapshot</p>
              <p className="mt-1 text-lg font-semibold text-[#e0dedd]">
                ₹{Math.round(profile.overview.market_size_usd_bn * 83 * 100).toLocaleString("en-IN")} Cr
                {" "}market
              </p>
            </div>
          </div>
        </header>

        <div className="mt-4 flex flex-wrap gap-2">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setTab(entry.key)}
              className={`rounded-lg border px-3 py-2 text-sm transition ${
                tab === entry.key
                  ? "border-[#e07d2a] bg-[#e07d2a]/20 text-[#e0dedd]"
                  : "border-[#2a2c48] bg-[#1e2038] text-[#8a8ca0] hover:text-[#e0dedd]"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        <section className="mt-4 rounded-2xl border border-[#2a2c48] bg-[#1e2038] p-5">
          {tab === "overview" && (
            <div className="space-y-4 text-sm">
              <p className="whitespace-pre-line text-[#c7c6d6]">{profile.overview.description}</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard label="Market Size (USD Bn)" value={profile.overview.market_size_usd_bn} />
                <MetricCard label="5Y CAGR" value={`${profile.overview.cagr_5yr_pct}%`} />
                <MetricCard label="GDP Contribution" value={`${profile.overview.gdp_contribution_pct}%`} />
                <MetricCard label="Employment" value={`${profile.overview.employment_millions} Mn`} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#e0dedd]">Value Chain</h3>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-[#c7c6d6]">
                  {profile.value_chain.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#e0dedd]">Geographies</h3>
                <p className="mt-2 text-[#c7c6d6]">
                  Dominant states: {profile.geographies.dominant_states.join(", ")}
                </p>
                <p className="text-[#c7c6d6]">Export orientation: {profile.geographies.export_orientation}</p>
                <p className="text-[#c7c6d6]">FDI allowed: {profile.geographies.fdi_allowed_pct}%</p>
                <p className="text-[#8a8ca0]">{profile.geographies.notes}</p>
              </div>
            </div>
          )}

          {tab === "kpis" && (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {profile.kpis.map((kpi) => (
                <article key={kpi.name} className="rounded-xl border border-[#2a2c48] bg-[#18192a] p-4">
                  <p className="text-xs text-[#8a8ca0]">{kpi.abbr}</p>
                  <h3 className="text-base font-semibold text-[#e07d2a]">{kpi.name}</h3>
                  <p className="mt-2 text-sm text-[#c7c6d6]">{kpi.definition}</p>
                  <p className="mt-2 text-xs text-[#8a8ca0]">{kpi.why_it_matters}</p>
                  <p className="mt-3 rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                    Good: {kpi.good_range}
                  </p>
                  <p className="mt-1 rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">
                    Red flag: {kpi.red_flag}
                  </p>
                </article>
              ))}
            </div>
          )}

          {tab === "players" && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#2a2c48] text-[#8a8ca0]">
                    {[
                      ["name", "Company"],
                      ["market_cap_inr_cr", "Market Cap"],
                      ["revenue_inr_cr", "Revenue"],
                      ["revenue_growth_pct", "Revenue Growth"],
                      ["ebitda_margin_pct", "Margin"],
                      ["pe_ratio", "P/E"],
                      ["roic_pct", "ROIC"],
                    ].map(([key, label]) => (
                      <th key={key} className="cursor-pointer px-3 py-2" onClick={() => {
                        const typed = key as keyof IndustryPlayer;
                        setSortAsc(sortBy === typed ? !sortAsc : false);
                        setSortBy(typed);
                      }}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayers.map((player) => (
                    <tr key={player.ticker} className="border-b border-[#2a2c48]/60">
                      <td className="px-3 py-3">
                        <Link href={`/${player.ticker}`} className="text-[#e0dedd] hover:text-[#e07d2a]">
                          {player.rank_in_industry <= 3 && (
                            <span className="mr-2 rounded bg-[#e07d2a]/20 px-1.5 py-0.5 text-xs text-[#e07d2a]">
                              {player.rank_in_industry}
                            </span>
                          )}
                          {player.name}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-[#c7c6d6]">{fmtCr(player.market_cap_inr_cr)}</td>
                      <td className="px-3 py-3 text-[#c7c6d6]">{fmtCr(player.revenue_inr_cr)}</td>
                      <td className="px-3 py-3 text-[#c7c6d6]">{fmtPct(player.revenue_growth_pct)}</td>
                      <td className="px-3 py-3 text-[#c7c6d6]">{fmtPct(player.ebitda_margin_pct)}</td>
                      <td className="px-3 py-3 text-[#c7c6d6]">{player.pe_ratio.toFixed(1)}</td>
                      <td className="px-3 py-3 text-[#c7c6d6]">{fmtPct(player.roic_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === "investment" && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                {profile.investment_framework.what_to_check_before_investing.map((item) => (
                  <article key={item.parameter} className="rounded-xl border border-[#2a2c48] bg-[#18192a] p-4">
                    <h3 className="font-semibold text-[#e07d2a]">{item.parameter}</h3>
                    <p className="text-sm text-[#8a8ca0]">Metric: {item.metric}</p>
                    <p className="mt-2 text-sm text-[#c7c6d6]">{item.why}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <p className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300">
                        Good: {item.good_threshold}
                      </p>
                      <p className="rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300">
                        Red flag: {item.red_flag}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
              <div>
                <h3 className="font-semibold text-[#e0dedd]">Valuation multiples used in this sector</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.investment_framework.valuation_multiples_used.map((m) => (
                    <span key={m} className="rounded-full border border-[#2a2c48] px-3 py-1 text-xs text-[#e0dedd]">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-[#e0dedd]">Key risks</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {profile.investment_framework.key_risks.map((risk) => (
                    <p key={risk} className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-200">
                      {risk}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "news" && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {NEWS_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setNewsFilter(filter)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      newsFilter === filter
                        ? "border-[#e07d2a] bg-[#e07d2a]/20 text-[#e0dedd]"
                        : "border-[#2a2c48] text-[#8a8ca0]"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {filteredNews.map((item, index) => {
                  const key = `${item.headline}-${index}`;
                  const expanded = expandedNews === key;
                  return (
                    <article key={key} className="rounded-xl border border-[#2a2c48] bg-[#18192a] p-4">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.Sector}`}>
                          {item.category}
                        </span>
                        <span className="text-xs text-[#8a8ca0]">{item.date} · {item.source}</span>
                      </div>
                      <h3 className="text-base font-semibold text-[#e0dedd]">{item.headline}</h3>
                      <p className="mt-2 text-sm text-[#c7c6d6]">{item.summary}</p>
                      <button
                        type="button"
                        onClick={() => setExpandedNews(expanded ? null : key)}
                        className="mt-2 text-xs text-[#e07d2a] hover:underline"
                      >
                        {expanded ? "Hide buyer/seller details" : "Who is the buyer / seller?"}
                      </button>
                      {expanded && (
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-[#2a2c48] p-3 text-xs text-[#c7c6d6]">
                            <p className="mb-1 font-semibold text-[#e0dedd]">Buyer</p>
                            <p>{item.who_is_buyer.name}</p>
                            <p>{item.who_is_buyer.type}</p>
                            <p>{item.who_is_buyer.why_interested}</p>
                          </div>
                          <div className="rounded-lg border border-[#2a2c48] p-3 text-xs text-[#c7c6d6]">
                            <p className="mb-1 font-semibold text-[#e0dedd]">Target / Seller</p>
                            <p>{item.who_is_target.name}</p>
                            <p>{item.who_is_target.type}</p>
                            <p>{item.who_is_target.why_being_sold}</p>
                          </div>
                        </div>
                      )}
                      <div className="mt-3 rounded-lg border border-[#e07d2a]/30 bg-[#e07d2a]/10 p-3 text-sm text-[#f2c08e]">
                        <p className="font-semibold">Investment angle</p>
                        <p>{item.investment_angle}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.related_tickers?.map((ticker) => (
                          <Link
                            key={ticker}
                            href={`/${ticker}`}
                            className="rounded-full border border-[#2a2c48] px-2 py-0.5 text-xs text-[#8a8ca0] hover:text-[#e0dedd]"
                          >
                            {ticker}
                          </Link>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "regulations" && (
            <div className="grid gap-3 md:grid-cols-2">
              {profile.regulations.map((reg) => (
                <article key={reg.regulator} className="rounded-xl border border-[#2a2c48] bg-[#18192a] p-4">
                  <h3 className="font-semibold text-[#e07d2a]">{reg.regulator}</h3>
                  <p className="mt-2 text-xs uppercase text-[#8a8ca0]">Key laws</p>
                  <ul className="list-disc pl-5 text-sm text-[#c7c6d6]">
                    {reg.key_laws.map((law) => (
                      <li key={law}>{law}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm text-[#c7c6d6]">{reg.key_compliance}</p>
                  <p className="mt-2 text-xs text-[#8a8ca0]">{reg.recent_changes}</p>
                </article>
              ))}
            </div>
          )}

          {tab === "jargon" && (
            <div className="space-y-4">
              <input
                value={jargonQuery}
                onChange={(e) => setJargonQuery(e.target.value)}
                placeholder="Search terms..."
                className="w-full rounded-lg border border-[#2a2c48] bg-[#18192a] px-3 py-2 text-sm text-[#e0dedd] outline-none"
              />
              <div className="flex flex-wrap gap-1 text-xs text-[#8a8ca0]">
                {ALPHABET.map((letter) => (
                  <a key={letter} href={`#jargon-${letter}`} className="hover:text-[#e0dedd]">
                    {letter}
                  </a>
                ))}
              </div>
              <div className="space-y-3">
                {filteredJargon.map((item) => (
                  <article
                    key={item.term}
                    id={`jargon-${item.term.charAt(0).toUpperCase()}`}
                    className="rounded-xl border border-[#2a2c48] bg-[#18192a] p-4"
                  >
                    <h3 className="text-base font-semibold text-[#e07d2a]">
                      {item.term} <span className="text-xs text-[#8a8ca0]">({item.full_form})</span>
                    </h3>
                    <p className="mt-1 text-sm text-[#c7c6d6]">{item.definition}</p>
                    <p className="mt-1 text-xs text-[#8a8ca0]">Used in: {item.used_in}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {tab === "segments" && (
            <div className="grid gap-3 md:grid-cols-2">
              {profile.segments
                .filter((s) =>
                  activeSub ? s.name.toLowerCase().includes(activeSub.replaceAll("-", " ")) : true
                )
                .map((segment) => (
                  <article key={segment.name} className="rounded-xl border border-[#2a2c48] bg-[#18192a] p-4">
                    <h3 className="font-semibold text-[#e07d2a]">{segment.name}</h3>
                    <p className="mt-2 text-sm text-[#c7c6d6]">{segment.description}</p>
                    <p className="mt-2 text-xs text-[#8a8ca0]">Market share: {segment.market_share_pct}%</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {segment.key_players.map((p) => (
                        <span key={p} className="rounded-full border border-[#2a2c48] px-2 py-0.5 text-xs text-[#8a8ca0]">
                          {p}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[#2a2c48] bg-[#18192a] p-3">
      <p className="text-xs text-[#8a8ca0]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#e0dedd]">{value}</p>
    </div>
  );
}
