nn# CleanOps — Recurring-Service Confirm & Auto-Reschedule Bot

SMS-first confirmation and constrained reschedule layer for recurring route-service businesses.

## Quick start in GitHub Codespaces

1. Open this repo in Codespaces (it will run `npm install` automatically)
2. Copy `.env.local.example` to `.env.local` and fill in all values
3. Run migrations in your Supabase project (see below)
4. `npm run dev` — app runs on port 3000

## Environment setup

```bash
cp .env.local.example .env.local
# Edit .env.local with your values
```

Generate an encryption key:
```bash
openssl rand -hex 32
```

## Database migrations

Run in order in your Supabase SQL editor:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`

## Seed sample data

After signing up and creating an org:
```bash
SEED_ORG_ID=your-org-uuid npm run seed
```

## Generate visits

```bash
curl -X POST http://localhost:3000/api/visits/generate \
  -H "Content-Type: application/json" \
  -d '{"horizon_days": 14}' \
  -b "your-session-cookie"
```

## Run tests

```bash
npm test
```

## Stack

- **Next.js 14** App Router
- **Supabase** Postgres + Auth + Edge Functions
- **Twilio** Programmable Messaging (BYO credentials)
- **Google Calendar API** (OAuth2)
- **Vitest** for tests

## Key pages

| Path | Description |
|---|---|
| `/signup` | Create account |
| `/onboarding/sms` | Connect Twilio |
| `/onboarding/calendar` | Connect Google Calendar |
| `/onboarding/import` | Import customers CSV |
| `/dashboard/today` | Today's route view |
| `/customers` | Customer list |
| `/r/{token}` | Customer action page (public) |

## v1 scope

See `01_claude_build_brief.md` for full scope. Key constraints:
- Link-first customer actions (no SMS reply parsing except STOP/HELP)
- Reschedule constrained to route-pattern slots only (max 4, 21-day horizon)
- Skip ≠ cancel
- Anytime visits never get a misleading 2h reminder
- Suppression checked before every send
- Calendar failures surfaced truthfully, never hidden
