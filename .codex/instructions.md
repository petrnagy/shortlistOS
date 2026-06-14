# Codex Instructions for Kan

Kan is an open-source project management tool and Trello alternative. Work in this repository should follow the existing Next.js, React, TypeScript, Tailwind, tRPC, Drizzle, Better Auth, and Lingui conventions used across the workspace.

## Stack And Workspace

- Frontend: Next.js 15, React 18, TypeScript, Tailwind CSS
- Backend: tRPC on Node.js
- Database: PostgreSQL with Drizzle ORM
- Monorepo: pnpm workspaces with Turbo
- Authentication: Better Auth
- Internationalization: Lingui

## Repository Layout

- `apps/web/` contains the Next.js web app
- `packages/api/` contains tRPC routers and API utilities
- `packages/db/` contains Drizzle schema, migrations, and repositories
- `packages/auth/`, `packages/email/`, `packages/stripe/`, and `packages/shared/` contain supporting packages
- `tooling/` contains shared ESLint, Prettier, Tailwind, and TypeScript config

## Core Commands

- Install dependencies with `pnpm install`
- Start development with `pnpm dev`
- Run lint with `pnpm lint`
- Run type checks with `pnpm typecheck`
- Format code with `pnpm format:fix`
- Run database migrations with `pnpm db:migrate`
- Extract translations with `pnpm lingui:extract`

## Frontend Rules

- Put React components in `apps/web/src/components/`
- Put page-level views in `apps/web/src/views/`
- Put custom hooks in `apps/web/src/hooks/`
- Put shared utilities in `apps/web/src/utils/`
- Put locale files in `apps/web/src/locales/`
- Use Tailwind CSS classes and existing UI patterns
- Use tRPC React Query hooks for server state and query invalidation
- Use Lingui `t` template literals for user-facing strings
- Keep changes minimal, scoped, and consistent with the existing design system

## API And Data Rules

- Create tRPC routers in `packages/api/src/routers/`
- Validate inputs with Zod
- Use `protectedProcedure` for authenticated endpoints and `publicProcedure` for public endpoints
- Use `TRPCError` for user-facing failures
- Check workspace membership with `assertUserInWorkspace` when access depends on a workspace
- Do not expose internal database IDs in URLs or API responses; use `publicId` externally
- Use transactions for multi-step database changes
- Preserve sequential card indices when moving, inserting, or deleting cards
- Record significant card changes in `card_activity`

## Code Style And Safety

- Use strict TypeScript and avoid `any` unless there is no reasonable alternative
- Prefer kebab-case filenames, PascalCase React components, camelCase functions, and UPPER_SNAKE_CASE constants
- Use `deletedAt`-based soft deletes and filter them out in queries
- Use `@kan/logger` instead of `console.log`
- Preserve existing architecture and naming unless a change is required
- Do not create commits, branches, or tags unless the user explicitly asks

## Environment Variables

When adding or changing an environment variable, update all relevant places:

- `.env.example`
- `turbo.json`
- `docker-compose.yml`
- `cloud/docker-compose.yml`
- `README.md`

## Validation

- Run the smallest useful check for the files you touched before reporting done
- Prefer targeted lint, typecheck, or tests over broad repository-wide runs when possible
- For UI changes, verify the affected state visually when practical and mention any unverified states
