/**
 * Freeze-mode gate (2026-05-17).
 *
 * When `FROZEN=1`, every request to a write/admin route returns 503
 * with a JSON body explaining the freeze. Pages and read-only routes
 * pass through and read from `src/data/snapshot/*.json`.
 *
 * Routes intentionally remain in the codebase (not deleted) so a
 * future unfreeze just flips the env var.
 *
 * See `docs/solutions/integration-issues/freezing-and-unfreezing-parentbench.md`.
 */

import { NextRequest, NextResponse } from "next/server";

const BLOCKED_API_PREFIXES = [
  "/api/admin",
  "/api/submissions",
  "/api/newsletter",
  "/api/inngest",
];

const BLOCKED_PAGE_PREFIXES = ["/admin", "/report"];

function isFrozen() {
  return process.env.FROZEN === "1";
}

export function middleware(req: NextRequest) {
  if (!isFrozen()) return NextResponse.next();

  const { pathname } = req.nextUrl;

  if (BLOCKED_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return new NextResponse(
      JSON.stringify({
        error: "Site is frozen",
        message:
          "parentbench.ai is in read-only freeze mode as of 2026-05-17. Write endpoints are disabled.",
        frozen: true,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  if (BLOCKED_PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    // Admin and submission pages don't function without DB writes — point
    // visitors at the public site instead.
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/api/admin",
    "/api/admin/:path*",
    "/api/submissions",
    "/api/submissions/:path*",
    "/api/newsletter",
    "/api/newsletter/:path*",
    "/api/inngest",
    "/api/inngest/:path*",
    "/report",
    "/report/:path*",
  ],
};
