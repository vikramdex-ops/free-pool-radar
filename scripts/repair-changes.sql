-- Repairs the change log after an over-aggressive dedupe deleted legitimate
-- per-offer discovery rows.
--
-- The offers table is the source of truth for what exists and when it first
-- appeared, so the missing "new" rows are reconstructed from
-- first_discovered_at. Nothing is invented: every value here is already stored
-- on the offer the change refers to.
--
-- The dedupe_key is the same expression the sweep uses, so a repaired row is
-- indistinguishable from the original and a later sweep will not duplicate it.

insert into changes (
  provider_id, offer_id, change_type, field, old_value, new_value,
  detected_at, source_url, evidence, severity, dedupe_key)
select o.provider_id,
       o.id,
       'new',
       'offer',
       null,
       o.offer_type::text,
       coalesce(o.first_discovered_at, o.first_verified_at, o.created_at),
       o.official_evidence_url,
       'Discovered from ' || coalesce(o.official_evidence_url, 'a monitored source'),
       'info',
       encode(
         digest(
           'new|' || p.slug || '::' || coalesce(o.model_id_text, o.model_label),
           'sha256'),
         'hex')
from offers o
join providers p on p.id = o.provider_id
where not exists (
        select 1 from changes c
         where c.offer_id = o.id
           and c.change_type = 'new'
      )
on conflict (dedupe_key) where dedupe_key is not null do nothing;
