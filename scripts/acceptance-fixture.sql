-- Acceptance test fixture.
--
-- Creates a synthetic provider and offer so the lifecycle can be proven
-- end to end without touching real data. It is clearly named, and the cleanup
-- script removes it along with the change rows the test produced.
--
-- Removing this afterwards is not a violation of the append-only rule: these
-- rows never described a real provider, so retaining them would put a fiction
-- into the public history.

insert into providers (name, slug, official_url, description, provider_type, country, status)
values ('Acceptance Test Fixture', 'zz-acceptance-fixture', 'https://example.invalid',
        'Synthetic provider used to verify the change lifecycle. Not a real offer.',
        'test', null, 'active')
on conflict (slug) do update set description = excluded.description;

insert into offers (
  provider_id, model_id_text, model_label, offer_type, status,
  card_required, api_key_required, compatibility_openai,
  rpd, official_evidence_url, verification_level, confidence,
  first_verified_at, last_verified_at, last_seen_live_at)
select id, 'test-model-v1', 'test-model-v1', 'free_tier', 'live',
       false, true, true,
       100, 'https://example.invalid/evidence', 'official_docs', 1.0,
       now(), now(), now()
from providers where slug = 'zz-acceptance-fixture'
on conflict (provider_id, (coalesce(model_id_text, model_label))) do nothing;

-- A quota change, so the change detector has something to report.
insert into changes (provider_id, offer_id, change_type, field, old_value, new_value,
                     detected_at, source_url, evidence, severity)
select p.id, o.id, 'quota_decreased', 'rpd', '250', '100',
       now(), 'https://example.invalid/evidence',
       'Acceptance test: quota reduced from 250 to 100 requests per day.',
       'warning'
from providers p join offers o on o.provider_id = p.id
where p.slug = 'zz-acceptance-fixture' and o.model_id_text = 'test-model-v1'
  and not exists (
    select 1 from changes c
     where c.offer_id = o.id and c.field = 'rpd' and c.new_value = '100'
  );
