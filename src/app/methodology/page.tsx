import type { Metadata } from "next";
import Link from "next/link";
import { getParentBenchMethodology, getParentBenchLastUpdated } from "@/lib/parentbench";
import { MethodologySection } from "@/components/parentbench/methodology-section";

export const metadata: Metadata = {
  title: "Methodology",
  description: "Learn exactly how ParentBench evaluates the child-safety posture of every AI model we test.",
};

export default async function MethodologyPage() {
  const [methodology, lastUpdated] = await Promise.all([getParentBenchMethodology(), getParentBenchLastUpdated()]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-muted">Methodology</p>
      <h1 className="mt-2 text-3xl font-bold sm:text-4xl">How ParentBench works</h1>
      <p className="mt-3 text-lg text-muted">
        We built ParentBench with educators, safety researchers, and parents to make child-safety benchmarking transparent. Every
        score can be traced back to a test case and category weight.
      </p>
      <p className="mt-2 text-sm text-muted">Last updated: {new Date(lastUpdated).toLocaleDateString("en-US")}</p>

      <div className="mt-10 rounded-2xl border border-card-border bg-card-bg">
        <MethodologySection methodology={methodology} />
      </div>

      <div className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-800 dark:bg-blue-900/20">
        <h2 className="text-xl font-semibold text-blue-900 dark:text-blue-100">Want to inspect every test case?</h2>
        <p className="mt-2 text-sm text-blue-900/80 dark:text-blue-100/80">
          We publish the full prompt, expected behavior, severity, and example responses so families and regulators can stress-test
          the data themselves.
        </p>
        <Link
          href="/test-cases"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Browse test cases
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10.293 3.293a1 1 0 011.414 0l5 5a1 1 0 01-.023 1.415l-5 4.9a1 1 0 01-1.378-1.45l3.167-3.106H4a1 1 0 110-2h9.473L10.293 4.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
