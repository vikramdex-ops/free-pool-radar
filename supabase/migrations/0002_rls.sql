-- Row Level Security.
--
-- Public read for the intelligence the site is built on. Writes only from the
-- service role (the sweep Edge Function) or the authenticated admin role.
-- Observations are excluded from public read: they are the raw evidence trail
-- and are not needed to render the product.

alter table providers              enable row level security;
alter table models                 enable row level security;
alter table offers                 enable row level security;
alter table events                 enable row level security;
alter table changes                enable row level security;
alter table observations          enable row level security;
alter table sweep_runs             enable row level security;
alter table discovery_candidates   enable row level security;
alter table source_conflicts       enable row level security;

-- Public read -----------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'providers','models','offers','events','changes','source_conflicts'
  ]
  loop
    execute format(
      'drop policy if exists public_read_%1$I on %1$I;', t);
    execute format(
      'create policy public_read_%1$I on %1$I
         for select to anon, authenticated using (true);', t);
  end loop;
end $$;

-- Sweep run metadata is operational telemetry: readable, but it exposes no
-- offer intelligence, so it is safe to surface on the source-health panel.
drop policy if exists public_read_sweep_runs on sweep_runs;
create policy public_read_sweep_runs on sweep_runs
  for select to anon, authenticated using (true);

-- Observations stay private: raw payloads and response hashes are evidence,
-- not product surface.
drop policy if exists public_read_observations on observations;
create policy authenticated_read_observations on observations
  for select to authenticated using (true);

-- Discovery queue is internal (§52).
drop policy if exists public_read_discovery_candidates on discovery_candidates;
create policy authenticated_read_discovery_candidates on discovery_candidates
  for select to authenticated using (true);
create policy authenticated_manage_discovery_candidates on discovery_candidates
  for all to authenticated using (true) with check (true);

-- Write access is deliberately absent for anon/authenticated: the sweep runs as
-- the service role, which bypasses RLS. Writes happen through
-- `service_role` only, so a leaked publishable key cannot mutate intelligence.

-- Source registry is internal: it exposes fetch URLs and parser keys.
alter table sources enable row level security;
drop policy if exists public_read_sources on sources;
create policy authenticated_read_sources on sources
  for select to authenticated using (true);
