# Keeper

[![CI](https://github.com/Debatra7/Keeper/actions/workflows/ci.yml/badge.svg)](https://github.com/Debatra7/Keeper/actions/workflows/ci.yml)
[![Security Scan](https://github.com/Debatra7/Keeper/actions/workflows/security.yml/badge.svg)](https://github.com/Debatra7/Keeper/actions/workflows/security.yml)
[![Vercel Deployment](https://img.shields.io/badge/Deployed%20with-Vercel-black?logo=vercel)](https://vercel.com)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?logo=supabase)](https://supabase.com)

A local-first browser dashboard for collections of website shortcuts with offline-first synchronization, conflict resolution, and cloud backups.

## Project Structure

```text
.github/
  workflows/
    ci.yml                      Continuous Integration pipeline (format, lint, typecheck, tests, build)
    deploy.yml                  Continuous Delivery & Vercel deployment (preview & prod)
    security.yml                CodeQL static analysis & dependency audit
  dependabot.yml                Automated weekly dependency maintenance
src/
  main.tsx                      React entry point
  styles/tailwind.css           Tailwind theme and utilities
  app/App.tsx                   App state and screen composition
  features/
    collections/                Collection model, navigation, grid, and cards
    settings/                   Preferences model and appearance settings
  lib/
    sync/                       Offline-first CDC sync engine, outbox, and conflict resolver
    supabase.ts                 Supabase client initialization & auth listeners
supabase/
  migrations/                   PostgreSQL schemas, RPCs, and RLS policies
```

## Development & Scripts

```sh
# Install dependencies
npm install --legacy-peer-deps

# Start local Vite development server
npm run dev

# Run strict TypeScript typecheck
npm run typecheck

# Check and format code with Prettier
npm run format
npm run format:check

# Run static linting with Oxlint
npm run lint
npm run lint:fix

# Run automated unit test suite (CDC sync, LWW, 3-way merge, checkpoints)
npm test

# Build production bundle (runs typecheck + vite build)
npm run build

# Preview production build locally
npm run preview

# Run the complete CI pipeline locally
npm run ci
```

## Continuous Integration & Continuous Delivery (CI/CD)

The project includes an enterprise-grade CI/CD pipeline powered by **GitHub Actions**:

### 1. Continuous Integration (`.github/workflows/ci.yml`)

Runs on every push to `main` and all Pull Requests targeting `main`:

- **Code Quality**: Prettier formatting validation and Oxlint static analysis.
- **Verification**: Strict TypeScript typechecking (`tsc --noEmit`) and automated sync engine test suite.
- **Database Verification**: Validates naming convention (`YYYYMMDDHHMMSS_name.sql`) and SQL file integrity for all Supabase migrations.
- **Production Build**: Compiles optimized production bundle and stores build artifacts.

### 2. Continuous Delivery (`.github/workflows/deploy.yml`)

- **Pull Request Preview Deployments**: Automatically builds and deploys preview environments on Vercel for every open PR and posts the unique preview URL directly to the PR comments.
- **Production Deployments**: Deploys the pre-built, tested bundle to Vercel production upon merging to `main`.
- **Database Migration Synchronization**: Safely applies pending Supabase SQL migrations against the cloud database.

### 3. Security & Dependency Governance (`.github/workflows/security.yml` & `.github/dependabot.yml`)

- **CodeQL Static Analysis**: Advanced semantic security scanner inspecting JavaScript/TypeScript code for vulnerabilities.
- **Dependency Audit**: Automated `npm audit` checking for critical and high vulnerabilities.
- **Dependabot**: Weekly automated updates for npm packages and GitHub Actions actions.

### Required GitHub Secrets

To enable deployments and cloud syncing, configure these repository secrets in **GitHub -> Settings -> Secrets and variables -> Actions**:

| Secret Name                     | Description                                   | Required For                        |
| :------------------------------ | :-------------------------------------------- | :---------------------------------- |
| `VERCEL_TOKEN`                  | Vercel Personal Access Token                  | Preview & Production deployments    |
| `VERCEL_ORG_ID`                 | Vercel Organization / User ID                 | Vercel project linking              |
| `VERCEL_PROJECT_ID`             | Vercel Project ID                             | Vercel project linking              |
| `VITE_SUPABASE_URL`             | Supabase Cloud API URL                        | Production client build & runtime   |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Public / Anon API Key                | Production client build & runtime   |
| `SUPABASE_ACCESS_TOKEN`         | Supabase CLI Access Token _(optional)_        | Automated cloud database migrations |
| `SUPABASE_DB_PASSWORD`          | Supabase Cloud Database Password _(optional)_ | Automated cloud database migrations |

## Data Storage & Offline Sync

Stable entities stay normalized in Supabase tables: `collections`, `sites`, `profiles`, `keeper_preferences`, `widgets`, and `checkpoints`. Flexible feature settings use `keeper_feature_data`, a per-user JSONB store keyed by feature name.

Local storage and IndexedDB serve as the offline-first cache; authenticated changes are persisted to Supabase via Change Data Capture (CDC), optimistic concurrency, and 3-way conflict resolution.
