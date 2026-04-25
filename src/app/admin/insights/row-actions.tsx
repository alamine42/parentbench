"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Status = "draft" | "generation_failed" | "published" | "retracted";

export function RowActionsClient({ id, status }: { id: string; status: Status }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function action(body: object) {
    setErr(null);
    const res = await fetch(`/api/admin/insights/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setErr(data.error ?? `HTTP ${res.status}`);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2">
      {status === "draft" ? (
        <Button onClick={() => action({ action: "publish" })} disabled={isPending}>Publish</Button>
      ) : null}
      {status === "published" ? (
        <Button
          onClick={() => {
            const reason = window.prompt("Retraction reason (optional):") ?? undefined;
            action({ action: "retract", reason });
          }}
          disabled={isPending}
          variant="warn"
        >
          Retract
        </Button>
      ) : null}
      {status === "retracted" ? (
        <Button onClick={() => action({ action: "unretract" })} disabled={isPending}>
          Restore
        </Button>
      ) : null}
      {err ? <span className="text-xs text-red-600">{err}</span> : null}
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = "neutral",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "neutral" | "warn";
}) {
  const styles =
    variant === "warn"
      ? "border-red-300 text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20"
      : "border-card-border hover:bg-muted-bg";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}
