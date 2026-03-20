import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

/**
 * Inngest Webhook Handler
 *
 * This endpoint is used by Inngest to:
 * 1. Register functions during deployment
 * 2. Execute function steps
 * 3. Receive events from the Inngest cloud
 *
 * In development: Run `npx inngest-cli@latest dev` to start the local dev server
 * In production: Set INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY env vars
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
