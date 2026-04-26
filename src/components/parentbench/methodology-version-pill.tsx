/**
 * Tiny "v1.1.0" pill linked to /methodology/changelog (parentbench-rg1.3).
 *
 * Server-renderable. Designed to slot in next to a score or in a
 * page footer without competing with primary content.
 */

import Link from "next/link";

export function MethodologyVersionPill({
  version,
  className = "",
}: {
  version: string;
  className?: string;
}) {
  return (
    <Link
      href="/methodology/changelog"
      title={`Methodology v${version} — see changelog`}
      className={
        "inline-flex items-center gap-1 rounded-full border border-card-border " +
        "bg-card-bg/60 px-2 py-0.5 text-[11px] font-medium text-muted " +
        "hover:bg-muted-bg hover:text-foreground transition-colors " +
        className
      }
    >
      <span aria-hidden>📐</span>
      <span>v{version}</span>
    </Link>
  );
}
