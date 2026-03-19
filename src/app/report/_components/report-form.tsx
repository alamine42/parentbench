"use client";

import { useState } from "react";
import type { ModelInfo } from "@/types/model";
import type { ParentBenchCategory } from "@/types/parentbench";
import type { Severity, TestType } from "@/types/redteam";
import {
  severityLabels,
  testTypeLabels,
  categoryLabels,
} from "@/types/redteam";
import { parentBenchCategories } from "@/types/parentbench";

type Props = {
  models: ModelInfo[];
  preselectedModel?: string;
};

export function ReportForm({ models, preselectedModel }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(formData as unknown as Record<string, string>).toString(),
      });
      if (!response.ok) {
        throw new Error("Submission failed");
      }
      setSubmitted(true);
      form.reset();
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-green-600 dark:text-green-400"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">Thank you!</h2>
        <p className="mt-2 text-muted">
          Your report has been submitted. We&apos;ll review it within 48 hours.
        </p>
        <button
          onClick={() => setSubmitted(false)}
          className="mt-4 text-sm font-medium text-green-700 hover:text-green-600 dark:text-green-400"
        >
          Submit another report
        </button>
      </div>
    );
  }

  return (
    <form
      name="redteam-report"
      method="POST"
      data-netlify="true"
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <input type="hidden" name="form-name" value="redteam-report" />

      {/* Model Selection */}
      <div>
        <label htmlFor="model" className="block text-sm font-medium">
          Model <span className="text-red-500">*</span>
        </label>
        <select
          id="model"
          name="model"
          required
          defaultValue={preselectedModel || ""}
          className="mt-1 block w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          <option value="">Select a model...</option>
          {models.map((model) => (
            <option key={model.slug} value={model.slug}>
              {model.name} ({model.provider.name})
            </option>
          ))}
        </select>
      </div>

      {/* Category */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium">
          Safety Category <span className="text-red-500">*</span>
        </label>
        <select
          id="category"
          name="category"
          required
          className="mt-1 block w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          <option value="">Select a category...</option>
          {parentBenchCategories.map((cat) => (
            <option key={cat} value={cat}>
              {categoryLabels[cat as ParentBenchCategory]}
            </option>
          ))}
        </select>
      </div>

      {/* Test Type */}
      <div>
        <label htmlFor="testType" className="block text-sm font-medium">
          Issue Type <span className="text-red-500">*</span>
        </label>
        <select
          id="testType"
          name="testType"
          required
          className="mt-1 block w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          <option value="">Select issue type...</option>
          {(Object.keys(testTypeLabels) as TestType[]).map((type) => (
            <option key={type} value={type}>
              {testTypeLabels[type]}
            </option>
          ))}
        </select>
      </div>

      {/* Severity */}
      <div>
        <label htmlFor="severity" className="block text-sm font-medium">
          Severity <span className="text-red-500">*</span>
        </label>
        <select
          id="severity"
          name="severity"
          required
          className="mt-1 block w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          <option value="">Select severity...</option>
          {(Object.keys(severityLabels) as Severity[]).map((sev) => (
            <option key={sev} value={sev}>
              {severityLabels[sev]}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Description <span className="text-red-500">*</span>
        </label>
        <p className="mt-1 text-xs text-muted">
          Describe the safety issue you found. What did the model do wrong?
        </p>
        <textarea
          id="description"
          name="description"
          required
          minLength={25}
          rows={4}
          placeholder="The model generated harmful content when I asked..."
          className="mt-1 block w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      {/* Reproduction Steps */}
      <div>
        <label htmlFor="reproductionSteps" className="block text-sm font-medium">
          How to Reproduce <span className="text-red-500">*</span>
        </label>
        <p className="mt-1 text-xs text-muted">
          Step-by-step instructions to reproduce this issue.
        </p>
        <textarea
          id="reproductionSteps"
          name="reproductionSteps"
          required
          minLength={25}
          rows={3}
          placeholder="1. Send this prompt: '...'&#10;2. The model responds with..."
          className="mt-1 block w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      {/* Evidence */}
      <div>
        <label htmlFor="evidence" className="block text-sm font-medium">
          Evidence
        </label>
        <p className="mt-1 text-xs text-muted">
          Paste the model&apos;s response or a link to a screenshot.
        </p>
        <textarea
          id="evidence"
          name="evidence"
          rows={3}
          placeholder="Paste response text or screenshot URL..."
          className="mt-1 block w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      {/* Platform */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="platform" className="block text-sm font-medium">
            Platform
          </label>
          <input
            type="text"
            id="platform"
            name="platform"
            placeholder="e.g., ChatGPT, API, Claude.ai"
            className="mt-1 block w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
        <div>
          <label htmlFor="modelVersion" className="block text-sm font-medium">
            Model Version
          </label>
          <input
            type="text"
            id="modelVersion"
            name="modelVersion"
            placeholder="e.g., gpt-4-0125-preview"
            className="mt-1 block w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Contributor Info */}
      <div className="border-t border-card-border pt-6">
        <h3 className="text-sm font-medium">Attribution (optional)</h3>
        <p className="mt-1 text-xs text-muted">
          Leave blank to submit anonymously.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="contributorName" className="block text-sm font-medium">
              Your Name
            </label>
            <input
              type="text"
              id="contributorName"
              name="contributorName"
              placeholder="Jane Doe"
              className="mt-1 block w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <div>
            <label htmlFor="contributorEmail" className="block text-sm font-medium">
              Email
            </label>
            <input
              type="email"
              id="contributorEmail"
              name="contributorEmail"
              placeholder="jane@example.com"
              className="mt-1 block w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="space-y-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-green-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50 dark:bg-green-500 dark:hover:bg-green-600"
        >
          {submitting ? "Submitting..." : "Submit Report"}
        </button>
        {error && (
          <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    </form>
  );
}
