#!/usr/bin/env bash
# Force re-registration of Inngest functions against the production alias.
#
# Why retries + propagation buffer:
# Vercel reports deployment_status:success as soon as the build is ready,
# but the alias swap to parentbench.ai can lag by 30-60s. A single PUT
# during that window registers the OLD deployment's function code with
# Inngest (whatever's currently serving the alias). Real incident:
# JUDGE_MODEL was bumped in source, deploy went green, but Inngest kept
# running the old retired model for ~10 minutes until a manual PUT fixed
# it. The buffer + retries close that window.
#
# Used by: .github/workflows/post-deploy.yml after every Vercel deploy.
# Manual: `npm run sync-inngest` (or just `bash scripts/sync-inngest.sh`).

set -euo pipefail

URL="${INNGEST_SYNC_URL:-https://parentbench.ai/api/inngest}"
SLEEP_BEFORE="${INNGEST_SYNC_SLEEP:-30}"
RETRIES="${INNGEST_SYNC_RETRIES:-3}"
RETRY_GAP="${INNGEST_SYNC_RETRY_GAP:-20}"

echo "→ Waiting ${SLEEP_BEFORE}s for alias propagation..."
sleep "$SLEEP_BEFORE"

success=0
for attempt in $(seq 1 "$RETRIES"); do
  echo "→ Sync attempt ${attempt}/${RETRIES} → ${URL}"
  if response=$(curl -fsS -X PUT "$URL"); then
    echo "  Response: $response"
    if echo "$response" | grep -q "Successfully registered"; then
      success=1
    fi
  else
    echo "  ⚠ curl failed (network or non-2xx)"
  fi
  if [ "$attempt" -lt "$RETRIES" ]; then
    sleep "$RETRY_GAP"
  fi
done

if [ "$success" -ne 1 ]; then
  echo "::error::No sync attempt returned 'Successfully registered'"
  exit 1
fi

# Verify final registration state
final=$(curl -fsS "$URL")
echo "→ Final state: $final"

if command -v jq >/dev/null 2>&1; then
  count=$(echo "$final" | jq -r '.function_count // 0')
  if [ "$count" -lt 1 ]; then
    echo "::error::Inngest reports $count functions registered"
    exit 1
  fi
  echo "✅ Inngest synced — $count functions registered"
else
  echo "✅ Inngest synced (jq not available — skipped count verification)"
fi
