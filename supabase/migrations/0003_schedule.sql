-- Scheduling (§77) and scheduled-sweep support.
--
-- A plain cron expression cannot express "every 5 hours from an arbitrary
-- origin" without drift, so the spec calls for a deterministic strategy. This
-- uses an hourly tick plus a gate on the last successful run: the function
-- only does real work when at least `interval_hours` have elapsed. That keeps
-- the interval exact within one hour and never runs twice inside a window.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- Where the deployed Edge Function lives, and which Vault entry carries the
-- credential that authorises the call.
create table if not exists schedule_config (
  id                boolean primary key default true check (id),
  edge_function_url text   not null,
  -- Name of a Supabase Vault secret holding the project's secret key. The key
  -- itself lives only in Vault, so it never appears in a query, a log, or this
  -- table.
  secret_name       text   not null default 'supabase_secret_key',
  interval_hours    numeric not null default 5,
  enabled           boolean not null default true,
  last_run_at       timestamptz,
  next_run_at       timestamptz,
  updated_at        timestamptz not null default now()
);

insert into schedule_config (id, edge_function_url, interval_hours)
values (true, 'https://ihmeziugudvklybedxui.supabase.co/functions/v1/radar-sweep', 5)
on conflict (id) do nothing;

-- Fires hourly. The function itself decides whether this tick is due, so a
-- missed tick (platform downtime) is caught by the next one rather than
-- permanently shifting the schedule.
create or replace function public.tick_radar_sweep()
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cfg    schedule_config%rowtype;
  secret text;
  due    boolean := false;
begin
  select * into cfg from schedule_config where id = true and enabled;
  -- `cfg` is null when no enabled row exists. (FOUND is a plpgsql variable,
  -- not something you can test with `if not found`.)
  if cfg.id is null then
    return;
  end if;

  due := cfg.last_run_at is null
         or now() - cfg.last_run_at >= make_interval(hours => cfg.interval_hours::int);

  if not due then
    return;
  end if;

  -- Claim the slot before dispatching, so a slow run cannot be double-claimed.
  update schedule_config
     set last_run_at = now(),
         next_run_at  = now() + make_interval(hours => interval_hours::int)
   where id = true
  returning * into cfg;

  -- A missing vault secret must not raise: log and return, leaving the slot
  -- claimed so the next hourly tick retries rather than spinning.
  begin
    select decrypted_secret into secret
      from vault.decrypted_secrets
     where name = cfg.secret_name;
  exception when others then
    secret := null;
  end;

  if secret is null then
    raise warning 'radar: no vault secret named %', cfg.secret_name;
    return;
  end if;

  -- pg_net is asynchronous: the request is queued and dispatched in the
  -- background. The secret key travels in `apikey`, which is what the Edge
  -- Function's `auth: 'secret'` mode checks.
  perform net.http_post(
    url     := cfg.edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', secret
    ),
    body    := jsonb_build_object(
      'trigger', 'cron',
      'next_run_at', cfg.next_run_at
    )
  );
end $$;

-- Hourly tick, UTC. The gate above keeps real sweeps at the 5-hour interval.
select cron.schedule(
  'radar-sweep-tick',
  '7 * * * *',
  $$ select public.tick_radar_sweep(); $$
)
where not exists (select 1 from cron.job where jobname = 'radar-sweep-tick');

-- Public status endpoint for the source-health panel (§19, §50).
--
-- `next_sweep_at` is projected rather than read straight from the row: the
-- scheduler only writes it when a tick fires, so before the first tick it would
-- be null and the site would claim no sweep is scheduled when the job is
-- actually registered. Projecting from the last run, or from now on a project
-- that has never run, keeps that panel honest.
create or replace view public.radar_status as
select
  (select count(*) from sources where enabled)                          as sources_total,
  (select count(*) from sources where enabled and last_ok_at > now() - interval '6 hours') as sources_ok,
  (select count(*) from sources where enabled and health in ('failed','degraded'))          as sources_unhealthy,
  (select count(*) from offers where status in ('live','changed','ending'))                 as offers_live,
  (select count(*) from offers where status = 'upcoming')                                   as offers_upcoming,
  (select count(*) from offers where status = 'ended')                                      as offers_ended,
  (select count(*) from models)                                                              as models_total,
  (select count(*) from providers)                                                           as providers_total,
  (select count(*) from discovery_candidates where status = 'pending')                        as candidates_pending,
  coalesce(
    (select c.last_run_at from schedule_config c where c.id = true),
    (select max(r.finished_at) from sweep_runs r where r.finished_at is not null)
  )                                                                                          as last_sweep_at,
  coalesce(
    (select c.next_run_at from schedule_config c where c.id = true),
    -- Never run: the first tick is due within the hour, at :07.
    (select date_trunc('hour', now()) + interval '1 hour 7 minutes'),
    (select max(r.finished_at) from sweep_runs r where r.finished_at is not null)
      + make_interval(hours => (select c.interval_hours::int from schedule_config c where c.id = true))
  )                                                                                          as next_sweep_at,
  (select finished_at   from sweep_runs where finished_at is not null order by finished_at desc limit 1) as last_finished_at,
  (select duration_ms   from sweep_runs where finished_at is not null order by finished_at desc limit 1) as last_duration_ms,
  now()                                                                                     as computed_at;

comment on function public.tick_radar_sweep() is
  'Hourly tick that dispatches a sweep only when the 5-hour interval has elapsed. Deterministic, drift-free, and safe to retry.';
