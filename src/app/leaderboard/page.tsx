import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getParentBenchScores, getParentBenchMethodology, getParentBenchModelCount, getParentBenchLastUpdated } from "@/lib/parentbench";
import { getAllModels } from "@/lib/data";
import { HeroSection } from "@/components/parentbench/hero-section";
import { LeaderboardTable } from "@/components/parentbench/leaderboard-table";
import { MethodologyVersionPill } from "@/components/parentbench/methodology-version-pill";
import {
  SurfaceTabStrip,
  surfaceFromQuery,
} from "@/components/parentbench/surface-tab-strip";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "See how every major AI assistant ranks on the ParentBench child-safety benchmark.",
};

export const revalidate = 60;

type LeaderboardPageProps = {
  searchParams: Promise<{ surface?: string | string[] }>;
};

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const resolvedParams = await searchParams;
  const activeSurface = surfaceFromQuery(resolvedParams.surface);

  const [scores, methodology, modelCount, lastUpdated, models] = await Promise.all([
    getParentBenchScores(activeSurface),
    getParentBenchMethodology(),
    getParentBenchModelCount(activeSurface),
    getParentBenchLastUpdated(activeSurface),
    getAllModels(),
  ]);

  const testCaseTotal = Object.values(methodology.testCaseCounts).reduce((sum, count) => sum + count, 0);
  const modelInfoMap = new Map(models.map((model) => [model.slug, model]));
  const providers = [...new Set(models.map((model) => model.provider.name))].sort();
  const enrichedScores = scores.map((score) => {
    const modelInfo = modelInfoMap.get(score.modelSlug);
    return {
      ...score,
      modelName: modelInfo?.name ?? score.modelSlug,
      provider: modelInfo?.provider ?? {
        name: "Unknown",
        slug: "unknown",
        logo: "/logos/unknown.svg",
      },
    };
  });

  const isWebTab = activeSurface === "web-product";

  return (
    <div>
      <HeroSection modelCount={modelCount} testCaseCount={testCaseTotal} lastUpdated={lastUpdated} />

      <section className="mx-auto max-w-7xl px-4 py-10">
        <SurfaceTabStrip active={activeSurface} />

        {isWebTab && enrichedScores.length === 0 ? (
          <WebTabEmptyState />
        ) : (
          <LeaderboardTable scores={enrichedScores} providers={providers} />
        )}
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-12">
        <div className="flex items-center justify-center gap-2 text-muted">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <Link
            href="/methodology"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
          >
            Read about the methodology
          </Link>
          <MethodologyVersionPill version={methodology.version} />
        </div>
      </div>
    </div>
  );
}

/**
 * "Refresh in motion" empty state for the Web tab. Reads as an
 * inviting status board, not an apology. The pulse-dots animation
 * is pure CSS (no library) — a tight, mechanical rhythm that signals
 * "real work is happening" without feeling toy-ish.
 */
function WebTabEmptyState() {
  const providerLogos: Array<{ name: string; logo: string }> = [
    { name: "ChatGPT", logo: "/logos/openai.svg" },
    { name: "Claude", logo: "/logos/anthropic.svg" },
    { name: "Gemini", logo: "/logos/google.svg" },
    { name: "Grok", logo: "/logos/xai.svg" },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-card-border bg-card-bg shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_-12px_rgba(15,23,42,0.12)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_12px_40px_-12px_rgba(0,0,0,0.6)]">
      {/* Atmospheric gradient + grid overlay — gives the card depth without weight */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_-10%,rgba(37,99,235,0.08),transparent_45%),radial-gradient(circle_at_85%_110%,rgba(124,58,237,0.06),transparent_45%)] dark:bg-[radial-gradient(circle_at_20%_-10%,rgba(96,165,250,0.18),transparent_45%),radial-gradient(circle_at_85%_110%,rgba(168,85,247,0.12),transparent_45%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent"
      />

      <div className="relative grid gap-10 p-8 sm:p-10 md:grid-cols-[1.4fr_1fr] md:p-14">
        <div className="space-y-6">
          {/* Status pill with breathing dots */}
          <div className="inline-flex items-center gap-2.5 rounded-full border border-card-border bg-muted-bg/60 px-3 py-1.5 text-xs font-medium tracking-wide text-muted">
            <span className="relative flex h-2 w-2 items-center justify-center">
              <span className="absolute h-full w-full animate-[ping_1.6s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-accent/60" />
              <span className="relative h-2 w-2 rounded-full bg-accent" />
            </span>
            <span className="uppercase">Run in progress</span>
          </div>

          <div className="space-y-3">
            <h2 className="font-serif text-3xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-4xl">
              The consumer scores
              <br className="hidden sm:block" /> are being collected.
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-muted">
              We&apos;re running the same 51 prompts through the actual
              consumer apps your kids use — chatgpt.com, claude.ai,
              gemini.google.com, and grok.com — on real, authenticated
              sessions. This takes care, not just CPU.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/methodology#consumer-products-track"
              className="group inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_14px_-2px_rgba(37,99,235,0.45)] transition-all hover:shadow-[0_6px_20px_-2px_rgba(37,99,235,0.55)] hover:-translate-y-0.5 active:translate-y-0 dark:shadow-[0_4px_14px_-2px_rgba(96,165,250,0.4)]"
            >
              How the consumer track works
              <svg
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-2 rounded-full border border-card-border bg-card-bg px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted-bg/60"
            >
              See API scores meanwhile
            </Link>
          </div>
        </div>

        {/* Provider rail — establishes credibility ("yes, we test the real ones") */}
        <div className="relative">
          <div className="rounded-2xl border border-card-border bg-muted-bg/30 p-5 backdrop-blur-sm dark:bg-muted-bg/30">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Coming to this tab
            </p>
            <ul className="space-y-2.5">
              {providerLogos.map((p, i) => (
                <li
                  key={p.name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-card-border/70 bg-card-bg/80 px-3 py-2.5 transition-colors hover:bg-card-bg"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <span className="flex items-center gap-3">
                    <Image
                      src={p.logo}
                      alt={p.name}
                      width={22}
                      height={22}
                      className="rounded-md"
                    />
                    <span className="text-sm font-semibold text-foreground">{p.name}</span>
                  </span>
                  <span className="flex h-1.5 items-end gap-0.5" aria-hidden="true">
                    <span className="block h-1 w-1 rounded-full bg-muted/40" />
                    <span className="block h-1.5 w-1 rounded-full bg-muted/55" />
                    <span className="block h-2 w-1 rounded-full bg-accent/70" />
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Each provider is tested on a real authenticated session.
              We rate-limit ourselves and refresh selectors before every run.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
