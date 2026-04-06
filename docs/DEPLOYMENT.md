# FillBuddy — Production Deployment Strategy

> **Last updated:** 2026-04-06  
> **Domain:** fillbuddy.org (managed at Cloudflare)  
> **Repository:** github.com/aspriya/fillbuddy.org

---

## Strategy Overview

FillBuddy is currently a **fully static Next.js application** — every page is pre-rendered at build time and all PDF processing runs client-side in the browser. There is no server component today. This makes deployment dramatically simpler and cheaper than a typical SaaS.

The strategy is deliberately phased to stay at $0 until a backend is actually needed:

| Phase | What's running | Cost |
|-------|---------------|------|
| **Phase 1 — Launch** | Cloudflare Pages (static site) | **$0/month** |
| **Phase 2 Dev** | Cloudflare Pages + Supabase Free | **$0/month** |
| **Phase 2 Prod** | Cloudflare Pages + Supabase Pro | **$25/month** |

### Why Cloudflare Pages?

- **Your domain is already on Cloudflare.** `fillbuddy.org` was purchased through Cloudflare Registrar, so nameservers already point to Cloudflare. Attaching a custom domain to a Pages project is 3 clicks with zero DNS propagation wait — no external records to configure.
- **Unlimited bandwidth at $0.** Cloudflare Pages has no bandwidth cap on the free plan, unlike Firebase Hosting (360 MB/day) or Vercel Hobby (100 GB/month).
- **300+ global edge PoPs.** Your static HTML/JS/CSS is served from the nearest Cloudflare edge node to each user — typically faster than Vercel's edge for non-US traffic.
- **Automatic preview deployments.** Every PR gets a unique `*.pages.dev` preview URL before merging to production.

### Why Supabase (Phase 2)?

When auto-fill profiles and template library ship, you need: a relational database (Postgres), file storage (PDF templates), and authentication. Supabase provides all three in one service with a single JS client library — replacing what would otherwise require Cloud SQL + Cloud Storage + Firebase Auth as three separate GCP services.

---

## Phase 1 — Deploy to Cloudflare Pages

### What You're Deploying

The Next.js app is compiled into a static export (`out/` directory) — plain HTML files, client-side JS bundles, and static assets. Cloudflare Pages serves this from the edge. There is no Node.js server running at runtime.

### Step 1 — Add `output: 'export'` to next.config.ts

This tells Next.js to emit a fully static `out/` directory instead of a `.next/` server bundle. Without this, Cloudflare Pages won't know how to run the app.

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",          // ← add this line
  turbopack: {
    resolveAlias: {
      canvas: "./src/lib/canvas-shim.js",
    },
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
```

**Why this works:** FillBuddy has no API routes, no `getServerSideProps`, and no server actions — it's already a pure client-side application. `output: 'export'` is valid because nothing in the app requires a server at runtime.

**Verify locally before deploying:**
```bash
npm run build
# You should see an "out/" directory created at the project root
# All pages listed as "(Static)" in the build output
```

### Step 2 — Connect the Repository to Cloudflare Pages

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create application** → **Pages** tab.
2. Select **Connect to Git** → authorize Cloudflare to access your GitHub account.
3. Select the `aspriya/fillbuddy.org` repository → **Begin setup**.
4. Configure the build settings:

   | Setting | Value |
   |---------|-------|
   | Project name | `fillbuddy` |
   | Production branch | `main` |
   | Framework preset | **Next.js (Static HTML Export)** |
   | Build command | `npx next build` |
   | Build output directory | `out` |
   | Root directory | *(leave blank — it's the repo root)* |

5. Click **Save and Deploy**. Cloudflare will:
   - Clone your repo
   - Install dependencies via `npm ci`
   - Run `npx next build` (which writes to `out/`)
   - Upload the `out/` directory to the Cloudflare edge network globally
   - Assign a `fillbuddy.pages.dev` URL

> **What "deploy" means technically:** Cloudflare ingests every file in `out/` into their KV (key-value) storage, which is replicated across 300+ edge nodes. Requests hit the nearest PoP and are served directly from memory — there is no origin server.

### Step 3 — Attach Your Custom Domain

Since `fillbuddy.org` is already a Cloudflare zone on your account, this is automatic:

1. In the Pages project → **Custom domains** → **Set up a domain**.
2. Enter `fillbuddy.org` → Continue.
3. Cloudflare detects that this zone is already on your account and creates the CNAME record automatically. No manual DNS editing needed.
4. Also add `www.fillbuddy.org` as a second custom domain following the same steps.
5. Optional: Add a redirect rule to send `www.fillbuddy.org` → `fillbuddy.org` (or vice versa) via **Rules → Redirect Rules** in the Cloudflare dashboard.

> **What's happening technically:** Cloudflare adds a CNAME record in your zone's DNS that points `fillbuddy.org` → `fillbuddy.pages.dev`. Because both are on the same Cloudflare account, traffic is routed internally without leaving Cloudflare's network. TLS certificates are provisioned automatically.

### Step 4 — Configure Environment Variables (if needed)

Currently FillBuddy has no secrets or server-side config. Skip this for Phase 1. When Phase 2 begins, environment variables will be set here — not in the repo.

Settings are at: Pages project → **Settings** → **Environment variables**.

Variables set here are available during the **build step** (as `process.env.VAR`) for static site generation. They are **not** shipped to the browser unless prefixed with `NEXT_PUBLIC_`.

### Step 5 — Verify the Deployment

- Visit `https://fillbuddy.org` — should serve the app over HTTPS.
- Open DevTools → Network → confirm all resources return 200.
- Check the build logs: Pages project → **Deployments** → click the latest deployment → **View build log**.
- Test the full app flow: upload a PDF, annotate, save `.fillbuddy`, reload, resume.

### How CI/CD Works (Automatic Going Forward)

Every `git push` to `main` triggers a new deployment automatically:

```
git push origin main
        ↓
Cloudflare Pages webhook fires
        ↓
Cloudflare clones repo at HEAD
        ↓
npm ci → npx next build
        ↓
out/ uploaded to edge network globally
        ↓
fillbuddy.org updated (zero downtime)
```

Every Pull Request gets a preview URL:
```
PR #7 opened → https://7.fillbuddy.pages.dev
PR merged   → Production deployment
```

### Rollback

If a bad deployment goes out:

Pages project → **Deployments** → find the previous good deployment → **Rollback to this deployment**. Takes ~10 seconds with no rebuild required.

---

## Phase 2 Development — Adding Supabase (Free Tier)

Phase 2 begins when you start building auto-fill profiles or the template library. The frontend stays on Cloudflare Pages. Supabase provides the backend.

### What Supabase Gives You

| Supabase service | What it replaces in your app | Used for |
|-----------------|------------------------------|---------|
| **Postgres** | Nothing today | User profiles, saved annotation configs, template metadata |
| **Storage** | Nothing today | PDF template files, user-uploaded assets |
| **Auth** | Nothing today | Email/password, Google OAuth, magic link |
| **Edge Functions** | Nothing today | Server-side logic (e.g., PDF processing jobs) |
| **Row Level Security (RLS)** | Nothing today | Per-user data isolation at the database layer |

### Free Tier Limits (Development)

| Resource | Free limit | Notes |
|---------|-----------|-------|
| Database | 500 MB | Plenty for development |
| File storage | 1 GB | Enough for a template library prototype |
| Egress | 5 GB | Per month |
| Auth MAUs | 50,000 | Monthly active users |
| API requests | Unlimited | — |
| Projects | 2 | — |
| **Inactivity pause** | **After 1 week** | Free projects pause if no traffic — unacceptable for production |

> **Important:** The 1-week inactivity pause is why Free stays in development only. There's no automatic wake-up — users would get an error until you manually unpause via the dashboard.

### Step 1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Choose an organization (create one if needed).
3. Set:
   - **Name:** `fillbuddy-dev`
   - **Database password:** Generate a strong one and store it in a password manager. This is the raw Postgres password — you won't need it daily but losing it is painful.
   - **Region:** Choose the region closest to your primary user base. For a global audience, `us-east-1` (North Virginia) or `eu-west-1` (Ireland) are the lowest-latency options across continents.
4. Click **Create new project** — provisioning takes ~2 minutes.

### Step 2 — Understand the Supabase Architecture

After creation, Supabase gives you:

```
Your Supabase project
├── Postgres instance (dedicated, with PostgREST auto-REST API)
├── GoTrue (Auth service — handles sessions, JWTs, OAuth)
├── Storage service (S3-compatible, stores files in a GCS bucket behind the scenes)
└── Edge Functions (Deno runtime, deployed globally)

Access layer:
├── REST API:  https://<project-ref>.supabase.co/rest/v1/
├── Auth:      https://<project-ref>.supabase.co/auth/v1/
├── Storage:   https://<project-ref>.supabase.co/storage/v1/
└── Realtime:  wss://<project-ref>.supabase.co/realtime/v1/
```

Everything is accessed through the `@supabase/supabase-js` client, which routes calls to the correct sub-service.

### Step 3 — Install the Supabase Client

```bash
npm install @supabase/supabase-js
```

### Step 4 — Configure Environment Variables

Create `.env.local` in the project root (this file is already in `.gitignore` by default in Next.js):

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

Find these values: Supabase Dashboard → **Project Settings** → **API**.

The **anon key** is the public key — it's safe to expose in the browser. Row Level Security (RLS) policies on your database tables are what actually restrict access, not the key itself. The **service role key** must never go in frontend code — it bypasses RLS entirely.

**Add to Cloudflare Pages (for the build):**

Pages project → **Settings** → **Environment variables** → Add both variables. Set them for both **Production** and **Preview** environments (you can use different Supabase projects for each).

### Step 5 — Create the Supabase Client Singleton

Create `src/lib/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

Import this singleton wherever you need database or auth access. Do not call `createClient` multiple times — it maintains a connection pool and session state.

### Step 6 — Design the Initial Schema

Run this SQL in Supabase Dashboard → **SQL Editor**:

```sql
-- User profiles (extends the built-in auth.users table)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  created_at timestamptz default now() not null
);

-- Auto-fill configurations (saved annotation positions + defaults)
create table public.autofill_configs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  config jsonb not null,  -- stores annotation positions, field values, etc.
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Template metadata (the actual files live in Storage)
create table public.templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,  -- null = public template
  name text not null,
  description text,
  storage_path text not null,  -- path in the Supabase Storage bucket
  page_count integer,
  is_public boolean default false,
  created_at timestamptz default now() not null
);

-- Enable Row Level Security on all tables
alter table public.profiles enable row level security;
alter table public.autofill_configs enable row level security;
alter table public.templates enable row level security;

-- RLS policies: users can only see and edit their own data
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can manage own configs"
  on public.autofill_configs for all using (auth.uid() = user_id);

create policy "Users can manage own templates"
  on public.templates for all using (auth.uid() = user_id);

create policy "Anyone can view public templates"
  on public.templates for select using (is_public = true);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

> **What Row Level Security does:** Even though the anon key is public and anyone can hit your REST API endpoint, RLS policies at the PostgreSQL level ensure that `SELECT * FROM autofill_configs` only returns rows where `user_id = auth.uid()` — the currently authenticated user. No application-level filtering needed.

### Step 7 — Create the Storage Bucket

In Supabase Dashboard → **Storage** → **New bucket**:

- **Name:** `templates`
- **Public bucket:** No (files are private, accessed via signed URLs)

Access policies for Storage are configured separately from table RLS. Go to **Storage** → **Policies** → Add policies allowing:
- Authenticated users to upload to `templates/{user_id}/*`
- Public read access to `public-templates/*` (for the shared template library)

---

## Phase 2 Production — Upgrading to Supabase Pro

When you're ready to go live with the backend features, upgrade the Supabase project from Free to Pro.

### What Changes at Pro ($25/month)

| Resource | Free | Pro |
|---------|------|-----|
| Database | 500 MB | 8 GB |
| File storage | 1 GB | 100 GB |
| Egress | 5 GB | 250 GB |
| **Inactivity pause** | **After 1 week** | **Never** |
| Backups | None | Daily, 7-day retention |
| Log retention | 1 day | 7 days |

The $25/month includes $10 in compute credits, covering one Micro instance (1 GB RAM, 2-core ARM). For FillBuddy at early production scale this is sufficient.

### Upgrade Steps

1. Supabase Dashboard → **Organization** → **Billing** → **Upgrade to Pro**.
2. Enter payment information. The project resumes immediately and the inactivity pause is permanently disabled.
3. No code changes, no migrations, no redeployment needed. The Supabase URL and keys stay the same.

### Create a Separate Production Project

Best practice: use separate Supabase projects for development and production. This prevents dev data leaking into prod and lets you test schema migrations safely.

1. Create a new Supabase project: `fillbuddy-prod` on the Pro plan.
2. Run your schema SQL in the new project.
3. Set the production Supabase URL and keys in Cloudflare Pages environment variables — specifically under the **Production** environment (not Preview).
4. Your Preview deployments (from PRs) keep using the dev Supabase project.

In Cloudflare Pages → **Settings** → **Environment variables**, set values per environment:

| Variable | Production value | Preview value |
|---------|-----------------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<prod-ref>.supabase.co` | `https://<dev-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod anon key | dev anon key |

### Enabling Auth in Production

Configure the allowed redirect URLs in Supabase before enabling OAuth:

Supabase Dashboard → **Authentication** → **URL Configuration**:

- **Site URL:** `https://fillbuddy.org`
- **Redirect URLs:** Add `https://fillbuddy.org/**` and `https://*.fillbuddy.pages.dev/**`

For Google OAuth (recommended for Phase 2):

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**.
2. Set Authorized redirect URI to: `https://<prod-ref>.supabase.co/auth/v1/callback`
3. Copy the Client ID and Secret into Supabase → **Authentication** → **Providers** → **Google**.

---

## Database Migrations Workflow

As the schema evolves, you need a way to track and apply changes safely. Supabase provides a CLI for this.

### Install Supabase CLI

```bash
npm install -g supabase
supabase login   # opens browser, authenticates via supabase.com
```

### Initialize Local Development

```bash
supabase init                          # creates supabase/ directory
supabase link --project-ref <dev-ref>  # links to your dev Supabase project
supabase db pull                       # pulls current schema to supabase/migrations/
```

### Create a Migration

```bash
supabase migration new add_template_tags
# Creates: supabase/migrations/20260406120000_add_template_tags.sql
```

Edit the generated file with your SQL changes. Then:

```bash
supabase db push     # applies migrations to linked (dev) project
```

For production: `supabase db push --linked` after relinking to the prod project, or apply migrations manually via the SQL editor as part of a controlled release process.

---

## Monitoring and Observability

### Cloudflare Pages Analytics

Available in the Cloudflare dashboard at no extra cost:
- Request count, bandwidth, and error rate by deployment
- Requests by country and edge node
- Build duration history

### Supabase Dashboard

- **Database** → **Query Performance**: Shows slow queries (highlight inefficient patterns early)
- **Auth** → **Users**: Track signups and active users
- **Storage** → Usage metrics per bucket
- **Logs** → API logs (7-day retention on Pro)

### Recommended: Set a Supabase Spend Cap

On the Pro plan, Supabase has a spend cap that prevents surprise bills. By default it's enabled at $0 above the base plan, meaning if you hit quota limits on any resource (storage, egress) the service throttles rather than billing overages. Disable the spend cap only when you're confident in your usage patterns.

Dashboard → **Organization** → **Billing** → **Cost Control**.

---

## Future Migration Path: Adding Server-Side Logic

When FillBuddy needs server-side computation (e.g., server-rendered pages, API routes for webhooks, background PDF processing jobs), the lowest-friction upgrade path stays within the Cloudflare ecosystem:

**Current (Phase 2):**
```
Browser → Cloudflare Pages (static HTML) → Supabase (DB + Auth + Storage)
```

**Future (when API routes are needed):**
```
Browser → Cloudflare Workers (Next.js SSR + API routes) → Supabase
```

Cloudflare Workers can run Next.js via the `@cloudflare/next-on-pages` adapter or the new Workers for Next.js integration. The Supabase connection and all environment variables remain identical — only the Cloudflare deployment type changes from Pages (static) to Workers (SSR). This migration does not require changing the Supabase setup or any frontend code.

**When to consider this upgrade:**
- Adding authenticated webhook endpoints (e.g., payment provider callbacks)
- Server-side PDF pre-processing or conversion jobs
- API rate limiting per user that must be enforced server-side
- Dynamic `og:image` generation per template

---

## Cost Summary

| Period | Stack | Monthly cost |
|--------|-------|-------------|
| Now | Cloudflare Pages | **$0** |
| Phase 2 dev | Cloudflare Pages + Supabase Free | **$0** |
| Phase 2 prod launch | Cloudflare Pages + Supabase Pro | **$25** |
| At scale (>250 GB file egress) | Same + Supabase storage overage | **$25 + $0.021/GB over 100 GB** |

There is no Cloudflare cost at any point in this roadmap — Pages remains free regardless of traffic volume.
