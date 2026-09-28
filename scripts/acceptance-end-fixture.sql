-- Test 4: mark the fixture offer ended.
--
-- Proves two things at once: that an ended offer leaves LIVE and appears in
-- ENDED with its history intact, and that both are visible on the site without
-- any redeployment.

update offers o
   set status = 'ended',
       ended_at = now(),
       last_verified_at = now()
  from providers p
 where o.provider_id = p.id
   and p.slug = 'zz-acceptance-fixture'
   and o.status <> 'ended';

insert into changes (provider_id, offer_id, change_type, field, old_value, new_value,
                     detected_at, source_url, evidence, severity)
select p.id, o.id, 'free_tier_ended', 'status', 'live', 'ended',
       now(), 'https://example.invalid/evidence',
       'Acceptance test: free tier withdrawn.', 'critical'
from providers p join offers o on o.provider_id = p.id
where p.slug = 'zz-acceptance-fixture' and o.status = 'ended'
  and not exists (
    select 1 from changes c where c.offer_id = o.id and c.change_type = 'free_tier_ended'
  );
