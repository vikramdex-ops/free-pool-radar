-- What the database believes about freetheai.health, and whether the offers
-- attached to it are being re-verified or ageing in place.
--
-- The distinction matters more than usual. A source that is *down* means its
-- offers keep their last verified values and go stale on their own. A source
-- whose *domain no longer exists* is a different thing, and the product must
-- not quietly present researched data as though it were still being observed.

select
  p.name                as provider,
  p.slug,
  p.status              as provider_status,
  s.url                 as source_url,
  s.health,
  s.last_status_code,
  s.last_ok_at,
  s.last_error,
  count(o.id)                                        as offers,
  count(*) filter (where o.is_seed_data)             as from_research,
  count(*) filter (where not o.is_seed_data)         as from_collector,
  max(o.last_verified_at)                            as last_verified,
  min(o.last_verified_at)                            as oldest_verified,
  count(*) filter (where o.status = 'ended')         as ended
from providers p
left join sources s on s.provider_slug = p.slug
left join offers  o on o.provider_id = p.id
where lower(p.name) like '%freetheai%'
   or lower(p.slug) like '%freetheai%'
   or lower(coalesce(s.url, '')) like '%freetheai%'
group by p.name, p.slug, p.status, s.url, s.health,
         s.last_status_code, s.last_ok_at, s.last_error;

-- The same question across every source, so one dead domain is visible as a
-- pattern rather than as an isolated incident.
select
  s.provider_slug,
  s.health,
  coalesce(s.last_status_code::text, '-') as code,
  s.last_ok_at,
  left(coalesce(s.last_error, ''), 60)    as error
from sources s
where s.health <> 'live'
order by s.provider_slug;
