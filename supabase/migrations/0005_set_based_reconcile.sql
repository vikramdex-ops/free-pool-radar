-- Set-based reconciliation.
--
-- The first implementation of the sweep issued one RPC per offer, which meant
-- several hundred sequential PostgREST round trips for a single collector and
-- exhausted the Edge Function's compute budget. Reconciliation is inherently
-- set-based, so it belongs in one statement: the collector hands over an entire
-- provider's normalised result and the database reconciles it in a single call.
--
-- This also moves change detection into SQL, where the previous row is
-- available. The collector cannot compute a diff because it has never seen the
-- prior state — only the database has both values.

-- One detected difference, as a typed row.
--
-- A composite type rather than a jsonb object because the caller consumes it
-- from plpgsql. Field access on a typed record needs no operator resolution,
-- whereas `->>` on a jsonb loop variable does not always resolve inside plpgsql
-- and fails at runtime with "operator does not exist: text ->> unknown".
--
-- create type is not idempotent, so the guard keeps a re-apply of this
-- migration a no-op.
do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public' and t.typname = 'offer_change'
  ) then
    create type public.offer_change as (
      change_type text,
      field       text,
      old_value   text,
      new_value   text,
      severity    text
    );
  end if;
end $$;

-- The return type of an existing function cannot be changed in place, so the
-- jsonb version is dropped before the typed one is defined. On a fresh database
-- this drop is a no-op.
drop function if exists public.rpc_offer_changes(jsonb, jsonb);

-- Compares a previous offer row against a freshly collected one and returns one
-- row per field that actually moved (§15). Returning no rows is what makes a
-- repeated sweep a complete no-op.
create or replace function public.rpc_offer_changes(
  prev jsonb,
  next jsonb
) returns setof public.offer_change
language sql immutable
as $$
  with watched (field, kind, severity) as (
    values
      ('status',                       'status',   'warning'),
      ('rpm',                          'rate',     'info'),
      ('rpd',                          'rate',     'info'),
      ('tpm',                          'rate',     'info'),
      ('tpd',                          'rate',     'info'),
      ('card_required',                'card',     'critical'),
      ('access_requires_subscription', 'sub',      'warning'),
      ('payment_required',             'card',     'critical'),
      ('pool_remaining',               'pool',     'info'),
      ('pool_size',                    'pool',     'info'),
      ('token_limit',                  'pool',     'info')
  )
  select
    case w.kind
      when 'status' then 'status_changed'
      when 'rate'   then 'rate_limit_changed'
      when 'sub'    then 'subscription_required'
      when 'pool'   then case
                        when nullif(next->>w.field,'')::numeric
                             < nullif(prev->>w.field,'')::numeric
                          then 'quota_decreased' else 'quota_increased' end
      -- A card requirement can be added or removed; those are different events
      -- and a reader needs to know which way it moved.
      else case when next->>w.field = 'true'
                then 'card_required' else 'card_removed' end
    end,
    w.field,
    prev->>w.field,
    next->>w.field,
    w.severity
  from watched w
  where coalesce(prev->>w.field, '') is distinct from coalesce(next->>w.field, '')
$$;

comment on function public.rpc_offer_changes(jsonb, jsonb) is
  'Diffs a stored offer against a collected one, one typed row per field that moved. Returns no rows when nothing changed.';

-- Reconciles one provider: upserts the provider and its models, inserts or
-- updates each offer, appends an observation for every offer that changed, and
-- records the resulting changes — all in a single call.
-- Change detection now happens inside rpc_reconcile_sweep, so the sweep learns
-- how many changes it produced by asking the database rather than counting in
-- the collector. The window is the run's own start time, which makes the figure
-- exact even when two sweeps overlap.
create or replace function public.rpc_run_changes(p jsonb)
returns table (changes_created int, offers_ended int)
language sql stable security definer set search_path = public, extensions
as $$
  with a as (select coalesce(p->0, p) arg)
  select
    (select count(*)::int from changes c
      where c.detected_at >= (
        select r.started_at from sweep_runs r
         where r.id = (a.arg->>'id')::bigint)),
    (select count(*)::int from offers o
      where o.updated_at >= (
        select r.started_at from sweep_runs r
         where r.id = (a.arg->>'id')::bigint)
        and o.status = 'ended')
  from a;
$$;

create or replace function public.rpc_reconcile_sweep(p jsonb)
returns table (
  provider_id      bigint,
  offers_created   int,
  offers_updated   int,
  offers_unchanged int,
  models_created   int
)
language plpgsql security definer set search_path = public, extensions
as $$
declare
  arg        jsonb := coalesce(p->0, p);
  v_slug     text;
  v_prov     bigint;
  -- Declared explicitly as jsonb rather than left to plpgsql's implicit
  -- `record` loop variables. A record carries no static type, so a chained
  -- expression such as `v_offer->'evidence'->>'field'` has no type to resolve
  -- the second operator against and fails at runtime with
  -- "operator does not exist: text ->> unknown" — but only on the paths that
  -- actually execute it, which is why it stayed hidden until an offer changed.
  v_offer     jsonb;
  v_event     jsonb;
  v_evidence  jsonb;
  -- A typed record from rpc_offer_changes, not a jsonb value.
  v_change    public.offer_change;
  v_prev      offers%rowtype;
  v_prev_event events%rowtype;
  v_offer_id  bigint;
  v_model_id  bigint;
  v_model_new boolean;
  v_model_slug text;
  v_offer_key text;
  -- Event fields, bound once from the collected jsonb so no DML statement has
  -- to resolve a `->>` on a loop variable.
  v_ev_slug         text;
  v_ev_name         text;
  v_ev_description  text;
  v_ev_status       text;
  v_ev_start        timestamptz;
  v_ev_end          timestamptz;
  v_ev_pool_size    bigint;
  v_ev_pool_left    bigint;
  v_ev_pool_text    text;
  v_ev_unit         text;
  v_ev_models       jsonb;
  v_ev_eligibility  text;
  v_ev_requirements text;
  v_ev_exhaustion   text;
  v_ev_url          text;
  v_ev_announced    timestamptz;
  v_status    offer_status;
  v_created   int := 0;
  v_updated   int := 0;
  v_unchanged int := 0;
  v_models    int := 0;
begin
  v_slug := arg->>'provider_slug';
  if v_slug is null or v_slug = '' then
    raise exception 'rpc_reconcile_sweep: provider_slug is required';
  end if;

  -- provider -----------------------------------------------------------------
  -- The collector supplies fallbacks, never overwrites.
  --
  -- A collector knows the slug and little else, so allowing it to write the
  -- name or URL would replace a researcher's curated "Kilo Gateway" and
  -- https://kilo.ai with "kilo" and https://kilo. §59 requires the primary link
  -- to be the real official URL, so a placeholder must never win. The collector
  -- may only fill in what is genuinely missing.
  insert into providers (name, slug, official_url, description, last_verified_at)
  values (
    coalesce(nullif(arg->>'name',''), v_slug),
    v_slug,
    coalesce(nullif(arg->>'official_url',''), 'https://' || v_slug),
    nullif(arg->>'description',''),
    now())
  on conflict (slug) do update
    set last_verified_at = now(),
        name         = coalesce(nullif(providers.name, ''), excluded.name),
        official_url = case
                         when providers.official_url is null
                           or providers.official_url = 'https://' || providers.slug
                         then excluded.official_url
                         else providers.official_url end,
        description  = coalesce(nullif(providers.description, ''), excluded.description)
  returning id into v_prov;

  provider_id := v_prov;

  -- offers -------------------------------------------------------------------
  for v_offer in
    select * from jsonb_array_elements(coalesce(arg->'offers', '[]'::jsonb))
  loop
    v_status := (v_offer->>'status')::offer_status;
    v_offer_key := v_slug || '::' || coalesce(nullif(v_offer->>'model_id',''),
                                             v_offer->>'model_label');

    -- model, if this route names one
    v_model_id := null;
    if nullif(v_offer->>'model_id', '') is not null then
      v_model_slug := regexp_replace(
        trim(both '-' from regexp_replace(
          lower(v_slug || '-' || (v_offer->>'model_id')), '[^a-z0-9]+', '-', 'g')),
        '^-+|-+$', '', 'g');
      insert into models (provider_id, model_id, slug, display_name, context_window)
      values (
        v_prov,
        v_offer->>'model_id',
        v_model_slug,
        coalesce(nullif(v_offer->>'model_label',''), v_offer->>'model_id'),
        nullif(v_offer->>'context_window','')::int)
      on conflict (slug) do update
        set display_name = coalesce(nullif(excluded.display_name,''), models.display_name),
            updated_at    = now()
      returning id, (xmax = 0) into v_model_id, v_model_new;
      if v_model_new then
        v_models := v_models + 1;
      end if;
    end if;

    -- Locate the prior row.
    --
    -- A stored row is identified by (provider, model_id_text), falling back to
    -- its label for offers that cover many models and have no single id. A row
    -- whose label is the model id but whose model_id_text is still null is the
    -- same route recorded before an id was known — a seed row, typically. It
    -- must be adopted rather than duplicated, or every sweep would add a second
    -- copy of everything the seed created.
    select * into v_prev
      from offers o
     where o.provider_id = v_prov
       and (
         ( nullif(v_offer->>'model_id','') is not null
           and ( o.model_id_text = v_offer->>'model_id'
              or (o.model_id_text is null and o.model_label = v_offer->>'model_id') ) )
         or
         ( nullif(v_offer->>'model_id','') is null
           and o.model_id_text is null
           and o.model_label = v_offer->>'model_label' )
       )
     order by (o.model_id_text is not null) desc, o.id
     limit 1;

    if not found then
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
        v_prov, v_model_id, v_offer->>'model_id', v_offer->>'model_label',
        (v_offer->>'offer_type')::offer_type, v_status,
        coalesce((v_offer->>'access_requires_account')::boolean, true),
        coalesce((v_offer->>'access_requires_subscription')::boolean, false),
        coalesce((v_offer->>'payment_required')::boolean, false),
        coalesce((v_offer->>'card_required')::boolean, false),
        coalesce((v_offer->>'api_key_required')::boolean, true),
        coalesce((v_offer->>'keyless')::boolean, false),
        coalesce((v_offer->>'compatibility_openai')::boolean, false),
        coalesce((v_offer->>'compatibility_anthropic')::boolean, false),
        nullif(v_offer->>'compatibility_other',''),
        nullif(v_offer->>'rpm','')::int, nullif(v_offer->>'rpd','')::int,
        nullif(v_offer->>'tpm','')::bigint, nullif(v_offer->>'tpd','')::bigint,
        nullif(v_offer->>'monthly_limit','')::bigint, nullif(v_offer->>'monthly_unit',''),
        nullif(v_offer->>'token_limit','')::bigint, nullif(v_offer->>'token_limit_unit',''),
        nullif(v_offer->>'pool_size','')::bigint, nullif(v_offer->>'pool_remaining','')::bigint,
        nullif(v_offer->>'pool_unit',''),
        nullif(v_offer->>'credit_amount','')::numeric, nullif(v_offer->>'credit_currency',''),
        nullif(v_offer->>'start_at','')::timestamptz, nullif(v_offer->>'end_at','')::timestamptz,
        coalesce(nullif(v_offer->>'verification_level','')::verification_level, 'community'),
        nullif(v_offer->>'official_evidence_url',''), nullif(v_offer->>'payload_hash',''),
        now(), now(),
        case when v_status = 'live' then now() else null end)
      returning id into v_offer_id;

      v_created := v_created + 1;

      insert into changes (
        provider_id, offer_id, change_type, field, old_value, new_value,
        detected_at, source_url, evidence, severity, dedupe_key)
      values (
        v_prov, v_offer_id, 'new', 'offer', null, v_offer->>'offer_type',
        now(), nullif(v_offer->>'official_evidence_url',''),
        'Discovered from ' || coalesce(v_offer->>'official_evidence_url', v_offer->>'source_url', 'a monitored source'),
        'info',
        encode(digest(('new|' || v_offer_key)::text, 'sha256'), 'hex'));
      continue;
    end if;

    v_offer_id := v_prev.id;

    -- §13/§16: an ended offer is not revived by a source that still reports it.
    if v_prev.status = 'ended' and v_status <> 'ended' then
      v_unchanged := v_unchanged + 1;
      continue;
    end if;

    -- §78: an identical payload is a no-op apart from freshness. This is what
    -- stops a retried sweep from writing duplicate observations or changes.
    if v_prev.payload_hash is not distinct from v_offer->>'payload_hash'
       and v_prev.payload_hash is not null then
      update offers set last_verified_at = now() where id = v_offer_id;
      v_unchanged := v_unchanged + 1;
      continue;
    end if;

    update offers o set
      model_id        = v_model_id,
      model_id_text   = nullif(v_offer->>'model_id',''),
      model_label     = v_offer->>'model_label',
      offer_type      = (v_offer->>'offer_type')::offer_type,
      status          = v_status,
      access_requires_account     = coalesce((v_offer->>'access_requires_account')::boolean, o.access_requires_account),
      access_requires_subscription= coalesce((v_offer->>'access_requires_subscription')::boolean, o.access_requires_subscription),
      payment_required            = coalesce((v_offer->>'payment_required')::boolean, o.payment_required),
      card_required               = coalesce((v_offer->>'card_required')::boolean, o.card_required),
      api_key_required            = coalesce((v_offer->>'api_key_required')::boolean, o.api_key_required),
      keyless                     = coalesce((v_offer->>'keyless')::boolean, o.keyless),
      compatibility_openai    = coalesce((v_offer->>'compatibility_openai')::boolean, o.compatibility_openai),
      compatibility_anthropic = coalesce((v_offer->>'compatibility_anthropic')::boolean, o.compatibility_anthropic),
      compatibility_other     = coalesce(nullif(v_offer->>'compatibility_other',''), o.compatibility_other),
      rpm           = nullif(v_offer->>'rpm','')::int,
      rpd           = nullif(v_offer->>'rpd','')::int,
      tpm           = nullif(v_offer->>'tpm','')::bigint,
      tpd           = nullif(v_offer->>'tpd','')::bigint,
      monthly_limit = nullif(v_offer->>'monthly_limit','')::bigint,
      monthly_unit  = coalesce(nullif(v_offer->>'monthly_unit',''), o.monthly_unit),
      token_limit   = nullif(v_offer->>'token_limit','')::bigint,
      token_limit_unit = coalesce(nullif(v_offer->>'token_limit_unit',''), o.token_limit_unit),
      pool_size     = nullif(v_offer->>'pool_size','')::bigint,
      pool_remaining= nullif(v_offer->>'pool_remaining','')::bigint,
      pool_unit     = coalesce(nullif(v_offer->>'pool_unit',''), o.pool_unit),
      credit_amount = nullif(v_offer->>'credit_amount','')::numeric,
      credit_currency = coalesce(nullif(v_offer->>'credit_currency',''), o.credit_currency),
      start_at      = nullif(v_offer->>'start_at','')::timestamptz,
      end_at        = nullif(v_offer->>'end_at','')::timestamptz,
      verification_level    = coalesce(nullif(v_offer->>'verification_level','')::verification_level, o.verification_level),
      official_evidence_url = coalesce(nullif(v_offer->>'official_evidence_url',''), o.official_evidence_url),
      payload_hash   = v_offer->>'payload_hash',
      last_verified_at  = now(),
      last_seen_live_at = case when v_status = 'live' then now() else o.last_seen_live_at end,
      -- An offer that transitions to ended gets the moment recorded, once.
      ended_at = case when v_status = 'ended' and o.ended_at is null
                      then now() else o.ended_at end
    where o.id = v_offer_id;

    v_updated := v_updated + 1;

    -- Append-only evidence for this observation (§7.5, §67).
    insert into observations (
      provider_id, offer_id, observed_at, status, token_limit,
      pool_size, pool_remaining, rpm, rpd, tpm, tpd, model_count,
      source_url, source_type, response_hash, raw_payload, verification_level)
    values (
      v_prov, v_offer_id, now(), v_status,
      nullif(v_offer->>'token_limit','')::bigint,
      nullif(v_offer->>'pool_size','')::bigint,
      nullif(v_offer->>'pool_remaining','')::bigint,
      nullif(v_offer->>'rpm','')::int, nullif(v_offer->>'rpd','')::int,
      nullif(v_offer->>'tpm','')::bigint, nullif(v_offer->>'tpd','')::bigint,
      case when nullif(v_offer->>'model_id','') is null then 0 else 1 end,
      coalesce(nullif(v_offer->>'official_evidence_url',''), v_offer->>'source_url'),
      nullif(v_offer->>'source_type',''),
      v_offer->>'payload_hash',
      v_offer,
      coalesce(nullif(v_offer->>'verification_level','')::verification_level, 'community'));

    -- Changes, deduped so a retried sweep cannot duplicate history.
    --
    -- v_change is a typed record, so its fields are read directly. Nothing here
    -- uses a jsonb accessor on a loop variable, which is what previously made
    -- this branch fail to resolve at runtime.
    for v_change in
      select * from public.rpc_offer_changes(to_jsonb(v_prev), v_offer)
    loop
      v_evidence := v_offer->'evidence';
      insert into changes (
        provider_id, offer_id, change_type, field, old_value, new_value,
        detected_at, source_url, evidence, severity, dedupe_key)
      values (
        v_prov, v_offer_id,
        v_change.change_type::change_type,
        v_change.field, v_change.old_value, v_change.new_value,
        now(),
        coalesce(nullif(v_offer->>'official_evidence_url',''), v_offer->>'source_url'),
        coalesce(
          v_evidence ->> v_change.field,
          v_offer->>'official_evidence_url'
        ),
        v_change.severity,
        encode(digest(
          (v_change.change_type || '|' || coalesce(v_change.field,'') || '|'
           || coalesce(v_change.old_value,'') || '|'
           || coalesce(v_change.new_value,'') || '|' || v_offer_key)::text,
          'sha256'), 'hex'))
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
    end loop;
  end loop;

  -- events -------------------------------------------------------------------
  --
  -- Every field is read out of the collected jsonb once, into an explicitly
  -- typed variable, and the statements below use only those variables. The
  -- accessors are kept out of the DML on purpose: inside plpgsql a `->>` on a
  -- loop variable does not always resolve to the jsonb operator, and it fails
  -- at runtime with "operator does not exist: text ->> unknown". Binding first
  -- makes every type explicit, so there is nothing left to infer.
  for v_event in
    select * from jsonb_array_elements(coalesce(arg->'events', '[]'::jsonb))
  loop
    v_ev_slug        := nullif(v_event->>'slug', '');
    v_ev_name        := v_event->>'name';
    v_ev_description := v_event->>'description';
    v_ev_status      := nullif(v_event->>'status', '');
    v_ev_start       := nullif(v_event->>'start_at', '')::timestamptz;
    v_ev_end         := nullif(v_event->>'end_at', '')::timestamptz;
    v_ev_pool_size   := nullif(v_event->>'pool_size', '')::bigint;
    v_ev_pool_left   := nullif(v_event->>'pool_remaining', '')::bigint;
    v_ev_pool_text   := v_event->>'pool_remaining';
    v_ev_unit        := coalesce(nullif(v_event->>'unit', ''), 'tokens');
    v_ev_models      := coalesce(v_event->'models', '[]'::jsonb);
    v_ev_eligibility := v_event->>'eligibility';
    v_ev_requirements:= v_event->>'requirements';
    v_ev_exhaustion  := v_event->>'exhaustion_condition';
    v_ev_url         := v_event->>'official_url';
    v_ev_announced   := nullif(v_event->>'announced_at', '')::timestamptz;

    if v_ev_slug is null or v_ev_status is null then
      continue;
    end if;

    select * into v_prev_event
      from events e where e.slug = v_ev_slug limit 1;

    -- Pool movement on an event is worth recording even though the event itself
    -- is not an offer: a draining shared pool is the single most useful signal
    -- the product produces.
    if found
       and v_prev_event.pool_remaining is not null
       and v_ev_pool_left is not null
       and v_prev_event.pool_remaining is distinct from v_ev_pool_left then
      insert into changes (
        provider_id, event_id, change_type, field, old_value, new_value,
        detected_at, source_url, evidence, severity, dedupe_key)
      values (
        v_prov, v_prev_event.id,
        case when v_ev_pool_left < v_prev_event.pool_remaining
             then 'quota_decreased' else 'quota_increased' end::change_type,
        'pool_remaining',
        v_prev_event.pool_remaining::text, v_ev_pool_text,
        now(), v_ev_url,
        'Pool ' || v_ev_unit || ' read from ' || coalesce(v_ev_url, 'source'),
        'info',
        encode(digest(
          ('pool|' || v_ev_slug || '|'
           || v_prev_event.pool_remaining::text || '|'
           || v_ev_pool_text)::text, 'sha256'), 'hex'))
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
    end if;

    if found and v_prev_event.status::text is distinct from v_ev_status then
      insert into changes (
        provider_id, event_id, change_type, field, old_value, new_value,
        detected_at, source_url, evidence, severity, dedupe_key)
      values (
        v_prov, v_prev_event.id, 'status_changed', 'event_status',
        v_prev_event.status::text, v_ev_status,
        now(), v_ev_url,
        'Event state read from ' || coalesce(v_ev_url, 'source'),
        'warning',
        encode(digest(
          ('evstatus|' || v_ev_slug || '|' || v_prev_event.status::text
           || '|' || v_ev_status)::text, 'sha256'), 'hex'))
      on conflict (dedupe_key) where dedupe_key is not null do nothing;
    end if;

    insert into events (
      provider_id, name, slug, description, status, start_at, end_at,
      pool_size, pool_remaining, unit, models, eligibility, requirements,
      exhaustion_condition, official_url, announced_at, last_verified_at)
    values (
      v_prov, v_ev_name, v_ev_slug, v_ev_description,
      v_ev_status::event_status,
      v_ev_start, v_ev_end,
      v_ev_pool_size, v_ev_pool_left,
      v_ev_unit,
      coalesce((select array_agg(value::text) from jsonb_array_elements_text(
        v_ev_models)), '{}'),
      v_ev_eligibility, v_ev_requirements,
      v_ev_exhaustion, v_ev_url,
      coalesce(v_ev_announced, now()), now())
    on conflict (slug) do update set
      status          = excluded.status,
      start_at        = excluded.start_at,
      end_at          = excluded.end_at,
      pool_size       = excluded.pool_size,
      pool_remaining  = excluded.pool_remaining,
      description     = coalesce(nullif(excluded.description,''), events.description),
      models          = excluded.models,
      eligibility     = coalesce(nullif(excluded.eligibility,''), events.eligibility),
      requirements    = coalesce(nullif(excluded.requirements,''), events.requirements),
      exhaustion_condition = coalesce(nullif(excluded.exhaustion_condition,''), events.exhaustion_condition),
      last_verified_at= now();
  end loop;

  -- provider rollup ----------------------------------------------------------
  if (arg ? 'free_model_count') and nullif(arg->>'free_model_count','') is not null then
    update providers
       set free_model_count = (arg->>'free_model_count')::int
     where id = v_prov;
  end if;

  offers_created   := v_created;
  offers_updated   := v_updated;
  offers_unchanged := v_unchanged;
  models_created   := v_models;
  return next;
end $$;

comment on function public.rpc_reconcile_sweep(jsonb) is
  'Reconciles one provider''s collected result in a single call: models, offers, observations, events and changes. Returns per-provider counts.';

-- The per-entity procedures are superseded by rpc_reconcile_sweep. They are
-- dropped rather than left reachable so there is exactly one write path into
-- the offers table.
drop function if exists public.rpc_select_offer(jsonb);
drop function if exists public.rpc_insert_offer(jsonb);
drop function if exists public.rpc_update_offer(jsonb);
drop function if exists public.rpc_select_event(jsonb);
drop function if exists public.rpc_upsert_event(jsonb);
drop function if exists public.rpc_upsert_model(jsonb);
drop function if exists public.rpc_upsert_provider(jsonb);
drop function if exists public.rpc_record_change(jsonb);
drop function if exists public.rpc_touch_provider(jsonb);
drop function if exists public.rpc_insert_observation(jsonb);

-- Lock the reconciliation path down to the service role.
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
