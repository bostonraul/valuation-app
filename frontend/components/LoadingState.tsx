export function LoadingState({ ticker }: { ticker: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden
      >
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 animate-pulse rounded-full bg-emerald-500/15 blur-3xl" />
      </div>
      <div className="relative z-10">
        <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500" />
        <h2 className="text-2xl font-semibold text-white">
          Claude is building the DCF model…
        </h2>
        <p className="mt-2 text-zinc-400">
          Fetching {ticker} from FMP and running bear / base / bull scenarios.
        </p>
        <p className="mt-6 text-sm text-zinc-600">This usually takes 30–60 seconds.</p>
      </div>
    </div>
  );
}
