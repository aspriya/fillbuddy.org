# FillBuddy — Production Deployment Strategy

> **Last updated:** 2026-04-06
> **Domain:** fillbuddy.org (managed at Cloudflare)
> **Repository:** github.com/aspriya/fillbuddy.org

---

## Strategy Overview

FillBuddy is currently a **fully static Next.js application** — every page is pre-rendered at build time and all PDF processing runs client-side in the browser. There is no server component today. This makes deployment dramatically simpler and cheaper than a typical SaaS.

The strategy is deliberately phased to stay at $0 until a backend is actually needed:

| Phase                       | What's running                   | Cost                |
| --------------------------- | -------------------------------- | ------------------- |
| **Phase 1 — Launch** | Cloudflare Workers                 | **$0/month**  |
| **Phase 2 Dev**       | Cloudflare Workers + Supabase Free | **$0/month**  |
| **Phase 2 Prod**      | Cloudflare Workers + Supabase Pro  | **$25/month** |

### Why Cloudflare Workers?

Cloudflare has made **Workers** the primary deployment target for Next.js, superseding the older static Pages export approach. Workers run your app in lightweight V8 isolates at 300+ global edge locations — the same JavaScript engine as Chrome, but deployed at the network edge with no Node.js.

- **Your domain is already on Cloudflare.** `fillbuddy.org`'s nameservers already point to Cloudflare. Attaching a custom domain is 3 clicks in the same dashboard — zero DNS propagation wait.
- **Unlimited bandwidth at $0.** No bandwidth cap on the free tier, unlike Firebase Hosting (360 MB/day) or Vercel Hobby (100 GB/month).
- **Full Next.js feature support.** No `output: 'export'` constraint. SSR, API routes, Server Actions, and ISR all work — FillBuddy's current static pages are still served as cached edge assets. When Phase 2 adds API routes, nothing needs re-architecting.
- **Automatic preview deployments.** Every PR gets its own Worker version at a unique URL via `wrangler versions upload`.

### Why Supabase (Phase 2)?

When auto-fill profiles and template library ship, you need: a relational database (Postgres), file storage (PDF templates), and authentication. Supabase provides all three in one service with a single JS client library — replacing what would otherwise require Cloud SQL + Cloud Storage + Firebase Auth as three separate GCP services.

---

## Phase 1 — Deploy to Cloudflare Workers

### How This Works (Conceptually)

The **`@opennextjs/cloudflare` adapter** (OpenNext) is the bridge between Next.js and Cloudflare Workers:

```
npm run build  (local)      →  plain .next/ directory
opennextjs-cloudflare build →  transforms .next/ into .open-next/
                                 ├── worker.js   (the V8 isolate entry point)
                                 └── assets/     (static files, cached at edge)
wrangler deploy             →  uploads to Cloudflare's global network
```

FillBuddy's pages are still fully static (pre-rendered HTML served from the edge cache). The Worker function only runs when a request can't be served from cache — which for the current app is essentially never. As you add API routes in Phase 2, those run as Worker functions.

### `npm run build` vs `npx next build` vs `npx opennextjs-cloudflare build`

These are three different things:

| Command | What it does | When to use |
|---------|-------------|-------------|
| `npm run build` | Runs the `build` script in `package.json`, which is `next build` | Local development verification |
| `npx next build` | Directly runs Next.js build → produces `.next/` | Same as above, equivalent |
| `npx opennextjs-cloudflare build` | Runs `next build` AND transforms `.next/` → `.open-next/` | **This is what Cloudflare runs in CI** |

The Cloudflare dashboard's build command must be `npx opennextjs-cloudflare build` — not `npx next build`. The pre-filled `npx next build` in the form is **wrong for Workers**: it only produces `.next/` output, but Wrangler expects `.open-next/worker.js`. OpenNext does the transformation.

### What Was Set Up in the Repo

Four things have been added to support Cloudflare Workers:

**`wrangler.jsonc` — Worker runtime configuration**
```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "fillbuddy",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-04-06",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "observability": { "enabled": true }
}
```
- `name` → the Worker's name = `fillbuddy.workers.dev` subdomain
- `compatibility_flags: ["nodejs_compat"]` → **required** for Next.js; enables Node.js built-in APIs inside V8 isolates
- `assets.directory` → static files (JS, CSS, fonts, images) stored in Cloudflare's edge cache, served without invoking the Worker function

**`open-next.config.ts` — OpenNext adapter config**
```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
export default defineCloudflareConfig();
```
Minimal for now. Extend this when you need custom caching strategies, ISR, or custom middleware.

**New `package.json` scripts**
```json
"preview":    "opennextjs-cloudflare build && opennextjs-cloudflare preview",
"deploy":     "opennextjs-cloudflare build && opennextjs-cloudflare deploy",
"cf-typegen": "wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts"
```
- `preview` → builds for Workers and runs locally via Miniflare (Cloudflare's local Workers simulator) — tests the exact production runtime before you push
- `deploy` → builds + deploys to Cloudflare from your local machine (useful for hotfixes)
- `cf-typegen` → generates TypeScript types for any Cloudflare bindings (KV, R2, D1, etc.) you add to `wrangler.jsonc`

**Dev dependencies installed**
```
@opennextjs/cloudflare   OpenNext adapter — transforms Next.js for Workers
wrangler                 Cloudflare CLI — deploy, secrets, type generation
```

### Step 1 — Push to GitHub

All config files are already committed. Push so Cloudflare can access the updated repo:

```bash
git push origin main
```

### Step 2 — Fill Out the Cloudflare Dashboard Form

Navigation: [dash.cloudflare.com](https://dash.cloudflare.com) → **Build** → **Compute** → **Workers & Pages** → **Create application** → connect your GitHub repo.

Fill in this form with **exactly** these values:

| Field | Value | Notes |
|-------|-------|-------|
| **Project name** | `fillbuddy` | Change from `fillbuddy.org`. Names become the `*.workers.dev` subdomain — use the clean name. |
| **Build command** | `npx opennextjs-cloudflare build` | **Change this.** The pre-filled `npx next build` is wrong — it doesn't produce `.open-next/` output that Wrangler needs. |
| **Deploy command** | `npx wrangler deploy` | Keep as pre-filled. Reads `wrangler.jsonc` from the repo and deploys to the edge. |
| **Non-production branch deploy command** | `npx wrangler versions upload` | Keep as pre-filled. Uploads a preview version without replacing production. |
| **Path** | `/` | Keep as-is. Root of the repository. |
| **API token** | Create new token (selected) | Keep as-is. |
| **API token name** | `fillbuddy-workers-token` | Give it a descriptive name — this authenticates CI deployments from GitHub. |
| **Variable name / Variable value** | *(leave blank)* | No environment variables needed until Phase 2. |

Click **Deploy**.

> **What happens on first deploy:**
> 1. Cloudflare clones the repo, runs `npm ci`
> 2. `npx opennextjs-cloudflare build` → runs `next build` then transforms `.next/` → `.open-next/`
> 3. `npx wrangler deploy` → reads `wrangler.jsonc`, uploads `worker.js` + `assets/` to Cloudflare's global edge
> 4. Worker goes live at `fillbuddy.workers.dev`

### Step 3 — Attach Your Custom Domain

Since `fillbuddy.org` is already a Cloudflare zone on your account:

1. Dashboard → **Workers & Pages** → select the `fillbuddy` Worker → **Settings** → **Domains & Routes** → **Add** → **Custom domain**.
2. Enter `fillbuddy.org` → Continue.
3. Cloudflare automatically creates the DNS record in your zone. No manual DNS editing.
4. Repeat for `www.fillbuddy.org`.
5. Optional: **Rules → Redirect Rules** → add a 301 redirect from `www.fillbuddy.org` to `fillbuddy.org`.

> **What's happening technically:** Cloudflare creates an `AAAA` record pointing to Cloudflare's Anycast proxy range. All traffic for `fillbuddy.org` routes through the Workers runtime at the nearest edge PoP. TLS certificates are provisioned automatically (Let's Encrypt or Cloudflare CA depending on your SSL mode).

### Step 4 — Environment Variables (Phase 2 prep)

No variables needed now. When Phase 2 begins:

**Dashboard:** Workers project → **Settings** → **Variables and Secrets** → add variables per environment.

- Variables prefixed with `NEXT_PUBLIC_` are inlined into the browser bundle at build time.
- Non-prefixed variables are available only in the Worker runtime (server-side) — never shipped to the browser.

### Step 5 — Verify the Deployment

- Visit `https://fillbuddy.org` — app should load over HTTPS with a Cloudflare certificate.
- DevTools → **Network** → confirm no 404s or failed requests.
- Build logs: Dashboard → **Workers & Pages** → `fillbuddy` → **Deployments** → click the deployment → **View logs**.
- Full app test: upload a PDF → annotate → save `.fillbuddy` → reload → resume.

### How CI/CD Works (Automatic Going Forward)

```
git push origin main
        ↓
Cloudflare Workers Builds webhook fires
        ↓
npm ci  (install deps)
        ↓
npx opennextjs-cloudflare build
   next build → .next/
   OpenNext transform → .open-next/
        ↓
npx wrangler deploy
   worker.js → Cloudflare V8 isolate network
   assets/   → Cloudflare edge cache
        ↓
fillbuddy.org live (zero downtime)
```

Every PR:
```
PR opened → npx wrangler versions upload → preview URL
PR merged → production deploy
```

### Rollback

Dashboard → **Workers & Pages** → `fillbuddy` → **Deployments** → find previous good deployment → **Rollback**. Takes ~10 seconds — Wrangler re-activates the previously uploaded version with no rebuild.

---

## Phase 2 Development — Adding Supabase (Free Tier)

Phase 2 begins when you start building auto-fill profiles or the template library. The frontend stays on Cloudflare Workers. Supabase provides the backend.

### What Supabase Gives You

| Supabase service                   | What it replaces in your app | Used for                                                   |
| ---------------------------------- | ---------------------------- | ---------------------------------------------------------- |
| **Postgres**                 | Nothing today                | User profiles, saved annotation configs, template metadata |
| **Storage**                  | Nothing today                | PDF template files, user-uploaded assets                   |
| **Auth**                     | Nothing today                | Email/password, Google OAuth, magic link                   |
| **Edge Functions**           | Nothing today                | Server-side logic (e.g., PDF processing jobs)              |
| **Row Level Security (RLS)** | Nothing today                | Per-user data isolation at the database layer              |

### Free Tier Limits (Development)

| Resource                   | Free limit             | Notes                                                            |
| -------------------------- | ---------------------- | ---------------------------------------------------------------- |
| Database                   | 500 MB                 | Plenty for development                                           |
| File storage               | 1 GB                   | Enough for a template library prototype                          |
| Egress                     | 5 GB                   | Per month                                                        |
| Auth MAUs                  | 50,000                 | Monthly active users                                             |
| API requests               | Unlimited              | —                                                               |
| Projects                   | 2                      | —                                                               |
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

**Add to Cloudflare Workers (for the build):**

Workers project → **Settings** → **Variables and Secrets** → Add both variables. Set them for both **Production** and **Preview** environments (you can use different Supabase projects for each).

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

| Resource                   | Free                   | Pro                    |
| -------------------------- | ---------------------- | ---------------------- |
| Database                   | 500 MB                 | 8 GB                   |
| File storage               | 1 GB                   | 100 GB                 |
| Egress                     | 5 GB                   | 250 GB                 |
| **Inactivity pause** | **After 1 week** | **Never**        |
| Backups                    | None                   | Daily, 7-day retention |
| Log retention              | 1 day                  | 7 days                 |

The $25/month includes $10 in compute credits, covering one Micro instance (1 GB RAM, 2-core ARM). For FillBuddy at early production scale this is sufficient.

### Upgrade Steps

1. Supabase Dashboard → **Organization** → **Billing** → **Upgrade to Pro**.
2. Enter payment information. The project resumes immediately and the inactivity pause is permanently disabled.
3. No code changes, no migrations, no redeployment needed. The Supabase URL and keys stay the same.

### Create a Separate Production Project

Best practice: use separate Supabase projects for development and production. This prevents dev data leaking into prod and lets you test schema migrations safely.

1. Create a new Supabase project: `fillbuddy-prod` on the Pro plan.
2. Run your schema SQL in the new project.
3. Set the production Supabase URL and keys in the Cloudflare Workers environment variables — specifically under the **Production** environment (not Preview).
4. Your Preview deployments (from PRs) keep using the dev Supabase project.

In the Workers project → **Settings** → **Variables and Secrets**, set values per environment:

| Variable                          | Production value                   | Preview value                     |
| --------------------------------- | ---------------------------------- | --------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://<prod-ref>.supabase.co` | `https://<dev-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod anon key                      | dev anon key                      |

### Enabling Auth in Production

Configure the allowed redirect URLs in Supabase before enabling OAuth:

Supabase Dashboard → **Authentication** → **URL Configuration**:

- **Site URL:** `https://fillbuddy.org`
- **Redirect URLs:** Add `https://fillbuddy.org/**` and `https://*.fillbuddy.workers.dev/**`

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

### Cloudflare Workers Analytics

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

## Future Path: Adding Server-Side API Routes

When FillBuddy needs server-side computation (e.g., server-rendered pages, API routes for webhooks, background PDF processing jobs), the lowest-friction upgrade path stays within the Cloudflare ecosystem:

**Current (Phase 2):**

```
Browser → Cloudflare Workers (Next.js static) → Supabase (DB + Auth + Storage)
```

**Future (when serverless API routes are needed):**

```
Browser → Cloudflare Workers (Next.js SSR + API routes) → Supabase
```

You are **already on Workers**. Adding API routes is as simple as creating `src/app/api/*/route.ts` files — Next.js App Router API routes run as Worker functions automatically, with zero infra changes. The Supabase connection and all environment variables remain identical. No migration needed.

**When to add API routes:**

- Authenticated webhook endpoints (e.g., payment provider callbacks)
- Server-side PDF processing jobs
- API rate limiting per user that must be enforced server-side
- Dynamic `og:image` generation per template

---

## Cost Summary

| Period                         | Stack                            | Monthly cost                          |
| ------------------------------ | -------------------------------- | ------------------------------------- |
| Now                            | Cloudflare Workers                 | **$0**                          |
| Phase 2 dev                    | Cloudflare Workers + Supabase Free | **$0**                          |
| Phase 2 prod launch            | Cloudflare Workers + Supabase Pro  | **$25**                         |
| At scale (>250 GB file egress) | Same + Supabase storage overage    | **$25 + $0.021/GB over 100 GB** |

There is no Cloudflare cost at any point in this roadmap — Workers remains free regardless of traffic volume.
