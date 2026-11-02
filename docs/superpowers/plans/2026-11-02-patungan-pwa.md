# Patungan PWA Implementation Plan

> **For agentic workers:** This plan is executed inline. Each task uses test-first implementation where applicable.

**Goal:** Build the Patungan administrator PWA for menu-based bill splitting with secure Supabase persistence and independent participant payments.

**Architecture:** Next.js App Router with TypeScript and Tailwind. A single administrator authenticates through Supabase SSR; protected server actions persist one draft session through an atomic PostgreSQL RPC and finalize it through a server-recalculated completion RPC. Pure integer-Rupiah functions own all calculations.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Supabase, Zod, React Hook Form, Lucide React, Vitest, Playwright.

**Spec:** `C:/Users/USER/Downloads/PRD (2).md`, `C:/Users/USER/Downloads/DESIGN (1).md`, `C:/Users/USER/Downloads/TECH_STACK.md`, and the user's Patungan master prompt.

## Global Constraints

- Primary language: Indonesian; currency: integer Rupiah (IDR).
- The workflow has exactly three steps: Peserta, Pesanan, Ringkasan & Pembayaran.
- Maximum 20 participants; participants have no accounts.
- Payments are independent and never transferred across participants.
- Only an authenticated administrator may read or mutate private data.
- Financial values use BIGINT in PostgreSQL and integer arithmetic in TypeScript.
- Completed sessions preserve details and cannot be silently edited.
- Cache public static assets only; never cache private financial data.
- Do not deploy or make external irreversible changes.

## Review Focus

- Participant names differing only by case/outer whitespace must be rejected; test normalization and duplicate detection.
- Inputs beyond safe integer/database bounds must be rejected before arithmetic; test validation boundaries.
- Removing a participant must also remove their draft orders/payments and preserve remaining menu selections; test draft reconciliation.
- Concurrent draft saves/completion must not mutate a completed session; test database status guards.
- Missing Supabase configuration must fail clearly without exposing secrets; verify setup and protected routes.

---

### Task 1: Project foundation and calculation engine

**Files:** Next.js package/configuration, `src/lib/calculations/bill.ts`, `src/lib/currency.ts`, `tests/unit/bill.test.ts`, `README.md`.

**Interfaces:** Produces typed participant, menu/order, payment, and summary calculation functions for UI and server use.

- [ ] Write tests for menu/group/participant totals and exact, over-, under-, and zero-payment cases using integer Rupiah.
- [ ] Run tests and confirm expected missing-module failure.
- [ ] Scaffold the app and implement only the tested calculation and currency functions.
- [ ] Run unit tests and TypeScript check.

### Task 2: Supabase schema, authentication, and persistence

**Files:** `supabase/migrations/*.sql`, `src/lib/supabase/*`, `src/actions/bill-session.ts`, `.env.example`, middleware/proxy.

**Interfaces:** Authenticated administrator session; Zod-validated draft save, load, and completion actions; database RPCs provide atomic draft replacement and server-side recalculation/locking.

- [ ] Add SQL policy/constraint checks for ownership, 20-person maximum, positive prices/quantities, nonnegative integer payments, same-session foreign keys, and immutable completed sessions.
- [ ] Implement protected Supabase SSR clients and route redirects without public signup.
- [ ] Implement authenticated actions and database RPC integration.
- [ ] Verify type/lint and database migration structure.

### Task 3: Three-step calculator UI

**Files:** `src/app/*`, `src/components/calculator/*`, `src/components/ui/*`, styles.

**Interfaces:** Responsive Indonesian workflow consumes calculation functions from Task 1 and persisted actions from Task 2.

- [ ] Implement participant management, menu/order editor, summary/payment breakdown, and completed state.
- [ ] Preserve draft while navigating; validate inputs and reflect derived totals immediately.
- [ ] Match the supplied sage/ivory design tokens and accessible mobile interaction targets.
- [ ] Verify unit tests, lint, and production build.

### Task 4: PWA, end-to-end coverage, and operations docs

**Files:** `src/app/manifest.ts`, `public/sw.js`, `public/icons/*`, `tests/e2e/*`, Playwright/Vitest config, `.env.example`, `README.md`.

**Interfaces:** Installable static shell; end-to-end flow covers the authenticated calculator and completion.

- [ ] Add manifest/icons and public-static-only service worker caching.
- [ ] Add Playwright coverage for login protection and the three-step flow where configured.
- [ ] Document Supabase project setup, migration, admin provisioning, local run, build, and Vercel deployment.
- [ ] Run available tests and production build; report external Supabase credentials/browser availability gaps.

