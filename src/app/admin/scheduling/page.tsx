"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { SchedulingData, ScheduledModel, EvalTier } from "@/app/api/admin/scheduling/route";

const TIER_CONFIG: Record<
  EvalTier,
  { label: string; frequency: string; color: string; bgColor: string; description: string }
> = {
  active: {
    label: "Active",
    frequency: "Daily",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    description: "Flagship models evaluated every day at 2:00 AM UTC",
  },
  standard: {
    label: "Standard",
    frequency: "Twice Weekly",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    description: "Mid-tier models evaluated Monday & Thursday at 2:00 AM UTC",
  },
  maintenance: {
    label: "Maintenance",
    frequency: "Monthly",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    description: "Legacy models evaluated on the 1st of each month",
  },
  paused: {
    label: "Paused",
    frequency: "Manual Only",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-100 dark:bg-yellow-900/30",
    description: "No scheduled evaluations, manual trigger only",
  },
};

function formatNextRun(isoDate: string): string {
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 24) {
    return `in ${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
  } else if (diffDays < 7) {
    return `in ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
}

function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export default function SchedulingPage() {
  const [data, setData] = useState<SchedulingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch("/api/admin/scheduling");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError("Failed to load scheduling data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function updateTier(modelId: string, newTier: EvalTier) {
    setUpdating(modelId);
    try {
      const res = await fetch("/api/admin/scheduling", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, evalTier: newTier }),
      });
      if (!res.ok) throw new Error("Failed to update");
      await fetchData();
    } catch (err) {
      setError("Failed to update tier");
      console.error(err);
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          <p className="text-sm text-muted">Loading schedules...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <p className="text-red-600 dark:text-red-400">{error || "Failed to load data"}</p>
        <button
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchData();
          }}
          className="mt-4 text-sm text-red-600 hover:underline dark:text-red-400"
        >
          Try again
        </button>
      </div>
    );
  }

  type ScheduledTier = "active" | "standard" | "maintenance";
  const scheduledTiers: ScheduledTier[] = ["active", "standard", "maintenance"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Evaluation Scheduling</h1>
        <p className="mt-1 text-muted">
          Manage automated evaluation schedules for all models
        </p>
      </div>

      {/* Next Runs Overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        {scheduledTiers.map((tier) => {
          const config = TIER_CONFIG[tier];
          const nextRun = data.nextRuns[tier];
          const modelCount = data.tiers[tier].length;

          return (
            <div
              key={tier}
              className="rounded-xl border border-card-border bg-card-bg p-5"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${config.bgColor}`}>
                  <svg
                    className={`h-5 w-5 ${config.color}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold">{config.label} Tier</h3>
                  <p className="text-sm text-muted">{config.frequency}</p>
                </div>
              </div>
              <div className="mt-4">
                <p className={`text-lg font-bold ${config.color}`}>
                  {formatNextRun(nextRun)}
                </p>
                <p className="text-xs text-muted">{formatDateTime(nextRun)}</p>
              </div>
              <div className="mt-3 pt-3 border-t border-card-border">
                <p className="text-sm">
                  <span className="font-medium">{modelCount}</span>
                  <span className="text-muted"> model{modelCount !== 1 ? "s" : ""} scheduled</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Paused models alert */}
      {data.tiers.paused.length > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-yellow-600 dark:text-yellow-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span className="font-medium text-yellow-800 dark:text-yellow-200">
              {data.tiers.paused.length} model{data.tiers.paused.length !== 1 ? "s" : ""} paused
            </span>
          </div>
          <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
            Paused models won&apos;t receive automated evaluations. Use manual triggers or change their tier to resume.
          </p>
        </div>
      )}

      {/* Models by Tier */}
      <div className="space-y-6">
        {(["active", "standard", "maintenance", "paused"] as EvalTier[]).map((tier) => {
          const config = TIER_CONFIG[tier];
          const tierModels = data.tiers[tier];

          return (
            <div key={tier} className="rounded-xl border border-card-border bg-card-bg overflow-hidden">
              <div className="px-5 py-4 border-b border-card-border bg-muted-bg/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${config.bgColor} ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-sm text-muted">{config.description}</span>
                  </div>
                  <span className="text-sm font-medium">{tierModels.length} models</span>
                </div>
              </div>

              {tierModels.length === 0 ? (
                <div className="px-5 py-8 text-center text-muted">
                  No models in this tier
                </div>
              ) : (
                <div className="divide-y divide-card-border">
                  {tierModels.map((model) => (
                    <ModelRow
                      key={model.id}
                      model={model}
                      updating={updating === model.id}
                      onTierChange={(newTier) => updateTier(model.id, newTier)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ModelRowProps = {
  model: ScheduledModel;
  updating: boolean;
  onTierChange: (tier: EvalTier) => void;
};

function ModelRow({ model, updating, onTierChange }: ModelRowProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingTier, setPendingTier] = useState<EvalTier | null>(null);

  function handleTierSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const newTier = e.target.value as EvalTier;
    if (newTier === model.evalTier) return;

    if (newTier === "paused") {
      setPendingTier(newTier);
      setShowConfirm(true);
    } else {
      onTierChange(newTier);
    }
  }

  function confirmChange() {
    if (pendingTier) {
      onTierChange(pendingTier);
    }
    setShowConfirm(false);
    setPendingTier(null);
  }

  return (
    <div className="flex items-center gap-4 px-5 py-3 hover:bg-muted-bg/30 transition-colors">
      {/* Model info */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {model.providerLogo && (
          <Image
            src={model.providerLogo}
            alt={model.providerName}
            width={32}
            height={32}
            className="rounded-md shrink-0"
          />
        )}
        <div className="min-w-0">
          <Link
            href={`/admin/models/${model.id}`}
            className="font-medium hover:text-blue-600 dark:hover:text-blue-400 truncate block"
          >
            {model.name}
          </Link>
          <p className="text-sm text-muted truncate">{model.providerName}</p>
        </div>
      </div>

      {/* Last eval */}
      <div className="hidden sm:block text-sm text-muted w-32 text-right">
        {model.lastEvalDate ? (
          <span>Last: {model.lastEvalDate}</span>
        ) : (
          <span className="italic">Never evaluated</span>
        )}
      </div>

      {/* Status badge */}
      {!model.isActive && (
        <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          Inactive
        </span>
      )}

      {/* Tier selector */}
      <div className="relative">
        <select
          value={model.evalTier}
          onChange={handleTierSelect}
          disabled={updating}
          className="appearance-none rounded-lg border border-card-border bg-card-bg px-3 py-1.5 pr-8 text-sm font-medium cursor-pointer hover:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="active">Active</option>
          <option value="standard">Standard</option>
          <option value="maintenance">Maintenance</option>
          <option value="paused">Paused</option>
        </select>
        <svg
          className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {updating && (
          <div className="absolute inset-0 flex items-center justify-center bg-card-bg/80 rounded-lg">
            <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card-bg rounded-xl border border-card-border p-6 max-w-md mx-4 shadow-xl">
            <h3 className="text-lg font-semibold">Pause Scheduled Evaluations?</h3>
            <p className="mt-2 text-sm text-muted">
              <strong>{model.name}</strong> will no longer receive automated evaluations.
              You can still trigger manual evaluations from the Evaluations page.
            </p>
            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setPendingTier(null);
                }}
                className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-muted-bg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmChange}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-yellow-500 text-white hover:bg-yellow-600 transition-colors"
              >
                Pause Evaluations
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
