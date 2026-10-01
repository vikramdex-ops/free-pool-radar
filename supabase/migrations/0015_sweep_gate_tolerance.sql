-- ==================================================================
-- 0015_sweep_gate_tolerance.sql
-- ------------------------------------------------------------------
-- SEN-003: sweeps ran every 6 hours instead of 5, nearly every cycle.
--
-- Root cause, not bad luck: the due gate compared with microsecond
-- exactness (now() - last_run_at >= exactly 5 hours), but the claiming
-- tick stamps last_run_at ~10-30ms after its own start. Any +5h tick
-- executing a few milliseconds earlier than the claiming tick's fraction
-- returns "not due", and that costs exactly one hour — which is why every
-- anomalous gap was exactly 360 minutes, never scattered. All hourly
-- ticks succeeded; nothing was dropped.
--
-- Two changes, both inside tick_radar_sweep (CREATE OR REPLACE only):
-- 1. The due comparison tolerates 5 minutes. This cannot double-run: the
--    next tick after a claim is 60 minutes away, far outside the tolerance.
--    The 5-hour cadence itself is untouched.
-- 2. pg_net timeout 5s -> 60s. Every sweep takes 10-20s (observed max
--    12.6s and growing with sources), so every dispatch logged a timeout
--    while the work completed server-side — a monitoring blind spot where
--    a real failure looks identical to normal. 60s keeps headroom; a
--    timeout should mean something.
-- ==================================================================

begin;

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

  -- SEN-003: tolerate 5 minutes so a tick arriving milliseconds earlier
  -- than the claiming tick's sub-second fraction is still due. Without
  -- this, that tick returns not-due and the sweep waits a full extra hour.
  due := cfg.last_run_at is null
         or now() - cfg.last_run_at >= make_interval(hours => cfg.interval_hours::int) - interval '5 minutes';

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
  -- Function's `auth: 'secret'` mode checks. Timeout is 60s because every
  -- sweep takes 10-20s; the 5s default timed out on every single dispatch
  -- while the work completed anyway, hiding real failures in noise.
  perform net.http_post(
    url     := cfg.edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', secret
    ),
    body    := jsonb_build_object(
      'trigger', 'cron',
      'next_run_at', cfg.next_run_at
    ),
    timeout_milliseconds => 60000
  );
end $$;

comment on function public.tick_radar_sweep() is
  'Hourly tick that dispatches a sweep only when the 5-hour interval has elapsed (with a 5-minute tolerance so sub-second fractions cannot skip a cycle). Deterministic, drift-free, and safe to retry.';

-- Same posture as before: no grant changes. The scheduler path keeps
-- whatever execute grants it already has.

commit;

select pg_notify('pgrst', 'reload schema');
