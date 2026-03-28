import { NextResponse } from "next/server";

export async function GET() {
  throw new Error("Sentry Test API Error: Server-side error from ParentBench");

  // This line is unreachable but satisfies TypeScript
  return NextResponse.json({ ok: true });
}
