"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  IconBolt,
  IconBuildingBank,
  IconBuildingFactory,
  IconCar,
  IconCpu,
  IconHeartRateMonitor,
  IconHome,
  IconLeaf,
  IconPackage,
  IconPhone,
  IconPick,
  IconShoppingBag,
  IconTruck,
  IconVideo,
} from "@tabler/icons-react";
import { fetchIndustryList, searchIndustry, type IndustryTaxonomy } from "@/lib/industry";

const CARD_THEME: Record<string, string> = {
  banking: "border-blue-500/40 bg-blue-500/5",
  pharma: "border-emerald-500/40 bg-emerald-500/5",
  technology: "border-violet-500/40 bg-violet-500/5",
  consumer: "border-rose-400/40 bg-rose-400/5",
  "real-estate": "border-orange-500/40 bg-orange-500/5",
  manufacturing: "border-orange-400/40 bg-orange-400/5",
  automobiles: "border-amber-500/40 bg-amber-500/5",
  energy: "border-amber-400/40 bg-amber-400/5",
  infrastructure: "border-orange-600/40 bg-orange-600/5",
  "metals-mining": "border-orange-500/40 bg-orange-500/5",
  "agri-plantations": "border-lime-500/40 bg-lime-500/5",
  "media-gaming": "border-fuchsia-500/40 bg-fuchsia-500/5",
  telecom: "border-indigo-500/40 bg-indigo-500/5",
  logistics: "border-cyan-500/40 bg-cyan-500/5",
  "consumer-durables": "border-rose-500/40 bg-rose-500/5",
};

const ICON_BY_SLUG = {
  banking: IconBuildingBank,
  pharma: IconHeartRateMonitor,
  technology: IconCpu,
  consumer: IconShoppingBag,
  "real-estate": IconHome,
  manufacturing: IconBuildingFactory,
  automobiles: IconCar,
  energy: IconBolt,
  infrastructure: IconPackage,
  "metals-mining": IconPick,
  "agri-plantations": IconLeaf,
  "media-gaming": IconVideo,
  telecom: IconPhone,
  logistics: IconTruck,
  "consumer-durables": IconPackage,
} as const;

const TEASERS: Record<string, string> = {
  banking: "Credit cycle, deposit franchise, NIM and GNPA trends.",
  pharma: "Domestic formulations, USFDA pipeline, API leverage.",
  technology: "Global IT spend, deal wins, attrition and margins.",
  consumer: "Volume growth, premiumization, distribution intensity.",
  "real-estate": "Bookings, collections, inventory and leverage quality.",
  manufacturing: "Order books, capacity use, export competitiveness.",
  automobiles: "EV transition, mix shifts, financing-led demand.",
  energy: "Thermal-renewable mix, tariffs, upstream/downstream cycles.",
  infrastructure: "Policy capex, execution quality, working capital.",
  "metals-mining": "Commodity cycle beta, spread and utilization.",
  "agri-plantations": "Monsoon sensitivity, input costs, MSP impact.",
  "media-gaming": "Content economics, regulatory and user monetization.",
  telecom: "ARPU, capex intensity and spectrum overhang.",
  logistics: "Freight cycle, network utilization and yield discipline.",
  "consumer-durables": "Replacement cycle, import costs, festive demand.",
};

export default function IndustryDirectoryPage() {
  const [taxonomy, setTaxonomy] = useState<IndustryTaxonomy>({});
  const [query, setQuery] = useState("");
  const [semanticMatches, setSemanticMatches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIndustryList()
      .then(setTaxonomy)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load industries"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (query.trim().length < 6) {
      setSemanticMatches([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await searchIndustry(query);
        setSemanticMatches(res.results.map((r) => r.slug));
      } catch {
        setSemanticMatches([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const entries = Object.entries(taxonomy);
    if (!q) return entries;
    return entries.filter(([slug, meta]) => {
      const haystack = [slug, meta.name, ...meta.sub].join(" ").toLowerCase();
      return haystack.includes(q) || semanticMatches.includes(slug);
    });
  }, [taxonomy, query, semanticMatches]);

  return (
    <main className="min-h-screen bg-[#18192a] px-4 py-8 text-[#e0dedd] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.18em] text-[#e07d2a]">Industry Module</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#e0dedd] sm:text-4xl">
            India Industry Research
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[#8a8ca0] sm:text-base">
            Deep-dive industry intelligence — KPIs, players, M&A, regulations
          </p>
        </div>

        <div className="mb-8">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search industries or ask a question..."
            className="w-full rounded-xl border border-[#2a2c48] bg-[#1e2038] px-4 py-3 text-[#e0dedd] outline-none placeholder:text-[#8a8ca0] focus:border-[#e07d2a]"
          />
        </div>

        {loading && <p className="text-[#8a8ca0]">Loading industries...</p>}
        {error && <p className="text-red-300">{error}</p>}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {filtered.map(([slug, meta]) => {
            const Icon = ICON_BY_SLUG[slug as keyof typeof ICON_BY_SLUG] ?? IconBuildingFactory;
            return (
              <Link
                key={slug}
                href={`/industry/${slug}`}
                className={`rounded-xl border p-4 transition hover:border-[#e07d2a] ${CARD_THEME[slug] ?? "border-[#2a2c48] bg-[#1e2038]"}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <Icon size={22} stroke={1.8} className="text-[#e07d2a]" />
                  <span className="rounded-full border border-[#2a2c48] px-2 py-0.5 text-xs text-[#8a8ca0]">
                    {meta.sub.length} sub-industries
                  </span>
                </div>
                <h2 className="text-sm font-semibold text-[#e0dedd] sm:text-base">{meta.name}</h2>
                <p className="mt-2 line-clamp-2 text-xs text-[#8a8ca0] sm:text-sm">
                  {TEASERS[slug] ?? "Sector-focused research, KPIs, valuation signals and risks."}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
