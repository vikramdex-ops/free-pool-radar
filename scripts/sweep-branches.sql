-- Regression probe for the sweep's reconciliation branches.
--
-- Why this exists
-- ---------------
-- A sweep takes one of three paths per offer: insert, update, or skip. The skip
-- is a payload-hash comparison, so when nothing has changed — which is almost
-- every sweep — the update and change-detection branches never execute.
--
-- That is how a type error lived in the change-detection code through many
-- green runs. It only surfaced when a real source started reporting different
-- numbers, and it surfaced as an opaque "operator does not exist: text ->>"
-- with no indication of which statement it came from.
--
-- This probe forces every branch deliberately, so a change to the reconcile
-- function cannot break one of them unnoticed again. It rolls back, so it
-- leaves no data behind.
--
-- Run with:  npx supabase db query --linked --file scripts/sweep-branches.sql

begin;

-- 1. A changed offer: forces the update, observation and change-detection path,
--    including the per-field evidence lookup that previously failed to resolve.
create temporary table probe_target as
select o.id
  from providers p join offers o on o.provider_id = p.id
 where p.slug = 'kilo' and o.status = 'live'
 order by o.id
 limit 1;

select public.rpc_reconcile_sweep(
  jsonb_build_array(
    jsonb_build_object(
      'provider_slug', 'kilo',
      'offers', (
        select jsonb_build_array(jsonb_build_object(
          'model_id', o.model_id_text,
          'model_label', o.model_label,
          'offer_type', o.offer_type,
          'status', o.status,
          'card_required', not o.card_required,
          'api_key_required', o.api_key_required,
          'keyless', o.keyless,
          'compatibility_openai', o.compatibility_openai,
          'rpm', o.rpm, 'rpd', o.rpd,
          'verification_level', o.verification_level,
          'official_evidence_url', o.official_evidence_url,
          'source_url', o.official_evidence_url,
          'source_type', 'json',
          'evidence', jsonb_build_object('card_required', o.official_evidence_url),
          'payload_hash', 'probe-branch-hash'
        ))
        from offers o where o.id = (select id from probe_target)),
      'events', '[]'::jsonb
    )
  )
);

-- 2. The same payload again: must be a complete no-op. This is the idempotency
--    guarantee, checked here rather than only in production.
select public.rpc_reconcile_sweep(
  jsonb_build_array(
    jsonb_build_object(
      'provider_slug', 'kilo',
      'offers', (
        select jsonb_build_array(jsonb_build_object(
          'model_id', o.model_id_text,
          'model_label', o.model_label,
          'offer_type', o.offer_type,
          'status', o.status,
          'card_required', not o.card_required,
          'api_key_required', o.api_key_required,
          'keyless', o.keyless,
          'compatibility_openai', o.compatibility_openai,
          'rpm', o.rpm, 'rpd', o.rpd,
          'verification_level', o.verification_level,
          'official_evidence_url', o.official_evidence_url,
          'source_url', o.official_evidence_url,
          'source_type', 'json',
          'evidence', jsonb_build_object('card_required', o.official_evidence_url),
          'payload_hash', 'probe-branch-hash'
        ))
        from offers o where o.id = (select id from probe_target)),
      'events', '[]'::jsonb
    )
  )
);

-- 3. An event whose pool moved, alongside the changed offer. Both branches in
--    one call, which is the combination that failed.
select public.rpc_reconcile_sweep(
  jsonb_build_array(
    jsonb_build_object(
      'provider_slug', 'sponsored-tokens',
      'offers', '[]'::jsonb,
      'events', jsonb_build_array(jsonb_build_object(
        'slug', 'sponsored-tokens-public-pool',
        'name', 'Public sponsor pool',
        'status', 'live',
        'start_at', null,
        'pool_size', 37000000,
        'pool_remaining', 37000000,
        'unit', 'dollars',
        'models', '[]'::jsonb,
        'official_url', 'https://sponsoredtokens.com/sponsors'
      ))
    )
  )
);

-- 4. The offer must not be revived once ended, even though step 1's payload
--    still reports it as live.
update offers set status = 'ended', ended_at = now()
 where id = (select id from probe_target);

select public.rpc_reconcile_sweep(
  jsonb_build_array(
    jsonb_build_object(
      'provider_slug', 'kilo',
      'offers', (
        select jsonb_build_array(jsonb_build_object(
          'model_id', o.model_id_text,
          'model_label', o.model_label,
          'offer_type', o.offer_type,
          'status', 'live',
          'card_required', not o.card_required,
          'api_key_required', o.api_key_required,
          'keyless', o.keyless,
          'compatibility_openai', o.compatibility_openai,
          'verification_level', o.verification_level,
          'official_evidence_url', o.official_evidence_url,
          'payload_hash', 'probe-branch-hash-2'
        ))
        from offers o where o.id = (select id from probe_target)),
      'events', '[]'::jsonb
    )
  )
);

-- The result. Every branch above must have executed without raising, and the
-- offer must still read as ended.
select o.status::text                                   as final_status,
       (o.status = 'ended')                            as not_revived,
       (select count(*) from changes c
         where c.offer_id = o.id and c.change_type = 'new')  as new_changes,
       (select count(*) from observations x
         where x.offer_id = o.id)                      as observations,
       (select count(*) from changes c
         where c.offer_id = o.id and c.change_type = 'card_required') as card_changes
from offers o
where o.id = (select id from probe_target);

rollback;
