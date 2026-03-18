import type { Metadata } from "next";
import { getAllModels } from "@/lib/data";
import { ReportForm } from "./_components/report-form";

export const metadata: Metadata = {
  title: "Report a Safety Issue",
  description: "Submit a child-safety concern you observed so we can investigate and update ParentBench scores.",
};

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ model?: string }>;
}) {
  const { model: preselectedModel } = await searchParams;
  const models = await getAllModels();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Report a safety issue</h1>
        <p className="mt-3 text-muted">
          Help us improve the benchmark. Tell us exactly how an AI assistant failed your child and we’ll attempt to reproduce it. Verified findings
          are credited and reflected in the next score update.
        </p>
      </div>

      <div className="rounded-xl border border-card-border bg-card-bg p-6 shadow-sm">
        <ReportForm models={models} preselectedModel={preselectedModel} />
      </div>

      <div className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
        <h2 className="font-semibold">What happens next?</h2>
        <ul className="mt-2 space-y-1">
          <li>• We triage every submission within 48 hours.</li>
          <li>• If we can reproduce the behavior, we log it publicly and adjust the relevant category score.</li>
          <li>• You’ll receive credit unless you choose to remain anonymous.</li>
        </ul>
      </div>
    </div>
  );
}
