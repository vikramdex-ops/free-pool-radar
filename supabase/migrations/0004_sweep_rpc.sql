-- Sweep stored procedures (§11, §61).
--
-- The collector runs outside the database, so it reaches data through these
-- parameterised functions rather than by building SQL. Every parameter is
-- bound; nothing collected is ever concatenated into a statement.
--
-- PostgREST hands a `jsonb` parameter as an array when the caller posts
-- `{"p": [...]}`, so the argument is read as `coalesce(p->0, p)`. Unwrapping it
-- in one place keeps every function below readable.
--
-- `SECURITY DEFINER` is required because the sweep writes through the service
-- role and must bypass RLS; `search_path` is pinned so a definer function
-- cannot be redirected through a hijacked schema. EXECUTE is revoked from
-- everyone else at the bottom of this file.

-- providers ------------------------------------------------------------------
create or replace function public.rpc_start_sweep(p jsonb)
returns table (id bigint)
language plpgsql security definer set search_path = public, extensions
as $$
declare arg jsonb := coalesce(p->0, p);
begin
  return query
  insert into sweep_runs (started_at, trigger)
  values (now(), coalesce(arg->>'trigger', 'cron'))
  returning sweep_runs.id;
end $$;

create or replace function public.rpc_finish_sweep(p jsonb)
returns void
language sql security definer set search_path = public, extensions
as $$
  with a as (select coalesce(p->0, p) arg)
  update sweep_runs r set
    finished_at     = now(),
    duration_ms     = (a.arg->>'duration_ms')::int,
    sources_total   = coalesce((a.arg->>'sources_total')::int, r.sources_total),
    sources_ok      = coalesce((a.arg->>'sources_ok')::int, r.sources_ok),
    sources_failed  = coalesce((a.arg->>'sources_failed')::int, r.sources_failed),
    offers_new      = coalesce((a.arg->>'offers_new')::int, r.offers_new),
    offers_changed  = coalesce((a.arg->>'offers_changed')::int, r.offers_changed),
    offers_ended    = coalesce((a.arg->>'offers_ended')::int, r.offers_ended),
    changes_created = coalesce((a.arg->>'changes_created')::int, r.changes_created),
    errors          = a.arg->'errors'
  from a
  where r.id = (a.arg->>'id')::bigint;
$$;

-- Upserts by slug so the collector never has to know provider ids. The name and
-- URL are only overwritten when the caller actually supplies them, so a
-- researcher's curated description is not replaced by a bare slug.
create or replace function public.rpc_upsert_provider(p jsonb)
returns table (id bigint)
language plpgsql security definer set search_path = public, extensions
as $$
declare arg jsonb := coalesce(p->0, p);
begin
  return query
  insert into providers (name, slug, official_url, description, last_verified_at)
  values (
    coalesce(nullif(arg->>'name',''), arg->>'slug'),
    arg->>'slug',
    coalesce(nullif(arg->>'official_url',''), 'https://' || (arg->>'slug')),
    nullif(arg->>'description',''),
    now())
  on conflict (slug) do update
    set last_verified_at = now(),
        name             = case when coalesce(nullif(arg->>'name',''), '') <> ''
                                  and excluded.name <> arg->>'slug'
                                then excluded.name else providers.name end,
        official_url     = case when coalesce(nullif(arg->>'official_url',''), '') <> ''
                                  and excluded.official_url <> 'https://' || (arg->>'slug')
                                then excluded.official_url else providers.official_url end,
        description      = coalesce(excluded.description, providers.description)
  returning providers.id;
end $$;

create or replace function public.rpc_touch_provider(p jsonb)
returns void
language sql security definer set search_path = public, extensions
as $$
  with a as (select coalesce(p->0, p) arg)
  update providers pr set
    last_verified_at = now(),
    free_model_count = case
      when (a.arg ? 'free_model_count') and a.arg->>'free_model_count' is not null
        then (a.arg->>'free_model_count')::int
      else pr.free_model_count end
  from a
  where pr.slug = a.arg->>'slug';
$$;

create or replace function public.rpc_rollup_live_offers(p jsonb default '{}'::jsonb)
returns void
language sql security definer set search_path = public, extensions
as $$
  update providers pr
     set live_offer_count = coalesce(
       (select count(*) from offers o
         where o.provider_id = pr.id
           and o.status in ('live','changed','ending')), 0)
   where true;
$$;

-- models ---------------------------------------------------------------------
-- Reports whether the row was newly inserted, so the sweep can count
-- discoveries without a second round trip.
create or replace function public.rpc_upsert_model(p jsonb)
returns table (id bigint, inserted boolean)
language plpgsql security definer set search_path = public, extensions
as $$
declare
  arg      jsonb := coalesce(p->0, p);
  v_id     bigint;
  v_new    boolean := false;
begin
  insert into models (provider_id, model_id, slug, display_name, context_window, capabilities)
  values (
    (arg->>'provider_id')::bigint,
    arg->>'model_id',
    arg->>'slug',
    coalesce(nullif(arg->>'display_name',''), arg->>'model_id'),
    nullif(arg->>'context_window','')::int,
    coalesce(
      (select array_agg(value::text)
         from jsonb_array_elements_text(coalesce(arg->'capabilities','[]'::jsonb))),
      '{}'))
  on conflict (slug) do update
    set display_name = coalesce(nullif(excluded.display_name,''), models.display_name),
        updated_at    = now()
  returning models.id, (xmax = 0) into v_id, v_new;

  return query select v_id, v_new;
end $$;

-- offers ---------------------------------------------------------------------
-- The reconciliation key is (provider, model_id_text) when a model id exists,
-- and (provider, model_label) when it does not. A pool that covers many models
-- has no single id, so it is identified by its label instead.
create or replace function public.rpc_select_offer(p jsonb)
returns setof jsonb
language sql stable security definer set search_path = public, extensions
as $$
  with a as (select coalesce(p->0, p) arg)
  select to_jsonb(t) from a, lateral (
    select o.id, o.status::text as status, o.rpm, o.rpd, o.tpm, o.tpd,
           o.card_required, o.access_requires_subscription,
           o.pool_remaining, o.pool_size, o.token_limit,
           o.model_label, o.payload_hash
      from offers o
     where o.provider_id = (a.arg->>'provider_id')::bigint
       and ( (a.arg->>'model_id') is not null and o.model_id_text = a.arg->>'model_id'
          or (a.arg->>'model_id') is null and o.model_label = a.arg->>'model_label')
  ) t limit 1;
$$;

create or replace function public.rpc_insert_offer(p jsonb)
returns table (id bigint)
language plpgsql security definer set search_path = public, extensions
as $$
declare arg jsonb := coalesce(p->0, p);
begin
  return query
  insert into offers (
    provider_id, model_id, model_id_text, model_label, offer_type, status,
    access_requires_account, access_requires_subscription, payment_required,
    card_required, api_key_required, keyless,
    compatibility_openai, compatibility_anthropic, compatibility_other,
    rpm, rpd, tpm, tpd, monthly_limit, monthly_unit,
    token_limit, token_limit_unit, pool_size, pool_remaining, pool_unit,
    credit_amount, credit_currency, start_at, end_at,
    verification_level, official_evidence_url, payload_hash,
    first_verified_at, last_verified_at, last_seen_live_at)
  values (
    (arg->>'provider_id')::bigint, nullif(arg->>'model_id','')::bigint, arg->>'model_id_text',
    arg->>'model_label', (arg->>'offer_type')::offer_type, (arg->>'status')::offer_status,
    coalesce((arg->>'access_requires_account')::boolean, true),
    coalesce((arg->>'access_requires_subscription')::boolean, false),
    coalesce((arg->>'payment_required')::boolean, false),
    coalesce((arg->>'card_required')::boolean, false),
    coalesce((arg->>'api_key_required')::boolean, true),
    coalesce((arg->>'keyless')::boolean, false),
    coalesce((arg->>'compatibility_openai')::boolean, false),
    coalesce((arg->>'compatibility_anthropic')::boolean, false),
    nullif(arg->>'compatibility_other',''),
    nullif(arg->>'rpm','')::int, nullif(arg->>'rpd','')::int,
    nullif(arg->>'tpm','')::bigint, nullif(arg->>'tpd','')::bigint,
    nullif(arg->>'monthly_limit','')::bigint, nullif(arg->>'monthly_unit',''),
    nullif(arg->>'token_limit','')::bigint, nullif(arg->>'token_limit_unit',''),
    nullif(arg->>'pool_size','')::bigint, nullif(arg->>'pool_remaining','')::bigint,
    nullif(arg->>'pool_unit',''),
    nullif(arg->>'credit_amount','')::numeric, nullif(arg->>'credit_currency',''),
    nullif(arg->>'start_at','')::timestamptz, nullif(arg->>'end_at','')::timestamptz,
    coalesce(nullif(arg->>'verification_level','')::verification_level, 'community'),
    nullif(arg->>'official_evidence_url',''), nullif(arg->>'payload_hash',''),
    now(), now(),
    case when arg->>'status' = 'live' then now() else null end)
  returning offers.id;
end $$;

-- The WHERE clause is the §13/§16 invariant held at the database layer: an
-- ended offer cannot be revived by a source that still reports it.
create or replace function public.rpc_update_offer(p jsonb)
returns table (id bigint)
language plpgsql security definer set search_path = public, extensions
as $$
declare arg jsonb := coalesce(p->0, p);
begin
  return query
  update offers o set
    model_id       = nullif(arg->>'model_id','')::bigint,
    model_id_text  = nullif(arg->>'model_id_text',''),
    model_label    = arg->>'model_label',
    offer_type     = (arg->>'offer_type')::offer_type,
    status         = (arg->>'status')::offer_status,
    access_requires_account     = coalesce((arg->>'access_requires_account')::boolean, o.access_requires_account),
    access_requires_subscription= coalesce((arg->>'access_requires_subscription')::boolean, o.access_requires_subscription),
    payment_required            = coalesce((arg->>'payment_required')::boolean, o.payment_required),
    card_required               = coalesce((arg->>'card_required')::boolean, o.card_required),
    api_key_required            = coalesce((arg->>'api_key_required')::boolean, o.api_key_required),
    keyless                     = coalesce((arg->>'keyless')::boolean, o.keyless),
    compatibility_openai    = coalesce((arg->>'compatibility_openai')::boolean, o.compatibility_openai),
    compatibility_anthropic = coalesce((arg->>'compatibility_anthropic')::boolean, o.compatibility_anthropic),
    compatibility_other     = coalesce(nullif(arg->>'compatibility_other',''), o.compatibility_other),
    rpm    = nullif(arg->>'rpm','')::int,
    rpd    = nullif(arg->>'rpd','')::int,
    tpm    = nullif(arg->>'tpm','')::bigint,
    tpd    = nullif(arg->>'tpd','')::bigint,
    monthly_limit  = nullif(arg->>'monthly_limit','')::bigint,
    monthly_unit   = coalesce(nullif(arg->>'monthly_unit',''), o.monthly_unit),
    token_limit    = nullif(arg->>'token_limit','')::bigint,
    token_limit_unit = coalesce(nullif(arg->>'token_limit_unit',''), o.token_limit_unit),
    pool_size      = nullif(arg->>'pool_size','')::bigint,
    pool_remaining = nullif(arg->>'pool_remaining','')::bigint,
    pool_unit      = coalesce(nullif(arg->>'pool_unit',''), o.pool_unit),
    credit_amount  = nullif(arg->>'credit_amount','')::numeric,
    credit_currency= coalesce(nullif(arg->>'credit_currency',''), o.credit_currency),
    start_at = nullif(arg->>'start_at','')::timestamptz,
    end_at   = nullif(arg->>'end_at','')::timestamptz,
    verification_level = coalesce(nullif(arg->>'verification_level','')::verification_level, o.verification_level),
    official_evidence_url = coalesce(nullif(arg->>'official_evidence_url',''), o.official_evidence_url),
    payload_hash = nullif(arg->>'payload_hash',''),
    last_verified_at  = now(),
    last_seen_live_at = case when arg->>'status' = 'live' then now() else o.last_seen_live_at end
  where o.id = (arg->>'id')::bigint
    and not (o.status = 'ended' and coalesce(arg->>'status','') <> 'ended')
  returning o.id;
end $$;

-- observations ---------------------------------------------------------------
create or replace function public.rpc_insert_observation(p jsonb)
returns void
language sql security definer set search_path = public, extensions
as $$
  with a as (select coalesce(p->0, p) arg)
  insert into observations (
    provider_id, offer_id, event_id, observed_at, status, token_limit,
    pool_size, pool_remaining, rpm, rpd, tpm, tpd, model_count,
    source_url, source_type, response_hash, raw_payload, verification_level)
  select
    nullif(a.arg->>'provider_id','')::bigint,
    nullif(a.arg->>'offer_id','')::bigint,
    nullif(a.arg->>'event_id','')::bigint,
    now(),
    nullif(a.arg->>'status','')::offer_status,
    nullif(a.arg->>'token_limit','')::bigint,
    nullif(a.arg->>'pool_size','')::bigint,
    nullif(a.arg->>'pool_remaining','')::bigint,
    nullif(a.arg->>'rpm','')::int, nullif(a.arg->>'rpd','')::int,
    nullif(a.arg->>'tpm','')::bigint, nullif(a.arg->>'tpd','')::bigint,
    nullif(a.arg->>'model_count','')::int,
    a.arg->>'source_url', a.arg->>'source_type', a.arg->>'response_hash',
    a.arg->'raw_payload', nullif(a.arg->>'verification_level','')::verification_level
  from a;
$$;

-- sources --------------------------------------------------------------------
-- This is where §13 is enforced for the failure path: health is recorded, and
-- no offer status is touched. A dead source simply stops re-verifying its
-- offers, so freshness decays on its own without anything being declared ended.
create or replace function public.rpc_update_source(p jsonb)
returns void
language sql security definer set search_path = public, extensions
as $$
  with a as (select coalesce(p->0, p) arg)
  update sources s set
    last_fetched_at  = now(),
    last_status_code = nullif(a.arg->>'http_status','')::int,
    last_latency_ms  = (a.arg->>'latency_ms')::int,
    last_error       = nullif(a.arg->>'error',''),
    health           = coalesce(nullif(a.arg->>'health','')::source_health, s.health),
    last_ok_at       = case when a.arg->>'status' = 'ok' then now() else s.last_ok_at end
  from a
  where s.provider_slug = a.arg->>'provider_slug'
    and s.parser_key    = a.arg->>'parser_key';
$$;

-- events ---------------------------------------------------------------------
create or replace function public.rpc_select_event(p jsonb)
returns setof jsonb
language sql stable security definer set search_path = public, extensions
as $$
  with a as (select coalesce(p->0, p) arg)
  select to_jsonb(t) from a, lateral (
    select id, status::text as status, pool_remaining, pool_size
      from events where slug = a.arg->>'slug' limit 1
  ) t;
$$;

create or replace function public.rpc_upsert_event(p jsonb)
returns table (id bigint)
language plpgsql security definer set search_path = public, extensions
as $$
declare arg jsonb := coalesce(p->0, p);
begin
  return query
  insert into events (
    provider_id, name, slug, description, status, start_at, end_at,
    pool_size, pool_remaining, unit, models, eligibility, requirements,
    exhaustion_condition, official_url, announced_at, last_verified_at)
  values (
    (arg->>'provider_id')::bigint, arg->>'name', arg->>'slug', arg->>'description',
    (arg->>'status')::event_status,
    nullif(arg->>'start_at','')::timestamptz, nullif(arg->>'end_at','')::timestamptz,
    nullif(arg->>'pool_size','')::bigint, nullif(arg->>'pool_remaining','')::bigint,
    coalesce(nullif(arg->>'unit',''),'tokens'),
    coalesce((select array_agg(value::text) from jsonb_array_elements_text(
      coalesce(arg->'models','[]'::jsonb))), '{}'),
    arg->>'eligibility', arg->>'requirements', arg->>'exhaustion_condition',
    arg->>'official_url', coalesce(nullif(arg->>'announced_at','')::timestamptz, now()),
    now())
  on conflict (slug) do update set
    status          = excluded.status,
    start_at        = excluded.start_at,
    end_at          = excluded.end_at,
    pool_size       = excluded.pool_size,
    pool_remaining  = excluded.pool_remaining,
    models          = excluded.models,
    last_verified_at= now()
  returning events.id;
end $$;

-- changes --------------------------------------------------------------------
-- The unique index on dedupe_key is what makes a retried sweep idempotent
-- (§78): the second attempt conflicts and is dropped rather than duplicated.
create or replace function public.rpc_record_change(p jsonb)
returns void
language sql security definer set search_path = public, extensions
as $$
  with a as (select coalesce(p->0, p) arg)
  insert into changes (
    provider_id, offer_id, change_type, field, old_value, new_value,
    detected_at, source_url, evidence, severity, dedupe_key)
  select
    (a.arg->>'provider_id')::bigint, nullif(a.arg->>'offer_id','')::bigint,
    (a.arg->>'change_type')::change_type, a.arg->>'field',
    a.arg->>'old_value', a.arg->>'new_value',
    now(), a.arg->>'source_url', a.arg->>'evidence',
    coalesce(nullif(a.arg->>'severity',''),'info'),
    nullif(a.arg->>'dedupe_key','')
  from a
  where (a.arg->>'dedupe_key') is not null
  on conflict (dedupe_key) where dedupe_key is not null do nothing;
$$;

-- Restrict execution to the service role. These are the only write path into
-- the intelligence store, so an anonymous or publishable key must not reach
-- them even though the tables themselves allow public reads.
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'rpc\_%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;
end $$;
