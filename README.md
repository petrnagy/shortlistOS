# shortlistOS

shortlistOS is a self-hostable job-search workspace. It combines Kanban-style application tracking with job capture, structured job data, contacts, reminders, source ingestion, salary and company enrichment, and browser-extension ingestion.

shortlistOS is a fork of [Kan](https://github.com/kanbn/kan), the open-source project management application created by the [kan.bn](https://kan.bn) team. It retains Kan's project-management foundation and adapts it into a job-search workspace with a dedicated data model, workflows, capture services, enrichment, background processing, and Powerpack features.

This repository contains the complete shortlistOS application, including all **Powerpack** features. There is no separate proprietary source distribution. The project is licensed under the [GNU Affero General Public License v3.0 or later](./LICENSE).

This README is for developers and operators who want to fork shortlistOS, run it locally, or deploy it on their own infrastructure.

## Contents

- [What is included](#what-is-included)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Local development](#local-development)
- [Docker Compose](#docker-compose)
- [Production deployment](#production-deployment)
- [Object storage and AWS S3](#object-storage-and-aws-s3)
- [Optional integrations](#optional-integrations)
- [Environment variables](#environment-variables)
- [Database operations](#database-operations)
- [Background workers](#background-workers)
- [Web Clipper API](#web-clipper-api)
- [Development commands](#development-commands)
- [Acknowledgements](#acknowledgements)
- [License](#license)

## What is included

The repository includes:

- workspaces, boards, lists, cards, labels, members, comments, checklists, attachments, due dates, activity history, favourites, templates, webhooks, and Trello import;
- shortlist-specific job fields, contacts, job types, salary intervals, application tracking, card ageing, and manual-update controls;
- Magic Inbox and Magic Clip ingestion endpoints;
- source upload, parsing, classification, deduplication, and card-linking queues;
- LLM-backed job-post classification;
- company and salary enrichment with OpenWebNinja, regional salary sampling, currency conversion through Frankfurter, caching, retry limits, and per-account quotas;
- Powerpack settings and Stripe checkout/webhook support;
- the Web Clipper authorization and ingestion API;
- email, OAuth/OIDC, notifications, analytics, partner integration, and white-label configuration.

Most third-party integrations are optional. A standard installation requires PostgreSQL, an S3-compatible object store, a base URL, and an authentication secret.

## Architecture

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js user interface, API routes, tRPC server, and auth endpoints |
| `apps/shortlist-worker` | Source, inbox, clip, and enrichment background jobs |
| `apps/web-clipper-api` | Web Clipper pairing, token, metadata, and clip API |
| `packages/api` | Shared tRPC routers and OpenAPI support |
| `packages/auth` | Better Auth configuration and providers |
| `packages/db` | Drizzle schema, repositories, PostgreSQL migrations, and Redis client |
| `packages/email` | SMTP and notification email templates |
| `packages/llm` | LLM connector and job-post classification |
| `packages/logger` | Application logging and optional Axiom transport |
| `packages/shared` | Shared types, permissions, and utilities |
| `packages/stripe` | Stripe client integration |

The required runtime is PostgreSQL, an S3-compatible object store, and the web app. Redis, SMTP, the worker, Web Clipper API, and external providers are enabled as needed.

## Prerequisites

- Node.js `>=20.18.1`
- pnpm `9.14.2` (the repository pins this through `packageManager`)
- PostgreSQL 15 or newer
- an S3-compatible object store and three private buckets
- Docker and Docker Compose for the container workflow
- optional: Redis

Enable the pinned package manager with Corepack:

```bash
corepack enable
corepack prepare pnpm@9.14.2 --activate
```

## Local development

1. Fork and clone the repository.

   ```bash
   git clone https://github.com/petrnagy/shortlistOS.git
   cd shortlistOS
   ```

2. Install dependencies.

   ```bash
   pnpm install
   ```

3. Copy the example environment file.

   ```bash
   cp .env.example .env
   ```

4. Set at least these values, replacing the bucket names and storage settings with your own:

   ```dotenv
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   BETTER_AUTH_SECRET=replace-with-a-random-string-at-least-32-characters
   POSTGRES_URL=postgresql://shortlistos:shortlistos@localhost:5432/shortlistos_db
   S3_REGION=us-east-1
   S3_ENDPOINT=https://your-s3-compatible-endpoint.example.com
   S3_ACCESS_KEY_ID=replace-with-your-access-key
   S3_SECRET_ACCESS_KEY=replace-with-your-secret-key
   NEXT_PUBLIC_AVATAR_BUCKET_NAME=shortlistos-avatars
   NEXT_PUBLIC_ATTACHMENTS_BUCKET_NAME=shortlistos-attachments
   SHORTLIST_SOURCE_BUCKET_NAME=shortlistos-sources
   NEXT_PUBLIC_STORAGE_URL=https://your-storage-or-cdn-origin.example.com
   NEXT_PUBLIC_STORAGE_DOMAIN=your-storage-domain.example.com
   ```

   Generate a suitable auth secret with `openssl rand -base64 32`. AWS-hosted workloads should use an IAM role instead of static access keys.

5. Start PostgreSQL yourself or start only the repository database container:

   ```bash
   POSTGRES_PASSWORD=shortlistos docker compose up -d postgres
   ```

6. Apply all migrations.

   ```bash
   pnpm db:migrate
   ```

7. Start the workspace.

   ```bash
   pnpm dev
   ```

The web app is available at `http://localhost:3000`. The root `dev` command runs workspace development tasks; `pnpm dev:next` narrows this to the web app and Web Clipper API.

## Docker Compose

The root [`docker-compose.yml`](./docker-compose.yml) builds and runs:

- `postgres`: PostgreSQL 15 with persistent storage;
- `migrate`: a run-once image that applies Drizzle migrations;
- `web`: the production Next.js image on `WEB_PORT` (default `3000`).

Create `.env`, then set a Compose database URL whose hostname is the service name:

```dotenv
NEXT_PUBLIC_BASE_URL=http://localhost:3000
BETTER_AUTH_SECRET=replace-with-a-random-string-at-least-32-characters
POSTGRES_PASSWORD=replace-with-a-strong-database-password
POSTGRES_URL=postgresql://shortlistos:replace-with-a-strong-database-password@postgres:5432/shortlistos_db
```

Build and start:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f web
```

The web container starts only after the migration container completes successfully. Data is stored in the `shortlistos_postgres_data` volume.

Useful operations:

```bash
docker compose down                 # stop, preserving data
docker compose up -d --build        # rebuild after source changes
docker compose logs -f migrate      # inspect migrations
docker compose logs -f postgres     # inspect PostgreSQL
```

Do not add `-v` to `docker compose down` unless you intentionally want to delete the database volume.

The current Compose file runs the web tier, migrations, and PostgreSQL. It does not create an object store: configure an external S3-compatible service and buckets before starting shortlistOS. Run the optional worker and Web Clipper API separately as described below, or add equivalent services to your deployment.

## Production deployment

shortlistOS can run on any platform that supports containers and PostgreSQL. The production image is built from `apps/web/Dockerfile`:

```bash
docker build --target migrate -t shortlistos-migrate -f apps/web/Dockerfile .
docker build --target web -t shortlistos-web -f apps/web/Dockerfile .
```

A safe production topology is:

1. managed PostgreSQL with backups and TLS;
2. a run-once migration job using the `migrate` target;
3. one or more stateless `web` containers behind an HTTPS reverse proxy;
4. Redis when running multiple web replicas or when durable distributed rate limiting is needed;
5. private S3 buckets for attachments and source documents;
6. a continuously running shortlist worker if capture or enrichment is enabled;
7. a Web Clipper API service if the browser extension is enabled.

Set `NEXT_PUBLIC_BASE_URL` to the final HTTPS origin. Set `BETTER_AUTH_TRUSTED_ORIGINS` when callbacks may arrive through more than one trusted origin. Never expose PostgreSQL, Redis, the internal `WEB_CLIPPER_API_URL`, or provider secrets publicly.

The [`cloud/docker-compose.yml`](./cloud/docker-compose.yml) is an example for a Dokploy-style environment. It expects an existing external `dokploy-network` and an externally supplied PostgreSQL URL. Review image names, domains, secrets, health checks, persistence, and backup policy before using it. It is not a universal production manifest.

For every release:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
```

Run the migration image once before replacing the web workload. Back up the database before upgrades and retain the exact image tag used for rollback.

## Object storage and AWS S3

An S3-compatible object store is required. shortlistOS has no filesystem, PostgreSQL binary, or Docker-volume fallback for uploaded files. Object storage holds uploaded avatars, card attachments, source documents, Magic Inbox content and attachments, Magic Clip captures, and Web Clipper snapshots.

Create three private buckets (names are examples):

- `shortlistos-avatars`
- `shortlistos-attachments`
- `shortlistos-sources`

For AWS S3:

1. Create the buckets in one AWS region and keep **Block Public Access** enabled.
2. Enable server-side encryption and bucket versioning. Add lifecycle rules appropriate to your retention policy.
3. Create an IAM role for the workload (preferred on ECS, EKS, or EC2) or an IAM user for non-AWS hosting.
4. Grant only the required object actions on the three bucket ARNs. The app needs to read, write, and delete its own objects and may need bucket listing for relevant prefixes.
5. Configure CORS for browser-direct operations from the exact `NEXT_PUBLIC_BASE_URL` origin if your storage flow uses them. Allow only required methods and headers.
6. Set:

   ```dotenv
   S3_REGION=eu-central-1
   S3_ENDPOINT=
   S3_ACCESS_KEY_ID=
   S3_SECRET_ACCESS_KEY=
   S3_FORCE_PATH_STYLE=false
   NEXT_PUBLIC_AVATAR_BUCKET_NAME=shortlistos-avatars
   NEXT_PUBLIC_ATTACHMENTS_BUCKET_NAME=shortlistos-attachments
   SHORTLIST_SOURCE_BUCKET_NAME=shortlistos-sources
   NEXT_PUBLIC_STORAGE_DOMAIN=s3.eu-central-1.amazonaws.com
   NEXT_PUBLIC_USE_VIRTUAL_HOSTED_URLS=true
   ```

When the workload has an AWS IAM role, leave `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` empty. For MinIO, Cloudflare R2, DigitalOcean Spaces, or another S3-compatible provider, set `S3_ENDPOINT`, supply credentials, and choose `S3_FORCE_PATH_STYLE`/`NEXT_PUBLIC_USE_VIRTUAL_HOSTED_URLS` according to that provider. `NEXT_PUBLIC_STORAGE_URL` can override the public storage base URL, for example when using a CDN.

Never make source-document or attachment buckets public merely to simplify setup.

## Optional integrations

- **Email:** SMTP sends invitations and notifications. `NEXT_PUBLIC_DISABLE_EMAIL=true` disables email features. Brevo credentials additionally enable Magic Inbox attachment retrieval.
- **OAuth/OIDC:** configure any supported provider pair; password authentication remains available unless changed in the auth package.
- **Redis:** provides shared rate-limit state; without it, the app falls back to in-memory state, which is unsuitable for consistent limits across replicas.
- **Stripe:** enables Powerpack checkout and/or the legacy workspace subscription flow. Each webhook endpoint needs its matching signing secret.
- **LLM:** `LLM_CONNECTOR_API_KEY` and `LLM_CONNECTOR_MODEL` enable job-post classification.
- **OpenWebNinja:** enables company and salary enrichment. Account limits, retries, cache reuse, and polling are configurable.
- **Frankfurter:** performs deterministic currency conversion for salary data.
- **Trello:** app key and secret enable board import.
- **Novu, Discord, Axiom, Umami, PostHog:** optional notification, logging, and analytics providers.
- **Partner API:** the `PARTNER_*` group configures an external licensing/OAuth partner integration.

Third-party services have their own terms, costs, quotas, and data-processing implications. Self-hosters are responsible for those accounts and for protecting their credentials.

## Environment variables

Copy [`.env.example`](./.env.example) as the starting point. Empty optional values should be omitted in production when the platform distinguishes empty from unset.

### Core and runtime

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_BASE_URL` | Yes | Canonical public origin, including scheme |
| `BETTER_AUTH_SECRET` | Yes | Random authentication/encryption secret, at least 32 characters |
| `POSTGRES_URL` | Yes | PostgreSQL connection URL |
| `POSTGRES_PASSWORD` | Compose | Password used by the bundled PostgreSQL container |
| `WEB_PORT` | No | Host port for Compose; default `3000` |
| `CONTAINER_NAME`, `MIGRATOR_CONTAINER_NAME` | No | Container-name overrides |
| `APP_VERSION`, `NEXT_PUBLIC_APP_VERSION` | No | Build/runtime version display |
| `NODE_ENV` | No | `development`, `production`, or `test` |
| `NEXT_PUBLIC_KAN_ENV` | No | Deployment/environment identifier retained for upstream compatibility |
| `KAN_ADMIN_API_KEY` | No | Administrative API credential |
| `NEXT_API_BODY_SIZE_LIMIT` | No | Next.js API body limit; default `1mb` |
| `LOG_LEVEL` | No | `debug`, `info`, `warn`, or `error` |

### URLs, UI, and auth policy

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_LANDING_PAGE_URL` | Optional external landing/home URL |
| `NEXT_PUBLIC_GITHUB_URL` | Source-code link shown by the UI; point this at your fork |
| `NEXT_PUBLIC_ALLOW_CREDENTIALS` | Enables credential-based auth UI/flow |
| `NEXT_PUBLIC_DISABLE_SIGN_UP` | Disables public registration |
| `NEXT_PUBLIC_DISABLE_EMAIL` | Disables email-dependent features |
| `NEXT_PUBLIC_WHITE_LABEL_HIDE_POWERED_BY` | Hides the powered-by treatment |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Comma-separated trusted callback origins |
| `BETTER_AUTH_ALLOWED_DOMAINS` | Comma-separated permitted sign-in email domains |
| `NEXT_PUBLIC_USE_STANDALONE_OUTPUT` | Selects standalone Next.js output behavior |

### Email and notifications

| Variable | Purpose |
| --- | --- |
| `SMTP_HOST`, `SMTP_PORT` | SMTP server and port |
| `SMTP_USER`, `SMTP_PASSWORD` | SMTP credentials |
| `SMTP_SECURE` | TLS mode; use `false` where STARTTLS on port 587 is required |
| `SMTP_REJECT_UNAUTHORIZED` | Certificate verification; keep `true` in production |
| `EMAIL_FROM` | Sender, for example `shortlistOS <hello@example.com>` |
| `FEEDBACK_EMAIL_TO` | Feedback modal destination |
| `NOVU_API_KEY` | Novu notification provider key |
| `DISCORD_WEBHOOK_URL` | Discord notification webhook |
| `EMAIL_UNSUBSCRIBE_SECRET` | Signs unsubscribe links |

### Object storage

All bucket and connection variables in this section are required for a standard shortlistOS deployment. `S3_ENDPOINT` is the exception for AWS S3, and static credentials may be omitted when the workload receives credentials through an AWS IAM role.

| Variable | Purpose |
| --- | --- |
| `S3_REGION` | AWS/S3 region; defaults to `us-east-1` where supported |
| `S3_ENDPOINT` | Custom S3-compatible endpoint; blank for AWS |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Static credentials; omit when using an IAM role |
| `S3_FORCE_PATH_STYLE` | Use path-style bucket URLs when required |
| `S3_AVATAR_UPLOAD_LIMIT` | Avatar limit in bytes; default `2097152` |
| `NEXT_PUBLIC_STORAGE_URL` | Public storage/CDN base URL override |
| `NEXT_PUBLIC_AVATAR_BUCKET_NAME` | Avatar bucket |
| `NEXT_PUBLIC_ATTACHMENTS_BUCKET_NAME` | Card attachment bucket |
| `SHORTLIST_SOURCE_BUCKET_NAME` | Private source, inbox, and captured-page bucket |
| `NEXT_PUBLIC_STORAGE_DOMAIN` | Storage hostname used to construct object URLs |
| `NEXT_PUBLIC_USE_VIRTUAL_HOSTED_URLS` | Use `bucket.host/key` URLs |

### Powerpack, capture, and enrichment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_MAGIC_INBOX_DOMAIN` | Domain used to build Magic Inbox forwarding addresses |
| `BREVO_API_KEY` | Downloads attachments delivered through Brevo |
| `BREVO_MAGIC_INBOX_WEBHOOK_SECRET` | Bearer secret for `/api/magic_inbox/incoming_webhook` |
| `SHORTLIST_MAGIC_CLIP_WEBHOOK_SECRET` | Bearer secret for `/api/shortlist_magic_clip` |
| `LLM_CONNECTOR_API_KEY`, `LLM_CONNECTOR_MODEL` | LLM provider credential and model |
| `INBOX_CLIP_RETRY_LIMIT` | Maximum Magic Inbox/Clip processing attempts; example `3` |
| `SHORTLIST_LLM_ACCOUNT_DAILY_REQUEST_LIMIT` | Per-account LLM calls per UTC day; example `250` |
| `OPENWEBNINJA_API_KEY` | Salary and employer enrichment key |
| `OPENWEBNINJA_RETRY_LIMIT` | Enrichment attempts; example `3` |
| `OPENWEBNINJA_WORKER_POLL_INTERVAL_MS` | Worker polling interval; example `60000` |
| `OPENWEBNINJA_SALARY_CACHE_REUSE_DAYS` | Reuse window for non-empty salary results; example `30` |
| `OPENWEBNINJA_ACCOUNT_DAILY_REQUEST_LIMIT` | Per-account real provider calls per UTC day; example `250` |
| `FRANKFURTER_BASE_URL` | Currency API base; default/example `https://api.frankfurter.dev` |
| `REGION_SALARY_AVERAGE_COUNTRIES_EU` | Comma-separated EU sample countries, maximum 10 |
| `REGION_SALARY_AVERAGE_COUNTRIES_UK` | Comma-separated UK sample countries, maximum 10 |
| `REGION_SALARY_AVERAGE_COUNTRIES_US` | Comma-separated US sample countries, maximum 10 |
| `REGION_SALARY_AVERAGE_COUNTRIES_APAC` | Comma-separated APAC sample countries, maximum 10 |
| `REGION_SALARY_AVERAGE_COUNTRIES_GLOBAL` | Comma-separated global sample countries, maximum 10 |

### Web Clipper API

| Variable | Purpose |
| --- | --- |
| `WEB_CLIPPER_API_URL` | Internal Web Clipper API URL used by the web app |
| `WEB_CLIPPER_API_PORT` | API listen port; default `3010` |
| `WEB_CLIPPER_ACCESS_TOKEN_SECRET` | Random token-signing secret, minimum 32 characters |
| `WEB_CLIPPER_ENCRYPTION_KEY` | Random snapshot-encryption secret, minimum 32 characters |
| `WEB_CLIPPER_ALLOWED_ORIGINS` | Exact comma-separated `chrome-extension://` and `moz-extension://` origins |

### Payments

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser-side Stripe key |
| `STRIPE_SECRET_KEY` | Server-side Stripe key |
| `STRIPE_SHORTLIST_WEBHOOK_SECRET` | Powerpack webhook signing secret |
| `STRIPE_WEBHOOK_SECRET`, `STRIPE_WEBHOOK_SECRET_LEGACY` | Workspace subscription webhook secrets |
| `STRIPE_TEAM_PLAN_MONTHLY_PRICE_ID`, `STRIPE_TEAM_PLAN_YEARLY_PRICE_ID` | Team price IDs |
| `STRIPE_PRO_PLAN_MONTHLY_PRICE_ID`, `STRIPE_PRO_PLAN_YEARLY_PRICE_ID` | Pro price IDs |

### OAuth, OIDC, and imports

OAuth providers use the following variables. Configure only the providers you enable:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET`, `GITLAB_ISSUER`
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
- `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`
- `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET`
- `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`
- `DROPBOX_CLIENT_ID`, `DROPBOX_CLIENT_SECRET`
- `VK_CLIENT_ID`, `VK_CLIENT_SECRET`
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`
- `ROBLOX_CLIENT_ID`, `ROBLOX_CLIENT_SECRET`
- `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_CLIENT_KEY`
- `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`
- `APPLE_CLIENT_ID`, `APPLE_CLIENT_SECRET`, `APPLE_APP_BUNDLE_IDENTIFIER`
- generic OIDC: `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_DISCOVERY_URL`
- Trello import: `TRELLO_APP_API_KEY`, `TRELLO_APP_SECRET`

Register the callback URL shown by your provider using the same public origin as `NEXT_PUBLIC_BASE_URL`.

### Analytics, logging, and partner integration

| Variable | Purpose |
| --- | --- |
| `REDIS_URL` | Shared Redis connection for rate limiting |
| `AXIOM_TOKEN`, `AXIOM_DATASET` | Axiom log transport |
| `NEXT_PUBLIC_UMAMI_ID` | Umami site identifier |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | PostHog project and host |
| `NEXT_PUBLIC_PARTNER_NAME` | Partner branding label |
| `PARTNER_CLIENT_ID`, `PARTNER_CLIENT_SECRET` | Partner OAuth credentials |
| `PARTNER_REDIRECT_URL`, `PARTNER_TOKEN_URL`, `PARTNER_OAUTH_LICENSE_URL` | Partner OAuth URLs |
| `PARTNER_LICENSE_API_URL`, `PARTNER_API_KEY` | Partner license API |
| `PARTNER_API_KEY_HEADER`, `PARTNER_SIGNATURE_HEADER`, `PARTNER_TIMESTAMP_HEADER` | Custom partner request header names |

## Database operations

Schema definitions live in `packages/db/src/schema`; migrations live in `packages/db/migrations`.

```bash
pnpm db:migrate
pnpm db:studio
cd packages/db && pnpm drizzle-kit generate --name "DescribeChange"
```

Never edit an existing migration after it has been published. Add a new migration and test it against a copy of production data where practical.

## Background workers

### Background Workers

Powerpack automation runs in separate worker processes. Apply database migrations before starting them:

```bash
pnpm db:migrate
```

Run each required worker as an independent, continuously running production process:

```bash
# Magic Inbox and web clipper classification queue
pnpm --filter @kan/shortlist-queue-worker start

# Salary and company enrichment queue
pnpm --filter @kan/shortlist-enrichment-worker start

# Daily reminders and Monday weekly digests
pnpm --filter @kan/shortlist-automation-email-worker start

# Automatic card archiving and Ghosted labeling
pnpm --filter @kan/shortlist-automation-card-worker start
```

The email and card automation workers check for work once per hour. Reminder emails are generated for 07:00 in the user's configured timezone, and weekly digests are generated at 07:00 on Monday. Durable database queues prevent completed daily or weekly jobs from being generated again after a worker restart.

All workers skip deleted or archived shortlists and re-check Powerpack access immediately before processing. The automation workers intentionally remain idle during `pnpm dev`; run their `start` scripts explicitly when testing worker behavior locally.

### Email Template Preview

Preview every production React Email template locally with:

```bash
pnpm --filter @kan/email run:dev
```

Open [http://localhost:3002](http://localhost:3002). The preview server reads directly from `packages/email/src/templates`, which is the same template directory used by the application and automation email worker.

### Powerpack API Endpoints

The Powerpack checkout and Magic Inbox integrations expose the following REST endpoints from the web application:

| Method | Endpoint                                        | Authentication                                             | Purpose                                                                                                                                                                                                                                    |
| ------ | ----------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST` | `/api/shortlist_stripe/create_checkout_session` | Signed-in shortlistOS session                              | Creates a one-time Stripe Checkout session for Powerpack and returns `{ "sessionId": "..." }`. The optional JSON body `{ "withPowerpack": "yes" }` preserves the Powerpack purchase flow through the success, cancel, and login redirects. |
| `POST` | `/api/shortlist_stripe/webhook`                 | Stripe signature in the `Stripe-Signature` header          | Handles `checkout.session.completed`. A paid checkout grants or extends Powerpack for the user identified by the Checkout metadata or client reference ID.                                                                                 |
| `POST` | `/api/shortlist_magic_inbox/incoming_webhook`   | `Authorization: Bearer <BREVO_MAGIC_INBOX_WEBHOOK_SECRET>` | Receives Brevo inbound-email batches, stores supported message bodies and attachments, and enqueues Magic Inbox processing. `/api/magic_inbox/incoming_webhook` is retained as a compatibility alias.                                      |

#### Stripe configuration

Set `STRIPE_SECRET_KEY`, `STRIPE_SHORTLIST_WEBHOOK_SECRET`, and `NEXT_PUBLIC_BASE_URL`. In Stripe, create a webhook destination pointing to:

```text
https://your-shortlistos-domain.example/api/shortlist_stripe/webhook
```

Subscribe it to `checkout.session.completed` and copy that destination's signing secret into `STRIPE_SHORTLIST_WEBHOOK_SECRET`. Stripe must send the original request body; the endpoint disables Next.js body parsing so signature verification uses the raw payload.

The checkout-session endpoint is intended to be called by the signed-in web client. It returns `401` with a `loginUrl` when no valid shortlistOS session is present.

#### Brevo Magic Inbox configuration

Set `BREVO_MAGIC_INBOX_WEBHOOK_SECRET`, `NEXT_PUBLIC_MAGIC_INBOX_DOMAIN`, `SHORTLIST_SOURCE_BUCKET_NAME`, and the S3-compatible storage variables. Set `BREVO_API_KEY` when Brevo attachments need to be downloaded using attachment tokens.

Configure Brevo's inbound webhook destination as:

```text
https://your-shortlistos-domain.example/api/shortlist_magic_inbox/incoming_webhook
```

Brevo must send `POST` requests with the configured secret as a Bearer token. The JSON payload must contain an `items` array of inbound messages. Magic Inbox recipients use this address format:

```text
{boardPublicId}.{userPublicSecret}@{NEXT_PUBLIC_MAGIC_INBOX_DOMAIN}
```

Duplicate messages are ignored using the message ID and shortlist combination. Messages are also skipped when the address cannot be resolved, Magic Inbox is disabled, the shortlist is archived or deleted, or its owner's Powerpack is inactive.

Available one-shot or dedicated jobs include:

```bash
pnpm --filter @kan/shortlist-queue-worker process-sources
pnpm --filter @kan/shortlist-queue-worker process-clip
pnpm --filter @kan/shortlist-queue-worker process-inbox
pnpm --filter @kan/shortlist-enrichment-worker prepare
pnpm --filter @kan/shortlist-enrichment-worker process
pnpm --filter @kan/shortlist-enrichment-worker cleanup-cache
```

In production, supervise long-running workers, restart them on failure, and ensure only the intended number of consumers is active. Source processing requires PostgreSQL and `SHORTLIST_SOURCE_BUCKET_NAME`; classification and enrichment additionally require their provider variables.

## Web Clipper API

The API is in `apps/web-clipper-api`. It requires PostgreSQL/object-storage configuration plus all five `WEB_CLIPPER_*` values listed above. Use separate random values for token signing and snapshot encryption.

```bash
pnpm --filter @kan/web-clipper-api dev
pnpm --filter @kan/web-clipper-api build
pnpm --filter @kan/web-clipper-api start
```

Keep the service behind HTTPS in production. Set `WEB_CLIPPER_ALLOWED_ORIGINS` to the exact IDs of extension builds you control; do not use wildcard origins. `WEB_CLIPPER_API_URL` is an internal server-to-server URL and does not need to be browser-accessible.

## Development commands

```bash
pnpm dev                 # all workspace development tasks
pnpm dev:next            # web app and Web Clipper API
pnpm lint                # lint all packages
pnpm typecheck           # TypeScript checks
pnpm build               # production builds
pnpm format              # check formatting
pnpm format:fix          # apply formatting
pnpm lingui:extract      # extract translatable messages
```

User-facing strings must use Lingui. Database and API changes must preserve public-ID boundaries, workspace authorization, soft deletion, card index ordering, and activity logging.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Keep changes focused, add migrations for schema changes, and run lint and type checking before opening a pull request.

## Acknowledgements

shortlistOS is a fork of [Kan](https://github.com/kanbn/kan), the open-source project management application created by the [kan.bn](https://kan.bn) team. We are grateful to Kan's maintainers and contributors for the original codebase on which shortlistOS was built.

shortlistOS has since been adapted into a job-search workspace and extended with its shortlist-specific data model, workflows, capture services, background processing, enrichment, and Powerpack features. Copyright and attribution for code inherited from Kan remain with their original authors and contributors.

## License

shortlistOS, including the Powerpack, worker, LLM connector, and Web Clipper API code in this repository, is licensed under the [GNU Affero General Public License v3.0 or later](./LICENSE).

If you modify the software and make it available to users over a network, AGPL section 13 requires you to offer those users the Corresponding Source of the version they are using. Third-party services, APIs, trademarks, and bundled dependencies remain subject to their respective terms and licenses.

Copyright © Kan contributors and shortlistOS contributors.
