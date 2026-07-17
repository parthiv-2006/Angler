-- Global daily cap on metered (live scrape / AI) requests. One row per UTC day;
-- increment_live_usage atomically bumps today's counter and reports whether the
-- request is still within the cap, so concurrent serverless instances share one
-- budget without a read-modify-write race.
-- Apply with: supabase db push  OR  paste into Supabase SQL editor

create table if not exists live_usage (
  day date primary key,
  count integer not null default 0
);

create or replace function increment_live_usage(cap integer)
returns boolean
language plpgsql
as $$
declare
  new_count integer;
begin
  insert into live_usage as lu (day, count)
  values (current_date, 1)
  on conflict (day) do update set count = lu.count + 1
  returning lu.count into new_count;
  return new_count <= cap;
end;
$$;
