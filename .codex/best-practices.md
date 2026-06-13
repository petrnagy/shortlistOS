# Codex Best Practices for Kan

These notes are distilled from `.github/` instructions, issue templates, and workflows.

## Task Intake

- For bugs, capture the observed behavior, reproduction steps, expected behavior, environment, and relevant screenshots or logs.
- For features, understand the user problem, the desired solution, considered alternatives, and any implementation constraints before making broad changes.
- Keep implementation scope focused on the requested behavior.

## Implementation

- Follow the repository conventions in `instructions.md`.
- Prefer existing app, API, database, and design patterns over introducing new frameworks or architectural styles.
- Use workspace packages and existing helpers for auth, logging, data access, server state, modals, popups, and i18n.
- Keep internal database IDs out of URLs, API responses, and frontend-facing contracts.
- Use transactions for related database writes and preserve card index ordering.
- Create activity records for significant card changes.

## Internationalization

- Use Lingui `t` template literals for all user-facing strings.
- When changing translatable UI, run `pnpm lingui:extract` when practical.
- The GitHub translation workflow runs on `main`, extracts translations in `apps/web`, uses Lingo.dev, then compiles locale message files.
- If translations are part of the task, compile with `pnpm lingui:compile` from `apps/web` or the equivalent workspace command when available.

## Verification

- Run the smallest meaningful check for touched files before reporting done.
- Common checks:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm lingui:extract`
  - `pnpm db:migrate`
- For database schema changes, create new migrations instead of editing existing migrations.
- For Docker or release-affecting changes, consider whether `apps/web/Dockerfile`, migration image behavior, version build args, or generated translation files are affected.

## Release And CI Awareness

- Docker images are built for pull requests to `main`, release tags matching `v*.*.*`, and after the Translate workflow completes on `main`.
- Release tags are treated as semantic versions, with the leading `v` removed for the application version.
- Non-release builds derive an application version from `git describe` or the commit hash.
- Published images include both the web image and a migrate image.
- GitHub Actions pins several third-party actions by commit SHA; preserve that security posture when editing workflows.

## Final Response Checklist

When reporting completed work, include:

- What changed
- Files changed
- Checks run and their results
- Any remaining risks, skipped checks, or blockers
