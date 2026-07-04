-- Fix: creative_dna.ad_id was typed `uuid`, but the app supplies its own
-- string ad ids that are never real UUIDs; fb_<archiveId>, tiktok_<id>,
-- paste_<n> / upload_<n> (client-generated for pasted/uploaded ads),
-- preflight_<timestamp>. Every non-seed DNA cache write failed with
-- `22P02 invalid input syntax for type uuid`, silently swallowed by the
-- `.catch(console.error)` write-through wrapper in lib/cache/index.ts; so
-- live-analyzed DNA was never actually persisted to Supabase.
-- Apply with: supabase db push  OR  paste into Supabase SQL editor

alter table creative_dna alter column ad_id type text using ad_id::text;
