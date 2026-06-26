-- Creative Strategist — initial schema
-- Apply with: supabase db push  OR  paste into Supabase SQL editor

create extension if not exists "pgcrypto";

-- ── Verticals ────────────────────────────────────────────────────────────────
create table if not exists verticals (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  display_name text not null,
  is_seed      boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ── Competitor ads (Module 1 cache) ──────────────────────────────────────────
create table if not exists competitor_ads (
  id          uuid primary key default gen_random_uuid(),
  vertical_id uuid not null references verticals(id) on delete cascade,
  source      text not null,
  advertiser  text not null,
  cover_url   text not null default '',
  copy        text not null default '',
  first_seen  date,
  last_seen   date,
  run_days    int  not null default 0,
  raw_metrics jsonb not null default '{}',
  fetched_at  timestamptz not null default now()
);
create index if not exists competitor_ads_vertical_id_idx on competitor_ads(vertical_id);
create index if not exists competitor_ads_run_days_idx    on competitor_ads(run_days desc);

-- ── Creative DNA (Module 2 cache — works for competitor AND uploaded ads) ─────
create table if not exists creative_dna (
  id               uuid primary key default gen_random_uuid(),
  ad_id            uuid not null,
  ad_kind          text not null check (ad_kind in ('competitor', 'uploaded')),
  hook_type        text not null default '',
  angle            text not null default '',
  format           text not null default '',
  offer_framing    text not null default '',
  cta_style        text not null default '',
  target_persona   text not null default '',
  one_line_summary text not null default '',
  model            text not null default '',
  created_at       timestamptz not null default now()
);
create index if not exists creative_dna_ad_id_idx on creative_dna(ad_id);

-- ── User-uploaded ad sets (Module 3 input) ────────────────────────────────────
create table if not exists uploaded_sets (
  id         uuid primary key default gen_random_uuid(),
  label      text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists uploaded_ads (
  id        uuid primary key default gen_random_uuid(),
  set_id    uuid not null references uploaded_sets(id) on delete cascade,
  cover_url text not null default '',
  copy      text not null default ''
);

-- ── Diversity reports (Module 3 output) ──────────────────────────────────────
create table if not exists diversity_reports (
  id          uuid primary key default gen_random_uuid(),
  set_id      uuid not null references uploaded_sets(id) on delete cascade,
  vertical_id uuid references verticals(id),
  n_ads       int  not null default 0,
  k_concepts  int  not null default 0,
  clusters    jsonb not null default '[]',
  gaps        jsonb not null default '[]',
  created_at  timestamptz not null default now()
);

-- ── Angle batches (Module 4 output) ──────────────────────────────────────────
create table if not exists angle_batches (
  id          uuid primary key default gen_random_uuid(),
  vertical_id uuid not null references verticals(id) on delete cascade,
  set_id      uuid references uploaded_sets(id),
  briefs      jsonb not null default '[]',
  created_at  timestamptz not null default now()
);

-- ── RLS: single shared demo — all reads public, writes via service role ────────
alter table verticals      enable row level security;
alter table competitor_ads enable row level security;
alter table creative_dna   enable row level security;
alter table uploaded_sets  enable row level security;
alter table uploaded_ads   enable row level security;
alter table diversity_reports enable row level security;
alter table angle_batches  enable row level security;

-- Public read for the demo (no user accounts)
create policy "public read verticals"       on verticals      for select using (true);
create policy "public read competitor_ads"  on competitor_ads for select using (true);
create policy "public read creative_dna"    on creative_dna   for select using (true);
create policy "public read uploaded_sets"   on uploaded_sets  for select using (true);
create policy "public read uploaded_ads"    on uploaded_ads   for select using (true);
create policy "public read diversity_reports" on diversity_reports for select using (true);
create policy "public read angle_batches"   on angle_batches  for select using (true);
-- Writes happen server-side via the service-role key (bypasses RLS automatically)
