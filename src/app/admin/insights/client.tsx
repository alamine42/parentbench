"use client";

import { useState } from "react";

export function AdminInsightsClient() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function regenerate() {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/insights/regenerate", { method: "POST" });
      if (!response.ok) {
        setStatus(`Error: ${response.status}`);
      } else {
        const data = await response.json();
        setStatus(`Queued ${data.eventIds?.length ?? 1} regen event(s). Refresh in ~30s.`);
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
        onClick={regenerate}
        disabled={busy}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "Queueing…" : "Regenerate now"}
      </button>
    </div>
  );
}
