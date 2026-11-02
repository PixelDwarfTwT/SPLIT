# Patungan

Patungan is a mobile-first PWA for calculating a shared meal bill by menu and portions. An administrator enters participant names, records each menu and the portions ordered, then reviews each person's bill, payment, change, and shortfall.

## Repository layout

- `frontend/` contains the Next.js app, Server Actions, PWA assets, dependencies, configuration, and tests.
- `backend/` contains Supabase migrations and database setup notes. Supabase is the managed backend; there is no separate API server.

## Requirements

- Node.js 20.9 or newer and npm
- A Supabase project with email/password authentication enabled
- A modern browser; an internet connection is required for Supabase operations

## Local setup

```bash
npm install
Copy-Item frontend/.env.example frontend/.env.local
npm run dev
```

Set these values in `frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The publishable key is safe for browser use only when Row Level Security is enabled. Never put a service-role key in this app.

## Supabase setup

1. Create a Supabase project and copy the project URL and publishable key to `frontend/.env.local`.
2. In Supabase Authentication settings, disable public sign-ups. Create the administrator account from the Supabase dashboard or the Supabase CLI.
3. Follow `backend/README.md` and apply SQL files in `backend/supabase/migrations/` in filename order.
4. In Authentication → Users, copy the administrator's UUID. Register the UUID in the protected allowlist using the SQL editor:

   ```sql
   insert into private.admin_users (user_id)
   values ('ADMIN-AUTH-USER-UUID');
   ```

5. Configure password recovery and SMTP in Supabase before enabling it for the administrator.

All exposed tables have RLS enabled. Only a user listed in `private.admin_users` can use the application RPCs or access session records. Draft replacement and completion run as database transactions; completion recalculates totals from menu and order rows and locks the session. Completed records remain in the database and reject edits.

## Development commands

```bash
npm run dev
npm test
npm run lint
npm run build
```

For Playwright, start `npm run dev` in one terminal, then run `npm run test:e2e` in another. Playwright requires Chromium (`npx playwright install chromium`). The full signed-in workflow additionally requires a Supabase test project and a provisioned administrator. Never use real financial data in preview/test projects.

## PWA

The App Router manifest is in `frontend/src/app/manifest.ts`. The service worker at `frontend/public/sw.js` caches only public icons and Next.js static build assets; authenticated pages and financial requests are never cached. The app requires HTTPS outside localhost to install as a PWA.

The icons can be regenerated with:

```bash
node frontend/scripts/generate-icons.mjs
```

## Production and Vercel

1. Push the repository to GitHub and import it in Vercel.
2. Set the Vercel Root Directory to `frontend` and enable access to files outside that directory for the npm workspace lockfile.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_APP_URL` as Vercel environment variables.
4. Apply the migrations to the production Supabase project and provision its administrator UUID in `private.admin_users`.
5. Run `npm run build`, then deploy the Vercel project over HTTPS.

The project does not deploy itself or create external Supabase/Vercel resources.
