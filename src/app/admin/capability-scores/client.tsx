"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CAPABILITY_BENCHMARKS, type CapabilityBenchmark } from "@/lib/capability/validation";

type ModelRow = {
  id: string;
  slug: string;
  name: string;
  provider: string;
  coverageCount: number;
  coverageTotal: number;
  eligible: boolean;
  benchmarks: Array<{
    benchmark: CapabilityBenchmark;
    live: { score: number; recordedAt: Date } | null;
  }>;
};

export function CapabilityScoresClient({ models }: { models: ModelRow[] }) {
  const [editing, setEditing] = useState<{ model: ModelRow; benchmark: CapabilityBenchmark } | null>(null);

  return (
    <>
      <div className="mb-3 flex items-center justify-end gap-3">
        <RecomputeButton />
      </div>
      <div className="overflow-x-auto rounded-lg border border-card-border bg-card-bg">
        <table className="w-full text-sm">
          <thead className="border-b border-card-border bg-muted-bg/50 text-xs uppercase tracking-wide text-muted">
            <tr>
              <Th className="text-left">Model</Th>
              <Th>Provider</Th>
              {CAPABILITY_BENCHMARKS.map((b) => (
                <Th key={b}>{b.toUpperCase()}</Th>
              ))}
              <Th>Coverage</Th>
              <Th>Eligible</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {models.map((m) => (
              <tr key={m.id}>
                <Td>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted">{m.slug}</p>
                </Td>
                <Td className="text-center text-xs text-muted">{m.provider}</Td>
                {m.benchmarks.map((b) => (
                  <Td key={b.benchmark} className="text-center">
                    {b.live ? (
                      <button
                        onClick={() => setEditing({ model: m, benchmark: b.benchmark })}
                        className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200"
                      >
                        {b.live.score.toFixed(1)}
                      </button>
                    ) : (
                      <button
                        onClick={() => setEditing({ model: m, benchmark: b.benchmark })}
                        className="rounded border border-dashed border-card-border px-2 py-1 text-xs text-muted hover:bg-muted-bg"
                      >
                        + add
                      </button>
                    )}
                  </Td>
                ))}
                <Td className="text-center text-xs">
                  {m.coverageCount}/{m.coverageTotal}
                </Td>
                <Td className="text-center">
                  {m.eligible ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">yes</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">no</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <EditModal
          model={editing.model}
          benchmark={editing.benchmark}
          existingScore={editing.model.benchmarks.find((b) => b.benchmark === editing.benchmark)?.live?.score ?? null}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-center ${className}`}>{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 ${className}`}>{children}</td>;
}

function EditModal({
  model,
  benchmark,
  existingScore,
  onClose,
}: {
  model: ModelRow;
  benchmark: CapabilityBenchmark;
  existingScore: number | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [score, setScore] = useState<string>(existingScore?.toString() ?? "");
  const [sourceUrl, setSourceUrl] = useState("");
  const [shotSetting, setShotSetting] = useState("5-shot");
  const [variant, setVariant] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/capability-scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: model.id,
          benchmark,
          score: Number(score),
          sourceUrl,
          shotSetting: shotSetting || null,
          benchmarkVariant: variant || null,
          sourceNote: note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(`${data.error}${data.details ? ": " + data.details.join(", ") : ""}`);
        setBusy(false);
        return;
      }
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-card-bg p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-lg font-bold">{benchmark.toUpperCase()} score</h2>
        <p className="mb-4 text-sm text-muted">
          {model.name} {existingScore !== null ? `· current ${existingScore.toFixed(1)}` : ""}
        </p>

        <div className="space-y-3">
          <Field label="Score (0-100)">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className="w-full rounded border border-card-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Source URL">
            <input
              type="url"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded border border-card-border bg-background px-3 py-2 text-sm"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Shot setting">
              <input
                type="text"
                value={shotSetting}
                onChange={(e) => setShotSetting(e.target.value)}
                placeholder="5-shot"
                className="w-full rounded border border-card-border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Variant (optional)">
              <input
                type="text"
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
                placeholder="Diamond"
                className="w-full rounded border border-card-border bg-background px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="Note (optional)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              className="w-full rounded border border-card-border bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="rounded border border-card-border px-4 py-2 text-sm">Cancel</button>
          <button
            onClick={submit}
            disabled={busy || !score || !sourceUrl}
            className="rounded bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : existingScore !== null ? "Append (supersedes prior)" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

function RecomputeButton() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function recompute() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/correlation/recompute", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setStatus(`Error: ${data.error ?? res.status}`);
      } else {
        setStatus(`Queued. The report will publish on /methodology in ~30s if ≥5 models are eligible.`);
      }
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {status ? <span className="text-xs text-muted">{status}</span> : null}
      <button
        onClick={recompute}
        disabled={busy}
        className="rounded-lg border border-card-border bg-accent px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Queueing…" : "Recompute correlation"}
      </button>
    </div>
  );
}
