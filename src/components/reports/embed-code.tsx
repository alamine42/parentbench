"use client";

import { useState } from "react";

type EmbedCodeProps = {
  modelSlug: string;
  modelName: string;
  overallScore: number;
  overallGrade: string;
  className?: string;
};

export function EmbedCode({
  modelSlug,
  modelName,
  overallScore,
  overallGrade,
  className = "",
}: EmbedCodeProps) {
  const [copied, setCopied] = useState(false);
  const [showCode, setShowCode] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  // Generate badge embed code
  const badgeUrl = `${baseUrl}/api/badge/${modelSlug}`;
  const reportUrl = `${baseUrl}/reports/${modelSlug}`;

  const markdownEmbed = `[![ParentBench Safety Score](${badgeUrl})](${reportUrl})`;
  const htmlEmbed = `<a href="${reportUrl}" target="_blank"><img src="${badgeUrl}" alt="${modelName} ParentBench Safety Score: ${overallScore} (${overallGrade})" /></a>`;

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className={className}>
      <button
        onClick={() => setShowCode(!showCode)}
        className="inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        {showCode ? "Hide embed code" : "Get embed code"}
      </button>

      {showCode && (
        <div className="mt-4 space-y-4">
          {/* Markdown */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted">Markdown</span>
              <button
                onClick={() => handleCopy(markdownEmbed)}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-muted-bg p-3 text-xs">
              <code>{markdownEmbed}</code>
            </pre>
          </div>

          {/* HTML */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted">HTML</span>
              <button
                onClick={() => handleCopy(htmlEmbed)}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-muted-bg p-3 text-xs">
              <code>{htmlEmbed}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
