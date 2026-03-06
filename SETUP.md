# Leads Manager — Setup Guide

## 1. Supabase Database

1. Go to [supabase.com](https://supabase.com) → New Project
2. Once created, go to **Settings → Database → Connection string**
3. Get both strings:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`
   - **Session pooler / Direct** (port `5432`) → `DIRECT_URL`
4. Edit `.env` and replace both placeholder URLs with your real ones

## 2. NextAuth Secret

Generate a secure random secret:

```bash
# PowerShell
[System.Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Paste it as `NEXTAUTH_SECRET` in `.env`

## 3. Run Database Migration

```bash
npm run db:migrate
# or, for a quick push without migration files:
npm run db:push
```

## 4. Seed the First Admin User

```bash
npm run seed
# Default: admin@example.com / admin1234
# Override: set SEED_EMAIL and SEED_PASSWORD in .env first
```

## 5. Start Development Server

```bash
npm run dev
# Open: http://localhost:3000
# Log in with admin@example.com / admin1234
```

## 6. Deploy to Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Web Service → connect your repo
3. Render auto-detects `render.yaml`
4. Set Environment Variables on Render:
   - `DATABASE_URL` — Supabase transaction pooler URL
   - `DIRECT_URL` — Supabase direct URL
   - `NEXTAUTH_SECRET` — your generated secret
   - `NEXTAUTH_URL` — `https://your-app-name.onrender.com`

## Project Structure

```
src/
  app/
    (protected)/          ← requires login
      dashboard/          ← leads browser
      admin/
        files/            ← CSV upload
        users/            ← user management
    api/
      auth/[...nextauth]  ← NextAuth handler
      leads/              ← paginated/filtered leads API
      leads/filters/      ← distinct filter values
      admin/upload/       ← CSV ingest
      admin/files/        ← file list + delete
      admin/users/        ← user CRUD
    login/                ← login page
  components/
    leads-table.tsx       ← TanStack Table component
    filter-panel.tsx      ← search + filter UI
    lead-detail-drawer.tsx ← row detail side panel
    navbar.tsx
  lib/
    auth.ts               ← NextAuth config
    prisma.ts             ← Prisma client singleton
prisma/
  schema.prisma           ← DB models
  seed.ts                 ← admin seeder
```

## User Roles

| Role   | Can do                                          |
|--------|-------------------------------------------------|
| ADMIN  | Upload/delete CSVs, manage users, browse leads  |
| VIEWER | Browse and filter leads only                    |

## CSV Format

Any CSV is accepted. These columns are mapped to dedicated fields:

`business_name`, `phone`, `address`, `city_state`, `rating`, `review_count`,
`website_domain`, `claimed`, `detail_path`, `search_niche`, `search_location`,
`scraped_at`, `email`, `website_full`, `facebook`, `twitter`, `linkedin`,
`instagram`, `enrichment_status`, `enriched_at`

Any **extra columns** are stored in a JSON `extraFields` column and shown in the detail drawer — no schema change required.
