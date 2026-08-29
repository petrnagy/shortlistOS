#!/bin/sh
set -eu

case "${SHORTLISTOS_SERVICE:-web}" in
  web)
    exec node /app/bootstrap.cjs
    ;;
  web-clipper-api)
    exec pnpm --filter @kan/web-clipper-api exec tsx src/index.ts
    ;;
  queue-worker)
    exec pnpm --filter @kan/shortlist-queue-worker exec tsx src/index.ts
    ;;
  enrichment-worker)
    exec pnpm --filter @kan/shortlist-enrichment-worker exec tsx src/index.ts
    ;;
  card-worker)
    exec pnpm --filter @kan/shortlist-automation-card-worker exec tsx src/index.ts
    ;;
  email-worker)
    exec pnpm --filter @kan/shortlist-automation-email-worker exec tsx src/index.ts
    ;;
  *)
    echo "Unknown SHORTLISTOS_SERVICE: ${SHORTLISTOS_SERVICE}" >&2
    exit 64
    ;;
esac
