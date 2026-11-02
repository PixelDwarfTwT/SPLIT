# Backend (Supabase)

Patungan uses Supabase for authentication and PostgreSQL data. Next.js Server Actions stay in `frontend/`; this folder contains database setup and migrations, not a separate API server.

## Apply database migrations

Apply the SQL files under `backend/supabase/migrations/` in filename order using the Supabase SQL Editor:

1. `20261102000000_patungan_schema.sql` creates the schema, constraints, access policies, and RPCs.
2. `20261102000001_payment_amount_limit.sql` enforces the maximum individual payment amount.

Review the SQL output for errors before continuing. The migrations are safe to apply to the project's configured Supabase database; do not apply them to a production project until its backup and deployment process is ready.

## Administrator access

- Disable public sign-ups in Supabase Authentication settings.
- Create the administrator account from the Supabase dashboard.
- Add that account's UUID to the private administrator allowlist using the SQL instructions in the repository [README](../README.md).
- Never place the Supabase service-role key in frontend environment variables or commit credentials.

Participants do not have accounts. The authenticated administrator manages calculations through the frontend.
