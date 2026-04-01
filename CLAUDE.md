# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Internal observability dashboard — Next.js 15 app that queries Datadog, Mezmo, and Sentry APIs and displays results in a browser UI. Runs on port 3007.

## Commands

```bash
npm run dev    # start dev server (port 3007)
npm run build  # production build
npm run start  # start production server (port 3007)
```

## Environment Variables

Credentials live in `.env.local` (gitignored). See `.env.local.example` for required keys:
- `DD_API_KEY` / `DD_APP_KEY` — Datadog
- `MEZMO_SERVICE_KEY` — Mezmo log export
- `SENTRY_AUTH_TOKEN` — Sentry personal token (`alerts:read`, `event:read`, `project:read` scopes)

API calls to external services should be made from **Route Handlers** (`src/app/api/`) so credentials are never exposed to the browser.

## Tech Stack

- Next.js 15 App Router (`src/app/`)
- React 19, TypeScript, Tailwind CSS
- No testing framework configured yet

## Conventions

- Use `type` over `interface` in TypeScript
- Use `const` arrow functions over `function` declarations
- Keep API route handlers in `src/app/api/`
- Keep UI components colocated with the page or in `src/components/`
