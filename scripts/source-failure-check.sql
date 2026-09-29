select p.slug, o.status::text, count(*) as offers, o.ended_at::text
from offers o join providers p on p.id=o.provider_id
where p.slug='freetheai'
group by p.slug, o.status, o.ended_at;
